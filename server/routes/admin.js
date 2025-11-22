const express = require('express');
const AdminRouter = express.Router();

AdminRouter.get('', async (req, res) => {
    const locals = {
        title: `Area de Administrador`,
        description: "Tenha cuidado!",
        icon: '⚠️',
        version: process.env.VERSION,
    }
    res.render('pages/admin', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

AdminRouter.get('/criar-chat', async (req, res) => {
    const locals = {
        title: `Criar Chat/DM`,
        description: "Crie novos chats/DMs",
        version: process.env.VERSION,
    }
    res.render('pages/admin/criar-chat', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/editar-chat', async (req, res) => {
    const locals = {
        title: `Editar Chat/DM`,
        description: "Edite chats/DMs existentes",
        version: process.env.VERSION,
    }
    res.render('pages/admin/editar-chat', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/editar-usuario', async (req, res) => {
    const locals = {
        title: `Editar Usuário`,
        description: "Edite usuários existentes",
        version: process.env.VERSION,
    }
    res.render('pages/admin/editar-usuario', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/resetar-senha-usuario', async (req, res) => {
    const locals = {
        title: `Resetar senha de usuário`,
        description: "Resete a senha de usuários existentes",
        version: process.env.VERSION,
    }
    res.render('pages/admin/resetar-senha-usuario', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/editar-cartinha', async (req, res) => {
    const locals = {
        title: `Gerenciar Cartinhas`,
        description: "Gerencie e remova cartinhas",
        version: process.env.VERSION,
    }
    res.render('pages/admin/editar-cartinha', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/teste-notificacoes', async (req, res) => {
    const locals = {
        title: `Teste de Notificações`,
        icon: '🔔',
        description: "Teste o sistema de notificações externas",
        version: process.env.VERSION,
    }
    res.render('pages/teste-notificacoes', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

module.exports = AdminRouter;