const express = require("express");
const AdminRouter = express.Router();

// Importar todos os roteadores administrativos
const AdminUsersRouter = require("./users");
const AdminCartinhasRouter = require("./cartinhas");
const AdminChatsRouter = require("./chats");

// ==================== Rotas Administrativas ====================

// Rotas de usuários administrativos
AdminRouter.use("/users", AdminUsersRouter);

// Rotas de cartinhas administrativas  
AdminRouter.use("/cartinhas", AdminCartinhasRouter);

// Rotas de chats administrativos
AdminRouter.use("/chats", AdminChatsRouter);

module.exports = AdminRouter;