const express = require("express");
const NotificationsRouter = express.Router();
const pool = require("../config/bd");

// ==================== Endpoints de Notificações ====================

// GET /notifications - Listar notificações do usuário
NotificationsRouter.get('/', async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    try {
        const connection = await pool.getConnection();

        let query;
        let queryParams = [req.user.id];

        if (unreadOnly) {
            // Apenas não lidas
            query = `
                SELECT id, type, title, body, link, data, read_at, created_at
                FROM notifications
                WHERE user_id = ? AND read_at IS NULL
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            // Todas não lidas + até 5 lidas mais recentes
            query = `
                (
                    SELECT id, type, title, body, link, data, read_at, created_at
                    FROM notifications
                    WHERE user_id = ? AND read_at IS NULL
                    ORDER BY created_at DESC
                )
                UNION ALL
                (
                    SELECT id, type, title, body, link, data, read_at, created_at
                    FROM notifications
                    WHERE user_id = ? AND read_at IS NOT NULL
                    ORDER BY created_at DESC
                    LIMIT 5
                )
                ORDER BY read_at IS NULL DESC, created_at DESC
                LIMIT ${limit}
            `;
            queryParams.push(req.user.id);
        }

        const [notifications] = await connection.execute(query, queryParams);

        // Contagem total
        let countQuery = `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?`;
        if (unreadOnly) countQuery += ` AND read_at IS NULL`;

        const [countResult] = await connection.execute(countQuery, [req.user.id]);

        connection.release();

        res.json({
            success: true,
            notifications,
            total: countResult[0].total,
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
        const connection = await pool.getConnection();

        const [result] = await connection.execute(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
            [req.user.id]
        );

        connection.release();

        res.json({ success: true, count: result[0].count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar contagem" });
    }
});

// PUT /notifications/:id/read - Marcar notificação como lida
NotificationsRouter.put('/:id/read', async (req, res) => {
    const notificationId = parseInt(req.params.id);

    try {
        const connection = await pool.getConnection();

        // Verifica se a notificação pertence ao usuário
        const [notification] = await connection.execute(
            `SELECT id FROM notifications WHERE id = ? AND user_id = ?`,
            [notificationId, req.user.id]
        );

        if (notification.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Notificação não encontrada" });
        }

        // Marca como lida
        await connection.execute(
            `UPDATE notifications SET read_at = NOW() WHERE id = ?`,
            [notificationId]
        );

        connection.release();
        res.json({ success: true, message: "Notificação marcada como lida" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar notificação" });
    }
});

// PUT /notifications/read-all - Marcar todas como lidas
NotificationsRouter.put('/read-all', async (req, res) => {
    try {
        const connection = await pool.getConnection();

        await connection.execute(
            `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL`,
            [req.user.id]
        );

        connection.release();
        res.json({ success: true, message: "Todas as notificações foram marcadas como lidas" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar notificações" });
    }
});

// DELETE /notifications/:id - Deletar notificação
NotificationsRouter.delete('/:id', async (req, res) => {
    const notificationId = parseInt(req.params.id);

    try {
        const connection = await pool.getConnection();

        const [result] = await connection.execute(
            `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
            [notificationId, req.user.id]
        );

        connection.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Notificação não encontrada" });
        }

        res.json({ success: true, message: "Notificação deletada" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar notificação" });
    }
});

// ==================== Função helper para criar notificações ====================
async function createNotification({ userId, type, title, body, link = null, data = null }) {
    try {
        const connection = await pool.getConnection();

        const [result] = await connection.execute(
            `INSERT INTO notifications (user_id, type, title, body, link, data) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, type, title, body, link, data ? JSON.stringify(data) : null]
        );

        connection.release();
        return result.insertId;
    } catch (err) {
        console.error('[createNotification] Erro:', err);
        return null;
    }
}

// Exporta o router e a função helper
module.exports = NotificationsRouter;
module.exports.createNotification = createNotification;
