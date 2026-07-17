const express = require("express");
const InicialRouter = express.Router();
const { renderStaticPage, renderPage } = require("../../utils/render");
const { SystemConfig } = require("../../models");

InicialRouter.get('/', async (req, res) => {
    try {
        const carouselConfig = await SystemConfig.findOne({ where: { key: 'index_carousel' } });
        
        let indexCarousel = [];
        if (carouselConfig && carouselConfig.value) {
            try { indexCarousel = JSON.parse(carouselConfig.value); } catch(e){}
        }

        renderPage(req, res, 'pages/index', {
            title: 'Site do Boteco - Início',
            description: 'Página inicial do Boteco',
            botecoAnalyticsUrl: process.env.BOTECOANALYTICS_URL,
            locals: {
                indexCarousel: indexCarousel
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro interno");
    }
});

InicialRouter.get('/feed', renderStaticPage('pages/feed', {
    title: 'Feed do Boteco',
    description: 'Feed de postagens'
}));

InicialRouter.get('/register', renderStaticPage('pages/auth/register', {
    title: 'Registro',
    description: 'Crie sua conta do Teco',
    layout: 'layouts/empty'
}));

InicialRouter.get('/login', renderStaticPage('pages/auth/login', {
    title: 'Login',
    description: 'Faça login na sua conta do Teco',
    layout: 'layouts/empty'
}));

module.exports = InicialRouter;