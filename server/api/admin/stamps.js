const express = require("express");
const AdminStampsRouter = express.Router();
const { Stamp } = require("../../models");

// GET /admin/stamps - Listar selos
AdminStampsRouter.get('/', async (req, res) => {
    try {
        const stamps = await Stamp.findAll({ order: [['createdat', 'DESC']] });
        res.json(stamps);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar stamps" });
    }
});

// POST /admin/stamps - Criar selo
AdminStampsRouter.post('/', async (req, res) => {
    const { name } = req.body;
    let { image_url } = req.body;

    try {
        if (!name) return res.status(400).json({ message: "Nome do selo é obrigatório" });

        if (!image_url) return res.status(400).json({ message: "Imagem é obrigatória" });

        const stamp = await Stamp.create({ name, image_url });
        res.status(201).json(stamp);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar stamp" });
    }
});

// DELETE /admin/stamps/:publicid - Deletar selo
AdminStampsRouter.delete('/:publicid', async (req, res) => {
    try {
        const stamp = await Stamp.findOne({ where: { publicid: req.params.publicid } });
        if (!stamp) return res.status(404).json({ message: "Stamp não encontrado" });

        await stamp.destroy();
        res.json({ message: "Stamp deletado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar stamp" });
    }
});

module.exports = AdminStampsRouter;
