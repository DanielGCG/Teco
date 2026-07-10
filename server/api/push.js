const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { PushSubscription } = require('../models');

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);

// Envia a chave publica para o client-side (front-end)
router.get('/vapidPublicKey', (req, res) => {
    res.json({ publicKey: publicVapidKey });
});

// Registra/salva a inscrição do usuário no banco
router.post('/subscribe', async (req, res) => {
    const subscription = req.body;
    const userId = req.user.id;

    try {
        // Verifica se a inscrição já existe para não duplicar
        const existing = await PushSubscription.findOne({ where: { endpoint: subscription.endpoint } });
        
        if (!existing) {
            await PushSubscription.create({
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            });
        }
        res.status(201).json({ success: true, message: 'Inscrição salva com sucesso.' });
    } catch (error) {
        console.error('[Push API] Erro ao salvar subscription:', error);
        res.status(500).json({ error: 'Erro ao salvar inscrição' });
    }
});

module.exports = router;