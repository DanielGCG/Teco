const express = require("express");
const FriendRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

FriendRouter.get('/', renderStaticPage('pages/social/lista-amigos', {
    title: 'Painel social',
    description: 'Gerencie suas conexões'
}));

module.exports = FriendRouter;