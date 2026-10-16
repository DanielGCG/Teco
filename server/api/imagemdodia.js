const express = require('express');
const { ImagemDoDia, ImagemDoDiaBorder, User } = require("../models");
const { Op } = require('sequelize');
const { checkAndRotateImage, notifyNewImage } = require('../utils/iotdLogic');
const router = express.Router();

// deleteFileFromServer substituído por deleteFromFileServer universal

// Busca a imagem do dia ativa (A maior posição, ignorando as da fila com posição 0)
router.get('/', async (req, res) => {
    try {
        await checkAndRotateImage(req.app.get('io'));
        const imagem = await ImagemDoDia.findOne({
            where: { position: { [Op.gt]: 0 } },
            order: [['position', 'DESC']],
            include: [{ model: ImagemDoDiaBorder, as: 'border' }]
        });
        if (imagem) res.json(imagem);
        else res.status(404).json({ message: 'Imagem do dia não encontrada.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar imagem do dia.', error: error.message });
    }
});

// Busca histórico (Somente as que já foram ativadas)
router.get('/ativas', async (req, res) => {
    try {
        const imagens = await ImagemDoDia.findAll({
            where: { position: { [Op.gt]: 0 } },
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
router.post('/', async (req, res) => {
    const { text, borderPublicId } = req.body;
    if (!req.body.fileUrl || !text) {
        return res.status(400).json({ message: 'Campos obrigatórios: file, text.' });
    }

    try {
        const url = req.body.fileUrl;

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

        if (req.body.borderUrl) {
            const borderUrl = req.body.borderUrl;
            const newBorder = await ImagemDoDiaBorder.create({
                url: borderUrl,
                name: 'Custom',
                createdbyUserId: req.user.id
            });
            finalBorderId = newBorder.id;
        }

        // Verifica se já existe uma imagem ativada hoje
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const imagemHoje = await ImagemDoDia.findOne({
            where: {
                position: { [Op.gt]: 0 },
                activatedat: { [Op.gte]: hoje }
            }
        });

        let position = 0;
        let activatedat = null;

        // Se não houver imagem para hoje, ativa esta imediatamente
        if (!imagemHoje) {
            const maxPos = await ImagemDoDia.max('position') || 0;
            position = maxPos + 1;
            activatedat = new Date();
        }

        const novaImagem = await ImagemDoDia.create({
            url,
            borderId: finalBorderId,
            text: text,
            position: position,
            activatedat: activatedat,
            createdbyUserId: req.user ? req.user.id : null
        });

        // Se a imagem foi ativada imediatamente
        if (novaImagem.position > 0) {
            const systemConfigMiddleware = require('../middlewares/systemConfigMiddleware');
            systemConfigMiddleware.clearCache();
            notifyNewImage(req.app.get('io'));
        }

        res.status(201).json(novaImagem);
    } catch (error) {
        console.error('[ImagemDoDia] Erro ao sugerir imagem:', error);
        res.status(500).json({ message: 'Erro ao adicionar imagem.' });
    }
});

module.exports = router;