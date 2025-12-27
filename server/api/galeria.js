const express = require('express');
const { Galeria, GaleriaImagem, GaleriaPermissao, User } = require("../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');
const axios = require('axios'); // Mantém para outras requisições
const FormData = require('form-data'); // Mantém para uso em outros pontos se necessário
// sharp is no longer required for gallery uploads; we preserve original files
const { Op } = require('sequelize');
const router = express.Router();

// Sanitizar nome de arquivo: remove acentos, caracteres especiais, mantém apenas alfanuméricos + hífem, underscore, ponto e espaço
function sanitizeFilename(filename) {
    if (!filename) return `file_${Date.now()}`;
    
    // Normalizar Unicode e remover acentos
    const normalized = filename
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove marcas diacríticas
    
    // Remover caracteres especiais perigosos, manter: letras, números, hífem, underscore, ponto, espaço
    const sanitized = normalized
        .replace(/[^a-zA-Z0-9-_ .]/g, '')
        .replace(/\s+/g, '_'); // Converter espaços em underscores
    
    return sanitized || `file_${Date.now()}`;
}

// Configuração de upload com limites compatíveis com servidor de arquivos:
// - 50MB para imagens (covers, backgrounds, gifs)
// - 100MB para vídeos (limite do Cloudflare)
const uploadImage = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB para imagens
});

const uploadVideo = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB para vídeos
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
router.post('/', uploadImage.single('capa'), async (req, res) => {
    const { nome, descricao, is_public, card_color } = req.body;
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
                const remoteStatus = err.response?.status;
                const remoteData = err.response?.data;
                return res.status(502).json({ success: false, message: 'Erro ao enviar capa ao servidor de arquivos.', remoteStatus, remoteData });
            }
        }

        const galeria = await Galeria.create({
            nome,
            descricao,
            capa_url,
            user_id: req.user.id,
            is_public: is_public === 'true' || is_public === true,
            card_color: card_color || undefined
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
router.post('/:id/upload', checkGaleriaPermission, (req, res, next) => {
    uploadVideo.single('imagem')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ success: false, message: 'Arquivo muito grande. Limite: 100MB' });
            }
            return res.status(400).json({ success: false, message: `Erro no upload: ${err.message}` });
        }
        next();
    });
}, uploadGaleria, async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });

    try {
        if (!process.env.SERVIDORDEARQUIVOS_URL || !process.env.SERVIDORDEARQUIVOS_KEY) {
            return res.status(500).json({ success: false, message: 'Configuração do servidor de arquivos ausente.' });
        }
        const sanitizedFilename = sanitizeFilename(req.file.originalname);
        let fileUrl;
        try {
            fileUrl = await uploadToFileServer({
                buffer: req.file.buffer,
                filename: sanitizedFilename,
                folder: `galerias/${req.params.id}`,
                mimetype: req.file.mimetype
            });
        } catch (err) {
            console.error('Erro ao enviar para o servidor de arquivos:', err.message);
            return res.status(502).json({ 
                success: false, 
                message: 'Erro ao enviar arquivo ao servidor remoto.', 
                error: err.message,
                remoteStatus: err.response?.status,
                remoteData: err.response?.data
            });
        }
        const imagem = await GaleriaImagem.create({
            galeria_id: req.params.id,
            url: fileUrl,
            nome: req.body.nome || req.file.originalname,
            user_id: req.user.id
        });
        return res.status(201).json({ success: true, imagem });
    } catch (error) {
        console.error('Erro interno no upload:', error);
        res.status(500).json({ success: false, message: 'Erro interno ao processar upload.', error: error.message });
    }
});

// Deletar imagem da galeria
router.delete('/:id/imagem/:imagemId', checkGaleriaPermission, async (req, res) => {
    try {
        const imagem = await GaleriaImagem.findOne({ where: { id: req.params.imagemId, galeria_id: req.params.id } });
        if (!imagem) return res.status(404).json({ success: false, message: 'Imagem não encontrada.' });

        // Deletar arquivo do servidor antes de remover do BD
        await deleteFromFileServer({
            fileUrl: imagem.url
        });

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

        // Deletar capa do servidor
        if (req.galeria.capa_url) {
            await deleteFromFileServer({ fileUrl: req.galeria.capa_url });
        }

        // Deletar background do servidor
        if (req.galeria.background_url) {
            await deleteFromFileServer({ fileUrl: req.galeria.background_url });
        }

        // Deletar todas as imagens do servidor antes de destruir
        const imagens = await GaleriaImagem.findAll({ where: { galeria_id: req.params.id } });
        for (const img of imagens) {
            await deleteFromFileServer({ fileUrl: img.url });
        }

        // Agora destroi a galeria e todas as suas imagens (cascade)
        await req.galeria.destroy();
        res.json({ success: true, message: 'Galeria excluída com sucesso.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao excluir galeria.', error: error.message });
    }
});

// Atualizar configurações da galeria (pública, colaboradores, estilos, capa)
router.patch('/:id', 
    checkGaleriaPermission, 
    uploadImage.fields([
        { name: 'background', maxCount: 1 },
        { name: 'cover_image', maxCount: 1 }
    ]), 
    async (req, res) => {
    
    // Função helper para extrair valor do body (trata caso o multer transforme em array)
    const getBodyValue = (key) => {
        const val = req.body[key];
        return Array.isArray(val) ? val[0] : val;
    };

    // Extrair campos de texto explicitamente
    const nome = getBodyValue('nome');
    const descricao = getBodyValue('descricao');
    const is_public = getBodyValue('is_public');
    const colaboradores = getBodyValue('colaboradores');
    const card_color = getBodyValue('card_color');
    
    // Campos de Estilo
    const background_color = getBodyValue('background_color');
    const font_family = getBodyValue('font_family');
    const font_color = getBodyValue('font_color');
    const background_fill = getBodyValue('background_fill');
    
    // Flags
    const remove_background = getBodyValue('remove_background');
    const remove_cover = getBodyValue('remove_cover');

    try {
        // Apenas o dono ou admin pode mudar configurações estruturais
        if (req.galeria.user_id !== req.user.id && req.user.role < 1) {
            return res.status(403).json({ success: false, message: 'Apenas o dono pode alterar as configurações.' });
        }

        // --- Atualizações Básicas ---
        if (nome) req.galeria.nome = nome;
        // Permite salvar string vazia para descrição
        if (descricao !== undefined) req.galeria.descricao = descricao;
        if (is_public !== undefined) req.galeria.is_public = is_public === 'true' || is_public === true;
        if (card_color !== undefined) req.galeria.card_color = card_color;
        
        // --- Atualizações de Estilo e Aparência ---
        if (background_color) req.galeria.background_color = background_color;
        if (font_family) req.galeria.font_family = font_family;
        
        // Garante que o background_fill seja atribuído se estiver presente (cover ou repeat)
        if (background_fill) {
            req.galeria.background_fill = background_fill;
        }

        // Garante que font_color seja atribuída
        if (font_color) {
            req.galeria.font_color = font_color;
        }

        // --- Remoção de Arquivos (Flags) ---

        // Se pedido para remover background
        if (remove_background === 'true' || remove_background === true) {
            if (req.galeria.background_url) {
                await deleteFromFileServer({ fileUrl: req.galeria.background_url });
            }
            req.galeria.background_url = null;
        }

        // Se pedido para remover capa
        if (remove_cover === 'true' || remove_cover === true) {
            if (req.galeria.capa_url) {
                await deleteFromFileServer({ fileUrl: req.galeria.capa_url });
            }
            req.galeria.capa_url = null;
        }

        // --- Upload de Arquivos (Capa e Background) ---
        
        const files = req.files || {};

        // 1. Upload de Background
        if (files.background && files.background[0]) {
            const file = files.background[0];
            // Deletar background antigo se existir
            if (req.galeria.background_url) {
                await deleteFromFileServer({ fileUrl: req.galeria.background_url });
            }
            const sanitizedFilename = sanitizeFilename(file.originalname);
            try {
                req.galeria.background_url = await uploadToFileServer({
                    buffer: file.buffer,
                    filename: sanitizedFilename,
                    folder: `galerias/${req.params.id}/style`,
                    mimetype: file.mimetype
                });
            } catch (err) {
                const remoteStatus = err.response?.status;
                const remoteData = err.response?.data;
                return res.status(502).json({ success: false, message: 'Erro ao enviar background ao servidor de arquivos.', remoteStatus, remoteData });
            }
        }

        // 2. Upload de Capa (Cover Image)
        if (files.cover_image && files.cover_image[0]) {
            const file = files.cover_image[0];
            // Deletar capa antiga se existir
            if (req.galeria.capa_url) {
                await deleteFromFileServer({ fileUrl: req.galeria.capa_url });
            }
            const sanitizedFilename = sanitizeFilename(file.originalname);
            try {
                req.galeria.capa_url = await uploadToFileServer({
                    buffer: file.buffer,
                    filename: sanitizedFilename,
                    folder: 'galerias/capas',
                    mimetype: file.mimetype
                });
            } catch (err) {
                const remoteStatus = err.response?.status;
                const remoteData = err.response?.data;
                return res.status(502).json({ success: false, message: 'Erro ao enviar capa ao servidor de arquivos.', remoteStatus, remoteData });
            }
        }

        // Salvar tudo no banco
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