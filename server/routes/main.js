const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');

// Rota de admin - Requer role 1 (administrador)
router.use("/admin", authMiddleware(1), require("./admin"));

// Rota de chats
router.use("/chat", require("./chat"));

// Rota de DMs (mensagens diretas)
router.use("/dms", require("./dm"));

// Rota de cartinhas
router.use("/cartinhas", require("./cartinhas"));

// Rota de amigos
router.use("/amigos", require("./friends"));

// Rota de perfil (agora na raiz /@username)
router.use("/", require("./profile"));

// Rota de features
router.use("/", require("./features"));

// Rota de nao relacionado
router.use("/", require("./naorelacionado"));

// Rota inicial
router.use("/", require("./inicial"));

module.exports = router;