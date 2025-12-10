const express = require("express");
const FeaturesRouter = express.Router();

FeaturesRouter.get('/watchlist', async (req, res) => {
    const locals = {
        title: `Watchlist`,
        description: "Lista de Filmes",
        version: process.env.VERSION,
    }
    res.render('pages/features/watchlist', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

FeaturesRouter.get('/credits', async (req, res) => {
    const locals = {
        title: `Créditos`,
        description: "Agracedimentos e Créditos",
        version: process.env.VERSION,
    }
    res.render('pages/features/credits', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = FeaturesRouter;