const express = require("express");
const CartinhasRouter = express.Router();

CartinhasRouter.get('/', async (req, res) => {
    const locals = {
        title: `Correio`,
        description: "Gerencie suas cartinhas",
        icon: "📬",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/cartinhas', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/recebidas', async (req, res) => {
    const locals = {
        title: `Caixa de entrada`,
        description: "Suas cartinhas recebidas",
        icon: "📩",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/recebidas', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/escrever', async (req, res) => {
    const locals = {
        title: `Escrever Cartinha`,
        description: "Escreva uma nova cartinha",
        icon: "✏️",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/escrever', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/favoritas', async (req, res) => {
    const locals = {
        title: `Cartinhas Favoritas`,
        description: "Suas cartinhas favoritas guardadas com carinho",
        icon: "⭐",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/favoritas', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

CartinhasRouter.get('/enviadas', async (req, res) => {
    const locals = {
        title: `Cartinhas Enviadas`,
        description: "Gerencie as cartinhas que você enviou",
        icon: "📤",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/cartinhas/enviadas', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = CartinhasRouter;
