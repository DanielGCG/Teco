const express = require('express');
const { Galeria, GaleriaImagem, GaleriaPermissao, User } = require("../models");
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const { Op } = require('sequelize');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Middleware para verificar permissão de edição
async function checkGaleriaPermission(req, res, next) {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const galeria = await Galeria.findByPk(id);
        if (!galeria) return res.status(404).json({ success: false, message: 'Galeria não encontrada.' });

        // Admin ou Dono do site (role >= 1)
        if (userRole >= 1) {
            req.galeria = galeria;
            return next();
        }

        // Dono da galeria
        if (galeria.user_id === userId) {
            req.galeria = galeria;
            return next();
        }

        // Galeria pública (qualquer um pode editar)
        if (galeria.is_public) {
            req.galeria = galeria;
            return next();
        }

        // Usuário com permissão explícita
        const permissao = await GaleriaPermissao.findOne({ where: { galeria_id: id, user_id: userId } });
        if (permissao) {
            req.galeria = galeria;
            return next();
        }

        return res.status(403).json({ success: false, message: 'Você não tem permissão para editar esta galeria.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao verificar permissões.', error: error.message });
    }
}

// Listar todas as galerias
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

// Criar nova galeria
router.post('/', upload.single('capa'), async (req, res) => {
    const { nome, descricao, is_public } = req.body;
    if (!nome) return res.status(400).json({ success: false, message: 'Nome é obrigatório.' });

    try {
        let capa_url = null;
        if (req.file) {
            const pngBuffer = await sharp(req.file.buffer).resize(500, 500, { fit: 'cover' }).png().toBuffer();
            const form = new FormData();
            form.append('file', pngBuffer, { filename: 'capa.png', contentType: 'image/png' });
            form.append('folder', 'galerias/capas');

            const uploadRes = await axios.post(`${process.env.SERVIDORDEARQUIVOS_URL}/upload?folder=galerias/capas`, form, {
                headers: { ...form.getHeaders(), 'x-api-key': process.env.SERVIDORDEARQUIVOS_KEY }
            });
            capa_url = uploadRes.data.url;
        }

        const galeria = await Galeria.create({
            nome,
            descricao,
            capa_url,
            user_id: req.user.id,
            is_public: is_public === 'true' || is_public === true
        });

        res.status(201).json({ success: true, galeria });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao criar galeria.', error: error.message });
    }
});

// Obter detalhes de uma galeria e suas imagens
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
        res.status(500).json({ success: false, message: 'Erro ao buscar detalhes da galeria.', error: error.message });
    }
});

// Upload de imagem para galeria
router.post('/:id/upload', checkGaleriaPermission, upload.single('imagem'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });

    try {
        const processedBuffer = await sharp(req.file.buffer)
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();

        const form = new FormData();
        form.append('file', processedBuffer, { filename: `img_${Date.now()}.png`, contentType: 'image/png' });
        form.append('folder', `galerias/${req.params.id}`);

        const uploadRes = await axios.post(`${process.env.SERVIDORDEARQUIVOS_URL}/upload?folder=galerias/${req.params.id}`, form, {
            headers: { ...form.getHeaders(), 'x-api-key': process.env.SERVIDORDEARQUIVOS_KEY }
        });

        const imagem = await GaleriaImagem.create({
            galeria_id: req.params.id,
            url: uploadRes.data.url,
            nome: req.body.nome || req.file.originalname,
            user_id: req.user.id
        });

        res.status(201).json({ success: true, imagem });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao fazer upload da imagem.', error: error.message });
    }
});

// Deletar imagem da galeria
router.delete('/:id/imagem/:imagemId', checkGaleriaPermission, async (req, res) => {
    try {
        const imagem = await GaleriaImagem.findOne({ where: { id: req.params.imagemId, galeria_id: req.params.id } });
        if (!imagem) return res.status(404).json({ success: false, message: 'Imagem não encontrada.' });

        await imagem.destroy();
        res.json({ success: true, message: 'Imagem removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao remover imagem.', error: error.message });
    }
});

// Deletar galeria
router.delete('/:id', checkGaleriaPermission, async (req, res) => {
    try {
        // Apenas o dono ou admin pode deletar a galeria inteira
        if (req.galeria.user_id !== req.user.id && req.user.role < 1) {
            return res.status(403).json({ success: false, message: 'Apenas o dono pode excluir a galeria.' });
        }

        await req.galeria.destroy();
        res.json({ success: true, message: 'Galeria excluída com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao excluir galeria.', error: error.message });
    }
});

// Atualizar configurações da galeria (pública, colaboradores, estilos)
router.patch('/:id', checkGaleriaPermission, upload.single('background'), async (req, res) => {
    const { nome, descricao, is_public, colaboradores, background_color, font_family } = req.body;

    try {
        // Apenas o dono ou admin pode mudar configurações estruturais
        if (req.galeria.user_id !== req.user.id && req.user.role < 1) {
            return res.status(403).json({ success: false, message: 'Apenas o dono pode alterar as configurações.' });
        }

        if (nome) req.galeria.nome = nome;
        if (descricao !== undefined) req.galeria.descricao = descricao;
        if (is_public !== undefined) req.galeria.is_public = is_public === 'true' || is_public === true;
        if (background_color) req.galeria.background_color = background_color;
        if (font_family) req.galeria.font_family = font_family;

        // Upload de imagem de fundo se enviada
        if (req.file) {
            const processedBuffer = await sharp(req.file.buffer)
                .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                .png()
                .toBuffer();

            const form = new FormData();
            form.append('file', processedBuffer, { filename: `bg_${req.params.id}.png`, contentType: 'image/png' });
            form.append('folder', `galerias/${req.params.id}/style`);

            const uploadRes = await axios.post(`${process.env.SERVIDORDEARQUIVOS_URL}/upload?folder=galerias/${req.params.id}/style`, form, {
                headers: { ...form.getHeaders(), 'x-api-key': process.env.SERVIDORDEARQUIVOS_KEY }
            });
            req.galeria.background_url = uploadRes.data.url;
        }

        await req.galeria.save();

        // Atualizar colaboradores se fornecido
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