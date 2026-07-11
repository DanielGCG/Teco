const cron = require('node-cron');
const { Pet, User, PushSubscription } = require('../models');
const { Op } = require('sequelize');
const webpush = require('web-push');
const { createNotification } = require('../api/notifications');
const { applyDecay, getDeathMessage, getClaimInfo } = require('./petLogic');

async function sendPushToUser(user, payloadStr) {
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) return;

    for (const sub of user.pushSubscriptions) {
        const pushSub = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
        };

        try {
            await webpush.sendNotification(pushSub, payloadStr);
        } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await sub.destroy();
                console.log('[Pet Monitor] Inscrição expirada deletada.');
            } else {
                console.error('[Pet Monitor] Erro ao enviar notificação push:', err);
            }
        }
    }
}

function startPetMonitor() {
    // Executa a cada 1 minuto
    cron.schedule('* * * * *', async () => {

        try {
            // Busca apenas pets que estão vivos
            const pets = await Pet.findAll({
                where: { dead: false },
                include: [{
                    model: User,
                    as: 'owner',
                    include: [{
                        model: PushSubscription,
                        as: 'pushSubscriptions'
                    }]
                }]
            });

            const now = new Date();

            for (const pet of pets) {
                // 1. Aplica o decaimento para saber o status real
                applyDecay(pet, now);

                // Se o pet morreu nesse tick
                if (pet.dead) {
                    await pet.save(); // Salva a morte com a data correta

                    const causeStr = getDeathMessage(pet);

                    // Notifica in-app
                    await createNotification({
                        userId: pet.owner.id,
                        type: 'info',
                        title: 'Seu BotecoGotchi faleceu 🪦',
                        body: `O(a) ${pet.name} ${causeStr}`,
                        link: '/gotchi/cemiterio'
                    });

                    // Notifica via Push
                    const payload = JSON.stringify({
                        title: 'Descanse em paz...',
                        body: `O(a) ${pet.name} ${causeStr} Ele agora descansa no cemitério.`,
                        icon: '/images/Teco.webp',
                        url: '/gotchi/cemiterio'
                    });
                    await sendPushToUser(pet.owner, payload);

                    continue; // Pula pro próximo pet
                }

                // 2. Verifica Resgate Diário
                const claimInfo = getClaimInfo(pet, now);
                if (claimInfo.canClaim && pet.claimNotifiedFor !== claimInfo.cycleKey) {
                    pet.claimNotifiedFor = claimInfo.cycleKey;

                    const payload = JSON.stringify({
                        title: 'Presente para o seu BotecoGotchi!',
                        body: `O resgate diário de suprimentos do ${pet.name} já está disponível!`,
                        icon: '/images/Teco.webp',
                        url: '/gotchi'
                    });
                    await sendPushToUser(pet.owner, payload);
                }

                // 3. Verifica Níveis e Avisos
                const stats = [pet.fome, pet.sede, pet.diversao, pet.sono];
                const lowestStat = Math.min(...stats);

                let necessidades = [];
                if (pet.fome < 30) necessidades.push('comida');
                if (pet.sede < 30) necessidades.push('água');
                if (pet.diversao < 30) necessidades.push('brincar');
                if (pet.sono < 30) necessidades.push('dormir');

                let shouldWarn = false;
                let newWarningsSent = pet.warningsSent;

                if (lowestStat < -80 && pet.warningsSent < 3) {
                    // Aviso final de morte iminente
                    shouldWarn = true;
                    newWarningsSent = 3;
                } else if (lowestStat < 0 && pet.warningsSent < 2) {
                    // Segundo aviso (abaixo de 0)
                    shouldWarn = true;
                    newWarningsSent = 2;
                } else if (lowestStat < 30 && pet.warningsSent < 1) {
                    // Primeiro aviso (abaixo de 30)
                    shouldWarn = true;
                    newWarningsSent = 1;
                } else if (lowestStat >= 30) {
                    // Pet está saudável, reseta avisos
                    newWarningsSent = 0;
                }

                if (shouldWarn && necessidades.length > 0) {
                    const urgencia = newWarningsSent === 3 ? "ÚLTIMO AVISO! " :
                        newWarningsSent === 2 ? "AVISO CRÍTICO! " : "";

                    const payload = JSON.stringify({
                        title: `Seu BotecoGotchi precisa de você!`,
                        body: `${urgencia}O(a) ${pet.name} está precisando muito de: ${necessidades.join(', ')}.`,
                        icon: '/images/Teco.webp',
                        url: '/gotchi'
                    });
                    await sendPushToUser(pet.owner, payload);
                }

                pet.warningsSent = newWarningsSent;

                // Salva o novo status no banco a cada minuto
                await pet.save();
            }
        } catch (error) {
            console.error('[Pet Monitor] Erro na verificação dos pets:', error);
        }
    });
}

module.exports = { startPetMonitor };