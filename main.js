const express = require('express');
const expressLayout = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require("cookie-parser");
const http = require('http');
const { Server } = require('socket.io');
const authMiddleware = require('./server/middlewares/authMiddleware');

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

// Disponibiliza io para as rotas
servidor.set('io', io);

// Rotas de admin - Nivel de acesso 1
//servidor.use('/admin', checkAuth(1), require('./server/routes/admin.router'));

servidor.use('/api', require('./server/api/main'));

// Rotas principais - Nivel de acesso 0
servidor.use('/', authMiddleware(0), require('./server/routes/main'));

// ==================== Socket.IO ====================
require('./server/routes/socket.router')(io);

httpServer.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
});