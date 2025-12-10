const express = require("express");
const DMsRouter = express.Router();

DMsRouter.get('/', async (req, res) => {
    const locals = {
        title: `Mensagens Diretas`,
        description: "Lista de mensagens diretas",
        version: process.env.VERSION,
    }
    res.render('pages/chats/dms', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = DMsRouter;
