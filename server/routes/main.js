const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// Rota de notificações
//router.use("/notificacao", require("./notification"));

// Rota de admin - Requer role 1 (administrador)
router.use("/admin", authMiddleware(1), require("./admin"));

// Rota de chats
router.use("/chat", require("./chats"));

// Rota de conversas
router.use("/conversas", require("./conversas"));

// Rota de cartinhas
router.use("/cartinhas", require("./cartinhas"));

// Rota de watchlist
router.use("/watchlist", require("./watchlist"));

// Rota de amigos
router.use("/amigos", require("./friends"));

// Rota de perfil
router.use("/perfil", require("./perfil"));

// Rota inicial
router.use("/", require("./inicial"));


module.exports = router;