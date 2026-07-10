const express = require('express');
const AdminRouter = express.Router();
const { renderStaticPage } = require('../../utils/render');

const adminRender = (view, title, description) => 
    renderStaticPage(`pages/${view}`, { title, description, layout: 'layouts/no-sidebar' });

AdminRouter.get('', adminRender('admin', 'Area de administrador', 'Use com cuidado!'));
AdminRouter.get('/criar-chat', adminRender('admin/criar-chat', 'Gerenciar Chats & DMs', 'Crie, edite ou remova chats e DMs'));
AdminRouter.get('/editar-usuario', adminRender('admin/editar-usuario', 'Editar usuários', 'Edite usuários existentes'));
AdminRouter.get('/resetar-senha-usuario', adminRender('admin/resetar-senha-usuario', 'Resetar senha de usuário', 'Resete a senha de usuários existentes'));
AdminRouter.get('/editar-cartinha', adminRender('admin/editar-cartinha', 'Gerenciar cartinhas', 'Gerencie e remova cartinhas'));
AdminRouter.get('/notificacoes', adminRender('admin/notificacoes', 'Gerenciar Notificações', 'Envie notificações push para os usuários'));
AdminRouter.get('/teste-notificacoes', adminRender('teste-notificacoes', 'Teste de notificações', 'Teste o sistema de notificações externas'));
AdminRouter.get('/imagemdodia', adminRender('admin/imagemdodia', 'Gerenciar imagem do dia', 'Controle a fila e molduras'));
AdminRouter.get('/badges', adminRender('admin/badges', 'Gerenciar badges', 'Controle as badges'));
AdminRouter.get('/config', adminRender('admin/config', 'Configurações globais', 'Controle o marquee e outras configurações'));
AdminRouter.get('/pet', adminRender('admin/pet', 'Gerenciar BoteGotchi', 'Configure itens e resgates'));

module.exports = AdminRouter;