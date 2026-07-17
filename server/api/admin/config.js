const express = require('express');
const router = express.Router();
const { SystemConfig } = require('../../models');
const { runGarbageCollector } = require('../../utils/garbageCollector');
const { upload } = require('../../utils/upload');
const { uploadToFileServer } = require('../../utils/fileServer');

// @route   GET /api/admin/config
// @desc    Obtém todas as configurações do sistema
router.get('/', async (req, res) => {
    try {
        const configs = await SystemConfig.findAll();
        res.json(configs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar configurações' });
    }
});

// @route   GET /api/admin/config/:key
// @desc    Obtém uma configuração específica
router.get('/:key', async (req, res) => {
    try {
        const config = await SystemConfig.findOne({ where: { key: req.params.key } });
        if (!config) {
            return res.status(404).json({ message: 'Configuração não encontrada' });
        }
        res.json(config);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar configuração' });
    }
});

// @route   POST /api/admin/config
// @desc    Cria ou atualiza uma configuração
router.post('/', async (req, res) => {
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
        return res.status(400).json({ message: 'Chave e valor são obrigatórios' });
    }

    try {
        const [config, created] = await SystemConfig.findOrCreate({
            where: { key },
            defaults: { value, description }
        });

        if (!created) {
            config.value = value;
            if (description) config.description = description;
            await config.save();
        }

        res.json({ message: 'Configuração salva com sucesso', config });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao salvar configuração' });
    }
});

// @route   POST /api/admin/config/upload
// @desc    Faz upload de um arquivo para o servidor de arquivos e retorna a URL
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        
        const url = await uploadToFileServer({
            buffer: req.file.buffer,
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            folder: 'configs'
        });
        
        res.json({ url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao fazer upload da imagem' });
    }
});

// @route   POST /api/admin/config/sync-files
// @desc    Executa manualmente o Garbage Collector de arquivos
router.post('/sync-files', async (req, res) => {
    try {
        const result = await runGarbageCollector();
        if (result && !result.error) {
            res.json({ message: 'Sincronização iniciada/concluída com sucesso', details: result });
        } else {
            res.status(500).json({ message: 'Erro ao executar o Garbage Collector', error: result?.error });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro interno ao sincronizar arquivos' });
    }
});

module.exports = router;
