const express = require('express');
const router = express.Router();
const { SystemConfig } = require('../../models');

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

module.exports = router;
