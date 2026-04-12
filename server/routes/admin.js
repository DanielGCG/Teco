const express = require('express');
const AdminRouter = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');

// Protege todas as rotas deste router para Administradores (Cargo 5) ou superior (Dono)
AdminRouter.use(authMiddleware(5));

AdminRouter.get('', async (req, res) => {
    const locals = {
        title: `Area de administrador`,
        description: "Use com cuidado!",
        version: process.env.VERSION,
    }
    res.render('pages/admin', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    });
});

AdminRouter.get('/criar-chat', async (req, res) => {
    const locals = {
        title: `Gerenciar Chats & DMs`,
        description: "Crie, edite ou remova chats e DMs",
        version: process.env.VERSION,
    }
    res.render('pages/admin/criar-chat', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/editar-usuario', async (req, res) => {
    const locals = {
        title: `Editar usuários`,
        description: "Edite usuários existentes",
        version: process.env.VERSION,
    }
    res.render('pages/admin/editar-usuario', {
        layout: 'layouts/retro-no-sidebar',
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
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/editar-cartinha', async (req, res) => {
    const locals = {
        title: `Gerenciar cartinhas`,
        description: "Gerencie e remova cartinhas",
        version: process.env.VERSION,
    }
    res.render('pages/admin/editar-cartinha', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/teste-notificacoes', async (req, res) => {
    const locals = {
        title: `Teste de notificações`,
        description: "Teste o sistema de notificações externas",
        version: process.env.VERSION,
    }
    res.render('pages/teste-notificacoes', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/imagemdodia', async (req, res) => {
    const locals = {
        title: `Gerenciar imagem do dia`,
        description: "Controle a fila e molduras",
        version: process.env.VERSION,
    }
    res.render('pages/admin/imagemdodia', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/badges', async (req, res) => {
    const locals = {
        title: `Gerenciar badges`,
        description: "Controle as badges",
        version: process.env.VERSION,
    }
    res.render('pages/admin/badges', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/config', async (req, res) => {
    const locals = {
        title: `Configurações globais`,
        description: "Controle o marquee e outras configurações",
        version: process.env.VERSION,
    }
    res.render('pages/admin/config', {
        layout: 'layouts/retro-no-sidebar',
        locals: locals,
        HOST: process.env.HOST
    })
});

module.exports = AdminRouter;