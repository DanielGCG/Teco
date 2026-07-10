const express = require("express");
const PerfilRouter = express.Router();
const { renderStaticPage, renderPage } = require("../../utils/render");

PerfilRouter.get('/editar', renderStaticPage('pages/social/profile-edit', {
    title: 'Editar perfil',
    description: 'Edite seu perfil!',
    locals: {
        botecoAnalyticsUrl: process.env.BOTECOANALYTICS_URL
    }
}));

PerfilRouter.get('/:username', async (req, res, next) => {
    if (!req.params.username.startsWith('@')) {
        return next();
    }
    renderPage(req, res, 'pages/social/retro-profile', {
        title: 'Perfil',
        description: 'Seu perfil',
        locals: {
            username: req.params.username,
            user: req.user,
            botecoAnalyticsUrl: process.env.BOTECOANALYTICS_URL
        }
    });
});

PerfilRouter.get('/:username/status/:postId', async (req, res, next) => {
    if (!req.params.username.startsWith('@')) {
        return next();
    }
    renderPage(req, res, 'pages/social/post-details', {
        title: 'Post',
        description: 'Veja o post',
        locals: {
            username: req.params.username,
            postId: req.params.postId,
            user: req.user
        }
    });
});

module.exports = PerfilRouter;