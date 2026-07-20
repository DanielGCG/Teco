const express = require("express");
const AdminRouter = express.Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");

// Importar todos os roteadores administrativos
const AdminUsersRouter = require("./users");
const AdminCartinhasRouter = require("./cartinhas");
const AdminStampsRouter = require("./stamps");
const AdminChatsRouter = require("./chats");
const AdminImagemDoDiaRouter = require("./imagemdodia");
const AdminBadgesRouter = require("./badges");
const AdminConfigRouter = require("./config");
const AdminPetRouter = require("./pet");
const AdminNotificationsRouter = require("./notifications");

const requireAdmin = authMiddleware(5);
const requireMod = authMiddleware(10);

// Rotas exclusivas para Administradores (5) ou superior
AdminRouter.use("/users", requireAdmin, AdminUsersRouter);
AdminRouter.use("/stamps", requireAdmin, AdminStampsRouter);
AdminRouter.use("/chats", requireAdmin, AdminChatsRouter);
AdminRouter.use("/config", requireAdmin, AdminConfigRouter);
AdminRouter.use("/pet", requireAdmin, AdminPetRouter);

// Rotas permitidas para Moderadores (10)
AdminRouter.use("/badges", requireMod, AdminBadgesRouter);
AdminRouter.use("/cartinhas", requireMod, AdminCartinhasRouter);
AdminRouter.use("/imagemdodia", requireMod, AdminImagemDoDiaRouter);
AdminRouter.use("/notifications", requireMod, AdminNotificationsRouter);

module.exports = AdminRouter;