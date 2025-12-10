const express = require("express");
const CartinhasRouter = express.Router();
const { Cartinha, User, sequelize } = require("../models");
const { createNotification } = require("./notifications");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const {
    createCartinhaSchema,
    updateCartinhaSchema,
    cartinhaIdSchema
} = require("../validators/cartinhas.validator");

// ==================== Auxiliares ====================

// Verifica se o usuário tem acesso à cartinha (remetente, destinatário ou admin)
async function verifyCartinhaAccess(cartinhaId, userId, userRole) {
    const cartinha = await Cartinha.findByPk(cartinhaId, {
        attributes: ['remetente_id', 'destinatario_id']
    });

    if (!cartinha) return false;

    // Admin sempre tem acesso
    if (userRole >= 1) return true;

    // Usuário deve ser remetente ou destinatário
    return cartinha.remetente_id === userId || cartinha.destinatario_id === userId;
}

// ==================== Rotas ====================

// GET /cartinhas/enviadas - Carregar cartinhas enviadas pelo usuário
CartinhasRouter.get('/enviadas', async (req, res) => {
    try {
        // Buscar cartinhas enviadas pelo usuário (remetente), aplicando a mesma regra de data
        const cartinhas = await Cartinha.findAll({
            where: {
                remetente_id: req.user.id,
                [Op.or]: [
                    { lida: false },
                    {
                        lida: true,
                        data_envio: { [Op.gte]: sequelize.literal('NOW() - INTERVAL 3 DAY') }
                    }
                ]
            },
            include: [{
                model: User,
                as: 'destinatario',
                attributes: ['id', 'username', 'profile_image']
            }],
            order: [['data_envio', 'DESC']]
        });

        // Agrupar cartinhas por destinatário
        const cartinhasPorUsuario = cartinhas.reduce((acc, carta) => {
            const destinatarioId = carta.destinatario.id;
            if (!acc[destinatarioId]) {
                acc[destinatarioId] = {
                    userId: destinatarioId,
                    username: carta.destinatario.username,
                    profile_image: carta.destinatario.profile_image,
                    cartinhas: []
                };
            }
            acc[destinatarioId].cartinhas.push({
                id: carta.id,
                titulo: carta.titulo,
                conteudo: carta.conteudo,
                dataEnvio: carta.data_envio,
                lida: carta.lida
            });
            return acc;
        }, {});

        const resultado = Object.values(cartinhasPorUsuario);
        res.json(resultado);

    } catch (err) {
        console.error('[API] Erro ao carregar cartinhas enviadas:', err);
        res.status(500).json({ message: "Erro ao carregar cartinhas enviadas" });
    }
});

// GET /cartinhas/recebidas - Carregar cartinhas agrupadas por remetente
CartinhasRouter.get('/recebidas', async (req, res) => {
    try {
        // Buscar todas as cartinhas recebidas do usuário, aplicando a regra de data para lidas
        const cartinhas = await Cartinha.findAll({
            where: {
                destinatario_id: req.user.id,
                [Op.or]: [
                    { lida: false },
                    {
                        lida: true,
                        data_envio: { [Op.gte]: sequelize.literal('NOW() - INTERVAL 3 DAY') }
                    }
                ]
            },
            include: [{
                model: User,
                as: 'remetente',
                attributes: ['id', 'username', 'profile_image']
            }],
            order: [['data_envio', 'DESC']]
        });

        // Agrupar cartinhas por remetente
        const cartinhasPorUsuario = cartinhas.reduce((acc, carta) => {
            const remetenteId = carta.remetente.id;
            if (!acc[remetenteId]) {
                acc[remetenteId] = {
                    userId: remetenteId,
                    username: carta.remetente.username,
                    profile_image: carta.remetente.profile_image,
                    cartinhas: []
                };
            }
            acc[remetenteId].cartinhas.push({
                id: carta.id,
                titulo: carta.titulo,
                conteudo: carta.conteudo,
                dataEnvio: carta.data_envio,
                lida: carta.lida,
                favoritada: carta.favoritada
            });
            return acc;
        }, {});

        const resultado = Object.values(cartinhasPorUsuario);
        res.json(resultado);

    } catch (err) {
        console.error('[API] Erro ao carregar cartinhas recebidas:', err);
        res.status(500).json({ message: "Erro ao carregar cartinhas recebidas" });
    }
});

// GET /cartinhas/favoritas - Carregar cartinhas favoritas
CartinhasRouter.get('/favoritas', async (req, res) => {
    try {
        const cartinhas = await Cartinha.findAll({
            where: {
                destinatario_id: req.user.id,
                favoritada: true
            },
            include: [{
                model: User,
                as: 'remetente',
                attributes: ['username', 'profile_image']
            }],
            order: [['data_favoritada', 'DESC']],
            raw: true,
            nest: true
        });

        // Formata o resultado
        const resultado = cartinhas.map(c => ({
            id: c.id,
            titulo: c.titulo,
            conteudo: c.conteudo,
            data_envio: c.data_envio,
            data_lida: c.data_lida,
            data_favoritada: c.data_favoritada,
            remetente_username: c.remetente.username,
            remetente_profile_image: c.remetente.profile_image
        }));

        res.json(resultado);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar cartinhas favoritas" });
    }
});

// GET /cartinhas/:cartinhaId - Carregar conteúdo de uma cartinha específica
CartinhasRouter.get('/:cartinhaId', validate(cartinhaIdSchema, 'params'), async (req, res) => {
    const cartinhaId = req.params.cartinhaId;

    try {
        // Verifica se o usuário tem acesso à cartinha
        const hasAccess = await verifyCartinhaAccess(cartinhaId, req.user.id, req.user.role);
        if (!hasAccess) {
            return res.status(403).json({ message: "Acesso negado" });
        }

        const cartinha = await Cartinha.findByPk(cartinhaId, {
            include: [
                {
                    model: User,
                    as: 'remetente',
                    attributes: ['id', 'username', 'profile_image']
                },
                {
                    model: User,
                    as: 'destinatario',
                    attributes: ['id', 'username']
                }
            ]
        });

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        res.json({
            id: cartinha.id,
            titulo: cartinha.titulo,
            conteudo: cartinha.conteudo,
            data_envio: cartinha.data_envio,
            lida: cartinha.lida,
            favoritada: cartinha.favoritada,
            remetente: {
                id: cartinha.remetente.id,
                username: cartinha.remetente.username,
                profile_image: cartinha.remetente.profile_image
            },
            destinatario: {
                id: cartinha.destinatario.id,
                username: cartinha.destinatario.username
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar cartinha" });
    }
});

// PUT /cartinhas/:cartinhaId/lida - Marcar cartinha como lida
CartinhasRouter.put('/:cartinhaId/lida', validate(cartinhaIdSchema, 'params'), async (req, res) => {
    const cartinhaId = req.params.cartinhaId;

    try {
        const cartinha = await Cartinha.findByPk(cartinhaId);

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        // Apenas o destinatário pode marcar como lida
        if (cartinha.destinatario_id !== req.user.id) {
            return res.status(403).json({ message: "Apenas o destinatário pode marcar como lida" });
        }

        // Se já estava lida, não faz nada
        if (cartinha.lida) {
            return res.json({ message: "Cartinha já estava marcada como lida" });
        }

        // Marca como lida (o hook do modelo cuida da data_lida)
        await cartinha.update({ lida: true });

        res.json({ message: "Cartinha marcada como lida" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar cartinha como lida" });
    }
});

// POST /cartinhas - Enviar uma nova cartinha
CartinhasRouter.post('/', validate(createCartinhaSchema), async (req, res) => {
    const { destinatario_username, titulo, conteudo } = req.body;

    try {
        // Busca o destinatário
        const destinatario = await User.findOne({
            where: { username: destinatario_username },
            attributes: ['id']
        });

        if (!destinatario) {
            return res.status(404).json({ message: "Usuário destinatário não encontrado" });
        }

        // Não pode enviar para si mesmo
        if (destinatario.id === req.user.id) {
            return res.status(400).json({ message: "Você não pode enviar uma cartinha para si mesmo" });
        }

        // Cria a cartinha
        const cartinha = await Cartinha.create({
            remetente_id: req.user.id,
            destinatario_id: destinatario.id,
            titulo,
            conteudo
        });

        // Cria notificação
        await createNotification({
            userId: destinatario.id,
            type: 'NEW_CARTINHA',
            title: 'Nova cartinha',
            body: `${req.user.username} te enviou uma cartinha`,
            link: `/cartinhas/recebidas`,
            data: { cartinhaId: cartinha.id }
        });

        // Emitir evento de socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${destinatario.id}`).emit('newNotification', { type: 'cartinha' });
        }

        res.status(201).json({ 
            message: "Cartinha enviada com sucesso", 
            cartinhaId: cartinha.id 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao enviar cartinha" });
    }
});

// POST /cartinhas/:cartinhaId/toggle-favorito - Alterna o status de favorito
CartinhasRouter.post('/:cartinhaId/toggle-favorito', validate(cartinhaIdSchema, 'params'), async (req, res) => {
    const cartinhaId = req.params.cartinhaId;

    try {
        const cartinha = await Cartinha.findByPk(cartinhaId);

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        // Apenas o destinatário pode favoritar
        if (cartinha.destinatario_id !== req.user.id) {
            return res.status(403).json({ message: "Apenas o destinatário pode favoritar" });
        }

        // Alterna o status de favoritada (o hook do modelo cuida das datas)
        const novoStatus = !cartinha.favoritada;
        await cartinha.update({ favoritada: novoStatus });

        res.json({ 
            message: novoStatus ? "Cartinha favoritada" : "Cartinha removida dos favoritos",
            favoritada: novoStatus
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao alterar favorito" });
    }
});

// PUT /cartinhas/:cartinhaId - Editar uma cartinha
CartinhasRouter.put('/:cartinhaId', validate(cartinhaIdSchema, 'params'), validate(updateCartinhaSchema), async (req, res) => {
    const cartinhaId = req.params.cartinhaId;
    const { titulo, conteudo } = req.body;

    try {
        const cartinha = await Cartinha.findByPk(cartinhaId);

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        // Apenas o remetente ou admin pode editar
        if (cartinha.remetente_id !== req.user.id && req.user.role < 1) {
            return res.status(403).json({ message: "Você não tem permissão para editar esta cartinha" });
        }

        // Se já foi lida, não pode editar (a não ser que seja admin)
        if (cartinha.lida && req.user.role < 1) {
            return res.status(403).json({ message: "Não é possível editar cartinhas já lidas" });
        }

        await cartinha.update({ titulo, conteudo });

        res.json({ message: "Cartinha editada com sucesso" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao editar cartinha" });
    }
});

// DELETE /cartinhas/:cartinhaId - Excluir uma cartinha
CartinhasRouter.delete('/:cartinhaId', validate(cartinhaIdSchema, 'params'), async (req, res) => {
    const cartinhaId = req.params.cartinhaId;

    try {
        const cartinha = await Cartinha.findByPk(cartinhaId);

        if (!cartinha) {
            return res.status(404).json({ message: "Cartinha não encontrada" });
        }

        // Apenas o remetente, destinatário ou admin pode excluir
        const isRemetente = cartinha.remetente_id === req.user.id;
        const isDestinatario = cartinha.destinatario_id === req.user.id;
        const isAdmin = req.user.role >= 1;

        if (!isRemetente && !isDestinatario && !isAdmin) {
            return res.status(403).json({ message: "Você não tem permissão para excluir esta cartinha" });
        }

        await cartinha.destroy();

        res.json({ message: "Cartinha excluída com sucesso" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao excluir cartinha" });
    }
});

module.exports = CartinhasRouter;
