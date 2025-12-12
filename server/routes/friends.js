const express = require("express");
const FriendRouter = express.Router();

FriendRouter.get('/', async (req, res) => {
    const locals = {
        title: `Meus Amigos`,
        description: "Gerencie suas amizades e pedidos",
        icon: '👥',
        version: process.env.VERSION,
    }
    res.render('pages/social/lista-amigos', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = FriendRouter;