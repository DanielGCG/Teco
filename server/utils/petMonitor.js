const cron = require('node-cron');
const { Pet, User, PushSubscription } = require('../models');
const { Op } = require('sequelize');
const webpush = require('web-push');

function startPetMonitor() {
    // Executa a cada 2 horas (Ajuste a expressão cron se quiser outra frequência. Ex: '0 * * * *' para cada hora)
    cron.schedule('0 */2 * * *', async () => {
        console.log('[Pet Monitor] Verificando necessidades do BotecoGotchi...');
        
        try {
            // Busca pets que não estão mortos e estão com status baixos (fome, sede ou diversão abaixo de 30)
            const pets = await Pet.findAll({
                where: {
                    dead: false,
                    [Op.or]: [
                        { fome: { [Op.lt]: 30 } },
                        { sede: { [Op.lt]: 30 } },
                        { diversao: { [Op.lt]: 30 } }
                    ]
                },
                include: [{
                    model: User,
                    as: 'owner',
                    include: [{
                        model: PushSubscription,
                        as: 'pushSubscriptions'
                    }]
                }]
            });

            for (const pet of pets) {
                // Se o dono tem inscrições Push
                if (pet.owner && pet.owner.pushSubscriptions && pet.owner.pushSubscriptions.length > 0) {
                    let necessidades = [];
                    if (pet.fome < 30) necessidades.push('comida');
                    if (pet.sede < 30) necessidades.push('água');
                    if (pet.diversao < 30) necessidades.push('brincar');

                    const payload = JSON.stringify({
                        title: 'Seu BotecoGotchi precisa de você!',
                        body: `O(a) ${pet.name} está precisando de: ${necessidades.join(', ')}. Venha cuidar dele(a)!`,
                        icon: '/images/Teco.webp', // Pode colocar uma imagem específica do pet chorando se tiver
                        url: '/gotchi' // Onde o usuário clica e vai
                    });

                    // Envia para todos os dispositivos logados/inscritos daquele dono
                    for (const sub of pet.owner.pushSubscriptions) {
                        const pushSub = {
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth }
                        };

                        try {
                            await webpush.sendNotification(pushSub, payload);
                        } catch (err) {
                            // Erro 410 (Gone) ou 404 significa que o usuário revogou a permissão ou limpou o cache
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await sub.destroy();
                                console.log('[Pet Monitor] Inscrição expirada deletada.');
                            } else {
                                console.error('[Pet Monitor] Erro ao enviar notificação push:', err);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[Pet Monitor] Erro na verificação dos pets:', error);
        }
    });
}

module.exports = { startPetMonitor };