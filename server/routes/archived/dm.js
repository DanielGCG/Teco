const express = require("express");
const DMsRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

DMsRouter.get('/', renderStaticPage('pages/chats/dm', {
    title: 'Mensagens Diretas',
    description: 'Suas DMs'
}));

module.exports = DMsRouter;
