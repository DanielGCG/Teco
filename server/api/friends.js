const express = require("express");
const FriendsRouter = express.Router();
const { Follow, User, sequelize } = require("../models");
const { authMiddleware } = require("../middlewares/authMiddleware");
const socketRouter = require("../routes/socket.router");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const { userIdSchema } = require("../validators/friends.validator");

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

// GET /friends - Listar amigos (seguidores mútuos) do usuário logado
FriendsRouter.get('/', protect(0), async (req, res) => {
    try {
        const userId = req.user.id;

        // Amigos são seguidores mútuos
        // Query: Encontrar usuários que eu sigo E que me seguem
        const friends = await User.findAll({
            include: [
                {
                    model: Follow,
                    as: 'followers',
                    where: { follower_id: userId },
                    attributes: []
                },
                {
                    model: Follow,
                    as: 'following',
                    where: { following_id: userId },
                    attributes: []
                }
            ],
            attributes: ['id', 'username', 'profile_image', 'bio']
        });

        const formatted = friends.map(f => ({
            id: f.id,
            username: f.username,
            profile_image: f.profile_image,
            bio: f.bio,
            status: getUserStatus(f.id)
        }));

        // Ordena por status (online -> ausente -> offline)
        formatted.sort((a, b) => {
            const order = { online: 0, ausente: 1, offline: 2 };
            return (order[a.status] || 2) - (order[b.status] || 2);
        });

        res.json({ friends: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar amigos" });
    }
});

// GET /friends/user/:userId - Listar amigos (seguidores mútuos) de outro usuário
FriendsRouter.get('/user/:userId', validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);

        const friends = await User.findAll({
            include: [
                {
                    model: Follow,
                    as: 'followers',
                    where: { follower_id: targetId },
                    attributes: []
                },
                {
                    model: Follow,
                    as: 'following',
                    where: { following_id: targetId },
                    attributes: []
                }
            ],
            attributes: ['id', 'username', 'profile_image', 'bio']
        });

        const formatted = friends.map(f => ({
            id: f.id,
            username: f.username,
            profile_image: f.profile_image,
            bio: f.bio,
            status: getUserStatus(f.id)
        }));

        res.json({ friends: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar amigos do usuário" });
    }
});

module.exports = FriendsRouter;
