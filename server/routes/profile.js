const express = require("express");
const PerfilRouter = express.Router();

PerfilRouter.get('/editar', async (req, res) => {
    const locals = {
        title: `Editar perfil`,
        description: "Edite seu perfil!",
        version: process.env.VERSION,
        loggedUser: req.user
    }
    res.render('pages/social/profile-edit', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

PerfilRouter.get('/:username', async (req, res, next) => {
    // Se não começar com @, passa para a próxima rota (evita conflitos com /amigos, /dms, etc)
    if (!req.params.username.startsWith('@')) {
        return next();
    }

    const locals = {
        title: `Perfil`,
        description: "Veja seu perfil",
        version: process.env.VERSION,
        username: req.params.username,
        user: req.user,
        loggedUser: req.user
    }
    res.render('pages/social/profile', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

PerfilRouter.get('/:username/status/:postId', async (req, res, next) => {
    if (!req.params.username.startsWith('@')) {
        return next();
    }

    const locals = {
        title: `Post`,
        description: "Veja o post",
        version: process.env.VERSION,
        username: req.params.username,
        postId: req.params.postId,
        user: req.user,
        loggedUser: req.user
    }
    res.render('pages/social/post-details', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = PerfilRouter;