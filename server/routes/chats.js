const express = require("express");
const ChatsRouter = express.Router();

ChatsRouter.get('/:id', async (req, res) => {
    const chatName = req.params.id;
    const locals = {
        title: `Chat ${chatName}`,
        description: "Converse em tempo real!",
        version: process.env.VERSION,
    }
    res.render('pages/chats/chat', {
        layout: 'layouts/main',
        locals: locals,
        chatName: chatName,
        HOST: process.env.HOST
    });
});

module.exports = ChatsRouter;