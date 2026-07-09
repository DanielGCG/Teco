const express = require("express");
const GamesRouter = express.Router();

GamesRouter.get('/pet', async (req, res) => {
    const locals = {
        title: `BoteGotchi`,
        description: "Cuide do seu BoteGotchi!",
        icon: '',
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/gotchi/pet', {
        layout: 'layouts/empty',
        locals: locals,
        HOST: process.env.HOST
    });
});

GamesRouter.get('/pet/cemiterio', async (req, res) => {
    const locals = {
        title: `Cemiterio BoteGotchi`,
        description: "Historico dos seus pets falecidos",
        icon: '',
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/gotchi/cemiterio', {
        layout: 'layouts/empty',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = GamesRouter;