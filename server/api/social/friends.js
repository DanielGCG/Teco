const express = require("express");
const FriendsRouter = express.Router();
const { Follow, User } = require("../../models");
const { authMiddleware } = require("../../middlewares/authMiddleware");
const socketRouter = require("../../routes/socket.router");
const validate = require("../../middlewares/validate");
const { publicidSchema } = require("../../validators/friends.validator");

// Helper para proteger rotas
const protect = (minRole = 20) => {
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
FriendsRouter.get('/', protect(20), async (req, res) => {
    try {
        const userId = req.user.id;

        // Amigos são seguidores mútuos
        // Query: Encontrar usuários que eu sigo E que me seguem
        const friends = await User.findAll({
            include: [
                {
                    model: Follow,
                    as: 'followers',
                    where: { followerUserId: userId },
                    attributes: []
                },
                {
                    model: Follow,
                    as: 'following',
                    where: { followedUserId: userId },
                    attributes: []
                }
            ],
            attributes: ['id', 'publicid', 'username', 'profileimage', 'bio']
        });

        const formatted = friends.map(f => ({
            publicid: f.publicid,
            username: f.username,
            profileimage: f.profileimage,
            bio: f.bio,
            status: getUserStatus(f.id)
        }));

        // Ordena por status (online -> ausente -> offline) e depois alfabeticamente
        formatted.sort((a, b) => {
            const order = { online: 0, ausente: 1, offline: 2 };
            const statusDiff = (order[a.status] || 2) - (order[b.status] || 2);
            if (statusDiff !== 0) return statusDiff;
            return (a.username || '').localeCompare(b.username || '', 'pt-BR', { sensitivity: 'base' });
        });

        res.json({ friends: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar amigos" });
    }
});

// GET /friends/user/:publicid - Listar amigos (seguidores mútuos) de outro usuário
FriendsRouter.get('/user/:publicid', validate(publicidSchema, 'params'), async (req, res) => {
    try {
        const publicid = req.params.publicid;

        // Busca o usuário por publicid
        const targetUser = await User.findOne({ where: { publicid } });

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const targetId = targetUser.id;

        const friends = await User.findAll({
            include: [
                {
                    model: Follow,
                    as: 'followers',
                    where: { followerUserId: targetId },
                    attributes: []
                },
                {
                    model: Follow,
                    as: 'following',
                    where: { followedUserId: targetId },
                    attributes: []
                }
            ],
            attributes: ['id', 'publicid', 'username', 'profileimage', 'bio']
        });

        const formatted = friends.map(f => ({
            publicid: f.publicid,
            username: f.username,
            profileimage: f.profileimage,
            bio: f.bio,
            status: getUserStatus(f.id)
        }));

        // Ordena por status (online -> ausente -> offline) e depois alfabeticamente
        formatted.sort((a, b) => {
            const order = { online: 0, ausente: 1, offline: 2 };
            const statusDiff = (order[a.status] || 2) - (order[b.status] || 2);
            if (statusDiff !== 0) return statusDiff;
            return (a.username || '').localeCompare(b.username || '', 'pt-BR', { sensitivity: 'base' });
        });

        res.json({ friends: formatted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar amigos do usuário" });
    }
});

module.exports = FriendsRouter;
