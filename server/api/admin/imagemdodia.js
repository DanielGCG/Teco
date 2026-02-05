const express = require('express');
const { ImagemDoDia, ImagemDoDiaBorder, User } = require("../../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../../utils/fileServer');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const { Op } = require('sequelize');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Fila de Imagens (Somente as que estão com posição 0, ou seja, aguardando ativação)
router.get('/fila', async (req, res) => {
    try {
        const fila = await ImagemDoDia.findAll({ 
            where: { position: 0 },
            order: [['createdat', 'ASC']],
            include: [
                { model: User, as: 'requester', attributes: ['username', 'publicid'] },
                { model: ImagemDoDiaBorder, as: 'border' }
            ]
        });
        res.json(fila);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar fila.', error: error.message });
    }
});

router.get('/fila/count', async (req, res) => {
    try {
        const count = await ImagemDoDia.count({ where: { position: 0 } });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao contar fila.', error: error.message });
    }
});

// Remove uma imagem (da fila ou do histórico)
router.delete('/fila/:publicid', async (req, res) => {
    try {
        const imagem = await ImagemDoDia.findOne({ where: { publicid: req.params.publicid } });
        if (!imagem) return res.status(404).json({ message: 'Imagem não encontrada.' });
        
        if (imagem.url) {
            try { await deleteFromFileServer({ fileUrl: imagem.url }); } catch (e) {}
        }
        
        await imagem.destroy();
        res.json({ message: 'Removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao remover.', error: error.message });
    }
});

// Ativa a próxima imagem da fila
router.post('/next', async (req, res) => {
    try {
        const proxima = await ImagemDoDia.findOne({
            where: { position: 0 },
            order: [['createdat', 'ASC']]
        });

        if (!proxima) {
            return res.status(404).json({ message: 'Nenhuma imagem na fila de espera.' });
        }

        const maxPos = await ImagemDoDia.max('position') || 0;
        proxima.position = maxPos + 1;
        proxima.activatedat = new Date();
        await proxima.save();

        res.json({ message: 'Imagem ativada com sucesso!', imagem: proxima });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao ativar próxima imagem.', error: error.message });
    }
});

// Adiciona nova moldura padrão
router.post('/borders', upload.single('file'), async (req, res) => {
    if (!req.file || !req.body.nome) {
        return res.status(400).json({ message: 'Campos obrigatórios: file, nome.' });
    }

    try {
        // Converte para PNG usando sharp
        const pngBuffer = await sharp(req.file.buffer).png().toBuffer();
        const url = await uploadToFileServer({
            buffer: pngBuffer,
            filename: 'border.png',
            folder: 'imagemdodia/borders',
            mimetype: 'image/png'
        });
        const novaBorder = await ImagemDoDiaBorder.create({
            url,
            name: req.body.nome,
            createdbyUserId: req.user.id
        });
        res.status(201).json(novaBorder);
    } catch (error) {
        console.error('[ImagemDoDia Admin] Erro ao adicionar moldura:', error);
        res.status(500).json({ message: 'Erro ao adicionar moldura.' });
    }
});

// Remove uma moldura
router.delete('/borders/:publicid', async (req, res) => {
    try {
        const border = await ImagemDoDiaBorder.findOne({ where: { publicid: req.params.publicid } });
        if (!border) return res.status(404).json({ message: 'Moldura não encontrada.' });
        
        // Deleta do servidor de arquivos antes de remover do BD
        if (border.url) {
            await deleteFromFileServer({ fileUrl: border.url });
        }
        
        await border.destroy();
        res.json({ message: 'Moldura removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao remover moldura.', error: error.message });
    }
});

module.exports = router;
