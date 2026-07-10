const express = require("express");
const InicialRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

InicialRouter.get('/', renderStaticPage('pages/index', {
    title: 'Página inicial',
    description: 'Página inicial'
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