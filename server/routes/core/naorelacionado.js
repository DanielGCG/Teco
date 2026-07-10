const express = require("express");
const NaoRelacionadoRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

NaoRelacionadoRouter.get('/rpg_site', renderStaticPage('pages/naorelacionado/RPG', {
    title: 'RPG',
    description: '???',
    layout: 'layouts/empty'
}));

NaoRelacionadoRouter.get('/easter_egg/carolls', renderStaticPage('pages/naorelacionado/easter_egg/carol', {
    title: 'Carolls',
    description: '???',
    layout: 'layouts/empty'
}));

NaoRelacionadoRouter.get('/easter_egg/velas', renderStaticPage('pages/naorelacionado/easter_egg/velas', {
    title: 'Velas',
    description: '???',
    layout: 'layouts/empty'
}));

module.exports = NaoRelacionadoRouter;