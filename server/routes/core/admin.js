const express = require('express');
const AdminRouter = express.Router();
const { renderStaticPage } = require('../../utils/render');

const { authMiddleware } = require('../../middlewares/authMiddleware');

const adminRender = (view, title, description) => 
    renderStaticPage(`pages/${view}`, { title, description, layout: 'layouts/no-sidebar' });

// Todos na rota /admin já passaram pelo authMiddleware(10) no main.js
// Apenas revalidamos para rotas que exigem Admin(5).
const requireAdmin = authMiddleware(5);

AdminRouter.get('', adminRender('admin', 'Area de administrador', 'Use com cuidado!'));

// Rotas de Admin (5)
AdminRouter.get('/criar-chat', requireAdmin, adminRender('admin/criar-chat', 'Gerenciar Chats & DMs', 'Crie, edite ou remova chats e DMs'));
AdminRouter.get('/editar-usuario', requireAdmin, adminRender('admin/editar-usuario', 'Editar usuários', 'Edite usuários existentes'));
AdminRouter.get('/resetar-senha-usuario', requireAdmin, adminRender('admin/resetar-senha-usuario', 'Resetar senha de usuário', 'Resete a senha de usuários existentes'));
AdminRouter.get('/gerenciar-stamps', requireAdmin, adminRender('admin/gerenciar-stamps', 'Gerenciar Stamps', 'Adicione ou remova stamps do servidor'));
AdminRouter.get('/config', requireAdmin, adminRender('admin/config', 'Configurações globais', 'Controle o servidor e arquivos'));
AdminRouter.get('/pet', requireAdmin, adminRender('admin/pet', 'Gerenciar BoteGotchi', 'Configure itens e resgates'));

// Rotas de Moderador (10)
AdminRouter.get('/notificacoes', adminRender('admin/notificacoes', 'Gerenciar Notificações', 'Envie notificações push para os usuários'));
AdminRouter.get('/imagemdodia', adminRender('admin/imagemdodia', 'Gerenciar imagem do dia', 'Controle a fila e molduras'));
AdminRouter.get('/editar-cartinha', adminRender('admin/editar-cartinha', 'Moderar Cartinhas', 'Gerencie e modere cartinhas do servidor'));
AdminRouter.get('/badges', adminRender('admin/badges', 'Gerenciar badges', 'Controle as badges'));
AdminRouter.get('/marquee', adminRender('admin/marquee', 'Configurações de Marquee', 'Controle o letreiro global'));
AdminRouter.get('/carrossel', adminRender('admin/carrossel', 'Carrossel Principal', 'Controle as imagens da página inicial'));

module.exports = AdminRouter;