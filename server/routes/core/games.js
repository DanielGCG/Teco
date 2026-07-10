const express = require("express");
const GamesRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

GamesRouter.get('/pet', renderStaticPage('pages/pet/pet', {
    title: 'BoteGotchi',
    description: 'Cuide do seu BoteGotchi!',
    layout: 'layouts/empty'
}));

GamesRouter.get('/pet/cemiterio', renderStaticPage('pages/pet/cemiterio', {
    title: 'Cemiterio BoteGotchi',
    description: 'Historico dos seus pets falecidos',
    layout: 'layouts/empty'
}));

module.exports = GamesRouter;