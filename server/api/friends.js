const express = require("express");
const FriendsRouter = express.Router();
const { Friendship, User } = require("../models");
const authMiddleware = require("../middlewares/authMiddleware");
const { createNotification } = require("./notifications");
const socketRouter = require("../routes/socket.router");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const {
    friendshipIdSchema,
    userIdSchema,
    sendFriendRequestSchema
} = require("../validators/friends.validator");

// Helper para proteger rotas
const protect = (minRole = 0) => {
    return authMiddleware(minRole);
};

// Helper para obter status do usuário
function getUserStatus(userId) {
    if (socketRouter.getUserStatus) {
        return socketRouter.getUserStatus(userId);
    }
    return 'offline';
}

// ==================== Rotas de Amizades ====================

// GET /friends - Listar amigos aceitos
FriendsRouter.get('/', protect(0), async (req, res) => {
    try {
        // Busca amizades onde o usuário é o requester OU o addressee e status é 'accepted'
        const friendships = await Friendship.findAll({
            where: {
                [Op.or]: [
                    { requester_id: req.user.id },
                    { addressee_id: req.user.id }
                ],
                status: 'accepted'
            },
            include: [
                {
                    model: User,
                    as: 'requester',
                    attributes: ['id', 'username', 'profile_image', 'bio']
                },
                {
                    model: User,
                    as: 'addressee',
                    attributes: ['id', 'username', 'profile_image', 'bio']
                }
            ]
        });

        // Extrai o amigo (o usuário que NÃO é req.user.id)
        const friends = friendships.map(f => {
            const friend = f.requester_id === req.user.id ? f.addressee : f.requester;
            return {
                id: friend.id,
                username: friend.username,
                profile_image: friend.profile_image,
                bio: friend.bio,
                friend_since: f.created_at,
                status: getUserStatus(friend.id)
            };
        });

        // Ordena por status (online -> ausente -> offline)
        friends.sort((a, b) => {
            const order = { online: 0, ausente: 1, offline: 2 };
            return (order[a.status] || 2) - (order[b.status] || 2);
        });

        res.json({ friends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar amigos" });
    }
});

// GET /friends/requests - Listar pedidos de amizade recebidos
FriendsRouter.get('/requests', protect(0), async (req, res) => {
    try {
        const requests = await Friendship.findAll({
            where: {
                addressee_id: req.user.id,
                status: 'pending'
            },
            include: [{
                model: User,
                as: 'requester',
                attributes: ['id', 'username', 'profile_image', 'bio']
            }],
            order: [['created_at', 'DESC']]
        });

        const formatted = requests.map(r => ({
            friendship_id: r.id,
            id: r.requester.id,
            username: r.requester.username,
            profile_image: r.requester.profile_image,
            bio: r.requester.bio,
            created_at: r.created_at
        }));

        res.json({ requests: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar pedidos" });
    }
});

// GET /friends/sent - Listar pedidos de amizade enviados
FriendsRouter.get('/sent', protect(0), async (req, res) => {
    try {
        const sent = await Friendship.findAll({
            where: {
                requester_id: req.user.id,
                status: 'pending'
            },
            include: [{
                model: User,
                as: 'addressee',
                attributes: ['id', 'username', 'profile_image', 'bio']
            }],
            order: [['created_at', 'DESC']]
        });

        const formatted = sent.map(s => ({
            friendship_id: s.id,
            id: s.addressee.id,
            username: s.addressee.username,
            profile_image: s.addressee.profile_image,
            bio: s.addressee.bio,
            status: s.status,
            created_at: s.created_at
        }));

        res.json({ sent: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar pedidos enviados" });
    }
});

// GET /friends/check/:userId - Verificar status de amizade com um usuário
FriendsRouter.get('/check/:userId', protect(0), validate(userIdSchema, 'params'), async (req, res) => {
    const targetUserId = parseInt(req.params.userId);

    if (targetUserId === req.user.id) {
        return res.json({ status: 'self' });
    }

    try {
        const friendship = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { requester_id: req.user.id, addressee_id: targetUserId },
                    { requester_id: targetUserId, addressee_id: req.user.id }
                ]
            }
        });

        if (!friendship) {
            return res.json({ status: 'none' });
        }

        if (friendship.status === 'accepted') {
            return res.json({ status: 'friends' });
        }

        if (friendship.requester_id === req.user.id) {
            return res.json({ status: 'pending_sent' });
        } else {
            return res.json({ status: 'pending_received' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao verificar amizade" });
    }
});

// POST /friends/request - Enviar pedido de amizade
FriendsRouter.post('/request', protect(0), validate(sendFriendRequestSchema), async (req, res) => {
    const { addressee_id } = req.body;

    if (addressee_id === req.user.id) {
        return res.status(400).json({ message: "Você não pode adicionar a si mesmo como amigo" });
    }

    try {
        // Verifica se o usuário de destino existe
        const targetUser = await User.findByPk(addressee_id);

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Verifica se já existe um pedido ou amizade
        const existing = await Friendship.findOne({
            where: {
                [Op.or]: [
                    { requester_id: req.user.id, addressee_id },
                    { requester_id: addressee_id, addressee_id: req.user.id }
                ]
            }
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ message: "Vocês já são amigos" });
            }
            if (existing.status === 'pending') {
                if (existing.requester_id === req.user.id) {
                    return res.status(400).json({ message: "Você já enviou um pedido para este usuário" });
                } else {
                    return res.status(400).json({ message: "Este usuário já te enviou um pedido de amizade" });
                }
            }
        }

        // Cria o pedido de amizade
        const friendship = await Friendship.create({
            requester_id: req.user.id,
            addressee_id,
            status: 'pending'
        });

        // Cria notificação para o destinatário
        await createNotification({
            userId: addressee_id,
            type: 'FRIEND_REQUEST',
            title: 'Novo pedido de amizade',
            body: `${req.user.username} te enviou um pedido de amizade`,
            link: '/amigos',
            data: { friendshipId: friendship.id, fromUserId: req.user.id }
        });

        // Emitir evento de socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${addressee_id}`).emit('newNotification', { type: 'friend' });
            io.to(`user_${addressee_id}`).emit('newFriendRequest');
        }

        res.status(201).json({ 
            message: "Pedido de amizade enviado", 
            friendshipId: friendship.id 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao enviar pedido de amizade" });
    }
});

// PUT /friends/accept/:friendshipId - Aceitar pedido de amizade
FriendsRouter.put('/accept/:friendshipId', protect(0), validate(friendshipIdSchema, 'params'), async (req, res) => {
    const friendshipId = parseInt(req.params.friendshipId);

    try {
        const friendship = await Friendship.findByPk(friendshipId, {
            include: [{
                model: User,
                as: 'requester',
                attributes: ['username']
            }]
        });

        if (!friendship) {
            return res.status(404).json({ message: "Pedido de amizade não encontrado" });
        }

        // Verifica se é o destinatário
        if (friendship.addressee_id !== req.user.id) {
            return res.status(403).json({ message: "Você não pode aceitar este pedido" });
        }

        // Verifica se já foi aceito
        if (friendship.status === 'accepted') {
            return res.status(400).json({ message: "Pedido já foi aceito" });
        }

        // Aceita o pedido
        await friendship.update({ status: 'accepted' });

        // Cria notificação para o solicitante
        await createNotification({
            userId: friendship.requester_id,
            type: 'FRIEND_ACCEPTED',
            title: 'Pedido de amizade aceito',
            body: `${req.user.username} aceitou seu pedido de amizade`,
            link: '/amigos',
            data: { friendshipId: friendship.id, fromUserId: req.user.id }
        });

        // Emitir evento de socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${friendship.requester_id}`).emit('newNotification', { type: 'friend' });
            io.to(`user_${friendship.requester_id}`).emit('friendRequestAccepted');
        }

        res.json({ message: "Pedido de amizade aceito" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao aceitar pedido" });
    }
});

// PUT /friends/reject/:friendshipId - Rejeitar pedido de amizade
FriendsRouter.put('/reject/:friendshipId', protect(0), validate(friendshipIdSchema, 'params'), async (req, res) => {
    const friendshipId = parseInt(req.params.friendshipId);

    try {
        const friendship = await Friendship.findByPk(friendshipId);

        if (!friendship) {
            return res.status(404).json({ message: "Pedido de amizade não encontrado" });
        }

        // Verifica se é o destinatário
        if (friendship.addressee_id !== req.user.id) {
            return res.status(403).json({ message: "Você não pode rejeitar este pedido" });
        }

        // Remove o pedido
        await friendship.destroy();

        res.json({ message: "Pedido de amizade rejeitado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao rejeitar pedido" });
    }
});

// DELETE /friends/:userId - Remover amizade
FriendsRouter.delete('/:userId', protect(0), validate(userIdSchema, 'params'), async (req, res) => {
    const targetUserId = parseInt(req.params.userId);

    try {
        const result = await Friendship.destroy({
            where: {
                [Op.or]: [
                    { requester_id: req.user.id, addressee_id: targetUserId },
                    { requester_id: targetUserId, addressee_id: req.user.id }
                ],
                status: 'accepted'
            }
        });

        if (result === 0) {
            return res.status(404).json({ message: "Amizade não encontrada" });
        }

        res.json({ message: "Amizade removida" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao remover amizade" });
    }
});

// DELETE /friends/cancel/:friendshipId - Cancelar pedido enviado
FriendsRouter.delete('/cancel/:friendshipId', protect(0), validate(friendshipIdSchema, 'params'), async (req, res) => {
    const friendshipId = parseInt(req.params.friendshipId);

    try {
        const friendship = await Friendship.findByPk(friendshipId);

        if (!friendship) {
            return res.status(404).json({ message: "Pedido não encontrado" });
        }

        // Verifica se é o solicitante
        if (friendship.requester_id !== req.user.id) {
            return res.status(403).json({ message: "Você não pode cancelar este pedido" });
        }

        // Verifica se ainda está pendente
        if (friendship.status !== 'pending') {
            return res.status(400).json({ message: "Apenas pedidos pendentes podem ser cancelados" });
        }

        // Remove o pedido
        await friendship.destroy();

        res.json({ message: "Pedido cancelado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao cancelar pedido" });
    }
});

module.exports = FriendsRouter;
