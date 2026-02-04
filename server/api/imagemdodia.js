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

// Busca a imagem do dia ativa (A maior posição)
router.get('/', async (req, res) => {
    try {
        const imagem = await ImagemDoDia.findOne({
            order: [['position', 'DESC']],
            include: [{ model: ImagemDoDiaBorder, as: 'border' }]
        });
        if (imagem) res.json(imagem);
        else res.status(404).json({ message: 'Imagem do dia não encontrada.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar imagem do dia.', error: error.message });
    }
});

// Busca histórico
router.get('/ativas', async (req, res) => {
    try {
        const imagens = await ImagemDoDia.findAll({
            order: [['position', 'DESC']],
            include: [
                { model: User, as: 'requester', attributes: ['username', 'profileimage'] },
                { model: ImagemDoDiaBorder, as: 'border' }
            ]
        });
        res.json(imagens);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar histórico.', error: error.message });
    }
});

// Lista molduras padrão
router.get('/borders', async (req, res) => {
    try {
        const borders = await ImagemDoDiaBorder.findAll({ order: [['createdat', 'DESC']] });
        res.json(borders);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar molduras.', error: error.message });
    }
});

// Adiciona nova imagem (sugestão)
router.post('/', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'border', maxCount: 1 }]), async (req, res) => {
    const { text, borderPublicId } = req.body;
    if (!req.files || !req.files['file'] || !text) {
        return res.status(400).json({ message: 'Campos obrigatórios: file, text.' });
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

        let finalBorderId = null;

        if (borderPublicId) {
            const border = await ImagemDoDiaBorder.findOne({ where: { publicid: borderPublicId } });
            if (border) finalBorderId = border.id;
        }

        // Se não foi informada uma border ou se a border não foi encontrada, busca a mais recente disponível
        if (!finalBorderId) {
            const defaultBorder = await ImagemDoDiaBorder.findOne({ order: [['id', 'ASC']] });
            finalBorderId = defaultBorder ? defaultBorder.id : null;
        }

        if (req.files['border'] && req.files['border'][0]) {
            const borderFile = req.files['border'][0];
            const borderPngBuffer = await sharp(borderFile.buffer).png().toBuffer();
            const borderUrl = await uploadToFileServer({
                buffer: borderPngBuffer,
                filename: 'border.png',
                folder: 'imagemdodia/borders',
                mimetype: 'image/png'
            });
            const newBorder = await ImagemDoDiaBorder.create({
                url: borderUrl,
                name: 'Custom',
                createdbyUserId: req.user.id
            });
            finalBorderId = newBorder.id;
        }

        const maxPosition = await ImagemDoDia.max('position') || 0;

        const novaImagem = await ImagemDoDia.create({ 
            url, 
            borderId: finalBorderId, 
            text: text,
            position: maxPosition + 1,
            createdbyUserId: req.user ? req.user.id : null
        });
        res.status(201).json(novaImagem);
    } catch (error) {
        console.error('[ImagemDoDia] Erro ao sugerir imagem:', error);
        res.status(500).json({ message: 'Erro ao adicionar imagem.' });
    }
});

module.exports = router;