const express = require("express");
const AdminNotificationsRouter = express.Router();
const { User, Notification, PushSubscription } = require("../../models");
const webpush = require("web-push");

// Configuração do Web Push (As mesmas do seu arquivo push.js)
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || 'SUA_VAPID_PUBLIC_KEY_AQUI';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'SUA_VAPID_PRIVATE_KEY_AQUI';
const subject = process.env.VAPID_SUBJECT || 'mailto:suporte@seusite.com';
webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);

// POST /api/admin/notifications/send - Enviar notificação manual
AdminNotificationsRouter.post('/send', async (req, res) => {
    const { targetUserPublicId, title, body, link, type } = req.body;

    if (!title || !body) {
        return res.status(400).json({ error: "Título e corpo são obrigatórios." });
    }

    try {
        const io = req.app.get('io');
        let targetUsers = [];

        // Verifica se é para todos ou um usuário específico
        if (targetUserPublicId === 'everyone') {
            targetUsers = await User.findAll({
                include: [{ model: PushSubscription, as: 'pushSubscriptions' }]
            });
        } else {
            const user = await User.findOne({
                where: { publicid: targetUserPublicId },
                include: [{ model: PushSubscription, as: 'pushSubscriptions' }]
            });
            if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
            targetUsers.push(user);
        }

        // 1. Criar as notificações no Banco de Dados
        const notificationsData = targetUsers.map(u => ({
            targetUserId: u.id,
            type: type || 'system',
            title,
            body,
            link: link || null
        }));

        await Notification.bulkCreate(notificationsData);

        // 2. Preparar payload do Push
        const payload = JSON.stringify({
            title: title,
            body: body,
            icon: '/images/Teco.webp',
            url: link || '/'
        });

        // 3. Disparar via Socket (ao vivo no site) e Push (em segundo plano)
        for (const u of targetUsers) {
            // Emite aviso em tempo real
            if (io) {
                io.to(`user_${u.id}`).emit('newNotification', { type: type || 'system' });
            }
            
            // Emite via Web Push
            if (u.pushSubscriptions && u.pushSubscriptions.length > 0) {
                for (const sub of u.pushSubscriptions) {
                    try {
                        await webpush.sendNotification({
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth }
                        }, payload);
                    } catch (err) {
                        // Limpa inscrições inválidas
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            await sub.destroy();
                        }
                    }
                }
            }
        }

        res.json({ success: true, message: `Notificação enviada com sucesso para ${targetUsers.length} usuário(s).` });
    } catch (err) {
        console.error('[Admin Notifications] Erro ao enviar:', err);
        res.status(500).json({ error: "Erro interno ao processar e enviar a notificação." });
    }
});

module.exports = AdminNotificationsRouter;