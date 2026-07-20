const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { User, Cutucada, Notification, PushSubscription } = require('../../models');
const webpush = require('web-push');

// Configuração do Web Push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;
webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);

// POST /api/cutucadas/poke
router.post('/poke', async (req, res) => {
    try {
        const { targetUserId, message } = req.body;
        const senderId = req.user.id;

        if (!targetUserId) {
            return res.status(400).json({ success: false, error: 'Usuário alvo não especificado.' });
        }

        // Busca o usuário logado para aplicar o "lazy reset"
        const currentUser = await User.findByPk(senderId);
        if (!currentUser) return res.status(404).json({ success: false, error: 'Usuário logado não encontrado.' });

        const now = new Date();
        let cutucadasRestantes = currentUser.cutucadasRestantes;
        
        // Se já passou 1 hora desde o último reset, restaura para 20
        if (!currentUser.lastCutucadaReset || (now - new Date(currentUser.lastCutucadaReset)) >= 60 * 60 * 1000) {
            cutucadasRestantes = 20;
            currentUser.lastCutucadaReset = now;
        }

        if (cutucadasRestantes <= 0) {
            return res.status(429).json({ success: false, error: 'Você atingiu o limite de 20 cutucadas por hora.' });
        }

        // Subtrai 1 e salva
        currentUser.cutucadasRestantes = cutucadasRestantes - 1;
        await currentUser.save();

        const targetUser = await User.findOne({
            where: { publicid: targetUserId },
            include: [{ model: PushSubscription, as: 'pushSubscriptions' }]
        });

        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
        }

        // Cria a cutucada no DB
        await Cutucada.create({
            senderUserId: senderId,
            targetUserId: targetUser.id,
            message: message || null,
            isGlobal: false
        });

        const title = `Alguém te cutucou!`;
        const body = message || 'Você recebeu uma cutucada.';
        const link = `/features/cutucar`;

        // Cria a notificação
        await Notification.create({
            targetUserId: targetUser.id,
            type: 'cutucado',
            title,
            body,
            link
        });

        // Dispara Socket e Push
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${targetUser.id}`).emit('newNotification', { type: 'cutucado' });
        }

        const payload = JSON.stringify({ title, body, icon: '/images/Teco.webp', url: link });
        if (targetUser.pushSubscriptions && targetUser.pushSubscriptions.length > 0) {
            for (const sub of targetUser.pushSubscriptions) {
                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                    }, payload);
                } catch (err) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await sub.destroy();
                    }
                }
            }
        }

        res.json({ success: true, message: 'Cutucada enviada com sucesso!', remaining: currentUser.cutucadasRestantes });
    } catch (err) {
        console.error('[Cutucar API]', err);
        res.status(500).json({ success: false, error: 'Erro ao enviar cutucada.' });
    }
});

// POST /api/cutucadas/poke-all
router.post('/poke-all', async (req, res) => {
    try {
        const { message } = req.body;
        const senderId = req.user.id;

        // Busca o usuário logado
        const currentUser = await User.findByPk(senderId);
        if (!currentUser) return res.status(404).json({ success: false, error: 'Usuário logado não encontrado.' });

        const now = new Date();
        
        // Verifica limite (1 por dia - 24 horas)
        if (currentUser.lastCutucadaGeral && (now - new Date(currentUser.lastCutucadaGeral)) < 24 * 60 * 60 * 1000) {
            return res.status(429).json({ success: false, error: 'Você já deu sua cutucada geral hoje. Volte amanhã!' });
        }

        currentUser.lastCutucadaGeral = now;
        await currentUser.save();

        // Cria o registro da cutucada global
        await Cutucada.create({
            senderUserId: senderId,
            targetUserId: null,
            message: message || null,
            isGlobal: true
        });

        // Busca todos os usuários, menos o remetente
        const users = await User.findAll({
            where: { id: { [Op.ne]: senderId } },
            include: [{ model: PushSubscription, as: 'pushSubscriptions' }]
        });

        const title = `Alguém cutucou geral!`;
        const body = message || 'Geral foi cutucado!';
        const link = `/features/cutucar`;

        const notificationsData = users.map(u => ({
            targetUserId: u.id,
            type: 'cutucado',
            title,
            body,
            link
        }));

        // Cria notificações em lote
        await Notification.bulkCreate(notificationsData);

        const io = req.app.get('io');
        const payload = JSON.stringify({ title, body, icon: '/images/Teco.webp', url: link });

        // Dispara Socket e Push para todos
        for (const u of users) {
            if (io) {
                io.to(`user_${u.id}`).emit('newNotification', { type: 'cutucado' });
            }
            if (u.pushSubscriptions && u.pushSubscriptions.length > 0) {
                for (const sub of u.pushSubscriptions) {
                    try {
                        await webpush.sendNotification({
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth }
                        }, payload);
                    } catch (err) {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            await sub.destroy();
                        }
                    }
                }
            }
        }

        res.json({ success: true, message: 'Cutucada geral enviada com sucesso!' });
    } catch (err) {
        console.error('[Cutucar Geral API]', err);
        res.status(500).json({ success: false, error: 'Erro ao enviar cutucada geral.' });
    }
});

module.exports = router;
