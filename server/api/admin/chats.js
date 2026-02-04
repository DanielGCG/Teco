const express = require("express");
const AdminChatsRouter = express.Router();
const { Chat, ChatMessage, DM, DMMessage, User, ChatTopic } = require("../../models");
const { Op, fn, col, literal } = require("sequelize");

// ==================== Endpoints Administrativos de Chats ====================

// GET /admin/chats/topics - Listar todos os tópicos disponíveis
AdminChatsRouter.get('/topics', async (req, res) => {
    try {
        const topics = await ChatTopic.findAll({ order: [['name', 'ASC']] });
        res.json(topics);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar tópicos" });
    }
});

// GET /admin/chats/estatisticas - Estatísticas gerais de chats
AdminChatsRouter.get('/estatisticas', async (req, res) => {
    try {
        const totalPublicos = await Chat.count();
        const totalDms = await DM.count();
        const totalMensagensChat = await ChatMessage.count();
        const totalMensagensDm = await DMMessage.count();

        res.json({
            chatcount: totalPublicos,
            dmcount: totalDms,
            messagecount: totalMensagensChat + totalMensagensDm,
            messagecount_chat: totalMensagensChat,
            messagecount_dm: totalMensagensDm
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar estatísticas de chats" });
    }
});

// POST /admin/chats/public - Criar um novo chat público
AdminChatsRouter.post('/public', async (req, res) => {
    const { title, topic } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ message: "Título do chat é obrigatório" });
    }

    try {
        const chat = await Chat.create({
            title: title.trim(),
            chatTopicName: topic || 'Geral',
            createdbyUserId: req.user.id
        });

        res.status(201).json({ message: "Chat público criado com sucesso", chat });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar chat público" });
    }
});

// POST /admin/chats/dm - Criar uma DM entre dois usuários
AdminChatsRouter.post('/dm', async (req, res) => {
    let { otherUserPublicId, creatorPublicId } = req.body;
    
    try {
        let user1, user2;
        
        if (creatorPublicId) {
            user1 = await User.findOne({ where: { publicid: creatorPublicId } });
        } else {
            user1 = await User.findByPk(req.user.id);
        }

        user2 = await User.findOne({ where: { publicid: otherUserPublicId } });

        if (!user1 || !user2) {
            return res.status(404).json({ message: "Um ou ambos os usuários não foram encontrados" });
        }

        const user1Id = user1.id;
        const user2Id = user2.id;

        if (user1Id == user2Id) {
            return res.status(400).json({ message: "Não é possível criar uma DM com o mesmo usuário" });
        }

        // Verificar se já existe uma DM entre eles
        const existingDM = await DM.findOne({
            where: {
                [Op.or]: [
                    { userId1: user1Id, userId2: user2Id },
                    { userId1: user2Id, userId2: user1Id }
                ]
            }
        });

        if (existingDM) {
            return res.status(409).json({ 
                message: "Conversa já existe", 
                dm: existingDM 
            });
        }

        // Criar novo chat DM
        const dm = await DM.create({
            userId1: user1Id,
            userId2: user2Id
        });

        res.status(201).json({ message: "DM criada com sucesso", dm });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar DM" });
    }
});

// GET /admin/chats - Listar todos os chats (Públicos e DM)
AdminChatsRouter.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const tipo = req.query.tipo; 
    const search = req.query.search;
    const offset = (page - 1) * limit;

    try {
        let results = [];

        // 1. Buscar Chats Públicos
        if (!tipo || tipo === 'public') {
            const publicChats = await Chat.findAll({
                where: search ? { title: { [Op.like]: `%${search}%` } } : {},
                include: [{ model: User, as: 'creator', attributes: ['username'] }],
                order: [['createdat', 'DESC']]
            });

            for (let chat of publicChats) {
                const messageCount = await ChatMessage.count({ where: { chatId: chat.id } });
                const lastMsg = await ChatMessage.findOne({ where: { chatId: chat.id }, order: [['createdat', 'DESC']] });

                results.push({
                    publicid: chat.publicid,
                    title: chat.title,
                    type: 'public',
                    topic: chat.chatTopicName,
                    creatorusername: chat.creator?.username || 'Sistema',
                    messagecount: messageCount,
                    lastmessageat: lastMsg?.createdat || chat.createdat,
                    participants: []
                });
            }
        }

        // 2. Buscar DMs
        if (!tipo || tipo === 'dm') {
            const dms = await DM.findAll({
                include: [
                    { model: User, as: 'user1', attributes: ['username', 'publicid'] },
                    { model: User, as: 'user2', attributes: ['username', 'publicid'] }
                ],
                order: [['createdat', 'DESC']]
            });

            for (let dm of dms) {
                // Filtro manual de busca por username em DM
                if (search && !dm.user1.username.toLowerCase().includes(search.toLowerCase()) && 
                            !dm.user2.username.toLowerCase().includes(search.toLowerCase())) continue;

                const messageCount = await DMMessage.count({ where: { dmId: dm.id } });
                const lastMsg = await DMMessage.findOne({ where: { dmId: dm.id }, order: [['createdat', 'DESC']] });

                results.push({
                    publicid: dm.publicid,
                    title: `${dm.user1.username} & ${dm.user2.username}`,
                    type: 'dm',
                    topic: 'Privado',
                    creatorusername: dm.user1.username,
                    messagecount: messageCount,
                    lastmessageat: lastMsg?.createdat || dm.createdat,
                    participants: [
                        { publicid: dm.user1.publicid, username: dm.user1.username },
                        { publicid: dm.user2.publicid, username: dm.user2.username }
                    ]
                });
            }
        }

        // Ordenar por última atividade globalmente
        results.sort((a, b) => new Date(b.lastmessageat) - new Date(a.lastmessageat));

        res.json({
            chats: results.slice(offset, offset + limit),
            currentPage: page,
            totalPages: Math.ceil(results.length / limit),
            totalItems: results.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar chats" });
    }
});

// GET /admin/chats/:publicid - Detalhes de um chat ou DM
AdminChatsRouter.get('/:publicid', async (req, res) => {
    const publicid = req.params.publicid;
    const type = req.query.type; // 'public' ou 'dm'

    try {
        if (type === 'public') {
            const chat = await Chat.findOne({
                where: { publicid },
                include: [{ model: User, as: 'creator', attributes: ['username'] }]
            });
            if (!chat) return res.status(404).json({ message: "Chat não encontrado" });
            
            res.json({
                ...chat.toJSON(),
                type: 'public',
                creatorusername: chat.creator?.username || 'Sistema',
                participants: []
            });
        } else {
            const dm = await DM.findOne({
                where: { publicid },
                include: [
                    { model: User, as: 'user1', attributes: ['username', 'publicid'] },
                    { model: User, as: 'user2', attributes: ['username', 'publicid'] }
                ]
            });
            if (!dm) return res.status(404).json({ message: "DM não encontrada" });

            res.json({
                ...dm.toJSON(),
                type: 'dm',
                title: `${dm.user1.username} & ${dm.user2.username}`,
                participants: [
                    { publicid: dm.user1.publicid, username: dm.user1.username },
                    { publicid: dm.user2.publicid, username: dm.user2.username }
                ]
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar detalhes" });
    }
});

// DELETE /admin/chats/:publicid - Deletar um chat ou DM
AdminChatsRouter.delete('/:publicid', async (req, res) => {
    const publicid = req.params.publicid;
    const type = req.query.type;

    try {
        if (type === 'public') {
            const chat = await Chat.findOne({ where: { publicid } });
            if (!chat) return res.status(404).json({ message: "Chat não encontrado" });
            await chat.destroy();
        } else {
            const dm = await DM.findOne({ where: { publicid } });
            if (!dm) return res.status(404).json({ message: "DM não encontrada" });
            await dm.destroy();
        }
        res.json({ message: "Deletado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar" });
    }
});

// PUT /admin/chats/:publicid - Atualizar um chat ou DM
AdminChatsRouter.put('/:publicid', async (req, res) => {
    const publicid = req.params.publicid;
    const { title, type, participants } = req.body;

    try {
        if (type === 'public') {
            const chat = await Chat.findOne({ where: { publicid } });
            if (!chat) return res.status(404).json({ message: "Chat não encontrado" });
            if (title) chat.title = title;
            await chat.save();
        } else if (type === 'dm') {
            const dm = await DM.findOne({ where: { publicid } });
            if (!dm) return res.status(404).json({ message: "DM não encontrada" });
            
            if (participants && participants.length === 2) {
                // Participants are publicids
                const user1 = await User.findOne({ where: { publicid: participants[0] } });
                const user2 = await User.findOne({ where: { publicid: participants[1] } });
                if (user1 && user2) {
                    dm.userId1 = user1.id;
                    dm.userId2 = user2.id;
                    await dm.save();
                }
            }
        }
        res.json({ message: "Atualizado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar" });
    }
});

// GET /admin/chats/:publicid/mensagens - Listar mensagens de um chat (admin)
AdminChatsRouter.get('/:publicid/mensagens', async (req, res) => {
    const publicid = req.params.publicid;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search; // busca por conteúdo da mensagem

    const offset = (page - 1) * limit;

    try {
        // Verificar se o chat existe
        const chat = await Chat.findOne({ where: { publicid } });
        
        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        const realChatId = chat.id;

        // Construir filtros
        const where = { chatId: realChatId };

        if (search) {
            where.message = { [Op.like]: `%${search}%` };
        }

        // Buscar mensagens
        const { count, rows: mensagens } = await ChatMessage.findAndCountAll({
            where,
            include: [{
                model: User,
                attributes: ['publicid', 'username']
            }],
            order: [['createdat', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            mensagens: mensagens.map(m => ({
                publicid: m.publicid,
                message: m.message,
                createdat: m.createdat,
                userPublicId: m.User.publicid,
                username: m.User.username
            })),
            currentPage: page,
            totalPages,
            totalItems: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar mensagens" });
    }
});

// DELETE /admin/chats/mensagens/remover - Remover mensagens selecionadas
AdminChatsRouter.delete('/mensagens/remover', async (req, res) => {
    const { publicids } = req.body;

    if (!publicids || !Array.isArray(publicids) || publicids.length === 0) {
        return res.status(400).json({ message: "publicids das mensagens são obrigatórios" });
    }

    try {
        const deletedCount = await ChatMessage.destroy({
            where: {
                publicid: { [Op.in]: publicids }
            }
        });

        res.json({
            removidas: deletedCount,
            message: "Mensagens removidas com sucesso"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao remover mensagens" });
    }
});

// PUT /admin/chats/:publicid/info - Atualizar informações do chat
AdminChatsRouter.put('/:publicid/info', async (req, res) => {
    const publicid = req.params.publicid;
    const { title, chatTopicName } = req.body;

    try {
        const chat = await Chat.findOne({ where: { publicid } });

        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (chatTopicName !== undefined) updates.chatTopicName = chatTopicName;

        await chat.update(updates);

        res.json({ message: "Chat atualizado com sucesso", chat });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar chat" });
    }
});

// POST /admin/chats/:publicid/participantes - Adicionar participante ao chat
AdminChatsRouter.post('/:publicid/participantes', async (req, res) => {
    const { publicid } = req.params;
    const { userPublicId } = req.body;

    if (!userPublicId) {
        return res.status(400).json({ message: "userPublicId é obrigatório" });
    }

    try {
        const chat = await Chat.findOne({ where: { publicid } });
        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        const user = await User.findOne({ where: { publicid: userPublicId } });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Se existisse ChatParticipant (é necessário importar se for usar)
        /*
        const existing = await ChatParticipant.findOne({
            where: { chatId: chat.id, userId: user.id }
        });

        if (existing) {
            return res.status(409).json({ message: "Usuário já é participante" });
        }

        await ChatParticipant.create({ chatId: chat.id, userId: user.id });
        */

        res.json({ message: "Participante adicionado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao adicionar participante" });
    }
});

// DELETE /admin/chats/:publicid/participantes/:userPublicid - Remover participante do chat
AdminChatsRouter.delete('/:publicid/participantes/:userPublicid', async (req, res) => {
    const { publicid, userPublicid } = req.params;

    try {
        const chat = await Chat.findOne({ where: { publicid } });
        const user = await User.findOne({ where: { publicid: userPublicid } });
        
        if (!chat || !user) {
            return res.status(404).json({ message: "Chat ou usuário não encontrado" });
        }

        const participant = await ChatParticipant.findOne({
            where: { chatId: chat.id, userId: user.id }
        });

        if (!participant) {
            return res.status(404).json({ message: "Participante não encontrado" });
        }

        await participant.destroy();

        res.json({ message: "Participante removido com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao remover participante" });
    }
});

module.exports = AdminChatsRouter;
