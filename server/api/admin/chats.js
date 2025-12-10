const express = require("express");
const AdminChatsRouter = express.Router();
const { Chat, ChatMessage, ChatParticipant, User } = require("../../models");
const { Op, fn, col, literal } = require("sequelize");

// ==================== Endpoints Administrativos de Chats ====================

// GET /admin/chats/estatisticas - Estatísticas gerais de chats
AdminChatsRouter.get('/estatisticas', async (req, res) => {
    try {
        const totalChats = await Chat.count();
        const totalDms = await Chat.count({ where: { tipo: 'dm' } });
        const totalPublicos = await Chat.count({ where: { tipo: 'public' } });
        const totalMensagens = await ChatMessage.count();
        const usuariosAtivos = await ChatParticipant.count({ distinct: true, col: 'user_id' });

        res.json({
            total_chats: totalChats,
            total_dms: totalDms,
            total_publicos: totalPublicos,
            total_mensagens: totalMensagens,
            usuarios_ativos: usuariosAtivos
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar estatísticas de chats" });
    }
});

// GET /admin/chats - Listar todos os chats com informações detalhadas
AdminChatsRouter.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const tipo = req.query.tipo; // 'dm' ou 'public'
    const search = req.query.search; // busca por nome ou participantes

    const offset = (page - 1) * limit;

    try {
        // Construir filtros
        const where = {};
        
        if (tipo) {
            where.tipo = tipo;
        }

        if (search && search.trim() !== '') {
            where.nome = { [Op.like]: `%${search}%` };
        }

        // Query simplificada - buscar chats básicos primeiro
        const { count, rows: chats } = await Chat.findAndCountAll({
            where,
            include: [{
                model: User,
                as: 'criador',
                attributes: ['username']
            }],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        // Buscar estatísticas para cada chat
        for (let chat of chats) {
            // Contar participantes
            const participantCount = await ChatParticipant.count({
                where: { chat_id: chat.id }
            });
            
            // Contar mensagens
            const messageCount = await ChatMessage.count({
                where: { chat_id: chat.id }
            });
            
            // Última mensagem
            const lastMessage = await ChatMessage.findOne({
                where: { chat_id: chat.id },
                order: [['created_at', 'DESC']],
                attributes: ['created_at']
            });

            // Buscar participantes
            const participantes = await User.findAll({
                include: [{
                    model: ChatParticipant,
                    where: { chat_id: chat.id },
                    attributes: []
                }],
                attributes: ['id', 'username'],
                raw: true
            });
            
            chat.dataValues.total_participantes = participantCount;
            chat.dataValues.total_mensagens = messageCount;
            chat.dataValues.ultima_mensagem = lastMessage?.created_at || null;
            chat.dataValues.participantes = participantes;
            chat.dataValues.criado_por_username = chat.criador.username;
        }

        const totalPages = Math.ceil(count / limit);

        res.json({
            chats,
            currentPage: page,
            totalPages,
            totalItems: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar chats" });
    }
});

// GET /admin/chats/:chatId - Detalhes de um chat específico
AdminChatsRouter.get('/:chatId', async (req, res) => {
    const chatId = req.params.chatId;

    try {
        // Buscar informações do chat
        const chat = await Chat.findByPk(chatId, {
            include: [{
                model: User,
                as: 'criador',
                attributes: ['username']
            }]
        });

        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        // Buscar participantes
        const participantes = await ChatParticipant.findAll({
            where: { chat_id: chatId },
            include: [{
                model: User,
                attributes: ['id', 'username', 'profile_image']
            }]
        });

        // Buscar estatísticas de mensagens
        const msgStats = await ChatMessage.findOne({
            where: { chat_id: chatId },
            attributes: [
                [fn('COUNT', col('id')), 'total_mensagens'],
                [fn('MIN', col('created_at')), 'primeira_mensagem'],
                [fn('MAX', col('created_at')), 'ultima_mensagem']
            ],
            raw: true
        });

        const response = {
            ...chat.toJSON(),
            criado_por_username: chat.criador.username,
            participantes: participantes.map(p => p.User),
            estatisticas_mensagens: msgStats
        };

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar detalhes do chat" });
    }
});

// DELETE /admin/chats/:chatId - Deletar um chat
AdminChatsRouter.delete('/:chatId', async (req, res) => {
    const chatId = req.params.chatId;

    try {
        const chat = await Chat.findByPk(chatId);
        
        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        // Deletar chat (CASCADE via modelo vai deletar mensagens e participantes)
        await chat.destroy();

        res.json({ message: "Chat deletado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar chat" });
    }
});

// GET /admin/chats/:chatId/mensagens - Listar mensagens de um chat (admin)
AdminChatsRouter.get('/:chatId/mensagens', async (req, res) => {
    const chatId = req.params.chatId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search; // busca por conteúdo da mensagem

    const offset = (page - 1) * limit;

    try {
        // Verificar se o chat existe
        const chat = await Chat.findByPk(chatId);
        
        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        // Construir filtros
        const where = { chat_id: chatId };

        if (search) {
            where.mensagem = { [Op.like]: `%${search}%` };
        }

        // Buscar mensagens
        const { count, rows: mensagens } = await ChatMessage.findAndCountAll({
            where,
            include: [{
                model: User,
                attributes: ['id', 'username']
            }],
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            mensagens: mensagens.map(m => ({
                id: m.id,
                mensagem: m.mensagem,
                created_at: m.created_at,
                user_id: m.User.id,
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
    const { mensagemIds } = req.body;

    if (!mensagemIds || !Array.isArray(mensagemIds) || mensagemIds.length === 0) {
        return res.status(400).json({ message: "IDs de mensagens são obrigatórios" });
    }

    try {
        // Converter IDs para integers e filtrar valores válidos
        const validIds = mensagemIds.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));

        if (validIds.length === 0) {
            return res.status(400).json({ message: "Nenhum ID válido fornecido" });
        }

        const deletedCount = await ChatMessage.destroy({
            where: {
                id: { [Op.in]: validIds }
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

// PUT /admin/chats/:chatId - Atualizar informações do chat
AdminChatsRouter.put('/:chatId', async (req, res) => {
    const chatId = req.params.chatId;
    const { nome, tipo } = req.body;

    try {
        const chat = await Chat.findByPk(chatId);

        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        const updates = {};
        if (nome !== undefined) updates.nome = nome;
        if (tipo !== undefined) updates.tipo = tipo;

        await chat.update(updates);

        res.json({ message: "Chat atualizado com sucesso", chat });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar chat" });
    }
});

// POST /admin/chats/:chatId/participantes - Adicionar participante ao chat
AdminChatsRouter.post('/:chatId/participantes', async (req, res) => {
    const chatId = req.params.chatId;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "userId é obrigatório" });
    }

    try {
        const chat = await Chat.findByPk(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat não encontrado" });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Verificar se já é participante
        const existing = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId }
        });

        if (existing) {
            return res.status(409).json({ message: "Usuário já é participante" });
        }

        await ChatParticipant.create({ chat_id: chatId, user_id: userId });

        res.json({ message: "Participante adicionado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao adicionar participante" });
    }
});

// DELETE /admin/chats/:chatId/participantes/:userId - Remover participante do chat
AdminChatsRouter.delete('/:chatId/participantes/:userId', async (req, res) => {
    const { chatId, userId } = req.params;

    try {
        const participant = await ChatParticipant.findOne({
            where: { chat_id: chatId, user_id: userId }
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
