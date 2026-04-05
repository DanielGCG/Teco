const express = require("express");
const FriendRouter = express.Router();

FriendRouter.get('/', async (req, res) => {
    const locals = {
        title: `Painel social`,
        description: "Gerencie suas conexões",
        icon: '',
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/social/lista-amigos', {
        layout: 'layouts/retro',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = FriendRouter;