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
function emitStatusChange(io, userId, status) {
    const now = Date.now();
    const lastEmission = lastStatusEmission.get(userId) || 0;
    
    // Só emite se passou mais de 10 segundos desde a última emissão
    // OU se está mudando para offline (desconexão é imediata)
    if (status === 'offline' || (now - lastEmission) > 10000) {
        io.emit('userStatusChanged', { userId, status });
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
    const statusCheckInterval = setInterval(() => {
        const now = Date.now();
        onlineUsers.forEach((sockets, userId) => {
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
                        io.emit('userStatusChanged', { userId, status: newStatus });
                        console.log('[Socket] Status do usuário', userId, 'mudou de', previousStatus, 'para', newStatus, '(inativo há', Math.round(inactiveMinutes), 'min)');
                    }
                }
            }
        });
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
                        cookie_value: cookieValue,
                        expires_at: { [Op.gt]: new Date() }
                    },
                    attributes: ['user_id']
                });

                if (!session) return null;
                return { userId: session.user_id };
            } catch (err) {
                throw err;
            }
        }

        // ==================== Join Chat ====================
        socket.on('joinChat', async (chatId) => {
            try {
                // Atualiza atividade do usuário ao entrar no chat
                if (socket.userId) {
                    updateUserActivity(socket.userId);
                    const newStatus = getUserStatus(socket.userId);
                    
                    // Emite status com debounce
                    emitStatusChange(io, socket.userId, newStatus);
                }
                
                socket.join(`chat_${chatId}`);
                socket.emit('joinedChat', { chatId, success: true });
                console.log('[Socket] Cliente entrou no chat:', chatId);
            } catch (err) {
                console.error('[Socket] Erro ao entrar no chat:', err);
                socket.emit('error', { message: 'Erro ao entrar no chat' });
            }
        });

        // ==================== Send Message ====================
        socket.on('sendMessage', async ({ chatId, mensagem }) => {
            try {
                console.log('[Socket] Mensagem recebida:', chatId, mensagem);
                
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId } = auth;
                const { Chat, ChatMessage, ChatParticipant } = require('../models');
                const { Op } = require('sequelize');

                // Atualiza atividade do usuário
                updateUserActivity(userId);

                // Insere mensagem no banco
                const newMessage = await ChatMessage.create({
                    chat_id: chatId,
                    user_id: userId,
                    mensagem: mensagem
                });

                // Busca mensagem completa com usuário
                const messageWithUser = await ChatMessage.findByPk(newMessage.id, {
                    include: [{
                        model: User,
                        attributes: ['username']
                    }],
                    attributes: ['id', 'mensagem', 'user_id', 'created_at']
                });

                // Busca participantes do chat para notificar
                const participants = await ChatParticipant.findAll({
                    where: {
                        chat_id: chatId,
                        user_id: { [Op.ne]: userId }
                    },
                    attributes: ['user_id']
                });

                // Busca info do chat
                const chat = await Chat.findByPk(chatId, {
                    attributes: ['tipo']
                });

                // Emite para todos no chat
                io.to(`chat_${chatId}`).emit('newMessage', {
                    chatId,
                    message: {
                        id: messageWithUser.id,
                        mensagem: messageWithUser.mensagem,
                        username: messageWithUser.User.username,
                        user_id: messageWithUser.user_id,
                        created_at: messageWithUser.created_at
                    }
                });

                // Se é DM, cria notificação para usuários que não estão no chat
                if (chat && chat.tipo === 'dm') {
                    try {
                        for (const participant of participants) {
                            const otherUserId = participant.user_id;
                            
                            // Pula se for o próprio remetente
                            if (otherUserId === userId) continue;
                            
                            // Verifica se o usuário está na sala do chat (online no chat)
                            const socketsInRoom = await io.in(`chat_${chatId}`).fetchSockets();
                            
                            // Se não está no chat, cria ou atualiza notificação
                            if (socketsInRoom.length <= 1) {
                                const { Notification, sequelize } = require('../models');
                                
                                // Busca notificação existente de forma mais simples
                                const existingNotif = await Notification.findOne({
                                    where: {
                                        user_id: otherUserId,
                                        type: 'NEW_DM',
                                        read_at: null
                                    },
                                    order: [['created_at', 'DESC']]
                                });

                                // Verifica se a notificação existente é do mesmo chat
                                let isFromSameChat = false;
                                if (existingNotif && existingNotif.data) {
                                    try {
                                        const notifData = JSON.parse(existingNotif.data);
                                        isFromSameChat = notifData.chatId === chatId;
                                    } catch (e) {
                                        // Se der erro ao parsear, não é do mesmo chat
                                        isFromSameChat = false;
                                    }
                                }

                                if (existingNotif && isFromSameChat) {
                                    // Atualiza a notificação existente
                                    const currentBody = existingNotif.body;
                                    const match = currentBody.match(/\((\d+) mensagens?\)/);
                                    const currentCount = match ? parseInt(match[1]) : 1;
                                    const newCount = currentCount + 1;
                                    
                                    await existingNotif.update({
                                        body: `${messageWithUser.User.username} (${newCount} mensagens)`,
                                        created_at: new Date()
                                    });
                                } else {
                                    // Cria nova notificação
                                    await Notification.create({
                                        user_id: otherUserId,
                                        type: 'NEW_DM',
                                        title: `Nova mensagem de ${messageWithUser.User.username}`,
                                        body: mensagem.substring(0, 100) + (mensagem.length > 100 ? '...' : ''),
                                        link: '/dms',
                                        data: JSON.stringify({ chatId, senderId: userId })
                                    });
                                }
                                
                                // Notifica em tempo real
                                io.to(`user_${otherUserId}`).emit('newNotification', { type: 'message' });
                                
                                // Atualiza contagem de DMs não lidas para o destinatário
                                io.to(`user_${otherUserId}`).emit('newMessage');
                            }
                        }
                    } catch (notifErr) {
                        // Erro ao criar notificação não deve impedir o envio da mensagem
                        console.error('[Socket] Erro ao criar notificação (não crítico):', notifErr);
                    }
                }

                console.log('[Socket] Mensagem enviada para chat', chatId);
            } catch (err) {
                console.error('[Socket] Erro ao enviar mensagem:', err);
                socket.emit('error', { message: 'Erro ao enviar mensagem' });
            }
        });

        // ==================== Mark As Read ====================
        socket.on('markAsRead', async ({ chatId }) => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId } = auth;
                const { ChatMessage, ChatRead, Chat } = require('../models');
                const { Op } = require('sequelize');

                // Atualiza atividade do usuário
                updateUserActivity(userId);

                // Apenas DMs devem suportar marcação de mensagens como lidas
                const chat = await Chat.findByPk(chatId, { attributes: ['tipo'] });
                if (!chat || chat.tipo !== 'dm') {
                    // Ignora marcação de leitura para chats públicos
                    return;
                }

                // Busca última mensagem de outros usuários no chat
                const lastMsg = await ChatMessage.findOne({
                    where: {
                        chat_id: chatId,
                        user_id: { [Op.ne]: userId }
                    },
                    order: [['created_at', 'DESC']],
                    attributes: ['id']
                });

                if (lastMsg) {
                    const lastMessageId = lastMsg.id;
                    
                    // Marca como lida (upsert)
                    const [chatRead, created] = await ChatRead.findOrCreate({
                        where: {
                            chat_id: chatId,
                            user_id: userId
                        },
                        defaults: {
                            last_read_message_id: lastMessageId
                        }
                    });

                    // Se já existia, atualiza com o maior ID
                    if (!created && chatRead.last_read_message_id < lastMessageId) {
                        await chatRead.update({ last_read_message_id: lastMessageId });
                    }

                    // Notifica todos no chat sobre a atualização de leitura
                    io.to(`chat_${chatId}`).emit('messageRead', {
                        chatId,
                        userId,
                        lastReadMessageId: lastMessageId
                    });
                    
                    // Atualiza contagem de DMs não lidas para o usuário que leu
                    socket.emit('messageRead');
                }
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

                const { userId } = auth;
                
                // Atualiza last_access no banco
                await User.update(
                    { last_access: new Date() },
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
                
                // Associa userId ao socket para usar no disconnect
                socket.userId = userId;
                
                console.log('[Socket] Usuário', userId, wasOnline ? 'reconectou' : 'conectou', '| Online:', onlineUsers.size);
                
                // Só notifica se é uma NOVA conexão (não estava online antes)
                if (!wasOnline) {
                    io.emit('userStatusChanged', { userId, status: 'online' });
                    lastStatusEmission.set(userId, Date.now());
                }
            } catch (err) {
                console.error('[Socket] Erro ao entrar na sala:', err);
            }
        });

        // ==================== User Activity ====================
        socket.on('userActivity', () => {
            if (socket.userId) {
                const previousStatus = getUserStatus(socket.userId);
                updateUserActivity(socket.userId);
                const newStatus = getUserStatus(socket.userId);
                
                // Só emite se mudou de ausente para online (com debounce)
                if (previousStatus === 'ausente' && newStatus === 'online') {
                    if (emitStatusChange(io, socket.userId, 'online')) {
                        console.log('[Socket] Usuário', socket.userId, 'voltou a ficar online');
                    }
                }
            }
        });

        // ==================== Request User Status ====================
        socket.on('requestUserStatus', ({ userIds }) => {
            if (!userIds || !Array.isArray(userIds)) return;
            
            const statusMap = {};
            userIds.forEach(userId => {
                statusMap[userId] = getUserStatus(userId);
            });
            
            socket.emit('userStatusBatch', statusMap);
        });

        // ==================== Get Unread DMs Count ====================
        socket.on('getUnreadDMsCount', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId } = auth;
                const { Chat, ChatParticipant, ChatMessage, ChatRead } = require('../models');
                const { Op } = require('sequelize');

                // Buscar chats DM do usuário
                const userChats = await ChatParticipant.findAll({
                    where: { user_id: userId },
                    include: [{
                        model: Chat,
                        where: { tipo: 'dm' },
                        attributes: ['id']
                    }],
                    attributes: ['chat_id']
                });

                const chatIds = userChats.map(cp => cp.chat_id);
                let unreadCount = 0;

                // Verificar mensagens não lidas em cada chat
                for (const chatId of chatIds) {
                    const chatRead = await ChatRead.findOne({
                        where: { chat_id: chatId, user_id: userId },
                        attributes: ['last_read_message_id']
                    });

                    const lastReadId = chatRead?.last_read_message_id || 0;

                    const hasUnread = await ChatMessage.count({
                        where: {
                            chat_id: chatId,
                            user_id: { [Op.ne]: userId },
                            id: { [Op.gt]: lastReadId }
                        }
                    });

                    if (hasUnread > 0) unreadCount++;
                }

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
                        user_id: userId,
                        read_at: null
                    }
                });

                socket.emit('notificationsCount', { count });
            } catch (err) {
                console.error('[Socket] Erro ao buscar notificações:', err);
            }
        });

        // ==================== Get Messages ====================
        socket.on('getMessages', async ({ chatId, chatName, page = 1 }) => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return socket.emit('error', { message: 'Não autenticado' });

                const { userId } = auth;
                const { Chat, ChatMessage, ChatParticipant, ChatRead } = require('../models');
                const { Op } = require('sequelize');

                const limit = 50;
                const offset = (page - 1) * limit;

                // Busca o chat por ID ou nome
                let chat;
                if (chatId) {
                    chat = await Chat.findByPk(chatId);
                } else if (chatName) {
                    chat = await Chat.findOne({
                        where: { nome: chatName, tipo: 'public' }
                    });
                }

                if (!chat) {
                    return socket.emit('error', { message: 'Chat não encontrado' });
                }

                const resolvedChatId = chat.id;

                // Para chats públicos, qualquer usuário pode acessar
                // Para DMs, verifica se é participante
                if (chat.tipo === 'dm') {
                    const isParticipant = await ChatParticipant.findOne({
                        where: { chat_id: resolvedChatId, user_id: userId }
                    });
                    if (!isParticipant) {
                        return socket.emit('error', { message: 'Acesso negado' });
                    }
                }

                // Busca mensagens
                const messages = await ChatMessage.findAll({
                    where: { chat_id: resolvedChatId },
                    include: [{
                        model: User,
                        attributes: ['username']
                    }],
                    order: [['created_at', 'DESC']],
                    limit,
                    offset
                });

                messages.reverse();

                // Para DMs, adiciona status de leitura
                let messagesWithReadStatus = messages;
                if (chat.tipo === 'dm') {
                    // Busca o outro participante
                    const participants = await ChatParticipant.findAll({
                        where: {
                            chat_id: resolvedChatId,
                            user_id: { [Op.ne]: userId }
                        }
                    });

                    const otherUserId = participants[0]?.user_id;

                    if (otherUserId) {
                        const otherUserRead = await ChatRead.findOne({
                            where: { chat_id: resolvedChatId, user_id: otherUserId }
                        });

                        messagesWithReadStatus = await Promise.all(messages.map(async (m) => {
                            const msg = m.toJSON();
                            msg.isMine = m.user_id === userId;
                            
                            if (m.user_id === userId && otherUserRead) {
                                msg.isRead = m.id <= otherUserRead.last_read_message_id;
                            }
                            
                            return msg;
                        }));
                    }
                } else {
                    // Para chats públicos
                    messagesWithReadStatus = messages.map(m => {
                        const msg = m.toJSON();
                        msg.isMine = m.user_id === userId;
                        return msg;
                    });
                }

                // Marca mensagens como lidas (APENAS para DMs)
                if (chat.tipo === 'dm' && messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage.user_id !== userId) {
                        const [chatRead, created] = await ChatRead.findOrCreate({
                            where: { chat_id: resolvedChatId, user_id: userId },
                            defaults: { last_read_message_id: lastMessage.id }
                        });

                        if (!created && chatRead.last_read_message_id < lastMessage.id) {
                            await chatRead.update({ last_read_message_id: lastMessage.id });
                        }

                        // Notifica outros usuários que as mensagens foram lidas (APENAS DMs)
                        io.to(`chat_${resolvedChatId}`).emit('messageRead', {
                            chatId: resolvedChatId,
                            userId,
                            lastReadMessageId: lastMessage.id
                        });
                    }
                }

                // Entra na sala do chat se ainda não entrou (para chats públicos)
                if (chat.tipo === 'public') {
                    socket.join(`chat_${resolvedChatId}`);
                }

                socket.emit('messagesLoaded', {
                    chatId: resolvedChatId,
                    page,
                    messages: messagesWithReadStatus,
                    hasMore: messages.length >= limit
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
                                        { last_access: new Date() },
                                        { where: { id: userId } }
                                    );
                                    
                                    console.log('[Socket] Usuário', userId, 'ficou offline. Online:', onlineUsers.size);
                                    
                                    // Notifica que usuário ficou offline
                                    io.emit('userStatusChanged', { userId, status: 'offline' });
                                    lastStatusEmission.delete(userId);
                                    disconnectionTimeouts.delete(userId);
                                } catch (err) {
                                    console.error('[Socket] Erro ao atualizar last_access:', err);
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
