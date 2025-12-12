const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');

const UsersRouter = require("./users");
const ChatsRouter = require("./chats");
const DMsRouter = require("./dms");
const CartinhasRouter = require("./cartinhas");
const AdminRouter = require("./admin/index");
const WatchlistRouter = require("./watchlist");
const NotificationsRouter = require("./notifications");
const FriendsRouter = require("./friends");

// Rotas de usuários (tem rotas públicas e protegidas dentro)
router.use("/users", UsersRouter);

// Rotas protegidas (requer autenticação)
router.use("/chats", authMiddleware(0), ChatsRouter);
router.use("/dms", authMiddleware(0), DMsRouter);
router.use("/cartinhas", authMiddleware(0), CartinhasRouter);
router.use("/watchlist", authMiddleware(0), WatchlistRouter);
router.use("/friends", authMiddleware(0), FriendsRouter);
router.use("/notifications", authMiddleware(0), NotificationsRouter);
router.use("/admin", authMiddleware(1), AdminRouter);

module.exports = router;
