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

module.exports = PerfilRouter;