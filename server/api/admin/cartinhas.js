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
    const usuario = req.query.usuario;
    const status = req.query.status;
    const search = req.query.search;

    const offset = (page - 1) * limit;

    try {
        const userWhere = {};
        if (usuario) userWhere.id = usuario;
        if (search && search.trim() !== '') userWhere.username = { [Op.like]: `%${search}%` };

        const cartinhaWhere = {};
        if (status === 'naolida') cartinhaWhere.isread = false;
        else if (status === 'lida') cartinhaWhere.isread = true;
        else if (status === 'favorita') cartinhaWhere.isfavorited = true;

        const { rows, count } = await User.findAndCountAll({
            where: userWhere,
            attributes: [
                'id',
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
                required: false
            }],
            group: ['User.id'],
            having: literal('totalcartinhas > 0'),
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
    const { usuario, remetente, search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const where = {};
        if (usuario) where.recipientUserId = usuario;
        if (remetente) where.senderUserId = remetente;
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
                { model: User, as: 'remetente', attributes: ['username'] },
                { model: User, as: 'destinatario', attributes: ['username'] }
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

// GET /admin/cartinhas/usuario/:userId - Listar cartinhas de um usuário específico
AdminCartinhasRouter.get('/usuario/:userId', async (req, res) => {
    const { userId } = req.params;
    const { page = 1, limit = 15, status, search } = req.query;
    const offset = (page - 1) * limit;

    try {
        const where = { recipientUserId: userId };
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
                { model: User, as: 'remetente', attributes: ['username'] }
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

module.exports = AdminCartinhasRouter;
