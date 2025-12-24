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

FeaturesRouter.get('/imagemdodia', async (req, res) => {
    const locals = {
        title: `Imagem do Dia`,
        description: "Conheça o álbum de Imagens do Dia!",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/imagemdodia/album', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

FeaturesRouter.get('/imagemdodia/sugerir', async (req, res) => {
    const locals = {
        title: `Imagem do Dia`,
        description: "Imagem destacada do dia!",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/imagemdodia/sugerir', {
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

FeaturesRouter.get('/manutencao', async (req, res) => {
    const locals = {
        title: `503`,
        description: "Página em construção",
        version: process.env.VERSION,
    }
    res.status(503).render('utils/503', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = FeaturesRouter;