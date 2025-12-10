const express = require("express");
const AdminCartinhasRouter = express.Router();
const { Cartinha, User } = require("../../models");
const { Op, fn, col, literal } = require("sequelize");

// ==================== Endpoints ====================

// GET /admin/cartinhas/estatisticas - Estatísticas gerais
AdminCartinhasRouter.get('/estatisticas', async (req, res) => {
    try {
        const total = await Cartinha.count();
        const naoLidas = await Cartinha.count({ where: { lida: false } });
        const lidas = await Cartinha.count({ where: { lida: true } });
        const favoritas = await Cartinha.count({ where: { favoritada: true } });

        res.json({
            total,
            nao_lidas: naoLidas,
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
    const usuario = req.query.usuario; // ID do usuário para filtrar
    const status = req.query.status;   // nao_lida, lida, favorita
    const search = req.query.search;   // busca por username

    const offset = (page - 1) * limit;

    try {
        // Construir filtros para usuários
        const userWhere = {};

        if (usuario) {
            userWhere.id = usuario;
        }

        if (search && search.trim() !== '') {
            userWhere.username = { [Op.like]: `%${search}%` };
        }

        // Construir filtros para cartinhas
        const cartinhaWhere = {};
        
        if (status === 'nao_lida') {
            cartinhaWhere.lida = false;
        } else if (status === 'lida') {
            cartinhaWhere.lida = true;
        } else if (status === 'favorita') {
            cartinhaWhere.favoritada = true;
        }

        // Query com agregações
        const usuarios = await User.findAll({
            where: userWhere,
            attributes: [
                'id',
                'username',
                'profile_image',
                [fn('COUNT', col('cartinhas_recebidas.id')), 'total_cartinhas'],
                [literal(`SUM(CASE WHEN cartinhas_recebidas.lida = FALSE THEN 1 ELSE 0 END)`), 'nao_lidas'],
                [literal(`SUM(CASE WHEN cartinhas_recebidas.lida = TRUE THEN 1 ELSE 0 END)`), 'lidas'],
                [literal(`SUM(CASE WHEN cartinhas_recebidas.favoritada = TRUE THEN 1 ELSE 0 END)`), 'favoritas']
            ],
            include: [{
                model: Cartinha,
                as: 'cartinhas_recebidas',
                attributes: [],
                where: cartinhaWhere,
                required: false
            }],
            group: ['User.id'],
            having: literal('total_cartinhas > 0'),
            order: [[literal('total_cartinhas'), 'DESC']],
            limit,
            offset,
            subQuery: false
        });

        // Contar total para paginação
        const countResult = await User.findAll({
            where: userWhere,
            attributes: [[fn('COUNT', fn('DISTINCT', col('User.id'))), 'total']],
            include: [{
                model: Cartinha,
                as: 'cartinhas_recebidas',
                attributes: [],
                where: cartinhaWhere,
                required: false
            }],
            having: literal('COUNT(cartinhas_recebidas.id) > 0'),
            raw: true
        });

        const totalItems = parseInt(countResult[0]?.total || 0);
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            usuarios: usuarios || [],
            currentPage: page,
            totalPages,
            totalItems
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar usuários e estatísticas" });
    }
});

// GET /admin/cartinhas/usuario/:userId - Listar cartinhas de um usuário específico
AdminCartinhasRouter.get('/usuario/:userId', async (req, res) => {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const status = req.query.status;
    const search = req.query.search;

    const offset = (page - 1) * limit;

    try {
        // Construir filtros
        const where = { destinatario_id: userId };

        if (status === 'nao_lida') {
            where.lida = false;
        } else if (status === 'lida') {
            where.lida = true;
        } else if (status === 'favorita') {
            where.favoritada = true;
        }

        if (search) {
            where.titulo = { [Op.like]: `%${search}%` };
        }

        // Buscar cartinhas
        const { count, rows: cartinhas } = await Cartinha.findAndCountAll({
            where,
            include: [{
                model: User,
                as: 'remetente',
                attributes: ['username']
            }],
            order: [['data_envio', 'DESC']],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            cartinhas: cartinhas.map(c => ({
                id: c.id,
                titulo: c.titulo,
                data_envio: c.data_envio,
                lida: c.lida,
                favoritada: c.favoritada,
                remetente_id: c.remetente_id,
                remetente_username: c.remetente.username
            })),
            currentPage: page,
            totalPages,
            totalItems: count
        });
    } catch (err) {
        console.error('[API] Erro ao carregar cartinhas do usuário:', err);
        res.status(500).json({ message: "Erro ao carregar cartinhas do usuário" });
    }
});

// GET /admin/cartinhas/:cartinhaId - Obter detalhes de uma cartinha específica
AdminCartinhasRouter.get('/:cartinhaId', async (req, res) => {
    const cartinhaId = req.params.cartinhaId;

    try {
        const cartinha = await Cartinha.findByPk(cartinhaId, {
            include: [
                {
                    model: User,
                    as: 'remetente',
                    attributes: ['username']
                },
                {
                    model: User,
                    as: 'destinatario',
                    attributes: ['username']
                }
            ]
        });

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        res.json({
            id: cartinha.id,
            titulo: cartinha.titulo,
            data_envio: cartinha.data_envio,
            data_leitura: cartinha.data_lida,
            lida: cartinha.lida,
            favoritada: cartinha.favoritada,
            remetente_id: cartinha.remetente_id,
            remetente_username: cartinha.remetente.username,
            destinatario_id: cartinha.destinatario_id,
            destinatario_username: cartinha.destinatario.username
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar detalhes da cartinha" });
    }
});

// DELETE /admin/cartinhas/remover - Remover cartinhas selecionadas
AdminCartinhasRouter.delete('/remover', async (req, res) => {
    const { cartinhaIds } = req.body;

    if (!cartinhaIds || !Array.isArray(cartinhaIds) || cartinhaIds.length === 0) {
        return res.status(400).json({ message: "IDs de cartinhas são obrigatórios" });
    }

    try {
        // Converter IDs para integers e filtrar valores válidos
        const validIds = cartinhaIds.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));

        if (validIds.length === 0) {
            return res.status(400).json({ message: "Nenhum ID válido fornecido" });
        }

        const deletedCount = await Cartinha.destroy({
            where: {
                id: { [Op.in]: validIds }
            }
        });

        res.json({
            removidas: deletedCount,
            message: "Cartinhas removidas com sucesso"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao remover cartinhas" });
    }
});

// POST /admin/cartinhas/limpeza - Executar limpeza automática
AdminCartinhasRouter.post('/limpeza', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Limpa apenas cartinhas lidas e não favoritadas com mais de 30 dias
        const deletedCount = await Cartinha.destroy({
            where: {
                lida: true,
                favoritada: false,
                data_lida: { [Op.lt]: thirtyDaysAgo }
            }
        });

        res.json({
            removidas: deletedCount,
            message: "Limpeza automática executada com sucesso"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao executar limpeza automática" });
    }
});

// PUT /admin/cartinhas/:cartinhaId - Atualizar uma cartinha
AdminCartinhasRouter.put('/:cartinhaId', async (req, res) => {
    const cartinhaId = req.params.cartinhaId;
    const { titulo, lida, favoritada } = req.body;

    try {
        const cartinha = await Cartinha.findByPk(cartinhaId);

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        const updates = {};
        if (titulo !== undefined) updates.titulo = titulo;
        if (lida !== undefined) updates.lida = lida;
        if (favoritada !== undefined) updates.favoritada = favoritada;

        await cartinha.update(updates);

        res.json({ message: "Cartinha atualizada com sucesso", cartinha });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar cartinha" });
    }
});

module.exports = AdminCartinhasRouter;
