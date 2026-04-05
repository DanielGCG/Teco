const express = require("express");
const CartinhasRouter = express.Router();

CartinhasRouter.get('/', async (req, res) => {
    const locals = {
        title: `Correio`,
        description: "Suas cartinhas",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/cartinhas', {
        layout: 'layouts/retro',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/recebidas', async (req, res) => {
    const locals = {
        title: `Caixa de entrada`,
        description: "Suas cartinhas recebidas",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/recebidas', {
        layout: 'layouts/retro',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/escrever', async (req, res) => {
    const locals = {
        title: `Escrever cartinha`,
        description: "Escreva uma nova cartinha",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/escrever', {
        layout: 'layouts/retro',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/favoritas', async (req, res) => {
    const locals = {
        title: `Cartinhas favoritas`,
        description: "Suas cartinhas favoritas",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/favoritas', {
        layout: 'layouts/retro',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/enviadas', async (req, res) => {
    const locals = {
        title: `Cartinhas enviadas`,
        description: "Gerencie as cartinhas enviou",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/enviadas', {
        layout: 'layouts/retro',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = CartinhasRouter;
