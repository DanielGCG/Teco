const express = require('express');
const { ImagemDoDia, ImagemDoDiaBorder, User } = require("../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');
const axios = require('axios'); // Mantém para outros usos
const FormData = require('form-data'); // Mantém para outros usos
const sharp = require('sharp');
const { Op } = require('sequelize');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// deleteFileFromServer substituído por deleteFromFileServer universal

// Busca a imagem do dia ativa
router.get('/', async (req, res) => {
    try {
        const imagem = await ImagemDoDia.findOne({
            where: { start_at: { [Op.ne]: null } },
            order: [['start_at', 'DESC']]
        });
        if (imagem) res.json(imagem);
        else res.status(404).json({ message: 'Imagem do dia não encontrada.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar imagem do dia.', error: error.message });
    }
});

// Busca todas as imagens já ativadas (para o calendário)
router.get('/ativas', async (req, res) => {
    try {
        const imagens = await ImagemDoDia.findAll({
            where: { start_at: { [Op.ne]: null } },
            order: [['start_at', 'DESC']],
            include: [{ model: User, as: 'requester', attributes: ['username', 'profile_image'] }]
        });
        res.json(imagens);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar histórico.', error: error.message });
    }
});

// Lista molduras padrão
router.get('/borders', async (req, res) => {
    try {
        const borders = await ImagemDoDiaBorder.findAll({ order: [['created_at', 'DESC']] });
        res.json(borders);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar molduras.', error: error.message });
    }
});

// Adiciona nova imagem (sugestão)
router.post('/', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'border', maxCount: 1 }]), async (req, res) => {
    const { texto, defaultBorderUrl } = req.body;
    if (!req.files || !req.files['file'] || !texto) {
        return res.status(400).json({ message: 'Campos obrigatórios: file, texto.' });
    }

    try {
        const file = req.files['file'][0];
        const pngBuffer = await sharp(file.buffer).png().toBuffer();
        const url = await uploadToFileServer({
            buffer: pngBuffer,
            filename: 'imagemdodia.png',
            folder: 'imagemdodia',
            mimetype: 'image/png'
        });

        let border_url = defaultBorderUrl || '';
        if (req.files['border'] && req.files['border'][0]) {
            const borderFile = req.files['border'][0];
            const borderPngBuffer = await sharp(borderFile.buffer).png().toBuffer();
            border_url = await uploadToFileServer({
                buffer: borderPngBuffer,
                filename: 'border.png',
                folder: 'imagemdodia/borders',
                mimetype: 'image/png'
            });
        }

        const novaImagem = await ImagemDoDia.create({ 
            url, 
            border_url, 
            texto,
            user_id: req.user ? req.user.id : null
        });
        res.status(201).json(novaImagem);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao adicionar imagem.', error: error.message });
    }
});

module.exports = router;