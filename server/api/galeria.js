const express = require('express');
const { Galeria, GaleriaImagem, GaleriaPermissao, User } = require("../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');
const axios = require('axios'); 
const FormData = require('form-data'); 
const { Op } = require('sequelize');
const router = express.Router();

// Sanitizar nome de arquivo
function sanitizeFilename(filename) {
    if (!filename) return `file_${Date.now()}`;
    const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); 
    const sanitized = normalized.replace(/[^a-zA-Z0-9-_ .]/g, '').replace(/\s+/g, '_'); 
    return sanitized || `file_${Date.now()}`;
}

const uploadImage = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 50 * 1024 * 1024 } 
});

const uploadVideo = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 100 * 1024 * 1024 } 
});

// Middleware para detectar tipo de arquivo e aplicar limite correto
const uploadGaleria = (req, res, next) => {
    const file = req.file;
    if (!file) return next();
    
    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv|avi|mpg|mpeg)$/i.test(file.originalname);
    const limit = isVideo ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
    
    if (file.size > limit) {
        const typeLabel = isVideo ? 'vídeo' : 'imagem';
        return res.status(413).json({ 
            success: false, 
            message: `Arquivo muito grande para o tipo ${typeLabel}. Limite: ${limit / (1024 * 1024)}MB` 
        });
    }
    next();
};

// Middleware permissão
async function checkGaleriaPermission(req, res, next) {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const galeria = await Galeria.findByPk(id);
        if (!galeria) return res.status(404).json({ success: false, message: 'Galeria não encontrada.' });

        if (userRole >= 1) { req.galeria = galeria; return next(); }
        if (galeria.user_id === userId) { req.galeria = galeria; return next(); }
        if (galeria.is_public) { req.galeria = galeria; return next(); }

        const permissao = await GaleriaPermissao.findOne({ where: { galeria_id: id, user_id: userId } });
        if (permissao) { req.galeria = galeria; return next(); }

        return res.status(403).json({ success: false, message: 'Você não tem permissão para editar esta galeria.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao verificar permissões.', error: error.message });
    }
}

// Rotas
router.get('/', async (req, res) => {
    try {
        const galerias = await Galeria.findAll({
            include: [{ model: User, as: 'owner', attributes: ['username', 'profile_image'] }],
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, galerias });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar galerias.', error: error.message });
    }
});

router.post('/', uploadImage.single('capa'), async (req, res) => {
    const { nome, descricao, is_public, card_color, grid_columns } = req.body;
    if (!nome) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });

    try {
        let capa_url = null;
        if (req.file) {
            const sanitizedFilename = sanitizeFilename(req.file.originalname);
            try {
                capa_url = await uploadToFileServer({
                    buffer: req.file.buffer,
                    filename: sanitizedFilename,
                    folder: 'galerias/capas',
                    mimetype: req.file.mimetype
                });
            } catch (err) {
                return res.status(502).json({ success: false, message: 'Erro ao enviar capa.', remoteData: err.response?.data });
            }
        }

        const galeria = await Galeria.create({
            nome, descricao, capa_url,
            user_id: req.user.id,
            is_public: is_public === 'true' || is_public === true,
            card_color: card_color || undefined,
            grid_columns: grid_columns ? parseInt(grid_columns) : undefined
        });

        res.status(201).json({ success: true, galeria });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao criar galeria.', error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const galeria = await Galeria.findByPk(req.params.id, {
            include: [
                { model: User, as: 'owner', attributes: ['username', 'profile_image'] },
                { 
                    model: GaleriaImagem, 
                    as: 'imagens',
                    include: [{ model: User, as: 'uploader', attributes: ['username'] }]
                },
                { model: User, as: 'colaboradores', attributes: ['id', 'username'] }
            ]
        });

        if (!galeria) return res.status(404).json({ success: false, message: 'Galeria não encontrada.' });
        res.json({ success: true, galeria });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao buscar detalhes.', error: error.message });
    }
});

router.post('/:id/upload', checkGaleriaPermission, (req, res, next) => {
    uploadVideo.single('imagem')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Arquivo muito grande. Limite: 100MB' });
            return res.status(400).json({ success: false, message: `Erro no upload: ${err.message}` });
        }
        next();
    });
}, uploadGaleria, async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });

    try {
        const sanitizedFilename = sanitizeFilename(req.file.originalname);
        const fileUrl = await uploadToFileServer({
            buffer: req.file.buffer,
            filename: sanitizedFilename,
            folder: `galerias/${req.params.id}`,
            mimetype: req.file.mimetype
        });

        const maxPos = await GaleriaImagem.max('pos', { where: { galeria_id: req.params.id } });
        const imagem = await GaleriaImagem.create({
            galeria_id: req.params.id,
            url: fileUrl,
            nome: req.body.nome || req.file.originalname,
            user_id: req.user.id,
            pos: (maxPos || 0) + 1,
            grid_w: 1,
            grid_h: 1
        });
        return res.status(201).json({ success: true, imagem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno ao processar upload.', error: error.message });
    }
});

router.delete('/:id/imagem/:imagemId', checkGaleriaPermission, async (req, res) => {
    try {
        const imagem = await GaleriaImagem.findOne({ where: { id: req.params.imagemId, galeria_id: req.params.id } });
        if (!imagem) return res.status(404).json({ success: false, message: 'Imagem não encontrada.' });
        await deleteFromFileServer({ fileUrl: imagem.url });
        await imagem.destroy();
        res.json({ success: true, message: 'Imagem removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao remover imagem.', error: error.message });
    }
});

router.delete('/:id', checkGaleriaPermission, async (req, res) => {
    try {
        if (req.galeria.user_id !== req.user.id && req.user.role < 1) return res.status(403).json({ success: false, message: 'Apenas o dono pode excluir a galeria.' });
        if (req.galeria.capa_url) await deleteFromFileServer({ fileUrl: req.galeria.capa_url });
        if (req.galeria.background_url) await deleteFromFileServer({ fileUrl: req.galeria.background_url });
        
        const imagens = await GaleriaImagem.findAll({ where: { galeria_id: req.params.id } });
        for (const img of imagens) await deleteFromFileServer({ fileUrl: img.url });
        
        await req.galeria.destroy();
        res.json({ success: true, message: 'Galeria excluída com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao excluir galeria.', error: error.message });
    }
});

// PATCH: Atualização completa
router.patch('/:id', 
    checkGaleriaPermission, 
    uploadImage.fields([{ name: 'background', maxCount: 1 }, { name: 'cover_image', maxCount: 1 }]), 
    async (req, res) => {
    
    const getBodyValue = (key) => {
        const val = req.body[key];
        return Array.isArray(val) ? val[0] : val;
    };

    const nome = getBodyValue('nome');
    const descricao = getBodyValue('descricao');
    const is_public = getBodyValue('is_public');
    const colaboradores = getBodyValue('colaboradores');
    const card_color = getBodyValue('card_color');
    const grid_columns = getBodyValue('grid_columns');
    const layout = getBodyValue('layout');
    
    const background_color = getBodyValue('background_color');
    const font_family = getBodyValue('font_family');
    const font_color = getBodyValue('font_color');
    const background_fill = getBodyValue('background_fill');
    
    const remove_background = getBodyValue('remove_background');
    const remove_cover = getBodyValue('remove_cover');

    try {
        if (req.galeria.user_id !== req.user.id && req.user.role < 1) return res.status(403).json({ success: false, message: 'Apenas o dono pode alterar as configurações.' });

        if (nome) req.galeria.nome = nome;
        if (descricao !== undefined) req.galeria.descricao = descricao;
        if (is_public !== undefined) req.galeria.is_public = is_public === 'true' || is_public === true;
        if (card_color !== undefined) req.galeria.card_color = card_color;
        if (grid_columns !== undefined) req.galeria.grid_columns = parseInt(grid_columns) || req.galeria.grid_columns;
        
        if (background_color) req.galeria.background_color = background_color;
        if (font_family) req.galeria.font_family = font_family;
        if (background_fill) req.galeria.background_fill = background_fill;
        if (font_color) req.galeria.font_color = font_color;

        if (remove_background === 'true' || remove_background === true) {
            if (req.galeria.background_url) await deleteFromFileServer({ fileUrl: req.galeria.background_url });
            req.galeria.background_url = null;
        }

        if (remove_cover === 'true' || remove_cover === true) {
            if (req.galeria.capa_url) await deleteFromFileServer({ fileUrl: req.galeria.capa_url });
            req.galeria.capa_url = null;
        }

        const files = req.files || {};
        if (files.background && files.background[0]) {
            const file = files.background[0];
            if (req.galeria.background_url) await deleteFromFileServer({ fileUrl: req.galeria.background_url });
            const sanitizedFilename = sanitizeFilename(file.originalname);
            req.galeria.background_url = await uploadToFileServer({
                buffer: file.buffer,
                filename: sanitizedFilename,
                folder: `galerias/${req.params.id}/style`,
                mimetype: file.mimetype
            });
        }

        if (files.cover_image && files.cover_image[0]) {
            const file = files.cover_image[0];
            if (req.galeria.capa_url) await deleteFromFileServer({ fileUrl: req.galeria.capa_url });
            const sanitizedFilename = sanitizeFilename(file.originalname);
            req.galeria.capa_url = await uploadToFileServer({
                buffer: file.buffer,
                filename: sanitizedFilename,
                folder: 'galerias/capas',
                mimetype: file.mimetype
            });
        }

        await req.galeria.save();

        // --- ATUALIZAÇÃO DO LAYOUT ---
        if (layout) {
            let parsed;
            try { parsed = typeof layout === 'string' ? JSON.parse(layout) : layout; } catch (e) { parsed = null; }
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    // ATUALIZAÇÃO: Adicionado img_fit na extração
                    const { id, grid_w, grid_h, pos, show_title, img_fit } = item;
                    if (!id) continue;
                    
                    const updateData = {
                        grid_w: grid_w || 1,
                        grid_h: grid_h || 1,
                        pos: pos || 0
                    };
                    
                    if (show_title !== undefined) updateData.show_title = show_title;
                    if (img_fit !== undefined) updateData.img_fit = img_fit;

                    try {
                        await GaleriaImagem.update(
                            updateData,
                            { where: { id, galeria_id: req.params.id } }
                        );
                    } catch (e) { /* continue */ }
                }
            }
        }

        if (colaboradores) {
            const colabsArray = typeof colaboradores === 'string' ? JSON.parse(colaboradores) : colaboradores;
            if (Array.isArray(colabsArray)) {
                await GaleriaPermissao.destroy({ where: { galeria_id: req.params.id } });
                const permissoes = colabsArray.map(uId => ({ galeria_id: req.params.id, user_id: uId }));
                await GaleriaPermissao.bulkCreate(permissoes);
            }
        }

        res.json({ success: true, message: 'Galeria atualizada com sucesso.', galeria: req.galeria });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar galeria.', error: error.message });
    }
});

module.exports = router;