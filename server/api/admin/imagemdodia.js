const express = require('express');
const { ImagemDoDia, ImagemDoDiaBorder, User } = require("../../models");
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const { Op } = require('sequelize');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Helper para deletar arquivo do servidor de arquivos por URL
async function deleteFileFromServer(fileUrl) {
    if (!fileUrl) return;
    try {
        await axios.delete(`${process.env.SERVIDORDEARQUIVOS_URL}/delete`, {
            data: { url: fileUrl },
            headers: { 'x-api-key': process.env.SERVIDORDEARQUIVOS_KEY }
        });
    } catch (err) {
        console.error('Erro ao deletar arquivo do servidor:', err.message);
        // Não falha a requisição se a deleção remota falhar
    }
}

// Fila de Imagens
router.get('/fila', async (req, res) => {
    try {
        const fila = await ImagemDoDia.findAll({ 
            where: { start_at: null }, 
            order: [['created_at', 'ASC']],
            include: [{ model: User, as: 'requester', attributes: ['username'] }]
        });
        res.json(fila);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar fila.', error: error.message });
    }
});

router.get('/fila/count', async (req, res) => {
    try {
        const count = await ImagemDoDia.count({ where: { start_at: null } });
        const hasActive = await ImagemDoDia.count({ where: { start_at: { [Op.ne]: null } } });
        res.json({ count, hasActive: hasActive > 0 });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao contar fila.', error: error.message });
    }
});

// Ativa a próxima imagem da fila
router.post('/next', async (req, res) => {
    try {
        const proxima = await ImagemDoDia.findOne({ where: { start_at: null }, order: [['created_at', 'ASC']] });
        if (!proxima) return res.status(404).json({ message: 'Nenhuma imagem na fila.' });
        proxima.start_at = new Date();
        await proxima.save();
        res.json({ message: 'Imagem ativada.', id: proxima.id });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao ativar próxima.', error: error.message });
    }
});

// Remove uma imagem (da fila ou do histórico)
router.delete('/fila/:id', async (req, res) => {
    try {
        const imagem = await ImagemDoDia.findByPk(req.params.id);
        if (!imagem) return res.status(404).json({ message: 'Imagem não encontrada.' });
        
        // Deleta apenas a imagem do servidor (moldura é reutilizável, não deletar)
        if (imagem.url) {
            await deleteFileFromServer(imagem.url);
        }
        
        await imagem.destroy();
        res.json({ message: 'Removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao remover.', error: error.message });
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

        const form = new FormData();
        form.append('file', pngBuffer, { filename: 'border.png', contentType: 'image/png' });
        form.append('folder', 'imagemdodia/borders');

        const uploadRes = await axios.post(
            `${process.env.SERVIDORDEARQUIVOS_URL}/upload?folder=imagemdodia/borders`,
            form,
            {
                headers: { ...form.getHeaders(), 'x-api-key': process.env.SERVIDORDEARQUIVOS_KEY }
            }
        );

        const novaBorder = await ImagemDoDiaBorder.create({
            url: uploadRes.data.url,
            nome: req.body.nome
        });

        res.status(201).json(novaBorder);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao adicionar moldura.', error: error.message });
    }
});

// Remove uma moldura
router.delete('/borders/:id', async (req, res) => {
    try {
        const border = await ImagemDoDiaBorder.findByPk(req.params.id);
        if (!border) return res.status(404).json({ message: 'Moldura não encontrada.' });
        
        // Deleta do servidor de arquivos antes de remover do BD
        if (border.url) {
            await deleteFileFromServer(border.url);
        }
        
        await border.destroy();
        res.json({ message: 'Moldura removida com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao remover moldura.', error: error.message });
    }
});

module.exports = router;
