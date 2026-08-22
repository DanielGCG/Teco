// ==================== Importações e Configurações Iniciais ====================
require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

// ==================== Middlewares e Plugins ====================
const expressLayout = require('express-ejs-layouts');
const cookieParser = require("cookie-parser");
const { authMiddleware } = require('./server/middlewares/authMiddleware');
const sanitizeMiddleware = require('./server/middlewares/sanitizeMiddleware');

// ==================== Modelos e Utilitários ====================
const { startCronJobs } = require('./server/utils/cronJobs');

// ==================== Inicialização do Servidor ====================
const servidor = express();
const httpServer = http.createServer(servidor);
const porta = process.env.PORT;

// Configuração do Socket.IO
const io = new Server(httpServer, {
    cors: {
        credentials: true
    }
});
servidor.set('io', io); // Disponibiliza io para as rotas do express

// ==================== Configurações do Express ====================
// Middlewares de parse e segurança
servidor.use(cookieParser());
servidor.use(express.urlencoded({ extended: true }));
servidor.use(express.json());
servidor.use(sanitizeMiddleware);

// Motor de Template e Arquivos Estáticos
servidor.use(expressLayout);
servidor.set('layout', './layouts/main');
servidor.set('view engine', 'ejs');
servidor.set('views', path.join(__dirname, 'views'));
servidor.use(express.static(path.join(__dirname, 'public')));

// Middlewares Customizados Globais
const systemConfigMiddleware = require('./server/middlewares/systemConfigMiddleware');
servidor.use(systemConfigMiddleware);

// ==================== Rotas (Express e Socket.IO) ====================
// API Pública e Rotas Gerais
servidor.use('/api', require('./server/api/api-router'));

// API de notificações
servidor.use('/api/push', authMiddleware(20), require('./server/api/push'));

// Rotas de Páginas
servidor.use('/', authMiddleware(20), require('./server/routes/main'));

// Eventos do Socket.IO
require('./server/routes/socket.router')(io);

// Fallback (404)
servidor.use((req, res) => {
    res.status(404).render('utils/404', {
        layout: 'layouts/empty',
        locals: {
            title: '404',
            description: 'Página não encontrada',
            version: process.env.VERSION
        }
    });
});

// ==================== Inicialização de Serviços ====================
// Rotinas Agendadas
startCronJobs(io);

// Inicia o Servidor HTTP
httpServer.listen(porta, () => {
    console.log(`Servidor rodando na porta: ${porta}`);
});