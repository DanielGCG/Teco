const express = require('express');
const RodinhaRouter = express.Router();
const { User, Rodinha, Follow } = require('../../models');
const { Op } = require('sequelize');

// GET /rodinha/contacts - Obter todos os seguidores e se estão na rodinha
RodinhaRouter.get('/contacts', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Buscar quem o usuário já segue
        const following = await Follow.findAll({
            where: { followerUserId: userId },
            include: [{
                model: User,
                as: 'followed',
                attributes: ['id', 'username', 'profileimage', 'publicid']
            }]
        });

        // Buscar membros atuais da rodinha
        const rodinha = await Rodinha.findAll({
            where: { userId: userId },
            attributes: ['targetUserId']
        });
        const rodinhaIds = rodinha.map(r => r.targetUserId);

        const contacts = following.map(f => {
            return {
                id: f.followed.id,
                username: f.followed.username,
                profileimage: f.followed.profileimage,
                publicid: f.followed.publicid,
                isRodinha: rodinhaIds.includes(f.followed.id)
            };
        });

        res.json({ contacts });
    } catch (err) {
        console.error('Erro ao buscar contatos da rodinha:', err);
        res.status(500).json({ error: 'Erro ao buscar contatos.' });
    }
});

// POST /rodinha - Salvar a configuração completa da rodinha
RodinhaRouter.post('/', express.json(), async (req, res) => {
    try {
        const userId = req.user.id;
        const { selectedIds } = req.body; // array de IDs

        if (!Array.isArray(selectedIds)) {
            return res.status(400).json({ error: 'Lista de IDs inválida.' });
        }

        // Remover todos os atuais e inserir os novos
        await Rodinha.destroy({ where: { userId: userId } });
        
        if (selectedIds.length > 0) {
            const rodinhaData = selectedIds.map(targetId => ({
                userId: userId,
                targetUserId: targetId
            }));
            await Rodinha.bulkCreate(rodinhaData);
        }

        res.json({ message: 'Rodinha salva com sucesso.' });
    } catch (err) {
        console.error('Erro ao salvar rodinha:', err);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

module.exports = RodinhaRouter;
