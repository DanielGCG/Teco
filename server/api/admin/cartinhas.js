const express = require("express");
const AdminCartinhasRouter = express.Router();
const { Cartinha, User } = require("../../models");
const { Op, fn, col, literal } = require("sequelize");

// ==================== Endpoints ====================

// GET /admin/cartinhas/estatisticas - Estatísticas gerais
AdminCartinhasRouter.get('/estatisticas', async (req, res) => {
    try {
        const total = await Cartinha.count();
        const naolidas = await Cartinha.count({ where: { isread: false } });
        const lidas = await Cartinha.count({ where: { isread: true } });
        const favoritas = await Cartinha.count({ where: { isfavorited: true } });

        res.json({
            total,
            naolidas,
            lidas,
            favoritas
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar estatísticas" });
    }
});

// GET /admin/cartinhas/usuarios - Listar usuários com estatísticas de cartinhas
AdminCartinhasRouter.get('/usuarios', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const usuario = req.query.usuario; // Alterado de userPublicId para usuario para bater com o frontend
    const status = req.query.status;
    const search = req.query.search;

    const offset = (page - 1) * limit;

    try {
        const userWhere = {};
        if (usuario) userWhere.publicid = usuario;
        if (search && search.trim() !== '') userWhere.username = { [Op.like]: `%${search}%` };

        const cartinhaWhere = {};
        if (status === 'naolida') cartinhaWhere.isread = false;
        else if (status === 'lida') cartinhaWhere.isread = true;
        else if (status === 'favorita') cartinhaWhere.isfavorited = true;

        const { rows, count } = await User.findAndCountAll({
            where: userWhere,
            attributes: [
                'publicid',
                'username',
                'profileimage',
                [fn('COUNT', col('cartinhas_recebidas.id')), 'totalcartinhas'],
                [literal(`SUM(CASE WHEN cartinhas_recebidas.isread = FALSE THEN 1 ELSE 0 END)`), 'naolidas'],
                [literal(`SUM(CASE WHEN cartinhas_recebidas.isread = TRUE THEN 1 ELSE 0 END)`), 'lidas'],
                [literal(`SUM(CASE WHEN cartinhas_recebidas.isfavorited = TRUE THEN 1 ELSE 0 END)`), 'favoritas']
            ],
            include: [{
                model: Cartinha,
                as: 'cartinhas_recebidas',
                attributes: [],
                where: cartinhaWhere,
                required: true
            }],
            group: ['User.id'],
            order: [[literal('totalcartinhas'), 'DESC']],
            limit,
            offset,
            subQuery: false
        });

        res.json({
            usuarios: rows,
            totalItems: Array.isArray(count) ? count.length : count,
            currentPage: page,
            totalPages: Math.ceil((Array.isArray(count) ? count.length : count) / limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar usuários" });
    }
});

// GET /admin/cartinhas - Listar cartinhas com filtros
AdminCartinhasRouter.get('/', async (req, res) => {
    const { recipientPublicId, senderPublicId, search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const where = {};
        
        if (recipientPublicId) {
            const recipient = await User.findOne({ where: { publicid: recipientPublicId } });
            if (recipient) where.recipientUserId = recipient.id;
        }

        if (senderPublicId) {
            const sender = await User.findOne({ where: { publicid: senderPublicId } });
            if (sender) where.senderUserId = sender.id;
        }

        if (status === 'naolida') where.isread = false;
        else if (status === 'lida') where.isread = true;
        else if (status === 'favorita') where.isfavorited = true;
        
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { body: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Cartinha.findAndCountAll({
            where,
            include: [
                { model: User, as: 'remetente', attributes: ['username', 'publicid'] },
                { model: User, as: 'destinatario', attributes: ['username', 'publicid'] }
            ],
            order: [['createdat', 'DESC']],
            limit,
            offset
        });

        res.json({
            cartinhas: rows,
            total: count,
            pages: Math.ceil(count / limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar cartinhas" });
    }
});

// GET /admin/cartinhas/usuario/:publicid - Listar cartinhas de um usuário específico
AdminCartinhasRouter.get('/usuario/:publicid', async (req, res) => {
    const { publicid } = req.params;
    const { page = 1, limit = 15, status, search } = req.query;
    const offset = (page - 1) * limit;

    try {
        const user = await User.findOne({ where: { publicid } });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const where = { recipientUserId: user.id };
        if (status === 'naolida') where.isread = false;
        else if (status === 'lida') where.isread = true;
        else if (status === 'favorita') where.isfavorited = true;

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { body: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Cartinha.findAndCountAll({
            where,
            include: [
                { model: User, as: 'remetente', attributes: ['username', 'publicid'] }
            ],
            order: [['createdat', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            cartinhas: rows,
            totalItems: count,
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar cartinhas do usuário" });
    }
});

// GET /admin/cartinhas/:publicid - Detalhes de uma cartinha
AdminCartinhasRouter.get('/:publicid', async (req, res) => {
    try {
        const cartinha = await Cartinha.findOne({
            where: { publicid: req.params.publicid },
            include: [
                { model: User, as: 'remetente', attributes: ['username', 'publicid'] },
                { model: User, as: 'destinatario', attributes: ['username', 'publicid'] }
            ]
        });
        if (!cartinha) return res.status(404).json({ message: "Cartinha não encontrada" });
        res.json(cartinha);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar detalhes da cartinha" });
    }
});

// DELETE /admin/cartinhas/remover - Remover múltiplas cartinhas
AdminCartinhasRouter.delete('/remover', async (req, res) => {
    const { cartinhaIds } = req.body;
    if (!Array.isArray(cartinhaIds)) return res.status(400).json({ message: "IDs inválidos" });

    try {
        const result = await Cartinha.destroy({
            where: { publicid: { [Op.in]: cartinhaIds } }
        });
        res.json({ message: "Cartinhas removidas", removidas: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao remover cartinhas" });
    }
});

// POST /admin/cartinhas/limpeza - Limpeza automática (lidas > 30 dias e não favoritas)
AdminCartinhasRouter.post('/limpeza', async (req, res) => {
    try {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

        const result = await Cartinha.destroy({
            where: {
                isread: true,
                isfavorited: false,
                readat: { [Op.lt]: trintaDiasAtras }
            }
        });
        res.json({ message: "Limpeza concluída", removidas: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao executar limpeza" });
    }
});

module.exports = AdminCartinhasRouter;
