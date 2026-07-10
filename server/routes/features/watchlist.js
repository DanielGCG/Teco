const express = require("express");
const WatchListRouter = express.Router();
const { renderStaticPage } = require("../../utils/render");

WatchListRouter.get('/', renderStaticPage('pages/watchlist', {
    title: 'Watchlist',
    description: 'Lista de filmes'
}));

module.exports = WatchListRouter;