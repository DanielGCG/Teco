const express = require('express');
const { Blog, User, Follow, BlogApplause } = require("../models");
const { uploadImage } = require('../utils/upload');
const { uploadToFileServer } = require('../utils/fileServer');
const { sanitizeFilename } = require('../utils/sanitize');
const { Op } = require('sequelize');
const router = express.Router();

// GET /api/blog
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const filter = req.query.filter || 'all'; // 'all' ou 'following'

        let whereClause = {};

        if (filter === 'following' && req.user) {
            // Pegar IDs dos usuários que o usuário atual segue
            const follows = await Follow.findAll({
                where: { followerUserId: req.user.id },
                attributes: ['followedUserId']
            });
            const followedIds = follows.map(f => f.followedUserId);
            followedIds.push(req.user.id);

            whereClause = {
                authorUserId: {
                    [Op.in]: followedIds
                }
            };
        }

        const { count, rows } = await Blog.findAndCountAll({
            where: whereClause,
            include: [{ model: User, as: 'author', attributes: ['username', 'profileimage', 'publicid', 'roleId'] }],
            order: [['createdat', 'DESC']],
            limit: limit,
            offset: offset
        });

        res.json({
            success: true,
            blogs: rows,
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar blogs', error: error.message });
    }
});

// GET /api/blog/:publicid
router.get('/:publicid', async (req, res) => {
    try {
        const blog = await Blog.findOne({
            where: { publicid: req.params.publicid },
            include: [{ model: User, as: 'author', attributes: ['username', 'profileimage', 'publicid', 'roleId', 'bio'] }]
        });

        if (!blog) return res.status(404).json({ success: false, message: 'Blog não encontrado.' });
        let hasApplauded = false;
        if (req.user) {
            const applause = await BlogApplause.findOne({ where: { blogId: blog.id, userId: req.user.id } });
            if (applause) hasApplauded = true;
        }

        res.json({ success: true, blog, hasApplauded });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar blog', error: error.message });
    }
});

// POST /api/blog (Criar blog)
router.post('/', uploadImage.single('background'), async (req, res) => {
    try {
        const { content, backgroundcolor, backgroundfill, fontcolor, fontfamily } = req.body;
        
        if (!content) {
            return res.status(400).json({ success: false, message: 'Conteúdo é obrigatório.' });
        }

        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (!titleMatch) {
            return res.status(400).json({ success: false, message: 'O artigo deve começar com um título (ex: "# Título").' });
        }
        const title = titleMatch[1].trim();

        let backgroundurl = null;
        if (req.file) {
            const sanitizedFilename = sanitizeFilename(req.file.originalname);
            backgroundurl = await uploadToFileServer({
                buffer: req.file.buffer,
                filename: sanitizedFilename,
                folder: `blogs/${req.user.publicid}/bg`,
                mimetype: req.file.mimetype
            });
        }

        const blog = await Blog.create({
            title,
            content,
            authorUserId: req.user.id,
            backgroundurl: backgroundurl || null,
            backgroundcolor: backgroundcolor || '#f4f4f4',
            backgroundfill: backgroundfill || 'cover',
            fontcolor: fontcolor || '#000000',
            fontfamily: fontfamily || 'Inter'
        });

        res.status(201).json({ success: true, blog });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao criar blog', error: error.message });
    }
});

// PUT /api/blog/:publicid
router.put('/:publicid', uploadImage.single('background'), async (req, res) => {
    try {
        const { content, backgroundcolor, backgroundfill, fontcolor, fontfamily, remove_background } = req.body;
        const blog = await Blog.findOne({ where: { publicid: req.params.publicid } });

        if (!blog) return res.status(404).json({ success: false, message: 'Blog não encontrado.' });
        
        if (blog.authorUserId !== req.user.id && req.user.roleId > 10) {
            return res.status(403).json({ success: false, message: 'Sem permissão para editar.' });
        }

        if (content) {
            const titleMatch = content.match(/^#\s+(.+)$/m);
            if (!titleMatch) {
                return res.status(400).json({ success: false, message: 'O artigo deve começar com um título (ex: "# Título").' });
            }
            blog.title = titleMatch[1].trim();
            blog.content = content;
        }

        if (remove_background === 'true') {
            blog.backgroundurl = null;
        } else if (req.file) {
            const sanitizedFilename = sanitizeFilename(req.file.originalname);
            blog.backgroundurl = await uploadToFileServer({
                buffer: req.file.buffer,
                filename: sanitizedFilename,
                folder: `blogs/${req.user.publicid}/bg`,
                mimetype: req.file.mimetype
            });
        }

        if (backgroundcolor) blog.backgroundcolor = backgroundcolor;
        if (backgroundfill) blog.backgroundfill = backgroundfill;
        if (fontcolor) blog.fontcolor = fontcolor;
        if (fontfamily) blog.fontfamily = fontfamily;

        blog.updatedat = new Date();

        await blog.save();

        res.json({ success: true, blog });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar blog', error: error.message });
    }
});

// DELETE /api/blog/:publicid
router.delete('/:publicid', async (req, res) => {
    try {
        const blog = await Blog.findOne({ where: { publicid: req.params.publicid } });

        if (!blog) return res.status(404).json({ success: false, message: 'Blog não encontrado.' });

        if (blog.authorUserId !== req.user.id && req.user.roleId > 10) {
            return res.status(403).json({ success: false, message: 'Sem permissão para deletar.' });
        }

        await blog.destroy();
        res.json({ success: true, message: 'Blog deletado com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao deletar blog', error: error.message });
    }
});

// POST /api/blog/:publicid/applause (Alternável)
router.post('/:publicid/applause', async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, message: 'Não autorizado.' });

        const blog = await Blog.findOne({ where: { publicid: req.params.publicid } });
        if (!blog) return res.status(404).json({ success: false, message: 'Blog não encontrado.' });

        const existingApplause = await BlogApplause.findOne({
            where: { blogId: blog.id, userId: req.user.id }
        });

        if (existingApplause) {
            await existingApplause.destroy();
            res.json({ success: true, message: 'Aplauso removido.', applauded: false });
        } else {
            await BlogApplause.create({ blogId: blog.id, userId: req.user.id });
            res.json({ success: true, message: 'Artigo aplaudido.', applauded: true });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao processar aplauso', error: error.message });
    }
});

// POST /api/blog/upload (Upload de mídia para o markdown)
router.post('/upload', uploadImage.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }

        const sanitizedFilename = sanitizeFilename(req.file.originalname);
        const imageUrl = await uploadToFileServer({
            buffer: req.file.buffer,
            filename: sanitizedFilename,
            folder: `blogs/${req.user.publicid}`,
            mimetype: req.file.mimetype
        });

        res.json({ success: true, url: imageUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro no upload da imagem', error: error.message });
    }
});

module.exports = router;
