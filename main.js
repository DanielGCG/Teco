const express = require('express');
const expressLayout = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { Server } = require('socket.io');
const { authMiddleware } = require('./server/middlewares/authMiddleware');
const { SystemConfig } = require('./server/models');

const servidor = express();
const httpServer = http.createServer(servidor);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        credentials: true
    }
});

const porta = process.env.PORT || 3000;

servidor.use(cookieParser());
servidor.use(express.urlencoded({ extended: true }));
servidor.use(express.json());

servidor.use(expressLayout);
servidor.set('layout', './layouts/main');
servidor.set('view engine', 'ejs');
servidor.set('views', path.join(__dirname, 'views'));
servidor.use(express.static(path.join(__dirname, 'public')));

// Inicializa variáveis globais para as views (opção certeira)
servidor.use(async (req, res, next) => {
    res.locals.loggedUser = null;
    res.locals.user = null;
    res.locals.version = process.env.VERSION;
    res.locals.botecoAnalyticsUrl = process.env.BOTECOANALYTICS_URL;

    try {
        const marqueeConfig = await SystemConfig.findOne({ where: { key: 'marquee' } });
        res.locals.marqueeText = marqueeConfig ? marqueeConfig.value : "Bem-vindo ao Teco!";
    } catch (err) {
        res.locals.marqueeText = "Bem-vindo ao Teco!";
    }

    next();
});

// Disponibiliza io para as rotas
servidor.set('io', io);

servidor.use('/api', require('./server/api/main'));

// Rotas principais - Nivel de acesso 20 (usuário)
servidor.use('/', authMiddleware(20), require('./server/routes/main'));

// Fallback 404 handler (deve ficar após todas as rotas)
servidor.use((req, res) => {
    const locals = {
        title: '404',
        description: 'Página não encontrada',
        version: process.env.VERSION
    };
    res.status(404).render('utils/404', {
        layout: 'layouts/retro-empty',
        locals,
        HOST: process.env.HOST
    });
});

// ==================== Socket.IO ====================
require('./server/routes/socket.router')(io);

httpServer.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
});