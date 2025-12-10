const express = require("express");
const DMsRouter = express.Router();
const { Chat, ChatMessage, ChatRead, ChatParticipant, User, Friendship, sequelize } = require("../models");
const socketRouter = require("../routes/socket.router");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const {
    dmIdSchema,
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
        // Busca apenas chats tipo 'dm' do usuário
        const myParticipations = await ChatParticipant.findAll({
            where: { user_id: req.user.id },
            attributes: ['chat_id']
        });

        const chatIds = myParticipations.map(p => p.chat_id);

        const dms = await Chat.findAll({
            where: {
                id: { [Op.in]: chatIds },
                tipo: 'dm'
            }
        });

        const dmList = [];

        for (const dm of dms) {
            // Busca todos os participantes do chat
            const participants = await ChatParticipant.findAll({
                where: { chat_id: dm.id },
                include: [{
                    model: User,
                    attributes: ['id', 'username', 'profile_image']
                }]
            });
            
            // Encontra o outro participante
            const otherParticipant = participants.find(p => p.user_id !== req.user.id);
            if (!otherParticipant || !otherParticipant.User) continue;

            const otherUser = otherParticipant.User;

            // Busca informações de amizade
            const friendship = await Friendship.findOne({
                where: {
                    [Op.or]: [
                        { requester_id: req.user.id, addressee_id: otherUser.id },
                        { requester_id: otherUser.id, addressee_id: req.user.id }
                    ]
                }
            });

            let isFriend = false;
            let friendRequestSent = false;
            let friendRequestReceived = false;
            let friendshipId = null;

            if (friendship) {
                friendshipId = friendship.id;
                if (friendship.status === 'accepted') {
                    isFriend = true;
                } else if (friendship.status === 'pending') {
                    if (friendship.requester_id === req.user.id) {
                        friendRequestSent = true;
                    } else {
                        friendRequestReceived = true;
                    }
                }
            }

            // Busca bio do usuário
            const fullUserData = await User.findByPk(otherUser.id, {
                attributes: ['bio']
            });

            // Busca a última mensagem
            const lastMessage = await ChatMessage.findOne({
                where: { chat_id: dm.id },
                order: [['created_at', 'DESC']],
                include: [{
                    model: User,
                    attributes: ['username']
                }]
            });

            // Busca o registro de leitura do usuário
            const chatRead = await ChatRead.findOne({
                where: {
                    chat_id: dm.id,
                    user_id: req.user.id
                }
            });

            const lastReadId = chatRead ? chatRead.last_read_message_id : 0;

            // Conta mensagens não lidas (de outros usuários)
            const unreadCount = await ChatMessage.count({
                where: {
                    chat_id: dm.id,
                    id: { [Op.gt]: lastReadId },
                    user_id: { [Op.ne]: req.user.id }
                }
            });

            dmList.push({
                id: dm.id, // Mudado de dmId para id
                otherUser: {
                    id: otherUser.id,
                    username: otherUser.username,
                    profile_image: otherUser.profile_image,
                    bio: fullUserData?.bio || null,
                    status: getUserStatus(otherUser.id),
                    isFriend,
                    friendRequestSent,
                    friendRequestReceived,
                    friendshipId
                },
                lastMessage: lastMessage ? lastMessage.mensagem : null,
                lastMessageAt: lastMessage ? lastMessage.created_at : null,
                unreadCount
            });
        }

        res.json(dmList);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar conversas" });
    }
});

// GET /conversas/unread-count - Conta conversas com mensagens não lidas
DMsRouter.get('/unread-count', async (req, res) => {
    try {
        // Busca chats DM do usuário
        const participations = await ChatParticipant.findAll({
            where: { user_id: req.user.id },
            include: [{
                model: Chat,
                where: { tipo: 'dm' },
                attributes: ['id']
            }]
        });

        let count = 0;

        for (const p of participations) {
            const chatId = p.Chat.id;

            // Busca último lido
            const chatRead = await ChatRead.findOne({
                where: { chat_id: chatId, user_id: req.user.id }
            });

            const lastReadId = chatRead ? chatRead.last_read_message_id : 0;

            // Verifica se há mensagens não lidas
            const hasUnread = await ChatMessage.count({
                where: {
                    chat_id: chatId,
                    id: { [Op.gt]: lastReadId },
                    user_id: { [Op.ne]: req.user.id }
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

        // Busca amigos aceitos
        const friendships = await Friendship.findAll({
            where: {
                [Op.or]: [
                    { requester_id: userId },
                    { addressee_id: userId }
                ],
                status: 'accepted'
            },
            include: [
                {
                    model: User,
                    as: 'requester',
                    attributes: ['id', 'username', 'profile_image']
                },
                {
                    model: User,
                    as: 'addressee',
                    attributes: ['id', 'username', 'profile_image']
                }
            ]
        });

        const friends = await Promise.all(friendships.map(async (f) => {
            const friend = f.requester_id === userId ? f.addressee : f.requester;

            // Verifica se já existe conversa - busca chats comuns
            const friendChats = await ChatParticipant.findAll({
                where: { user_id: friend.id },
                attributes: ['chat_id']
            });

            const myChats = await ChatParticipant.findAll({
                where: { user_id: userId },
                attributes: ['chat_id']
            });

            const friendChatIds = friendChats.map(c => c.chat_id);
            const myChatIds = myChats.map(c => c.chat_id);
            const commonChatIds = friendChatIds.filter(id => myChatIds.includes(id));

            let existingChat = null;
            if (commonChatIds.length > 0) {
                existingChat = await Chat.findOne({
                    where: {
                        id: { [Op.in]: commonChatIds },
                        tipo: 'dm'
                    },
                    attributes: ['id']
                });
            }

            return {
                id: friend.id,
                username: friend.username,
                profile_image: friend.profile_image,
                status: getUserStatus(friend.id),
                hasConversation: existingChat !== null,
                conversationId: existingChat?.id || null
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
    const query = req.query.q || '';
    
    if (!query.trim()) {
        return res.json({ users: [] });
    }

    try {
        const userId = req.user.id;
        const searchTerm = `%${query.toLowerCase()}%`;

        const users = await User.findAll({
            where: {
                username: { [Op.like]: searchTerm },
                id: { [Op.ne]: userId }
            },
            attributes: ['id', 'username', 'profile_image'],
            limit: 10
        });

        // Para cada usuário, verifica se já tem conversa
        const usersWithConversation = await Promise.all(users.map(async (u) => {
            // Busca conversa DM entre os dois usuários
            const userParticipations = await ChatParticipant.findAll({
                where: { user_id: u.id },
                attributes: ['chat_id']
            });

            const myParticipations = await ChatParticipant.findAll({
                where: { user_id: userId },
                attributes: ['chat_id']
            });

            const userChatIds = userParticipations.map(cp => cp.chat_id);
            const myChatIds = myParticipations.map(cp => cp.chat_id);
            const commonChatIds = userChatIds.filter(id => myChatIds.includes(id));

            const existingChat = commonChatIds.length > 0 ? await Chat.findOne({
                where: {
                    id: { [Op.in]: commonChatIds },
                    tipo: 'dm'
                },
                attributes: ['id']
            }) : null;

            return {
                id: u.id,
                username: u.username,
                profile_image: u.profile_image,
                hasConversation: existingChat !== null,
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
        const myChats = await ChatParticipant.findAll({
            where: { user_id: req.user.id },
            attributes: ['chat_id']
        });

        const otherUserChats = await ChatParticipant.findAll({
            where: { user_id: otherUser.id },
            attributes: ['chat_id']
        });

        const myChatIds = myChats.map(c => c.chat_id);
        const otherChatIds = otherUserChats.map(c => c.chat_id);
        const commonChatIds = myChatIds.filter(id => otherChatIds.includes(id));

        let existingChat = null;
        if (commonChatIds.length > 0) {
            existingChat = await Chat.findOne({
                where: {
                    id: { [Op.in]: commonChatIds },
                    tipo: 'dm'
                }
            });
        }

        if (existingChat) {
            return res.status(409).json({ 
                message: "Conversa já existe", 
                dmId: existingChat.id 
            });
        }

        // Cria novo chat DM
        const chat = await Chat.create({
            tipo: 'dm',
            criado_por: req.user.id
        });

        // Adiciona ambos os usuários como participantes
        await ChatParticipant.bulkCreate([
            { chat_id: chat.id, user_id: req.user.id },
            { chat_id: chat.id, user_id: otherUser.id }
        ]);

        res.status(201).json({ 
            message: "Conversa criada", 
            dmId: chat.id 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar conversa" });
    }
});

module.exports = DMsRouter;
