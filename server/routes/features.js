const express = require("express");
const FeaturesRouter = express.Router();

FeaturesRouter.get('/watchlist', async (req, res) => {
    const locals = {
        title: `Watchlist`,
        description: "Lista de Filmes",
        version: process.env.VERSION,
    }
    res.render('pages/features/watchlist', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

FeaturesRouter.get('/galerias', async (req, res) => {
    const locals = {
        title: `Galerias`,
        description: "Veja as galerias disponíveis",
        version: process.env.VERSION,
    }
    res.render('pages/features/galerias', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

FeaturesRouter.get('/galeria/:id', async (req, res) => {
    const locals = {
        title: `Galeria`,
        description: "Visualizando galeria",
        version: process.env.VERSION,
    }
    res.render('pages/features/galeria', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST,
        galleryId: req.params.id
    });
});

FeaturesRouter.get('/imagemdodia', async (req, res) => {
    const locals = {
        title: `Imagem do Dia`,
        description: "Conheça o álbum de Imagens do Dia!",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/imagemdodia/album', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

FeaturesRouter.get('/imagemdodia/sugerir', async (req, res) => {
    const locals = {
        title: `Imagem do Dia`,
        description: "Imagem destacada do dia!",
        icon: '',
        version: process.env.VERSION,
    }
    res.render('pages/imagemdodia/sugerir', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

FeaturesRouter.get('/credits', async (req, res) => {
    const locals = {
        title: `Créditos`,
        description: "Agracedimentos e Créditos",
        version: process.env.VERSION,
    }
    res.render('utils/credits', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

const { execSync } = require("child_process");

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

    const locals = {
        title: `Changelog`,
        description: "Histórico de atualizações do sistema",
        version: process.env.VERSION,
    }

    res.render('utils/changelog', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST,
        commits: commits
    });
});

FeaturesRouter.get('/manutencao', async (req, res) => {
    const locals = {
        title: `503`,
        description: "Página em construção",
        version: process.env.VERSION,
    }
    res.status(503).render('utils/503', {
        layout: 'layouts/main',
        locals: locals,
        HOST: process.env.HOST
    });
});

module.exports = FeaturesRouter;