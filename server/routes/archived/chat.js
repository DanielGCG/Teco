const express = require("express");
const ChatsRouter = express.Router();
const { renderStaticPage, renderPage } = require("../../utils/render");

// Rota para listar chats públicos
ChatsRouter.get('/', renderStaticPage('pages/chats/chat', {
    title: 'Chats públicos',
    description: 'Escolha uma sala para conversar!'
}));

ChatsRouter.get('/:id', async (req, res) => {
    renderPage(req, res, 'pages/chats/chat', {
        title: `Chat ${req.params.id}`,
        description: 'Converse em tempo real!',
        locals: { chatName: req.params.id }
    });
});

module.exports = ChatsRouter;