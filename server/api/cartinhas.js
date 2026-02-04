const express = require("express");
const CartinhasRouter = express.Router();
const { Cartinha, User, sequelize } = require("../models");
const { createNotification } = require("./notifications");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const {
    createCartinhaSchema,
    updateCartinhaSchema,
    publicidSchema
} = require("../validators/cartinhas.validator");

// ==================== Auxiliares ====================

// Verifica se o usuário tem acesso à cartinha (remetente, destinatário ou admin)
async function verifyCartinhaAccess(cartinhaPublicId, userId, userRole) {
    const cartinha = await Cartinha.findOne({
        where: { publicid: cartinhaPublicId },
        attributes: ['senderUserId', 'recipientUserId']
    });

    if (!cartinha) return false;

    // Admin sempre tem acesso
    if (userRole >= 1) return true;

    // Usuário deve ser remetente ou destinatário
    return cartinha.senderUserId === userId || cartinha.recipientUserId === userId;
}

// ==================== Rotas ====================

// GET /cartinhas/enviadas - Carregar cartinhas enviadas pelo usuário
CartinhasRouter.get('/enviadas', async (req, res) => {
    try {
        const cartinhas = await Cartinha.findAll({
            where: {
                senderUserId: req.user.id
            },
            include: [{
                model: User,
                as: 'destinatario',
                attributes: ['publicid', 'username', 'profileimage']
            }],
            order: [['createdat', 'DESC']]
        });

        const cartinhasPorUsuario = cartinhas.reduce((acc, carta) => {
            const destinatarioPublicId = carta.destinatario.publicid;
            if (!acc[destinatarioPublicId]) {
                acc[destinatarioPublicId] = {
                    userId: destinatarioPublicId,
                    username: carta.destinatario.username,
                    profileimage: carta.destinatario.profileimage,
                    cartinhas: []
                };
            }
            acc[destinatarioPublicId].cartinhas.push(carta);
            return acc;
        }, {});

        res.json(Object.values(cartinhasPorUsuario));
    } catch (err) {
        console.error('[API] Erro ao carregar cartinhas enviadas:', err);
        res.status(500).json({ message: "Erro ao carregar cartinhas enviadas" });
    }
});

// GET /cartinhas/recebidas - Carregar cartinhas agrupadas por remetente
CartinhasRouter.get('/recebidas', async (req, res) => {
    try {
        const cartinhas = await Cartinha.findAll({
            where: {
                recipientUserId: req.user.id
            },
            include: [{
                model: User,
                as: 'remetente',
                attributes: ['publicid', 'username', 'profileimage']
            }],
            order: [['createdat', 'DESC']]
        });

        const cartinhasPorUsuario = cartinhas.reduce((acc, carta) => {
            const remetentePublicId = carta.remetente.publicid;
            if (!acc[remetentePublicId]) {
                acc[remetentePublicId] = {
                    userId: remetentePublicId,
                    username: carta.remetente.username,
                    profileimage: carta.remetente.profileimage,
                    cartinhas: []
                };
            }
            acc[remetentePublicId].cartinhas.push(carta);
            return acc;
        }, {});

        res.json(Object.values(cartinhasPorUsuario));
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
                recipientUserId: req.user.id,
                isfavorited: true
            },
            include: [{
                model: User,
                as: 'remetente',
                attributes: ['publicid', 'username', 'profileimage']
            }],
            order: [['favoritedat', 'DESC']]
        });

        res.json(cartinhas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar cartinhas favoritas" });
    }
});

// GET /cartinhas/:publicid - Carregar conteúdo de uma cartinha específica
CartinhasRouter.get('/:publicid', validate(publicidSchema, 'params'), async (req, res) => {
    try {
        const cartinha = await Cartinha.findOne({
            where: { publicid: req.params.publicid },
            include: [
                { model: User, as: 'remetente', attributes: ['publicid', 'username', 'profileimage'] },
                { model: User, as: 'destinatario', attributes: ['publicid', 'username'] }
            ]
        });

        if (!cartinha) return res.status(404).json({ message: "Cartinha não encontrada" });

        const hasAccess = req.user.roleId <= 11 || cartinha.senderUserId === req.user.id || cartinha.recipientUserId === req.user.id;
        if (!hasAccess) return res.status(403).json({ message: "Acesso negado" });

        res.json(cartinha);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar cartinha" });
    }
});

// PUT /cartinhas/:publicid/lida - Marcar cartinha como lida
CartinhasRouter.put('/:publicid/lida', validate(publicidSchema, 'params'), async (req, res) => {
    try {
        const cartinha = await Cartinha.findOne({ where: { publicid: req.params.publicid } });
        if (!cartinha) return res.status(404).json({ message: "Cartinha não encontrada" });

        if (cartinha.recipientUserId !== req.user.id) {
            return res.status(403).json({ message: "Apenas o destinatário pode marcar como lida" });
        }

        if (!cartinha.isread) {
            await cartinha.update({ isread: true });
        }

        res.json({ message: "Cartinha marcada como lida" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar cartinha como lida" });
    }
});

// POST /cartinhas - Enviar uma nova cartinha
CartinhasRouter.post('/', validate(createCartinhaSchema), async (req, res) => {
    const { recipientusername, title, body } = req.body;
    try {
        const destinatario = await User.findOne({ where: { username: recipientusername } });
        if (!destinatario) return res.status(404).json({ message: "Destinatário não encontrado" });

        if (destinatario.id === req.user.id) {
            return res.status(400).json({ message: "Você não pode enviar uma cartinha para si mesmo" });
        }

        const cartinha = await Cartinha.create({
            senderUserId: req.user.id,
            recipientUserId: destinatario.id,
            title,
            body
        });

        await createNotification({
            userId: destinatario.id,
            type: 'info',
            title: 'Nova cartinha',
            body: `${req.user.username} te enviou uma cartinha`,
            link: `/cartinhas/recebidas`
        });

        const io = req.app.get('io');
        if (io) io.to(`user_${destinatario.id}`).emit('newNotification', { type: 'cartinha' });

        res.status(201).json({ message: "Cartinha enviada com sucesso", cartinhaPublicId: cartinha.publicid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao enviar cartinha" });
    }
});

// POST /cartinhas/:publicid/toggle-favorito - Alterna o status de favorito
CartinhasRouter.post('/:publicid/toggle-favorito', validate(publicidSchema, 'params'), async (req, res) => {
    try {
        const cartinha = await Cartinha.findOne({ where: { publicid: req.params.publicid } });
        if (!cartinha) return res.status(404).json({ message: "Cartinha não encontrada" });

        if (cartinha.recipientUserId !== req.user.id) {
            return res.status(403).json({ message: "Acesso negado" });
        }

        const novoStatus = !cartinha.isfavorited;
        await cartinha.update({ isfavorited: novoStatus });

        res.json({ message: novoStatus ? "Favoritada" : "Removida dos favoritos", isfavorited: novoStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao alterar favorito" });
    }
});

// PUT /cartinhas/:publicid - Editar uma cartinha
CartinhasRouter.put('/:publicid', validate(publicidSchema, 'params'), validate(updateCartinhaSchema), async (req, res) => {
    try {
        const cartinha = await Cartinha.findOne({ where: { publicid: req.params.publicid } });
        if (!cartinha) return res.status(404).json({ message: "Cartinha não encontrada" });

        if (cartinha.senderUserId !== req.user.id && req.user.roleId > 11) {
            return res.status(403).json({ message: "Permissão negada" });
        }

        if (cartinha.isread && req.user.roleId > 11) {
            return res.status(403).json({ message: "Não é possível editar cartinhas lidas" });
        }

        await cartinha.update({ title: req.body.title, body: req.body.body });
        res.json({ message: "Cartinha editada com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao editar cartinha" });
    }
});

// DELETE /cartinhas/:publicid - Excluir uma cartinha
CartinhasRouter.delete('/:publicid', validate(publicidSchema, 'params'), async (req, res) => {
    try {
        const cartinha = await Cartinha.findOne({ where: { publicid: req.params.publicid } });
        if (!cartinha) return res.status(404).json({ message: "Cartinha não encontrada" });

        const hasAccess = req.user.roleId <= 11 || cartinha.senderUserId === req.user.id || cartinha.recipientUserId === req.user.id;
        if (!hasAccess) return res.status(403).json({ message: "Permissão negada" });

        await cartinha.destroy();
        res.json({ message: "Cartinha excluída com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao excluir cartinha" });
    }
});

module.exports = CartinhasRouter;
