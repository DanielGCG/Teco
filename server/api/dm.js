const express = require("express");
const DMsRouter = express.Router();
const { DM, DMMessage, User, Follow, sequelize } = require("../models");
const socketRouter = require("../routes/socket.router");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const {
    publicidSchema,
    getMessagesSchema,
    sendMessageSchema,
    createDmSchema,
    searchUsersSchema
} = require("../validators/dms.validator");

// Usa a função getUserStatus do socketRouter que gerencia os 3 estados
function getUserStatus(userId) {
    if (socketRouter.getUserStatus) {
        return socketRouter.getUserStatus(userId);
    }
    return 'offline';
}

// ==================== Endpoints de DMs (Mensagens Diretas - 2 pessoas) ====================

// GET /dms - Lista todas as DMs do usuário
DMsRouter.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // --- AUTO-CRIAÇÃO DE DMs PARA AMIGOS ---
        // Busca todos os amigos (seguimento mútuo)
        const friends = await User.findAll({
            include: [
                {
                    model: Follow,
                    as: 'followers',
                    where: { followerUserId: userId },
                    attributes: []
                },
                {
                    model: Follow,
                    as: 'following',
                    where: { followedUserId: userId },
                    attributes: []
                }
            ],
            attributes: ['id', 'publicid', 'username']
        });

        // For cada amigo, garante que existe uma DM
        for (const friend of friends) {
            const existingDM = await DM.findOne({
                where: {
                    [Op.or]: [
                        { userId1: userId, userId2: friend.id },
                        { userId1: friend.id, userId2: userId }
                    ]
                }
            });

            if (!existingDM) {
                await DM.create({
                    userId1: userId,
                    userId2: friend.id
                });
            }
        }
        // --- FIM AUTO-CRIAÇÃO ---

        const dms = await DM.findAll({
            where: {
                [Op.or]: [
                    { userId1: userId },
                    { userId2: userId }
                ]
            },
            include: [
                { model: User, as: 'user1', attributes: ['id', 'publicid', 'username', 'profileimage', 'bio'] },
                { model: User, as: 'user2', attributes: ['id', 'publicid', 'username', 'profileimage', 'bio'] }
            ]
        });

        const dmList = [];

        for (const dm of dms) {
            const otherUser = dm.userId1 === userId ? dm.user2 : dm.user1;
            if (!otherUser) continue;

            // Busca informações de seguimento (mantém id interno para busca no banco)
            const following = await Follow.findOne({
                where: { followerUserId: userId, followedUserId: otherUser.id }
            });
            const followedBy = await Follow.findOne({
                where: { followerUserId: otherUser.id, followedUserId: userId }
            });

            const isFriend = !!(following && followedBy);
            const isFollowing = !!following;
            const isFollowedBy = !!followedBy;

            // Busca a última mensagem
            const lastMessage = await DMMessage.findOne({
                where: { dmId: dm.id },
                order: [['createdat', 'DESC']]
            });

            // Conta mensagens não lidas (de outros usuários)
            const unreadCount = await DMMessage.count({
                where: {
                    dmId: dm.id,
                    userId: otherUser.id,
                    isread: false
                }
            });

            dmList.push({
                publicid: dm.publicid,
                otherUser: {
                    publicid: otherUser.publicid,
                    username: otherUser.username,
                    profileimage: otherUser.profileimage,
                    bio: otherUser.bio || null,
                    status: getUserStatus(otherUser.id),
                    isFriend,
                    isFollowing,
                    isFollowedBy
                },
                lastMessage: lastMessage ? lastMessage.message : null,
                lastMessageAt: lastMessage ? lastMessage.createdat : null,
                unreadCount
            });
        }

        // Ordena conversas por data da última mensagem (mais recentes primeiro)
        dmList.sort((a, b) => {
            const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return tb - ta;
        });

        res.json(dmList);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar conversas" });
    }
});

// GET /conversas/unread-count - Conta conversas com mensagens não lidas
DMsRouter.get('/unread-count', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Busca dms do usuário
        const dms = await DM.findAll({
            where: {
                [Op.or]: [
                    { userId1: userId },
                    { userId2: userId }
                ]
            },
            attributes: ['id']
        });

        let count = 0;

        for (const dm of dms) {
            // Verifica se há mensagens não lidas de outros
            const hasUnread = await DMMessage.count({
                where: {
                    dmId: dm.id,
                    userId: { [Op.ne]: userId },
                    isread: false
                },
                limit: 1
            });

            if (hasUnread > 0) count++;
        }

        res.json({ count });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao contar mensagens não lidas" });
    }
});

// GET /conversas/friends - Lista amigos disponíveis para conversa
DMsRouter.get('/friends', async (req, res) => {
    try {
        const userId = req.user.id;

        // Amigos são seguidores mútuos
        const friendsList = await User.findAll({
            include: [
                {
                    model: Follow,
                    as: 'followers',
                    where: { followerUserId: userId },
                    attributes: []
                },
                {
                    model: Follow,
                    as: 'following',
                    where: { followedUserId: userId },
                    attributes: []
                }
            ],
            attributes: ['id', 'publicid', 'username', 'profileimage']
        });

        const friends = await Promise.all(friendsList.map(async (friend) => {
            // Verifica se já existe conversa
            const existingDM = await DM.findOne({
                where: {
                    [Op.or]: [
                        { userId1: userId, userId2: friend.id },
                        { userId1: friend.id, userId2: userId }
                    ]
                }
            });

            return {
                publicid: friend.publicid,
                username: friend.username,
                profileimage: friend.profileimage,
                status: getUserStatus(friend.id),
                hasConversation: existingDM !== null,
                conversationId: existingDM?.publicid || null
            };
        }));

        // Reordena por status (online -> ausente -> offline)
        friends.sort((a, b) => {
            const order = { online: 0, ausente: 1, offline: 2 };
            return (order[a.status] || 2) - (order[b.status] || 2);
        });

        res.json({ friends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar amigos" });
    }
});

// GET /conversas/search - Buscar usuários para iniciar conversa
DMsRouter.get('/search', validate(searchUsersSchema, 'query'), async (req, res) => {
    try {
        const query = (req.query.q || '').toString();
        if (!query.trim()) {
            return res.json({ users: [] });
        }
        
        const userId = req.user.id;
        const searchTerm = `%${query.toLowerCase()}%`;

        const users = await User.findAll({
            where: {
                username: { [Op.like]: searchTerm },
                id: { [Op.ne]: userId }
            },
            attributes: ['id', 'publicid', 'username', 'profileimage'],
            limit: 10
        });

        // Para cada usuário, verifica se já tem conversa
        const usersWithConversation = await Promise.all(users.map(async (u) => {
            const existingDM = await DM.findOne({
                where: {
                    [Op.or]: [
                        { userId1: userId, userId2: u.id },
                        { userId1: u.id, userId2: userId }
                    ]
                },
                attributes: ['id', 'publicid']
            });

            return {
                publicid: u.publicid,
                username: u.username,
                profileimage: u.profileimage,
                hasConversation: existingDM !== null,
                conversationId: existingDM?.publicid || null,
                status: getUserStatus(u.id)
            };
        }));

        res.json({ users: usersWithConversation });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar usuários" });
    }
});

// POST /conversas - Criar nova conversa (DM)
DMsRouter.post('/', validate(createDmSchema), async (req, res) => {
    const { username } = req.body;

    try {
        // Busca o usuário pelo username
        const otherUser = await User.findOne({
            where: { username },
            attributes: ['id']
        });

        if (!otherUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        if (otherUser.id === req.user.id) {
            return res.status(400).json({ message: "Você não pode iniciar uma conversa consigo mesmo" });
        }

        // Verifica se já existe uma conversa DM entre os dois
        const existingDM = await DM.findOne({
            where: {
                [Op.or]: [
                    { userId1: req.user.id, userId2: otherUser.id },
                    { userId1: otherUser.id, userId2: req.user.id }
                ]
            }
        });

        if (existingDM) {
            return res.status(409).json({ 
                message: "Conversa já existe", 
                dmId: existingDM.publicid 
            });
        }

        // Cria novo DM
        const dm = await DM.create({
            userId1: req.user.id,
            userId2: otherUser.id
        });

        res.status(201).json({ 
            message: "Conversa criada", 
            dmId: dm.publicid 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar conversa" });
    }
});

module.exports = DMsRouter;
