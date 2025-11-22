const express = require("express");
const WatchListRouter = express.Router();

WatchListRouter.get('/', async (req, res) => {
    const locals = {
        title: `Watchlist`,
        description: "Lista de Filmes",
        version: process.env.VERSION,
    }
    res.render('pages/watchlist', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});


module.exports = WatchListRouter;