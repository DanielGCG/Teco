const express = require('express');
const router = express.Router();
const { Item, SystemConfig } = require('../../models');
const systemConfigMiddleware = require('../../middlewares/systemConfigMiddleware');

// Lista todos os itens
router.get('/items', async (req, res) => {
    try {
        const items = await Item.findAll();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar itens" });
    }
});

// Cria ou Atualiza Item (buscando por publicid)
router.post('/items', async (req, res) => {
    try {
        const { publicid, name, type, value, emoji, imageurl } = req.body;
        
        if (publicid) {
            await Item.update({ name, type, value, emoji, imageurl }, { where: { publicid } });
        } else {
            await Item.create({ name, type, value, emoji, imageurl });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao salvar item" });
    }
});

// Deleta Item (usando publicid na URL)
router.delete('/items/:publicid', async (req, res) => {
    try {
        await Item.destroy({ where: { publicid: req.params.publicid } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao deletar item" });
    }
});

// Atualiza o Daily Claim (Configuração do Resgate Diário)
router.post('/claim-config', async (req, res) => {
    try {
        const { configJson } = req.body;
        JSON.parse(configJson); // Valida se é um JSON válido
        
        const [config, created] = await SystemConfig.findOrCreate({ 
            where: { key: 'gotchi_daily_claim' },
            defaults: { value: configJson, description: 'Resgate diário de itens do Gotchi' }
        });
        if (!created) {
            config.value = configJson;
            await config.save();
        }

        // Limpa o cache
        systemConfigMiddleware.clearCache();

        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: "JSON inválido ou erro ao salvar" });
    }
});

router.get('/claim-config', async (req, res) => {
    try {
        const configValue = req.systemConfig ? req.systemConfig.gotchi_daily_claim : null;
        res.json({ configJson: configValue || '[]' });
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar config" });
    }
});

module.exports = router;