const express = require("express");
const ChatsRouter = express.Router();
const { Chat, ChatMessage, User } = require("../models");
const { Op } = require("sequelize");

// ==================== Endpoints de Gerenciamento de Chats Públicos ====================

// GET /chats - Lista todos os chats públicos disponíveis
ChatsRouter.get('/', async (req, res) => {
    try {
        const chats = await Chat.findAll({
            include: [{
                model: User,
                as: 'creator',
                attributes: ['username']
            }],
            order: [['createdat', 'DESC']]
        });

        const chatList = chats.map(chat => ({
            id: chat.id,
            publicid: chat.publicid,
            title: chat.title,
            creatorusername: chat.creator?.username || 'Desconhecido',
            createdat: chat.createdat,
            chatTopicName: chat.chatTopicName,
            lastmessageat: chat.lastmessageat
        }));

        res.json(chatList);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar chats" });
    }
});

// GET /chats/users - Lista todos os usuários para criação de DM (usado no admin)
ChatsRouter.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username'],
            order: [['username', 'ASC']]
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar usuários" });
    }
});

module.exports = ChatsRouter;
