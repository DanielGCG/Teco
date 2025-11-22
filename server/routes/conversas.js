const express = require("express");
const ConversasRouter = express.Router();

ConversasRouter.get('/', async (req, res) => {
    const locals = {
        title: `Conversas`,
        description: "Lista de conversas",
        version: process.env.VERSION,
    }
    res.render('pages/conversas', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = ConversasRouter;
