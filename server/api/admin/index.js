const express = require("express");
const AdminRouter = express.Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");

// Protege todas as rotas administrativas da API para Administradores (Cargo 5) ou superior (Dono)
AdminRouter.use(authMiddleware(5));

// Importar todos os roteadores administrativos
const AdminUsersRouter = require("./users");
const AdminCartinhasRouter = require("./cartinhas");
const AdminChatsRouter = require("./chats");
const AdminImagemDoDiaRouter = require("./imagemdodia");
const AdminBadgesRouter = require("./badges");
const AdminConfigRouter = require("./config");
const AdminPetRouter = require("./pet");
const AdminNotificationsRouter = require("./notifications");

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

// Rotas de configurações globais
AdminRouter.use("/config", AdminConfigRouter);

// Rotas de gerenciamento de pets e itens
AdminRouter.use("/pet", AdminPetRouter);

// Rotas de notificações
AdminRouter.use("/notifications", AdminNotificationsRouter);

module.exports = AdminRouter;