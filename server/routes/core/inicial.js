const express = require("express");
const InicialRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

InicialRouter.get('/', renderStaticPage('pages/index', {
    title: 'Site do Boteco - Início',
    description: 'Página inicial do Boteco',
    botecoAnalyticsUrl: process.env.BOTECOANALYTICS_URL
}));

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