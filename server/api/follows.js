const express = require("express");
const FollowsRouter = express.Router();
const { Follow, User, sequelize } = require("../models");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { createNotification } = require("./notifications");
const validate = require("../middlewares/validate");
const { userIdSchema } = require("../validators/follows.validator");
const { Op } = require("sequelize");

// Helper para proteger rotas
const protect = (minRole = 20) => {
    return authMiddleware(minRole);
};

// POST /follow/:userId - Seguir um usuário
FollowsRouter.post('/:userId', protect(20), validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const inputId = req.params.userId;
        const followerId = req.user.id;

        // Tenta encontrar o usuário por publicid ou id
        let targetUser;
        if (isNaN(inputId)) {
            targetUser = await User.findOne({ where: { publicid: inputId } });
        } else {
            targetUser = await User.findByPk(parseInt(inputId));
        }

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const targetId = targetUser.id;

        if (targetId === followerId) {
            return res.status(400).json({ message: "Você não pode seguir a si mesmo" });
        }

        // Verifica se já segue
        const existing = await Follow.findOne({
            where: { followerUserId: followerId, followedUserId: targetId }
        });

        if (existing) {
            return res.status(400).json({ message: "Você já segue este usuário" });
        }

        const follow = await Follow.create({
            followerUserId: followerId,
            followedUserId: targetId
        });

        // Verifica se virou amizade (seguimento mútuo)
        const isMutual = await Follow.findOne({
            where: { followerUserId: targetId, followedUserId: followerId }
        });

        // Notificação
        if (isMutual) {
            await createNotification({
                userId: targetId,
                type: 'followaccept',
                title: 'Nova Amizade!',
                body: `Você e ${req.user.username} agora são amigos!`,
                link: `/${req.user.username}`
            });
        } else {
            await createNotification({
                userId: targetId,
                type: 'info',
                title: 'Novo Seguidor',
                body: `${req.user.username} começou a te seguir`,
                link: `/${req.user.username}`
            });
        }

        // Emitir evento de socket
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${targetId}`).emit('newNotification', { type: isMutual ? 'friend' : 'follow' });
        }

        // (evento emitido acima) socket já tratado

        res.status(201).json({ message: "Seguindo com sucesso", follow });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao seguir usuário" });
    }
});

// DELETE /unfollow/:userId - Parar de seguir um usuário
FollowsRouter.delete('/:userId', protect(20), validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const inputId = req.params.userId;
        const followerId = req.user.id;

        // Tenta encontrar o usuário por publicid ou id
        let targetUser;
        if (isNaN(inputId)) {
            targetUser = await User.findOne({ where: { publicid: inputId } });
        } else {
            targetUser = await User.findByPk(parseInt(inputId));
        }

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const targetId = targetUser.id;

        const deleted = await Follow.destroy({
            where: { followerUserId: followerId, followedUserId: targetId }
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
FollowsRouter.get('/status/:userId', protect(20), validate(userIdSchema, 'params'), async (req, res) => {
    try {
        const targetId = parseInt(req.params.userId);
        const currentUserId = req.user.id;

        const following = await Follow.findOne({
            where: { followerUserId: currentUserId, followedUserId: targetId }
        });

        const followedBy = await Follow.findOne({
            where: { followerUserId: targetId, followedUserId: currentUserId }
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
        const inputId = req.params.userId;
        let targetId;

        if (isNaN(inputId)) {
            const user = await User.findOne({ where: { publicid: inputId } });
            if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
            targetId = user.id;
        } else {
            targetId = parseInt(inputId);
        }

        const followers = await Follow.findAll({
            where: { followedUserId: targetId },
            include: [{
                model: User,
                as: 'follower',
                attributes: ['id', 'publicid', 'username', 'profileimage', 'bio']
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
        const inputId = req.params.userId;
        let targetId;

        if (isNaN(inputId)) {
            const user = await User.findOne({ where: { publicid: inputId } });
            if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
            targetId = user.id;
        } else {
            targetId = parseInt(inputId);
        }

        const following = await Follow.findAll({
            where: { followerUserId: targetId },
            include: [{
                model: User,
                as: 'followed',
                attributes: ['id', 'publicid', 'username', 'profileimage', 'bio']
            }]
        });

        res.json({ following: following.map(f => f.followed) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar seguindo" });
    }
});

module.exports = FollowsRouter;
