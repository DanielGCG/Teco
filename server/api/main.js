const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');

const UsersRouter = require("./users");
const ChatsRouter = require("./chat");
const DMsRouter = require("./dm");
const CartinhasRouter = require("./cartinhas");
const AdminRouter = require("./admin/index");
const WatchlistRouter = require("./watchlist");
const NotificationsRouter = require("./notifications");
const FriendsRouter = require("./friends");
const FollowsRouter = require("./follows");
const PostsRouter = require("./posts");
const ImagemDoDiaRouter = require("./imagemdodia");
const GaleriaRouter = require("./galeria-api");
const BadgesRouter = require("./badges");

// Rotas de usuários (tem rotas públicas e protegidas dentro)
router.use("/users", UsersRouter);

// Rotas protegidas (requer autenticação)
router.use("/chats", authMiddleware(20), ChatsRouter);
router.use("/dms", authMiddleware(20), DMsRouter);
router.use("/cartinhas", authMiddleware(20), CartinhasRouter);
router.use("/watchlist", authMiddleware(20), WatchlistRouter);
router.use("/friends", authMiddleware(20), FriendsRouter);
router.use("/follows", authMiddleware(20), FollowsRouter);
router.use("/posts", authMiddleware(20), PostsRouter);
router.use("/notifications", authMiddleware(20), NotificationsRouter);
router.use("/imagemdodia", authMiddleware(20), ImagemDoDiaRouter);
router.use("/galeria", authMiddleware(20), GaleriaRouter);
router.use("/badges", authMiddleware(20), BadgesRouter);
router.use("/admin", authMiddleware(5), AdminRouter);

module.exports = router;
