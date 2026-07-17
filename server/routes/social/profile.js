const express = require("express");
const PerfilRouter = express.Router();
const { renderStaticPage, renderPage } = require("../../utils/render");
const { User } = require("../../models");

PerfilRouter.get('/editar', async (req, res, next) => {
    let pageBgColor, pageBgImage, pageBgRepeat;
    if (req.user) {
        pageBgColor = req.user.backgroundcolor;
        pageBgImage = req.user.backgroundimage;
        pageBgRepeat = req.user.backgroundfill;
    }
    renderPage(req, res, 'pages/social/profile-edit', {
        title: 'Editar perfil',
        description: 'Edite seu perfil!',
        locals: {
            botecoAnalyticsUrl: process.env.BOTECOANALYTICS_URL,
            pageBgColor,
            pageBgImage,
            pageBgRepeat,
            ignoreGlobalBg: true
        }
    });
});

PerfilRouter.get('/:username', async (req, res, next) => {
    if (!req.params.username.startsWith('@')) {
        return next();
    }
    
    const targetUser = await User.findOne({ where: { username: req.params.username } });
    let pageBgColor, pageBgImage, pageBgRepeat;
    if (targetUser) {
        pageBgColor = targetUser.backgroundcolor;
        pageBgImage = targetUser.backgroundimage;
        pageBgRepeat = targetUser.backgroundfill;
    }

    renderPage(req, res, 'pages/social/retro-profile', {
        title: 'Perfil',
        description: 'Seu perfil',
        locals: {
            username: req.params.username,
            user: req.user,
            botecoAnalyticsUrl: process.env.BOTECOANALYTICS_URL,
            pageBgColor,
            pageBgImage,
            pageBgRepeat,
            ignoreGlobalBg: true
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