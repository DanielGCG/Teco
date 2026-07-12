const { ImagemDoDia, User } = require('../models');
const { Op } = require('sequelize');
const { createNotification } = require('../api/notifications');

/**
 * Notifica todos os usuários de que há uma nova imagem do dia.
 */
async function notifyNewImage(io) {
    setImmediate(async () => {
        try {
            const allUsers = await User.findAll({ attributes: ['id'] });
            for (const u of allUsers) {
                try {
                    await createNotification({
                        userId: u.id,
                        type: 'info',
                        title: 'Nova Imagem do Dia!',
                        body: 'saiu do forno bb! venha conferir!',
                        link: '/imagemdodia',
                        io: io
                    });
                } catch (err) {}
            }
        } catch (notifErr) {
            console.error('Erro ao notificar usuários sobre nova imagem do dia:', notifErr);
        }
    });
}

/**
 * Ativa uma imagem específica.
 */
async function activateImage(proxima, io) {
    if (!proxima) return null;
    
    const maxPos = await ImagemDoDia.max('position') || 0;
    proxima.position = maxPos + 1;
    proxima.activatedat = new Date();
    await proxima.save();
    
    notifyNewImage(io);
    return proxima;
}

/**
 * Verifica se a rotação é necessária e, se for, ativa a próxima imagem da fila.
 */
async function checkAndRotateImage(io) {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Busca a imagem mais recente ativada
        const atual = await ImagemDoDia.findOne({
            where: { position: { [Op.gt]: 0 } },
            order: [['position', 'DESC']]
        });

        // Se a imagem atual foi ativada antes de hoje, precisamos de uma nova
        if (atual && (!atual.activatedat || new Date(atual.activatedat) < hoje)) {
            // Tenta pegar a próxima da fila
            const proxima = await ImagemDoDia.findOne({
                where: { position: 0 },
                order: [['createdat', 'ASC']]
            });

            if (proxima) {
                await activateImage(proxima, io);
                console.log(`[ImagemDoDia] Rotação automática concluída: imagem ${proxima.id} ativada.`);
            }
        }
    } catch (error) {
        console.error('[ImagemDoDia] Erro na rotação automática:', error);
    }
}

module.exports = {
    notifyNewImage,
    activateImage,
    checkAndRotateImage
};
