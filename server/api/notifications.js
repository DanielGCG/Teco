const express = require("express");
const NotificationsRouter = express.Router();
const { Notification } = require("../models");
const validate = require("../middlewares/validate");
const { Op } = require("sequelize");
const {
    getNotificationsSchema,
    notificationIdSchema
} = require("../validators/notifications.validator");

// ==================== Endpoints de Notificações ====================

// GET /notifications - Listar notificações do usuário
NotificationsRouter.get('/', validate(getNotificationsSchema, 'query'), async (req, res) => {
    const { limit = 20, page = 1, unread } = req.query;
    const offset = (page - 1) * limit;
    const unreadOnly = unread === 'true';

    try {
        let whereClause = { targetUserId: req.user.id };
        
        if (unreadOnly) {
            whereClause.readat = null;
        }

        // Busca notificações
        const { count, rows: notifications } = await Notification.findAndCountAll({
            where: whereClause,
            order: [
                [Notification.sequelize.literal('readat IS NULL'), 'DESC'],
                ['createdat', 'DESC']
            ],
            limit: unreadOnly ? limit : undefined,
            offset: unreadOnly ? offset : undefined
        });

        // Se não for apenas não lidas, aplicar lógica especial
        let finalNotifications = notifications;
        if (!unreadOnly) {
            // Pega todas não lidas
            const unreadNotifs = await Notification.findAll({
                where: {
                    targetUserId: req.user.id,
                    readat: null
                },
                order: [['createdat', 'DESC']]
            });

            // Pega até 5 lidas mais recentes
            const readNotifs = await Notification.findAll({
                where: {
                    targetUserId: req.user.id,
                    readat: { [Op.ne]: null }
                },
                order: [['createdat', 'DESC']],
                limit: 5
            });

            // Combina e limita
            finalNotifications = [...unreadNotifs, ...readNotifs].slice(0, limit);
        }

        res.json({
            success: true,
            notifications: finalNotifications,
            total: count,
            page,
            limit
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar notificações" });
    }
});

// GET /notifications/count - Contagem de notificações não lidas
NotificationsRouter.get('/count', async (req, res) => {
    try {
        const count = await Notification.count({
            where: {
                targetUserId: req.user.id,
                readat: null
            }
        });

        res.json({ success: true, count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar contagem" });
    }
});

// PUT /notifications/:id/read - Marcar notificação como lida
NotificationsRouter.put('/:id/read', validate(notificationIdSchema, 'params'), async (req, res) => {
    const notificationId = req.params.id;

    try {
        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                targetUserId: req.user.id
            }
        });

        if (!notification) {
            return res.status(404).json({ message: "Notificação não encontrada" });
        }

        await notification.update({ readat: new Date() });

        res.json({ success: true, message: "Notificação marcada como lida" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar notificação" });
    }
});

// PUT /notifications/read-all - Marcar todas como lidas
NotificationsRouter.put('/read-all', async (req, res) => {
    try {
        await Notification.update(
            { readat: new Date() },
            {
                where: {
                    targetUserId: req.user.id,
                    readat: null
                }
            }
        );

        res.json({ success: true, message: "Todas as notificações foram marcadas como lidas" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar notificações" });
    }
});

// DELETE /notifications/:id - Deletar notificação
NotificationsRouter.delete('/:id', validate(notificationIdSchema, 'params'), async (req, res) => {
    const notificationId = req.params.id;

    try {
        const result = await Notification.destroy({
            where: {
                id: notificationId,
                targetUserId: req.user.id
            }
        });

        if (result === 0) {
            return res.status(404).json({ success: false, message: "Notificação não encontrada" });
        }

        res.json({ success: true, message: "Notificação deletada" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar notificação" });
    }
});

// ==================== Função helper para criar notificações ====================
async function createNotification({ userId, type, title, body, link = null }) {
    try {
        const notification = await Notification.create({
            targetUserId: userId,
            type,
            title,
            body,
            link
        });

        return notification.id;
    } catch (err) {
        console.error('[createNotification] Erro:', err);
        return null;
    }
}

// Exporta o router e a função helper
module.exports = NotificationsRouter;
module.exports.createNotification = createNotification;
