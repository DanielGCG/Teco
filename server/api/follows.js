const express = require("express");
const FollowsRouter = express.Router();
const { Follow, User, sequelize } = require("../models");
const authMiddleware = require("../middlewares/authMiddleware");
const { createNotification } = require("./notifications");
const validate = require("../middlewares/validate");
const { userIdSchema } = require("../validators/follows.validator");
const { Op } = require("sequelize");

// Helper para proteger rotas
const protect = (minRole = 0) => {
    return authMiddleware(minRole);
};

// POST /follow/:userId - Seguir um usuário
FollowsRouter.post('/:userId', protect(0), validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);
        const followerId = req.user.id;

        if (targetId === followerId) {
            return res.status(400).json({ message: "Você não pode seguir a si mesmo" });
        }

        // Verifica se o usuário existe
        const targetUser = await User.findByPk(targetId);
        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Verifica se já segue
        const existing = await Follow.findOne({
            where: { follower_id: followerId, following_id: targetId }
        });

        if (existing) {
            return res.status(400).json({ message: "Você já segue este usuário" });
        }

        const follow = await Follow.create({
            follower_id: followerId,
            following_id: targetId
        });

        // Notificação
        await createNotification({
            userId: targetId,
            type: 'FOLLOW',
            title: 'Novo Seguidor',
            body: `${req.user.username} começou a te seguir`,
            data: { followerId: followerId }
        });

        // Emitir evento de socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${targetId}`).emit('newNotification', { type: 'follow' });
        }

        res.status(201).json({ message: "Seguindo com sucesso", follow });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao seguir usuário" });
    }
});

// DELETE /unfollow/:userId - Parar de seguir um usuário
FollowsRouter.delete('/:userId', protect(0), validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);
        const followerId = req.user.id;

        const deleted = await Follow.destroy({
            where: { follower_id: followerId, following_id: targetId }
        });

        if (!deleted) {
            return res.status(404).json({ message: "Você não segue este usuário" });
        }

        res.json({ message: "Deixou de seguir com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deixar de seguir usuário" });
    }
});

// GET /status/:userId - Verificar status de seguimento
FollowsRouter.get('/status/:userId', protect(0), validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);
        const currentUserId = req.user.id;

        const following = await Follow.findOne({
            where: { follower_id: currentUserId, following_id: targetId }
        });

        const followedBy = await Follow.findOne({
            where: { follower_id: targetId, following_id: currentUserId }
        });

        res.json({
            following: !!following,
            followedBy: !!followedBy,
            isMutual: !!(following && followedBy)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao verificar status" });
    }
});

// GET /followers/:userId - Listar seguidores
FollowsRouter.get('/followers/:userId', validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);
        const followers = await Follow.findAll({
            where: { following_id: targetId },
            include: [{
                model: User,
                as: 'follower',
                attributes: ['id', 'username', 'profile_image', 'bio']
            }]
        });

        res.json({ followers: followers.map(f => f.follower) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar seguidores" });
    }
});

// GET /following/:userId - Listar quem o usuário segue
FollowsRouter.get('/following/:userId', validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);
        const following = await Follow.findAll({
            where: { follower_id: targetId },
            include: [{
                model: User,
                as: 'followed',
                attributes: ['id', 'username', 'profile_image', 'bio']
            }]
        });

        res.json({ following: following.map(f => f.followed) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar seguindo" });
    }
});

module.exports = FollowsRouter;
