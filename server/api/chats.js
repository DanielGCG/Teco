const express = require("express");
const ChatsRouter = express.Router();
const { Chat, ChatMessage, ChatRead, User } = require("../models");
const { Op } = require("sequelize");

// ==================== Endpoints de Gerenciamento de Chats Públicos ====================

// GET /chats - Lista todos os chats públicos disponíveis
ChatsRouter.get('/', async (req, res) => {
    try {
        const chats = await Chat.findAll({
            where: { tipo: 'public' },
            include: [{
                model: User,
                as: 'criador',
                attributes: ['username']
            }],
            order: [['created_at', 'DESC']]
        });

        // Para cada chat, conta mensagens não lidas
        const chatsWithUnreadCount = await Promise.all(chats.map(async (chat) => {
            // Busca o último registro de leitura do usuário neste chat
            const chatRead = await ChatRead.findOne({
                where: {
                    chat_id: chat.id,
                    user_id: req.user.id
                }
            });

            const lastReadId = chatRead ? chatRead.last_read_message_id : 0;

            // Conta mensagens após o último lido (que não sejam do próprio usuário)
            const unreadCount = await ChatMessage.count({
                where: {
                    chat_id: chat.id,
                    id: { [Op.gt]: lastReadId },
                    user_id: { [Op.ne]: req.user.id }
                }
            });

            return {
                id: chat.id,
                nome: chat.nome,
                criado_por: chat.criador?.username || 'Desconhecido',
                created_at: chat.created_at,
                unreadCount
            };
        }));

        res.json(chatsWithUnreadCount);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar chats" });
    }
});

module.exports = ChatsRouter;
