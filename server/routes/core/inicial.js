const express = require("express");
const InicialRouter = express.Router();
const { renderStaticPage, renderPage } = require("../../utils/render");
const { Post, PostMedia, User, PostLike, PostBookmark, PostMention, Follow, SystemConfig, LegalDocument } = require("../../models");
const { authMiddleware } = require("../../middlewares/authMiddleware");

const protect = (minRole = 20) => authMiddleware(minRole);

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

InicialRouter.get('/register', async (req, res) => {
    try {
        const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']], attributes: ['version'] });
        const requireConsent = latestDoc ? true : false;
        
        renderStaticPage('pages/auth/register', {
            title: 'Registro',
            description: 'Crie sua conta do Teco',
            layout: 'layouts/empty',
            locals: { requireConsent }
        })(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro interno");
    }
});

InicialRouter.get('/login', renderStaticPage('pages/auth/login', {
    title: 'Login',
    description: 'Faça login na sua conta do Teco',
    layout: 'layouts/empty'
}));

InicialRouter.get('/termos', async (req, res) => {
    try {
        const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']] });
        const termsText = latestDoc ? latestDoc.termsText : "Nenhum termo cadastrado.";
        
        renderPage(req, res, 'pages/institucional/termos', {
            title: 'Termos de Uso',
            description: 'Termos de Uso do Teco',
            layout: 'layouts/empty',
            locals: { termsText }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro interno");
    }
});

InicialRouter.get('/privacidade', async (req, res) => {
    try {
        const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']] });
        const privacyText = latestDoc ? latestDoc.privacyText : "Nenhuma política de privacidade cadastrada.";
        
        renderPage(req, res, 'pages/institucional/privacidade', {
            title: 'Política de Privacidade',
            description: 'Política de Privacidade do Teco',
            layout: 'layouts/empty',
            locals: { privacyText }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro interno");
    }
});

InicialRouter.get('/consentimento', async (req, res) => {
    try {
        const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']] });
        const currentConsentVersion = latestDoc ? latestDoc.version : 0;

        if (currentConsentVersion === 0 || (req.user && req.user.consentVersion >= currentConsentVersion)) {
            return res.redirect('/');
        }

        const termsText = latestDoc.termsText;
        const privacyText = latestDoc.privacyText;

        renderPage(req, res, 'pages/auth/consentimento', {
            title: 'Atualização de Termos',
            description: 'Novos Termos de Uso e Privacidade',
            layout: 'layouts/empty',
            locals: { termsText, privacyText }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro interno");
    }
});

InicialRouter.get('/verificar-email', protect(20), async (req, res) => {
    // Se o usuário já verificou ou é dono, manda pra home
    if (req.user.emailVerified || req.user.roleId == 1) {
        return res.redirect('/');
    }

    renderPage(req, res, 'pages/auth/verificar-email', {
        title: 'Verifique seu E-mail',
        description: 'Verificação obrigatória anti-spam',
        layout: 'layouts/empty',
        locals: { 
            hasEmail: !!req.user.email,
            email: req.user.email
        }
    });
});

module.exports = InicialRouter;