const express = require("express");
const AdminBadgesRouter = express.Router();
const { Badge, BadgeUser, User } = require("../../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../../utils/fileServer');
const sharp = require('sharp');

const upload = multer({ storage: multer.memoryStorage() });

// GET /admin/badges/ - Listar todas as badges
AdminBadgesRouter.get('/', async (req, res) => {
    try {
        const badges = await Badge.findAll();
        res.json(badges);
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/badges/:publicid - Buscar informações de uma badge específica e os usuários que a possuem
AdminBadgesRouter.get('/:publicid', async (req, res) => {
    try {
        const badge = await Badge.findOne({
            where: { publicid: req.params.publicid },
            include: [{
                model: User,
                as: 'owners',
                attributes: ['publicid', 'username', 'profileimage'],
                through: { attributes: [] }
            }]
        });
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }
        res.json(badge);
    } catch (error) {
        console.error('Error fetching badge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/badges/user/:publicid - Pegar badges de um usuário específico
AdminBadgesRouter.get('/user/:publicid', async (req, res) => {
    try {
        const user = await User.findOne({ where: { publicid: req.params.publicid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const badges = await user.getBadges({ joinTableAttributes: [] });
        res.json(badges);
    } catch (error) {
        console.error('Error fetching user badges:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/badges/ - Criar um novo badge
AdminBadgesRouter.post('/', upload.single('file'), async (req, res) => {
    const { name, description } = req.body;
    let { url } = req.body;

    try {
        if (req.file) {
            // Se enviou arquivo, faz o upload para o servidor de arquivos
            let processedBuffer;
            let extension = 'webp';
            let mimetype = 'image/webp';

            const isGif = req.file.mimetype === 'image/gif';

            if (isGif) {
                // Preservar animação se for GIF
                processedBuffer = await sharp(req.file.buffer, { animated: true })
                    .resize(100, 100, { fit: 'inside' })
                    .toBuffer();
                extension = 'gif';
                mimetype = 'image/gif';
            } else {
                // Normalizar para WebP (eficiente e suporta transparência)
                processedBuffer = await sharp(req.file.buffer)
                    .resize(100, 100, { fit: 'inside' })
                    .webp({ quality: 90 })
                    .toBuffer();
            }

            url = await uploadToFileServer({
                buffer: processedBuffer,
                filename: `badge.${extension}`,
                folder: 'badges',
                mimetype: mimetype
            });
        }

        const newBadge = await Badge.create({ 
            name, 
            description, 
            url,
            createdbyUserId: req.user.id 
        });
        res.status(201).json(newBadge);
    } catch (error) {
        console.error('Error creating badge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /admin/badges/:publicid - Editar um badge
AdminBadgesRouter.put('/:publicid', upload.single('file'), async (req, res) => {
    const { name, description } = req.body;
    let { url } = req.body;

    try {
        const badge = await Badge.findOne({ where: { publicid: req.params.publicid } });
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        if (req.file) {
            // Se enviou novo arquivo, deleta o antigo se ele for do servidor de arquivos
            if (badge.url) {
                try { await deleteFromFileServer({ fileUrl: badge.url }); } catch (e) {}
            }

            let processedBuffer;
            let extension = 'webp';
            let mimetype = 'image/webp';

            const isGif = req.file.mimetype === 'image/gif';

            if (isGif) {
                // Preservar animação se for GIF
                processedBuffer = await sharp(req.file.buffer, { animated: true })
                    .resize(100, 100, { fit: 'inside' })
                    .toBuffer();
                extension = 'gif';
                mimetype = 'image/gif';
            } else {
                // Normalizar para WebP (eficiente e suporta transparência)
                processedBuffer = await sharp(req.file.buffer)
                    .resize(100, 100, { fit: 'inside' })
                    .webp({ quality: 90 })
                    .toBuffer();
            }

            url = await uploadToFileServer({
                buffer: processedBuffer,
                filename: `badge.${extension}`,
                folder: 'badges',
                mimetype: mimetype
            });
        }

        await badge.update({ name, description, url });
        res.json(badge);
    } catch (error) {
        console.error('Error updating badge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/badges/assign - Atribuir badge a um usuário
AdminBadgesRouter.post('/assign', async (req, res) => {
    const { userPublicId, badgePublicId } = req.body;
    try {
        const [user, badge] = await Promise.all([
            User.findOne({ where: { publicid: userPublicId } }),
            Badge.findOne({ where: { publicid: badgePublicId } })
        ]);

        if (!user || !badge) {
            return res.status(404).json({ error: 'User or Badge not found' });
        }

        // Verificar se já existe
        const existingAssignment = await BadgeUser.findOne({
            where: {
                userId: user.id,
                badgeId: badge.id
            }
        });

        if (existingAssignment) {
            return res.status(400).json({ error: 'Usuário já possui esta badge' });
        }

        await BadgeUser.create({
            userId: user.id,
            badgeId: badge.id,
            createdbyUserId: req.user.id
        });

        res.json({ message: 'Badge assigned successfully' });
    } catch (error) {
        console.error('Error assigning badge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/badges/unassign - Remover badge de um usuário
AdminBadgesRouter.post('/unassign', async (req, res) => {
    const { userPublicId, badgePublicId } = req.body;
    try {
        const [user, badge] = await Promise.all([
            User.findOne({ where: { publicid: userPublicId } }),
            Badge.findOne({ where: { publicid: badgePublicId } })
        ]);

        if (!user || !badge) {
            return res.status(404).json({ error: 'User or Badge not found' });
        }

        await BadgeUser.destroy({
            where: {
                userId: user.id,
                badgeId: badge.id
            }
        });

        res.json({ message: 'Badge removed successfully' });
    } catch (error) {
        console.error('Error removing badge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /admin/badges/:publicid - Deletar um badge
AdminBadgesRouter.delete('/:publicid', async (req, res) => {
    try {
        const badge = await Badge.findOne({ where: { publicid: req.params.publicid } });
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        if (badge.url) {
            try { await deleteFromFileServer({ fileUrl: badge.url }); } catch (e) {}
        }

        await badge.destroy();
        res.json({ message: 'Badge deleted successfully' });
    } catch (error) {
        console.error('Error deleting badge:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = AdminBadgesRouter;