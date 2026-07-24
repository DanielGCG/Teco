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
    if (!onlineUsers.has(userId) || onlineUsers.get(userId).size === 0) return 'offline';
    const lastActivity = userLastActivity.get(userId);
    if (!lastActivity) return 'online';
    const inactiveMinutes = (Date.now() - lastActivity) / (1000 * 60);
    return inactiveMinutes >= 5 ? 'ausente' : 'online';
}

function isUserOnline(userId) {
    return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function updateUserActivity(userId) {
    userLastActivity.set(userId, Date.now());
}

async function emitStatusChange(io, userId, publicid, status) {
    const now = Date.now();
    const lastEmission = lastStatusEmission.get(userId) || 0;
    if (!publicid) {
        const user = await User.findByPk(userId, { attributes: ['publicid'] });
        if (user) publicid = user.publicid;
    }
    if (!publicid) return false;
    if (status === 'offline' || (now - lastEmission) > 10000) {
        io.emit('userStatusChanged', { userId: publicid, status });
        lastStatusEmission.set(userId, now);
        return true;
    }
    return false;
}

module.exports.isUserOnline = isUserOnline;
module.exports.getUserStatus = getUserStatus;

module.exports = (io) => {
    // Timer para verificar mudanças de status por inatividade
    setInterval(async () => {
        const now = Date.now();
        for (const [userId, sockets] of onlineUsers.entries()) {
            if (sockets.size > 0) {
                const lastActivity = userLastActivity.get(userId);
                if (lastActivity) {
                    const previousStatus = getUserStatus(userId);
                    const inactiveMinutes = (now - lastActivity) / (1000 * 60);
                    let newStatus = inactiveMinutes >= 5 ? 'ausente' : 'online';
                    if (previousStatus !== newStatus) {
                        const user = await User.findByPk(userId, { attributes: ['publicid'] });
                        if (user) emitStatusChange(io, userId, user.publicid, newStatus);
                    }
                }
            }
        }
    }, 60000);

    io.on('connection', (socket) => {
        async function authenticateSocket() {
            const cookies = socket.handshake.headers.cookie;
            if (!cookies) return null;
            const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('session='));
            if (!sessionCookie) return null;
            const cookieValue = sessionCookie.split('=')[1];
            try {
                const { Op } = require('sequelize');
                const session = await UserSession.findOne({
                    where: { cookie: cookieValue, expiresat: { [Op.gt]: new Date() } },
                    include: [{ model: User, attributes: ['id', 'publicid'] }]
                });
                return session?.User ? { userId: session.User.id, publicid: session.User.publicid } : null;
            } catch (err) { return null; }
        }

        async function resolveChatId(publicid, type = 'chat') {
            const { Chat, DM } = require('../models');
            const model = type === 'dm' ? DM : Chat;
            const res = await model.findOne({ where: { publicid }, attributes: ['id'] });
            return res ? res.id : null;
        }

        socket.on('joinChat', async (publicChatId) => {
            if (socket.userId) updateUserActivity(socket.userId);
            socket.join(`chat_${publicChatId}`);
            socket.emit('joinedChat', { chatId: publicChatId, success: true });
        });



        socket.on('sendMessage', async ({ chatId: publicChatId, mensagem, type = 'chat' }) => {
            try {
                const auth = await authenticateSocket();
                if (!auth) return socket.emit('error', { message: 'Não autenticado' });
                const realChatId = await resolveChatId(publicChatId, type);
                if (!realChatId) return socket.emit('error', { message: 'Chat não encontrado' });

                updateUserActivity(auth.userId);
                const { ChatMessage, DM, DMMessage, User: UserModel, Notification } = require('../models');
                
                if (type === 'dm') {
                    const newMessage = await DMMessage.create({ dmId: realChatId, userId: auth.userId, message: mensagem });
                    const msg = await DMMessage.findByPk(newMessage.id, { include: [{ model: UserModel, as: 'Sender', attributes: ['username', 'publicid'] }] });
                    
                    io.to(`chat_${publicChatId}`).emit('newMessage', {
                        chatId: publicChatId, type: 'dm',
                        message: { publicid: msg.publicid, message: msg.message, username: msg.Sender.username, userId: msg.Sender.publicid, createdat: msg.createdat }
                    });

                    const dm = await DM.findByPk(realChatId);
                    const otherUserId = dm.userId1 === auth.userId ? dm.userId2 : dm.userId1;
                    const socketsInRoom = await io.in(`chat_${publicChatId}`).fetchSockets();

                    if (socketsInRoom.length <= 1) {
                        const existingNotif = await Notification.findOne({ where: { targetUserId: otherUserId, type: 'dm', readat: null }, order: [['createdat', 'DESC']] });
                        let isSame = false;
                        if (existingNotif?.data) { try { isSame = JSON.parse(existingNotif.data).chatId === publicChatId; } catch(e){} }

                        if (existingNotif && isSame) {
                            const match = existingNotif.body.match(/\((\d+) mens/);
                            const count = (match ? parseInt(match[1]) : 1) + 1;
                            await existingNotif.update({ body: `${msg.Sender.username} (${count} mensagens)`, createdat: new Date() });
                            io.to(`user_${otherUserId}`).emit('newNotification', { type: 'message' });
                        } else {
                            await createNotification({
                                userId: otherUserId, 
                                type: 'dm', 
                                title: `Nova mensagem de ${msg.Sender.username}`,
                                body: mensagem.substring(0, 100), 
                                link: '/dms',
                                io: io,
                                socketType: 'message'
                            });
                        }
                    }
                } else {
                    const newMessage = await ChatMessage.create({ chatId: realChatId, userId: auth.userId, message: mensagem });
                    const msg = await ChatMessage.findByPk(newMessage.id, { include: [{ model: UserModel, as: 'author', attributes: ['username', 'publicid'] }] });
                    io.to(`chat_${publicChatId}`).emit('newMessage', {
                        chatId: publicChatId, type: 'chat',
                        message: { publicid: msg.publicid, message: msg.message, username: msg.author.username, userId: msg.author.publicid, createdat: msg.createdat }
                    });
                }
            } catch (err) { socket.emit('error', { message: 'Erro ao enviar mensagem' }); }
        });

        socket.on('markAsRead', async ({ chatId: publicChatId }) => {
            try {
                const auth = await authenticateSocket();
                if (!auth) return;
                const realChatId = await resolveChatId(publicChatId, 'dm');
                if (!realChatId) return;
                const { DMMessage } = require('../models');
                const { Op } = require('sequelize');
                await DMMessage.update({ isread: true }, { where: { dmId: realChatId, userId: { [Op.ne]: auth.userId }, isread: false } });
                io.to(`chat_${publicChatId}`).emit('messageRead', { chatId: publicChatId, userId: auth.publicid });
                socket.emit('messageRead');
            } catch (err) {}
        });

        socket.on('joinUserRoom', async () => {
            try {
                const auth = await authenticateSocket();
                if (!auth) return;
                const { userId, publicid } = auth;
                await User.update({ lastaccess: new Date() }, { where: { id: userId } });
                socket.join(`user_${userId}`);
                
                if (disconnectionTimeouts.has(userId)) {
                    clearTimeout(disconnectionTimeouts.get(userId));
                    disconnectionTimeouts.delete(userId);
                }
                
                const wasOnline = onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
                if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
                onlineUsers.get(userId).add(socket.id);
                updateUserActivity(userId);
                socket.userId = userId; socket.publicid = publicid;
                
                if (!wasOnline) emitStatusChange(io, userId, publicid, 'online');
            } catch (err) {}
        });



        socket.on('requestUserStatus', async ({ userIds }) => {
            if (!Array.isArray(userIds)) return;
            const statusMap = {};
            for (const pid of userIds) {
                const user = await User.findOne({ where: { publicid: pid }, attributes: ['id'] });
                if (user) statusMap[pid] = getUserStatus(user.id);
            }
            socket.emit('userStatusResponse', statusMap); // Mudado de userStatusBatch para coincidir com socket-ui.js
        });



        socket.on('getNotificationsCount', async () => {
            try {
                const auth = await authenticateSocket();
                if (!auth) return;
                const { Notification } = require('../models');
                const count = await Notification.count({ where: { targetUserId: auth.userId, readat: null } });
                socket.emit('notificationsCount', { count });
            } catch (err) {}
        });

        socket.on('getMessages', async ({ chatId: publicChatId, page = 1, type = 'chat' }) => {
            try {
                const auth = await authenticateSocket();
                if (!auth) return;
                const realChatId = await resolveChatId(publicChatId, type);
                if (!realChatId) return;
                const { Chat, ChatMessage, DM, DMMessage, User: UserModel } = require('../models');
                const { Op } = require('sequelize');
                const limit = 50, offset = (page - 1) * limit;
                let messages = [], hasMore = false;

                if (type === 'dm') {
                    const dm = await DM.findOne({ where: { id: realChatId, [Op.or]: [{ userId1: auth.userId }, { userId2: auth.userId }] } });
                    if (!dm) return;
                    const msgs = await DMMessage.findAll({ where: { dmId: realChatId }, include: [{ model: UserModel, as: 'Sender', attributes: ['username', 'publicid'] }], order: [['createdat', 'DESC']], limit: limit + 1, offset });
                    hasMore = msgs.length > limit;
                    messages = msgs.slice(0, limit).map(m => ({ ...m.toJSON(), isMine: m.userId === auth.userId, username: m.Sender?.username, userId: m.Sender?.publicid }));
                } else {
                    const msgs = await ChatMessage.findAll({ where: { chatId: realChatId }, include: [{ model: UserModel, as: 'author', attributes: ['username', 'publicid'] }], order: [['createdat', 'DESC']], limit: limit + 1, offset });
                    hasMore = msgs.length > limit;
                    messages = msgs.slice(0, limit).map(m => ({ ...m.toJSON(), isMine: m.userId === auth.userId, username: m.author?.username, userId: m.author?.publicid }));
                }
                socket.join(`chat_${publicChatId}`);
                socket.emit('messagesLoaded', { chatId: publicChatId, page, messages: messages.reverse(), hasMore });
            } catch (err) {}
        });

        socket.on('disconnect', () => {
            if (socket.userId) {
                const uid = socket.userId;
                const sockets = onlineUsers.get(uid);
                if (sockets) {
                    sockets.delete(socket.id);
                    if (sockets.size === 0) {
                        const tid = setTimeout(async () => {
                            if (!onlineUsers.has(uid) || onlineUsers.get(uid).size === 0) {
                                onlineUsers.delete(uid);
                                try {
                                    await User.update({ lastaccess: new Date() }, { where: { id: uid } });
                                    if (socket.publicid) io.emit('userStatusChanged', { userId: socket.publicid, status: 'offline' });
                                } catch (e) {}
                            }
                        }, 5000);
                        disconnectionTimeouts.set(uid, tid);
                    }
                }
            }
        });
    });
};
