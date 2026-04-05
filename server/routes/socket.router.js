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

        socket.on('joinPost', (postId) => socket.join(`post_${postId}`));

        socket.on('joinProfile', async (username) => {
            const rooms = Array.from(socket.rooms);
            rooms.forEach(r => { if (r.startsWith('profile_')) socket.leave(r); });
            socket.join(`profile_${username}`);
            const user = await User.findOne({ where: { username }, attributes: ['id', 'publicid'] });
            if (user) socket.emit('userStatusChanged', { userId: user.publicid, status: getUserStatus(user.id) });
        });

        socket.on('joinFollowed', async () => {
            const auth = await authenticateSocket();
            if (!auth) return;
            const { Follow, User: UserModel } = require('../models');
            const following = await Follow.findAll({
                where: { followerUserId: auth.userId },
                include: [{ model: UserModel, as: 'followed', attributes: ['username'] }]
            });
            following.forEach(f => { if (f.followed?.username) socket.join(`profile_${f.followed.username}`); });
            const me = await UserModel.findByPk(auth.userId, { attributes: ['username'] });
            if (me) socket.join(`profile_${me.username}`);
        });

        socket.on('loadPosts', async ({ username, tab = 'posts' }) => {
            try {
                const { Post, User: UserModel, PostMedia, PostLike, PostBookmark, PostMention } = require('../models');
                const { Op } = require('sequelize');
                const user = await UserModel.findOne({ where: { username } });
                if (!user) return socket.emit('error', { message: 'Usuário não encontrado' });

                const POST_INCLUDES = [
                    { model: UserModel, as: 'author', attributes: ['username', 'profileimage', 'pronouns'] },
                    { model: PostMedia, as: 'media' },
                    { model: PostLike, as: 'likes', include: [{ model: UserModel, as: 'user', attributes: ['username'] }] },
                    { model: PostBookmark, as: 'bookmarks', attributes: ['userId'] },
                    { model: PostMention, as: 'mentions', include: [{ model: UserModel, as: 'user', attributes: ['username'] }] },
                    { 
                        model: Post, as: 'parent', 
                        include: [
                            { model: UserModel, as: 'author', attributes: ['username', 'profileimage', 'pronouns'] },
                            { model: PostMedia, as: 'media' },
                            { model: PostMention, as: 'mentions', include: [{ model: UserModel, as: 'user', attributes: ['username'] }] },
                            { model: Post, as: 'parent', include: [{ model: UserModel, as: 'author', attributes: ['username', 'profileimage', 'pronouns'] }] }
                        ] 
                    }
                ];

                let posts = [];
                if (tab === 'posts') {
                    posts = await Post.findAll({ where: { authorUserId: user.id, type: { [Op.ne]: 'comment' } }, include: POST_INCLUDES, order: [['createdat', 'DESC']] });
                } else if (tab === 'bookmarks') {
                    const bookmarks = await PostBookmark.findAll({ where: { userId: user.id }, include: [{ model: Post, required: true, include: POST_INCLUDES }], order: [['createdat', 'DESC']] });
                    posts = bookmarks.map(b => b.Post);
                }
                socket.emit('postsLoaded', { posts, tab });
            } catch (err) { socket.emit('error', { message: 'Erro ao carregar posts' }); }
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
                        } else {
                            await Notification.create({
                                targetUserId: otherUserId, type: 'dm', title: `Nova mensagem de ${msg.Sender.username}`,
                                body: mensagem.substring(0, 100), link: '/dms', data: JSON.stringify({ chatId: publicChatId, senderId: auth.publicid })
                            });
                        }
                        io.to(`user_${otherUserId}`).emit('newNotification', { type: 'message' });
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

        socket.on('userActivity', () => {
            if (socket.userId && socket.publicid) {
                const prev = getUserStatus(socket.userId);
                updateUserActivity(socket.userId);
                if (prev === 'ausente') emitStatusChange(io, socket.userId, socket.publicid, 'online');
            }
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

        socket.on('getUnreadDMsCount', async () => {
            try {
                const auth = await authenticateSocket();
                if (!auth) return;
                const { DM, DMMessage } = require('../models');
                const { Op } = require('sequelize');
                const userDMs = await DM.findAll({ where: { [Op.or]: [{ userId1: auth.userId }, { userId2: auth.userId }] }, attributes: ['id'] });
                const counts = await DMMessage.count({ where: { dmId: { [Op.in]: userDMs.map(d => d.id) }, userId: { [Op.ne]: auth.userId }, isread: false }, group: ['dmId'] });
                socket.emit('unreadDMsCount', { count: counts.length });
            } catch (err) {}
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
