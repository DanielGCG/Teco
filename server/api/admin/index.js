const express = require("express");
const AdminRouter = express.Router();

// Importar todos os roteadores administrativos
const AdminUsersRouter = require("./users");
const AdminCartinhasRouter = require("./cartinhas");
const AdminChatsRouter = require("./chats");
const AdminImagemDoDiaRouter = require("./imagemdodia");
const AdminBadgesRouter = require("./badges");

// ==================== Rotas Administrativas ====================

// Rotas de usuários administrativos
AdminRouter.use("/users", AdminUsersRouter);

// Rotas de cartinhas administrativas  
AdminRouter.use("/cartinhas", AdminCartinhasRouter);

// Rotas de chats administrativos
AdminRouter.use("/chats", AdminChatsRouter);

// Rotas de badges administrativas
AdminRouter.use("/badges", AdminBadgesRouter);

// Rotas de imagem do dia administrativas
AdminRouter.use("/imagemdodia", AdminImagemDoDiaRouter);

module.exports = AdminRouter;