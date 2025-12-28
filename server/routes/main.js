const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

// Rota de admin - Requer role 1 (administrador)
router.use("/admin", authMiddleware(1), require("./admin"));

// Rota de chats
router.use("/chat", require("./chats"));

// Rota de DMs (mensagens diretas)
router.use("/dms", require("./dms"));

// Rota de cartinhas
router.use("/cartinhas", require("./cartinhas"));

// Rota de amigos
router.use("/amigos", require("./friends"));

// Rota de perfil
router.use("/perfil", require("./perfil"));

// Rota de perfil
router.use("/perfil", require("./perfil"));

// Rota de features
router.use("/", require("./features"));

// Rota de nao relacionado
router.use("/", require("./naorelacionado"));

// Rota inicial
router.use("/", require("./inicial"));

module.exports = router;