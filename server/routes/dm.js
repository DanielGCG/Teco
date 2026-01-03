const express = require("express");
const DMsRouter = express.Router();

DMsRouter.get('/', async (req, res) => {
    const locals = {
        title: `Mensagens Diretas`,
        description: "Lista de mensagens diretas",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/chats/dm', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = DMsRouter;
