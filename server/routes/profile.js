const express = require("express");
const PerfilRouter = express.Router();

PerfilRouter.get('/editar', async (req, res) => {
    const locals = {
        title: `Editar perfil`,
        description: "Edite seu perfil!",
        version: process.env.VERSION,
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
        username: req.params.username
    }
    res.render('pages/social/profile', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = PerfilRouter;