const express = require("express");
const NaoRelacionadoRouter = express.Router();

NaoRelacionadoRouter.get('/rpg_site', async (req, res) => {
    const locals = {
        title: `RPG`,
        description: "???",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/naorelacionado/RPG', {
        layout: 'layouts/main-sem-barra',
        locals: locals,
        HOST: process.env.HOST
    });
});

NaoRelacionadoRouter.get('/easter_egg/carolls', async (req, res) => {
    const locals = {
        title: `Carolls`,
        description: "???",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/naorelacionado/easter_egg/carol', {
        layout: 'layouts/main-sem-barra',
        locals: locals,
        HOST: process.env.HOST
    });
});

NaoRelacionadoRouter.get('/easter_egg/velas', async (req, res) => {
    const locals = {
        title: `Velas`,
        description: "???",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/naorelacionado/easter_egg/velas', {
        layout: 'layouts/main-sem-design',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = NaoRelacionadoRouter;