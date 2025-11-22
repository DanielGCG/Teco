const express = require("express");
const InicialRouter = express.Router();

async function getImagemDoDia () {
    res = await fetch(`https://www.botecors.me/API/imagemdodia`);
    const imagemDoDia = await res.json();

    return imagemDoDia;
}

InicialRouter.get('/', async (req, res) => {
    const locals = {
        title: "Teco",
        description: "Página inicial",
        version: process.env.VERSION,
    }
    res.render('pages/index', {
        layout: 'layouts/main',
        locals: locals,
        imagemDoDia: await getImagemDoDia(),
        HOST: process.env.HOST
    });
});

InicialRouter.get('/register', async (req, res) => {
    const locals = {
        title: "Registrar - Teco",
        description: "Crie sua conta no Teco",
        version: process.env.VERSION,
    }
    res.render('pages/register', {
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
    res.render('pages/login', {
        layout: 'layouts/main-sem-barra',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = InicialRouter;