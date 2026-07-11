const express = require('express');
const { ImagemDoDia, ImagemDoDiaBorder, User } = require("../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');
const axios = require('axios'); // Mantém para outros usos
const FormData = require('form-data'); // Mantém para outros usos
const sharp = require('sharp');
const { Op } = require('sequelize');
const { createNotification } = require('./notifications');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// deleteFileFromServer substituído por deleteFromFileServer universal

// Função para rotacionar a imagem se necessário
async function checkAndRotateImage(req) {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Busca a imagem mais recente ativada
        const atual = await ImagemDoDia.findOne({
            where: { position: { [Op.gt]: 0 } },
            order: [['position', 'DESC']]
        });

        // Se a imagem atual foi ativada antes de hoje, precisamos de uma nova
        if (atual && (!atual.activatedat || new Date(atual.activatedat) < hoje)) {
            // Tenta pegar a próxima da fila
            const proxima = await ImagemDoDia.findOne({
                where: { position: 0 },
                order: [['createdat', 'ASC']]
            });

            if (proxima) {
                const maxPos = await ImagemDoDia.max('position') || 0;
                proxima.position = maxPos + 1;
                proxima.activatedat = new Date(); // Ativa com a data atual
                await proxima.save();
                console.log(`[ImagemDoDia] Rotação automática: imagem ${proxima.id} ativada.`);

                // Notificar todos os usuários assincronamente
                setImmediate(async () => {
                    try {
                        const allUsers = await User.findAll({ attributes: ['id'] });
                        const io = req ? req.app.get('io') : null;
                        for (const u of allUsers) {
                            await createNotification({
                                userId: u.id,
                                type: 'info',
                                title: 'Nova Imagem do Dia!',
                                body: 'saiu do forno bb! venha conferir!',
                                link: '/imagemdodia',
                                io: io
                            });
                        }
                    } catch (notifErr) {
                        console.error('Erro ao notificar usuários sobre nova imagem do dia (rotação automática):', notifErr);
                    }
                });
            }
        }
    } catch (error) {
        console.error('[ImagemDoDia] Erro na rotação automática:', error);
    }
}

// Busca a imagem do dia ativa (A maior posição, ignorando as da fila com posição 0)
router.get('/', async (req, res) => {
    try {
        await checkAndRotateImage(req);
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
            setImmediate(async () => {
                try {
                    const allUsers = await User.findAll({ attributes: ['id'] });
                    const io = req.app.get('io');
                    for (const u of allUsers) {
                        await createNotification({
                            userId: u.id,
                            type: 'info',
                            title: 'Nova Imagem do Dia!',
                            body: 'saiu do forno bb! venha conferir!',
                            link: '/imagemdodia',
                            io: io
                        });
                    }
                } catch (notifErr) {
                    console.error('Erro ao notificar usuários sobre nova imagem do dia (upload imediato):', notifErr);
                }
            });
        }

        res.status(201).json(novaImagem);
    } catch (error) {
        console.error('[ImagemDoDia] Erro ao sugerir imagem:', error);
        res.status(500).json({ message: 'Erro ao adicionar imagem.' });
    }
});

module.exports = router;