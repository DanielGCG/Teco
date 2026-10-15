const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');

const UsersRouter = require("./social/users");
const GotchiRouter = require("./pet");
const CartinhasRouter = require("./social/cartinhas");
const AdminRouter = require("./admin/index");
const WatchlistRouter = require("./watchlist");
const NotificationsRouter = require("./notifications");
const FollowsRouter = require("./social/follows");
const PostsRouter = require("./social/posts");
const RodinhaRouter = require("./social/rodinha");
const ImagemDoDiaRouter = require("./imagemdodia");
const GaleriaRouter = require("./galeria-api");
const BadgesRouter = require("./social/badges");
const CutucadasRouter = require("./social/cutucadas");
const BlogRouter = require("./blog");

// Rotas praticamente descontinuadas
const ChatsRouter = require("./social/chat");
const DMsRouter = require("./social/dm");



// Rotas de usuários (tem rotas públicas e protegidas dentro)
router.use("/users", UsersRouter);
// Rotas protegidas (requer autenticação)
router.use("/posts", authMiddleware(20), PostsRouter);
router.use("/rodinha", authMiddleware(20), RodinhaRouter);
router.use("/badges", authMiddleware(20), BadgesRouter);
router.use("/notifications", authMiddleware(20), NotificationsRouter);
router.use("/cutucadas", authMiddleware(20), CutucadasRouter);
router.use("/follows", authMiddleware(20), FollowsRouter);
router.use("/cartinhas", authMiddleware(20), CartinhasRouter);
router.use("/watchlist", authMiddleware(20), WatchlistRouter);
router.use("/imagemdodia", authMiddleware(20), ImagemDoDiaRouter);
router.use("/galeria", authMiddleware(20), GaleriaRouter);
router.use("/blog", authMiddleware(20), BlogRouter);
router.use("/pet", authMiddleware(20), GotchiRouter);
router.use("/admin", authMiddleware(5), AdminRouter);

// Rotas praticamente descontinuadas
router.use("/chats", authMiddleware(20), ChatsRouter);
router.use("/dms", authMiddleware(20), DMsRouter);

module.exports = router;
