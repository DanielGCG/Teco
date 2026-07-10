const express = require('express');
const expressLayout = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { Server } = require('socket.io');
const { authMiddleware } = require('./server/middlewares/authMiddleware');
const sanitizeMiddleware = require('./server/middlewares/sanitizeMiddleware');
const { SystemConfig } = require('./server/models');

// Importa o monitor do pet
const { startPetMonitor } = require('./server/utils/petMonitor'); 

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
servidor.use(sanitizeMiddleware);

servidor.use(expressLayout);
servidor.set('layout', './layouts/main');
servidor.set('view engine', 'ejs');
servidor.set('views', path.join(__dirname, 'views'));
servidor.use(express.static(path.join(__dirname, 'public')));

// Carrega configurações de sistema
servidor.use(async (req, res, next) => {
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

// Rotas de Push API (precisam de autenticação)
servidor.use('/api/push', authMiddleware(20), require('./server/api/push'));

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
        layout: 'layouts/empty',
        locals,
        HOST: process.env.HOST
    });
});

// ==================== Socket.IO ====================
require('./server/routes/socket.router')(io);

// Inicia a rotina de verificação do BotecoGotchi
startPetMonitor();

httpServer.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
});