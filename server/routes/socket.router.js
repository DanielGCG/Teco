const { User, UserSession } = require('../models');
const { createNotification } = require('../api/notifications');

// ==================== Socket.IO Event Handlers ====================

// Mantém Set de usuários online (userId -> Set de socketIds)
const onlineUsers = new Map();

// Rastreia última atividade de cada usuário (userId -> timestamp)
const userLastActivity = new Map();

// Rastreia última emissão de status para evitar spam (userId -> timestamp)
const lastStatusEmission = new Map();

// Rastreia timeouts de desconexão pendentes (userId -> timeoutId)
const disconnectionTimeouts = new Map();

// Função para obter status do usuário baseado em atividade
function getUserStatus(userId) {
    // Se não está no Map de usuários online, está offline
    if (!onlineUsers.has(userId) || onlineUsers.get(userId).size === 0) {
        return 'offline';
    }
    
    // Usuário está conectado, verifica última atividade
    const lastActivity = userLastActivity.get(userId);
    if (!lastActivity) return 'online'; // Se não tem registro, acabou de conectar
    
    const inactiveMinutes = (Date.now() - lastActivity) / (1000 * 60);
    
    // Mesmo com inatividade, se está conectado, não pode ser offline
    // No máximo pode ser "ausente"
    if (inactiveMinutes >= 5) return 'ausente';  // 5+ minutos = ausente
    return 'online';                              // < 5 minutos = online
}

// Função helper para verificar se usuário está online (qualquer estado)
function isUserOnline(userId) {
    return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

// Atualiza atividade do usuário
function updateUserActivity(userId) {
    userLastActivity.set(userId, Date.now());
}

// Emite mudança de status com debounce (evita múltiplas emissões rápidas)
async function emitStatusChange(io, userId, publicid, status) {
    const now = Date.now();
    const lastEmission = lastStatusEmission.get(userId) || 0;
    
    // Se não temos o publicid, tentamos buscar no banco (fallback)
    if (!publicid) {
        const user = await User.findByPk(userId, { attributes: ['publicid'] });
        if (user) publicid = user.publicid;
    }

    if (!publicid) return false;

    // Só emite se passou mais de 10 segundos desde a última emissão
    // OU se está mudando para offline (desconexão é imediata)
    if (status === 'offline' || (now - lastEmission) > 10000) {
        io.emit('userStatusChanged', { userId: publicid, status });
        lastStatusEmission.set(userId, now);
        return true;
    }
    return false;
}

// Exporta função helper
module.exports.isUserOnline = isUserOnline;
module.exports.getUserStatus = getUserStatus;

module.exports = (io) => {
    // Timer para verificar mudanças de status por inatividade
    const statusCheckInterval = setInterval(async () => {
        const now = Date.now();
        const { User } = require('../models');

        for (const [userId, sockets] of onlineUsers.entries()) {
            if (sockets.size > 0) {
                const lastActivity = userLastActivity.get(userId);
                if (lastActivity) {
                    const previousStatus = getUserStatus(userId);
                    const inactiveMinutes = (now - lastActivity) / (1000 * 60);
                    
                    let newStatus = 'online';
                    if (inactiveMinutes >= 5) {
                        newStatus = 'ausente'; // Usuário conectado mas inativo
                    }
                    
                    // Notifica se o status mudou
                    if (previousStatus !== newStatus) {
                        const user = await User.findByPk(userId, { attributes: ['publicid'] });
                        if (user) {
                            emitStatusChange(io, userId, user.publicid, newStatus);
                            console.log('[Socket] Status do usuário', userId, 'mudou de', previousStatus, 'para', newStatus, '(inativo há', Math.round(inactiveMinutes), 'min)');
                        }
                    }
                }
            }
        }
    }, 60000); // Verifica a cada 60 segundos

    io.on('connection', (socket) => {
        console.log('[Socket.IO] Cliente conectado:', socket.id);

        // ==================== Autenticação ====================
        async function authenticateSocket(socket) {
            const cookies = socket.handshake.headers.cookie;
            if (!cookies) return null;

            const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('session='));
            if (!sessionCookie) return null;

            const cookieValue = sessionCookie.split('=')[1];

            try {
                const { Op } = require('sequelize');
                const session = await UserSession.findOne({
                    where: {
                        cookie: cookieValue,
                        expiresat: { [Op.gt]: new Date() }
                    },
                    include: [{ model: User, attributes: ['id', 'publicid'] }]
                });

                if (!session || !session.User) return null;
                return { userId: session.User.id, publicid: session.User.publicid };
            } catch (err) {
                throw err;
            }
        }

        // Helper para buscar ID real de um Chat ou DM a partir do publicid
        async function resolveChatId(publicid, type = 'chat') {
            const { Chat, DM } = require('../models');
            if (type === 'dm') {
                const dm = await DM.findOne({ where: { publicid }, attributes: ['id'] });
                return dm ? dm.id : null;
            } else {
                const chat = await Chat.findOne({ where: { publicid }, attributes: ['id'] });
                return chat ? chat.id : null;
            }
        }

        // ==================== Join Chat ====================
        socket.on('joinChat', async (publicChatId) => {
            try {
                // Atualiza atividade do usuário ao entrar no chat
                if (socket.userId) {
                    updateUserActivity(socket.userId);
                    const newStatus = getUserStatus(socket.userId);
                    
                    // Emite status com debounce
                    emitStatusChange(io, socket.userId, socket.publicid, newStatus);
                }
                
                socket.join(`chat_${publicChatId}`);
                socket.emit('joinedChat', { chatId: publicChatId, success: true });
                console.log('[Socket] Cliente entrou no chat:', publicChatId);
            } catch (err) {
                console.error('[Socket] Erro ao entrar no chat:', err);
                socket.emit('error', { message: 'Erro ao entrar no chat' });
            }
        });

        // ==================== Join Profile ====================
        socket.on('joinProfile', async (username) => {
            try {
                // Limpa salas de perfil anteriores para este socket (comportamento exclusivo para página de perfil)
                const rooms = Array.from(socket.rooms);
                rooms.forEach(room => {
                    if (room.startsWith('profile_')) {
                        socket.leave(room);
                    }
                });

                socket.join(`profile_${username}`);

                // Enviar status atual do dono do perfil para quem entrou
                const { User } = require('../models');
                const user = await User.findOne({ where: { username }, attributes: ['id', 'publicid'] });
                if (user) {
                    const status = getUserStatus(user.id);
                    socket.emit('userStatusChanged', { userId: user.publicid, status });
                }
            } catch (err) {
                console.error('[Socket] Erro ao entrar no perfil:', err);
            }
        });

        // ==================== Join Followed (Feed) ====================
        socket.on('joinFollowed', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { Follow, User } = require('../models');
                const following = await Follow.findAll({
                    where: { followerUserId: auth.userId },
                    include: [{ model: User, as: 'followed', attributes: ['username'] }]
                });

                following.forEach(f => {
                    if (f.followed && f.followed.username) {
                        socket.join(`profile_${f.followed.username}`);
                    }
                });
                
                // Também entra na sala do próprio perfil para ver seus próprios posts novos no feed
                const me = await User.findByPk(auth.userId, { attributes: ['username'] });
                if (me) socket.join(`profile_${me.username}`);

                console.log(`[Socket] Usuário ${auth.userId} ouvindo atualizações de ${following.length} seguidos`);
            } catch (err) {
                console.error('[Socket] Erro ao entrar em salas de seguidos:', err);
            }
        });

        // ==================== Load Posts ====================
        socket.on('loadPosts', async ({ username, tab = 'posts' }) => {
            try {
                const { Post, User, PostMedia, PostLike, PostBookmark, PostMention } = require('../models');
                const { Op } = require('sequelize');

                const user = await User.findOne({ where: { username } });
                if (!user) {
                    socket.emit('error', { message: 'Usuário não encontrado' });
                    return;
                }

                const POST_INCLUDES = [
                    { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns'] },
                    { model: PostMedia, as: 'media' },
                    { model: PostLike, as: 'likes', include: [{ model: User, as: 'user', attributes: ['username'] }] },
                    { model: PostBookmark, as: 'bookmarks', attributes: ['userId'] },
                    { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] },
                    { 
                        model: Post, 
                        as: 'parent', 
                        include: [
                            { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns'] },
                            { model: PostMedia, as: 'media' },
                            { model: PostMention, as: 'mentions', include: [{ model: User, as: 'user', attributes: ['username'] }] },
                            {
                                model: Post,
                                as: 'parent',
                                include: [
                                    { model: User, as: 'author', attributes: ['username', 'profileimage', 'pronouns'] }
                                ]
                            }
                        ] 
                    }
                ];

                let posts = [];
                if (tab === 'posts') {
                    posts = await Post.findAll({
                        where: { 
                            authorUserId: user.id, 
                            type: { [Op.ne]: 'comment' }
                        },
                        include: POST_INCLUDES,
                        order: [['createdat', 'DESC']]
                    });
                } else if (tab === 'bookmarks') {
                    const bookmarks = await PostBookmark.findAll({
                        where: { userId: user.id },
                        include: [{
                            model: Post,
                            required: true,
                            include: POST_INCLUDES
                        }],
                        order: [['createdat', 'DESC']]
                    });
                    posts = bookmarks.map(b => b.Post);
                }

                socket.emit('postsLoaded', { posts, tab });
            } catch (err) {
                console.error('[Socket] Erro ao carregar posts:', err);
                socket.emit('error', { message: 'Erro ao carregar posts' });
            }
        });

        // ==================== Send Message ====================
        socket.on('sendMessage', async ({ chatId: publicChatId, mensagem, type = 'chat' }) => {
            try {
                console.log(`[Socket] Mensagem recebida de ${socket.id}:`, { publicChatId, type });
                
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId } = auth;
                const { Chat, ChatMessage, DM, DMMessage, User } = require('../models');
                const { Op } = require('sequelize');

                // Resolve o ID real
                const realChatId = await resolveChatId(publicChatId, type);
                if (!realChatId) {
                    socket.emit('error', { message: 'Chat não encontrado' });
                    return;
                }

                // Atualiza atividade do usuário
                updateUserActivity(userId);

                let newMessage;
                let messageWithUser;

                if (type === 'dm') {
                    // Insere mensagem no banco (DM)
                    newMessage = await DMMessage.create({
                        dmId: realChatId,
                        userId: userId,
                        message: mensagem
                    });

                    // Busca mensagem completa com usuário
                    messageWithUser = await DMMessage.findByPk(newMessage.id, {
                        include: [{
                            model: User,
                            as: 'Sender',
                            attributes: ['username', 'publicid']
                        }],
                        attributes: ['publicid', 'message', 'userId', 'createdat']
                    });

                    // Emite para ambos no chat (usa o publicChatId para a sala e resposta)
                    io.to(`chat_${publicChatId}`).emit('newMessage', {
                        chatId: publicChatId,
                        type: 'dm',
                        message: {
                            id: messageWithUser.publicid,
                            message: messageWithUser.message,
                            username: messageWithUser.Sender.username,
                            userId: messageWithUser.Sender.publicid, // Usa publicid do sender
                            createdat: messageWithUser.createdat
                        }
                    });

                    // Notificações para o destinatário da DM
                    try {
                        const dm = await DM.findByPk(realChatId);
                        if (dm) {
                            const otherUserId = dm.userId1 === userId ? dm.userId2 : dm.userId1;
                            
                            // Verifica se o usuário está na sala do chat (online no chat)
                            const socketsInRoom = await io.in(`chat_${publicChatId}`).fetchSockets();
                            
                            // Se não está no chat, cria ou atualiza notificação
                            if (socketsInRoom.length <= 1) {
                                const { Notification } = require('../models');
                                
                                const existingNotif = await Notification.findOne({
                                    where: {
                                        targetUserId: otherUserId,
                                        type: 'dm',
                                        readat: null
                                    },
                                    order: [['createdat', 'DESC']]
                                });

                                let isFromSameChat = false;
                                if (existingNotif && existingNotif.data) {
                                    try {
                                        const notifData = JSON.parse(existingNotif.data);
                                        isFromSameChat = notifData.chatId === publicChatId;
                                    } catch (e) {
                                        isFromSameChat = false;
                                    }
                                }

                                if (existingNotif && isFromSameChat) {
                                    const currentBody = existingNotif.body;
                                    const match = currentBody.match(/\((\d+) mensagens?\)/);
                                    const currentCount = match ? parseInt(match[1]) : 1;
                                    const newCount = currentCount + 1;
                                    
                                    await existingNotif.update({
                                        body: `${messageWithUser.Sender.username} (${newCount} mensagens)`,
                                        createdat: new Date()
                                    });
                                } else {
                                    await Notification.create({
                                        targetUserId: otherUserId,
                                        type: 'dm',
                                        title: `Nova mensagem de ${messageWithUser.Sender.username}`,
                                        body: mensagem.substring(0, 100) + (mensagem.length > 100 ? '...' : ''),
                                        link: '/dms',
                                        data: JSON.stringify({ chatId: publicChatId, senderId: auth.publicid })
                                    });
                                }
                                
                                io.to(`user_${otherUserId}`).emit('newNotification', { type: 'message' });
                                io.to(`user_${otherUserId}`).emit('newMessage');
                            }
                        }
                    } catch (notifErr) {
                        console.error('[Socket] Erro ao criar notificação:', notifErr);
                    }
                } else {
                    // Mensagem para Chat Público / Tópico
                    newMessage = await ChatMessage.create({
                        chatId: realChatId,
                        userId: userId,
                        message: mensagem
                    });

                    messageWithUser = await ChatMessage.findByPk(newMessage.id, {
                        include: [{
                            model: User,
                            as: 'author',
                            attributes: ['username', 'publicid']
                        }],
                        attributes: ['publicid', 'message', 'userId', 'createdat']
                    });

                    io.to(`chat_${publicChatId}`).emit('newMessage', {
                        chatId: publicChatId,
                        type: 'chat',
                        message: {
                            id: messageWithUser.publicid,
                            message: messageWithUser.message,
                            username: messageWithUser.author.username,
                            userId: messageWithUser.author.publicid, // Usa publicid do autor
                            createdat: messageWithUser.createdat
                        }
                    });
                }

                console.log('[Socket] Mensagem enviada para', type, publicChatId);
            } catch (err) {
                console.error('[Socket] Erro ao enviar mensagem:', err);
                socket.emit('error', { message: 'Erro ao enviar mensagem' });
            }
        });

        // ==================== Mark As Read ====================
        socket.on('markAsRead', async ({ chatId: publicChatId }) => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId, publicid } = auth;
                const { DMMessage, DM } = require('../models');
                const { Op } = require('sequelize');

                // Resolve o id real
                const realChatId = await resolveChatId(publicChatId, 'dm');
                if (!realChatId) return;

                // Atualiza atividade do usuário
                updateUserActivity(userId);

                // Apenas DMs devem suportar marcação de mensagens como lidas
                const dm = await DM.findByPk(realChatId);
                if (!dm) {
                    // Ignora se não for uma DM válida
                    return;
                }

                // Marca todas as mensagens recebidas como lidas
                await DMMessage.update(
                    { isread: true },
                    {
                        where: {
                            dmId: realChatId,
                            userId: { [Op.ne]: userId },
                            isread: false
                        }
                    }
                );

                // Notifica todos no chat sobre a atualização de leitura (usa publicChatId para sala)
                io.to(`chat_${publicChatId}`).emit('messageRead', {
                    chatId: publicChatId,
                    userId: publicid // Usa publicid
                });
                
                // Atualiza contagem de DMs não lidas para o usuário que leu
                socket.emit('messageRead');
            } catch (err) {
                console.error('[Socket] Erro ao marcar mensagens como lidas:', err);
                socket.emit('error', { message: 'Erro ao marcar mensagens' });
            }
        });

        // ==================== Join User Room ====================
        socket.on('joinUserRoom', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId, publicid } = auth;
                
                // Atualiza lastaccess no banco
                await User.update(
                    { lastaccess: new Date() },
                    { where: { id: userId } }
                );

                socket.join(`user_${userId}`);
                
                // Verifica se o usuário já estava online (reconexão vs nova conexão)
                const wasOnline = onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
                
                // Se estava com desconexão pendente, cancela (reconexão rápida)
                if (disconnectionTimeouts.has(userId)) {
                    clearTimeout(disconnectionTimeouts.get(userId));
                    disconnectionTimeouts.delete(userId);
                    console.log('[Socket] Desconexão pendente cancelada para usuário', userId);
                }
                
                // Adiciona ao Set de usuários online
                if (!onlineUsers.has(userId)) {
                    onlineUsers.set(userId, new Set());
                }
                onlineUsers.get(userId).add(socket.id);
                
                // Registra atividade inicial
                updateUserActivity(userId);
                
                // Associa IDs ao socket para usar no disconnect e outros eventos
                socket.userId = userId;
                socket.publicid = publicid;
                
                console.log('[Socket] Usuário', userId, wasOnline ? 'reconectou' : 'conectou', '| Online:', onlineUsers.size);
                
                // Só notifica se é uma NOVA conexão (não estava online antes)
                if (!wasOnline) {
                    emitStatusChange(io, userId, publicid, 'online');
                    lastStatusEmission.set(userId, Date.now());
                }
            } catch (err) {
                console.error('[Socket] Erro ao entrar na sala:', err);
            }
        });

        // ==================== User Activity ====================
        socket.on('userActivity', () => {
            if (socket.userId && socket.publicid) {
                const previousStatus = getUserStatus(socket.userId);
                updateUserActivity(socket.userId);
                const newStatus = getUserStatus(socket.userId);
                
                // Só emite se mudou de ausente para online (com debounce)
                if (previousStatus === 'ausente' && newStatus === 'online') {
                    if (emitStatusChange(io, socket.userId, socket.publicid, 'online')) {
                        console.log('[Socket] Usuário', socket.userId, 'voltou a ficar online');
                    }
                }
            }
        });

        // ==================== Request User Status ====================
        socket.on('requestUserStatus', async ({ userIds: publicIds }) => {
            if (!publicIds || !Array.isArray(publicIds)) return;
            
            const statusMap = {};
            const { User } = require('../models');

            for (const publicid of publicIds) {
                const user = await User.findOne({ where: { publicid }, attributes: ['id'] });
                if (user) {
                    statusMap[publicid] = getUserStatus(user.id);
                }
            }
            
            socket.emit('userStatusBatch', statusMap);
        });

        // ==================== Get Unread DMs Count ====================
        socket.on('getUnreadDMsCount', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId } = auth;
                const { DM, DMMessage } = require('../models');
                const { Op } = require('sequelize');

                // Buscar chats DM do usuário
                const userDMs = await DM.findAll({
                    where: {
                        [Op.or]: [
                            { userId1: userId },
                            { userId2: userId }
                        ]
                    },
                    attributes: ['id']
                });

                const dmIds = userDMs.map(d => d.id);
                
                // Contar quantas DMs têm pelo menos uma mensagem não lida enviada pelo outro
                const counts = await DMMessage.count({
                    where: {
                        dmId: { [Op.in]: dmIds },
                        userId: { [Op.ne]: userId },
                        isread: false
                    },
                    group: ['dmId']
                });

                const unreadCount = counts.length;

                socket.emit('unreadDMsCount', { count: unreadCount });
            } catch (err) {
                console.error('[Socket] Erro ao buscar DMs não lidas:', err);
            }
        });

        // ==================== Get Notifications Count ====================
        socket.on('getNotificationsCount', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId } = auth;
                const { Notification } = require('../models');

                const count = await Notification.count({
                    where: {
                        targetUserId: userId,
                        readat: null
                    }
                });

                socket.emit('notificationsCount', { count });
            } catch (err) {
                console.error('[Socket] Erro ao buscar notificações:', err);
            }
        });

        // ==================== Get Messages ====================
        socket.on('getMessages', async ({ chatId: publicChatId, page = 1, type = 'chat' }) => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return socket.emit('error', { message: 'Não autenticado' });

                const { userId } = auth;
                const { Chat, ChatMessage, DM, DMMessage, User } = require('../models');
                const { Op } = require('sequelize');

                // Resolve o id real para busca
                const realChatId = await resolveChatId(publicChatId, type);
                if (!realChatId) return socket.emit('error', { message: 'Chat não encontrado' });

                const limit = 50;
                const offset = (page - 1) * limit;

                let messages = [];
                let hasMore = false;

                if (type === 'dm') {
                    // Verifica se o usuário faz parte da DM
                    const dm = await DM.findOne({
                        where: {
                            id: realChatId,
                            [Op.or]: [{ userId1: userId }, { userId2: userId }]
                        }
                    });

                    if (!dm) return socket.emit('error', { message: 'DM não encontrada ou acesso negado' });

                    const msgs = await DMMessage.findAll({
                        where: { dmId: realChatId },
                        include: [{ model: User, as: 'Sender', attributes: ['username', 'publicid'] }],
                        order: [['createdat', 'DESC']],
                        limit: limit + 1,
                        offset
                    });

                    hasMore = msgs.length > limit;
                    messages = msgs.slice(0, limit).map(m => {
                        const msg = m.toJSON();
                        msg.isMine = m.userId === userId;
                        msg.username = m.Sender?.username;
                        msg.userId = m.Sender?.publicid; // Usa publicid
                        msg.createdat = m.createdat;
                        return msg;
                    });
                } else {
                    // Chat Público
                    const chat = await Chat.findByPk(realChatId);
                    if (!chat) return socket.emit('error', { message: 'Chat não encontrado' });

                    const msgs = await ChatMessage.findAll({
                        where: { chatId: realChatId },
                        include: [{ model: User, as: 'author', attributes: ['username', 'publicid'] }],
                        order: [['createdat', 'DESC']],
                        limit: limit + 1,
                        offset
                    });

                    hasMore = msgs.length > limit;
                    messages = msgs.slice(0, limit).map(m => {
                        const msg = m.toJSON();
                        msg.isMine = m.userId === userId;
                        msg.username = m.author?.username;
                        msg.userId = m.author?.publicid; // Usa publicid
                        msg.createdat = m.createdat;
                        return msg;
                    });

                    // Entra na sala do chat (público) - usa publicid para o nome da sala
                    socket.join(`chat_${publicChatId}`);
                }

                messages.reverse();

                socket.emit('messagesLoaded', {
                    chatId: publicChatId,
                    page,
                    messages,
                    hasMore
                });

            } catch (err) {
                console.error('[Socket] Erro ao buscar mensagens:', err);
                socket.emit('error', { message: 'Erro ao carregar mensagens' });
            }
        });

        // ==================== Disconnect ====================
        socket.on('disconnect', async () => {
            console.log('[Socket.IO] Cliente desconectado:', socket.id);
            
            // Remove do Set de usuários online
            if (socket.userId) {
                const userId = socket.userId;
                const userSockets = onlineUsers.get(userId);
                
                if (userSockets) {
                    userSockets.delete(socket.id);
                    
                    // Se não há mais sockets deste usuário, agenda desconexão com delay
                    if (userSockets.size === 0) {
                        console.log('[Socket] Agendando desconexão do usuário', userId, 'em 5 segundos...');
                        
                        // Cria timeout para marcar como offline após 5 segundos
                        const timeoutId = setTimeout(async () => {
                            // Verifica novamente se usuário realmente não tem mais sockets
                            const stillOffline = !onlineUsers.has(userId) || onlineUsers.get(userId).size === 0;
                            
                            if (stillOffline) {
                                onlineUsers.delete(userId);
                                
                                try {
                                    await User.update(
                                        { lastaccess: new Date() },
                                        { where: { id: userId } }
                                    );
                                    
                                    console.log('[Socket] Usuário', userId, 'ficou offline. Online:', onlineUsers.size);
                                    
                                    // Notifica que usuário ficou offline
                                    if (socket.publicid) {
                                        io.emit('userStatusChanged', { userId: socket.publicid, status: 'offline' });
                                    }
                                    lastStatusEmission.delete(userId);
                                    disconnectionTimeouts.delete(userId);
                                } catch (err) {
                                    console.error('[Socket] Erro ao atualizar lastaccess:', err);
                                }
                            } else {
                                console.log('[Socket] Usuário', userId, 'reconectou antes do timeout');
                                disconnectionTimeouts.delete(userId);
                            }
                        }, 5000); // 5 segundos de grace period
                        
                        disconnectionTimeouts.set(userId, timeoutId);
                    }
                }
            }
        });
    });
};
