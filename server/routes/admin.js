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
        title: `Gerenciar Chats & DMs`,
        description: "Crie, edite ou remova chats e conversas diretas",
        version: process.env.VERSION,
    }
    res.render('pages/admin/criar-chat', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});

AdminRouter.get('/editar-chat', async (req, res) => {
    res.redirect('/admin/criar-chat');
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

AdminRouter.get('/imagemdodia', async (req, res) => {
    const locals = {
        title: `Gerenciar Imagem do Dia`,
        description: "Controle a fila e molduras",
        version: process.env.VERSION,
    }
    res.render('pages/admin/imagemdodia', {
        layout: 'layouts/main',
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
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    })
});


module.exports = AdminRouter;