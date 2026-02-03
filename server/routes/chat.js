const express = require("express");
const ChatsRouter = express.Router();

// Rota para listar chats públicos
ChatsRouter.get('/', async (req, res) => {
    const locals = {
        title: "Chats Públicos",
        description: "Escolha uma sala para conversar!",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/chats/chat', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

ChatsRouter.get('/:id', async (req, res) => {
    const chatName = req.params.id;
    const locals = {
        title: `Chat ${chatName}`,
        description: "Converse em tempo real!",
        version: process.env.VERSION,
        chatName: chatName,
        loggedUser: req.user
    }
    res.render('pages/chats/chat', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = ChatsRouter;