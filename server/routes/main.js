const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');

// Core
router.use("/admin", authMiddleware(10), require("./core/admin"));
router.use("/", require("./core/games"));
router.use("/", require("./core/naorelacionado"));
router.use("/", require("./core/inicial"));

// Social
router.use("/amigos", require("./social/friends"));
router.use("/", require("./social/profile"));

// Features
router.use("/", require("./features/features"));
router.use("/", require("./features/watchlist"));

// Messaging
router.use("/cartinhas", require("./messaging/cartinhas"));

module.exports = router;
