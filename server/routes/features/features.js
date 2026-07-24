const express = require("express");
const FeaturesRouter = express.Router();
const { execSync } = require("child_process");
const { renderStaticPage, renderPage } = require("../../utils/render");
const { Op } = require('sequelize');
const { Cutucada } = require('../../models');

FeaturesRouter.get('/watchlist', renderStaticPage('pages/features/watchlist', {
    title: 'Watchlist',
    description: 'Lista de filmes'
}));

FeaturesRouter.get('/galerias', renderStaticPage('pages/features/galerias', {
    title: 'Galerias',
    description: 'Galerias disponíveis'
}));

FeaturesRouter.get('/galeria/:id', async (req, res) => {
    renderPage(req, res, 'pages/features/galeria', {
        title: 'Galeria',
        description: 'Visualizando galeria',
        galleryId: req.params.id
    });
});

FeaturesRouter.get('/cutucar', async (req, res) => {
    let remainingNormalPokes = 20;
    let remainingGlobalPokes = 1;

    try {
        if (req.user && req.user.id) {
            const senderId = req.user.id;
            
            const currentUser = await require('../../models/Social/User').User.findByPk(senderId);
            if (currentUser) {
                const now = new Date();
                
                // Cutucadas Normais
                if (!currentUser.lastCutucadaReset || (now - new Date(currentUser.lastCutucadaReset)) >= 60 * 60 * 1000) {
                    remainingNormalPokes = 20;
                } else {
                    remainingNormalPokes = currentUser.cutucadasRestantes;
                }

                // Cutucada Geral
                if (!currentUser.lastCutucadaGeral || (now - new Date(currentUser.lastCutucadaGeral)) >= 24 * 60 * 60 * 1000) {
                    remainingGlobalPokes = 1;
                } else {
                    remainingGlobalPokes = 0;
                }
            }
        }
    } catch (err) {
        console.error('[Cutucar Route]', err);
    }

    renderPage(req, res, 'pages/features/cutucar', {
        title: 'Cutucar',
        description: 'Cutucar',
        remainingNormalPokes,
        remainingGlobalPokes
    });
});

FeaturesRouter.get('/blogs', renderStaticPage('pages/features/blogs', {
    title: 'Blogs',
    description: 'Leia artigos incríveis'
}));

FeaturesRouter.get('/blog/new', async (req, res) => {
    renderPage(req, res, 'pages/features/blog_edit', {
        title: 'Novo Artigo',
        description: 'Escreva um novo artigo',
        blogId: null
    });
});

FeaturesRouter.get('/blog/:id/edit', async (req, res) => {
    renderPage(req, res, 'pages/features/blog_edit', {
        title: 'Editar Artigo',
        description: 'Editando artigo',
        blogId: req.params.id
    });
});

FeaturesRouter.get('/blog/:id', async (req, res) => {
    renderPage(req, res, 'pages/features/blog', {
        title: 'Blog',
        description: 'Lendo artigo',
        blogId: req.params.id
    });
});

FeaturesRouter.get('/imagemdodia', renderStaticPage('pages/imagemdodia/album', {
    title: 'Imagem do Dia',
    description: 'Conheça o álbum de Imagens do Dia!'
}));

FeaturesRouter.get('/imagemdodia/sugerir', renderStaticPage('pages/imagemdodia/sugerir', {
    title: 'Imagem do Dia',
    description: 'Sugira uma imagem do dia!'
}));

FeaturesRouter.get('/credits', renderStaticPage('utils/credits', {
    title: 'Créditos',
    description: 'Agracedimentos e créditos',
    layout: 'layouts/empty'
}));

FeaturesRouter.get('/changelog', async (req, res) => {
    let commits = [];
    try {
        const gitLog = execSync('git log -n 30 --pretty=format:"%h|%as|%an|%s|%b[END_COMMIT]"').toString();
        
        commits = gitLog.split('[END_COMMIT]').filter(c => c.trim()).map(line => {
            const parts = line.trim().split('|');
            const hash = parts[0];
            const date = parts[1];
            const author = parts[2];
            const subject = parts[3] || '';
            const body = parts.slice(4).join('|').trim();
            
            return { hash, date, author, subject, body };
        });
    } catch (err) {
        console.error('[Changelog] Erro ao buscar git log:', err);
    }

    renderPage(req, res, 'utils/changelog', {
        title: 'Changelog',
        description: 'Histórico de atualizações do sistema',
        layout: 'layouts/empty',
        commits: commits
    });
});

FeaturesRouter.get('/manutencao', async (req, res) => {
    res.status(503);
    renderPage(req, res, 'utils/503', {
        title: '503',
        description: 'Página em construção',
        layout: 'layouts/empty'
    });
});

module.exports = FeaturesRouter;