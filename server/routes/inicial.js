const express = require("express");
const InicialRouter = express.Router();

InicialRouter.get('/', async (req, res) => {
    const locals = {
        title: "Teco",
        description: "Página inicial",
        version: process.env.VERSION,
        loggedUser: req.user // Garante que o usuário logado chegue ao front-end
    }
    res.render('pages/index', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

InicialRouter.get('/register', async (req, res) => {
    const locals = {
        title: "Registrar - Teco",
        description: "Crie sua conta no Teco",
        version: process.env.VERSION,
    }
    res.render('pages/auth/register', {
        layout: 'layouts/main-sem-barra',
        locals: locals,
        HOST: process.env.HOST
    });
});

InicialRouter.get('/login', async (req, res) => {
    const locals = {
        title: "Login - Teco",
        description: "Faça login na sua conta do Teco",
        version: process.env.VERSION,
    }
    res.render('pages/auth/login', {
        layout: 'layouts/main-sem-barra',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = InicialRouter;