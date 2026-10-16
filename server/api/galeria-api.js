const express = require('express');
const { Galeria, GaleriaItem, GaleriaContributor, User, UserSession } = require("../models");
const { getPublicUrl } = require('../utils/fileServer');
const { issueMediaTicket } = require('../utils/directUpload');
const router = express.Router();

async function checkGalleryPermission(req, res, next) {
    const { publicid } = req.params;
    const userId = req.user.id;
    const userRole = req.user.roleId;

    try {
        const gallery = await Galeria.findOne({ where: { publicid } });
        if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });

        if (userRole <= 11) { req.gallery = gallery; return next(); }
        if (gallery.createdbyUserId === userId) { req.gallery = gallery; return next(); }
        if (gallery.ispublic) { req.gallery = gallery; return next(); }

        const permission = await GaleriaContributor.findOne({ where: { galleryId: gallery.id, userId: userId } });
        if (permission) { req.gallery = gallery; return next(); }

        return res.status(403).json({ success: false, message: 'You do not have permission to edit this gallery.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Permission check failed.', error: error.message });
    }
}

router.get('/', async (req, res) => {
    try {
        const galleries = await Galeria.findAll({
            include: [{ model: User, as: 'owner', attributes: ['username', 'profileimage', 'publicid'] }],
            order: [['createdat', 'DESC']]
        });
        
        res.json({ success: true, galleries });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching galleries.', error: error.message });
    }
});

router.post('/', async (req, res) => {
    const { name, description, ispublic, backgroundcolor, cardcolor, gridxsize } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    try {
        let coverurl = null;
        coverurl = req.body.coverurl || null;

        const gallery = await Galeria.create({
            name, 
            description,
            coverurl,
            createdbyUserId: req.user.id,
            ispublic: ispublic === 'true' || ispublic === true,
            backgroundcolor: backgroundcolor || undefined,
            cardcolor: cardcolor || undefined,
            gridxsize: gridxsize ? parseInt(gridxsize) : 12,
            gridysize: 12 // Valor padrão
        });

        res.status(201).json({ success: true, gallery });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating gallery.', error: error.message });
    }
});

router.get('/:publicid', async (req, res) => {
    try {
        const gallery = await Galeria.findOne({
            where: { publicid: req.params.publicid },
            include: [
                { model: User, as: 'owner', attributes: ['username', 'profileimage', 'publicid'] },
                { 
                    model: GaleriaItem, 
                    as: 'items',
                    include: [{ model: User, as: 'uploader', attributes: ['username', 'publicid'] }]
                },
                { 
                    model: User, 
                    as: 'collaborators',
                    attributes: ['username', 'publicid'] 
                }
            ],
            order: [
                [{ model: GaleriaItem, as: 'items' }, 'positionz', 'ASC'],
                [{ model: GaleriaItem, as: 'items' }, 'id', 'ASC']
            ]
        });

        if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
        
        res.json({ success: true, gallery });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching details.', error: error.message });
    }
});

// Upload direto: o navegador envia os bytes ao servidor de arquivos usando este ticket
router.post('/:publicid/upload-ticket', checkGalleryPermission, express.json(), (req, res) => {
    try {
        const { name, type, size } = req.body || {};
        const { status, body } = issueMediaTicket({
            name, type, size,
            folder: `galerias/${req.gallery.publicid}`,
            allowAudio: true
        });
        res.status(status).json(body);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error issuing upload ticket.', error: error.message });
    }
});

router.post('/:publicid/upload', checkGalleryPermission, async (req, res) => {
    try {
        const itemType = req.body.item_type || 'media';
        let fileUrl = null;
        let coverUrl = req.body.cover_url || null;
        let mediaType = 'image';
        let originalName = req.body.title || 'Sem título';
        let textBody = null;

        if (itemType === 'media') {
            const directUrl = req.body.media_url;
            if (!directUrl) return res.status(400).json({ success: false, message: 'No media file provided.' });
            let parsedUrl;
            try {
                parsedUrl = new URL(directUrl);
            } catch (error) {
                return res.status(400).json({ success: false, message: 'Invalid media URL.' });
            }

            const expectedOrigin = new URL(getPublicUrl()).origin;
            const expectedPath = `/files/galerias/${req.gallery.publicid}/`;
            if (parsedUrl.origin !== expectedOrigin || !parsedUrl.pathname.startsWith(expectedPath) || parsedUrl.pathname.includes('..')) {
                console.error('[Galeria] URL de mídia direta rejeitada', {
                    origin: parsedUrl.origin,
                    expectedOrigin,
                    pathname: parsedUrl.pathname,
                    expectedPath
                });
                return res.status(400).json({ success: false, message: 'A URL da mídia não pertence a esta galeria.' });
            }

            const allowedTypes = ['video', 'audio', 'image/gif'];
            fileUrl = directUrl;
            originalName = req.body.title || req.body.media_name || 'Sem título';
            mediaType = allowedTypes.includes(req.body.media_type) ? req.body.media_type : 'image/gif';
            coverUrl = coverUrl || null;
            
            coverUrl = coverUrl || fileUrl;
        } else if (itemType === 'text') {
            textBody = req.body.text_content;
            if (!textBody) return res.status(400).json({ success: false, message: 'No text provided.' });
            mediaType = 'text';
            originalName = req.body.title || 'Texto';
        } else if (itemType === 'link') {
            fileUrl = req.body.link_url;
            if (!fileUrl) return res.status(400).json({ success: false, message: 'No link provided.' });
            mediaType = 'link';
            originalName = req.body.title || 'Link';

        }

        const maxZ = await GaleriaItem.max('positionz', { where: { galleryId: req.gallery.id } });
        
        const item = await GaleriaItem.create({
            galleryId: req.gallery.id,
            coverurl: coverUrl,
            contenturl: fileUrl,
            textbody: textBody,
            title: originalName,
            type: mediaType,
            showtitle: false,
            roundedcorners: false,
            editedbyUserId: req.user.id,
            positionz: (maxZ || 0) + 1,
            startpositionx: req.body.startpositionx ? parseInt(req.body.startpositionx) : 1,
            startpositiony: req.body.startpositiony ? parseInt(req.body.startpositiony) : 1,
            endpositionx: (req.body.startpositionx ? parseInt(req.body.startpositionx) : 1) + (parseInt(req.body.grid_w) || 1) - 1,
            endpositiony: (req.body.startpositiony ? parseInt(req.body.startpositiony) : 1) + (parseInt(req.body.grid_h) || 1) - 1
        });
        
        return res.status(201).json({ success: true, item });
    } catch (error) {
        console.error('[Galeria] Erro ao salvar item:', error);
        res.status(500).json({ success: false, message: 'Internal processing error.', error: error.message });
    }
});

router.delete('/:publicid/item/:itemPublicId', checkGalleryPermission, async (req, res) => {
    try {
        const item = await GaleriaItem.findOne({ where: { publicid: req.params.itemPublicId, galleryId: req.gallery.id } });
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
        
        
        await item.destroy();
        res.json({ success: true, message: 'Item removed successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error removing item.', error: error.message });
    }
});

router.delete('/:publicid', checkGalleryPermission, async (req, res) => {
    try {
        if (req.gallery.createdbyUserId !== req.user.id && req.user.roleId > 11) return res.status(403).json({ success: false, message: 'Only owner can delete.' });
        

        await req.gallery.destroy();
        res.json({ success: true, message: 'Gallery deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting gallery.', error: error.message });
    }
});

router.patch('/:publicid/item/:itemPublicId', checkGalleryPermission, async (req, res) => {
    try {
        const item = await GaleriaItem.findOne({ where: { publicid: req.params.itemPublicId, galleryId: req.gallery.id } });
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

        const getVal = (k) => {
            const v = req.body[k];
            if (typeof v === 'string' && (v === 'true' || v === 'false')) return v === 'true';
            return v;
        };

        const title = getVal('title');
        const textbody = getVal('textbody');
        const objectfit = getVal('objectfit'); 
        const showtitle = getVal('showtitle');
        const positionz = getVal('positionz');
        const roundedcorners = getVal('roundedcorners');

        if (title !== undefined) item.title = title; 
        if (textbody !== undefined) item.textbody = textbody;
        if (objectfit !== undefined) item.objectfit = objectfit;
        if (showtitle !== undefined) item.showtitle = showtitle;
        if (positionz !== undefined) item.positionz = parseInt(positionz) || 0;
        if (roundedcorners !== undefined) item.roundedcorners = roundedcorners;

        if (req.body.cover_url) {
            const isImageItem = (item.type || '').toLowerCase().startsWith('image/');
            if (isImageItem) {
                console.warn(`Ignoring cover upload for image item id=${item.id}`);
            } else {
                item.coverurl = req.body.cover_url;
            }
        }

        const remove_cover = req.body.remove_cover;
        if (!req.body.cover_url && (remove_cover === 'true' || remove_cover === true)) {

            item.coverurl = null;
        }

        await item.save();
        res.json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating item.', error: error.message });
    }
});

// PATCH Gallery (Settings & Layout)
router.patch('/:publicid', checkGalleryPermission, async (req, res) => {
    const body = req.body || {};
    
    const getBodyValue = (key) => {
        const val = body[key];
        return Array.isArray(val) ? val[0] : val;
    };

    const name = getBodyValue('name');
    const description = getBodyValue('description');
    const ispublic = getBodyValue('ispublic');
    const collaborators = getBodyValue('collaborators');
    const gridxsize = getBodyValue('gridxsize');
    const layout = getBodyValue('layout');
    
    const backgroundcolor = getBodyValue('backgroundcolor');
    const cardcolor = getBodyValue('cardcolor');
    const fontfamily = getBodyValue('fontfamily');
    const fontcolor = getBodyValue('fontcolor');
    const backgroundfill = getBodyValue('backgroundfill');
    
    const remove_background = getBodyValue('remove_background');
    const remove_cover = getBodyValue('remove_cover');

    try {
        if (name) req.gallery.name = name; 
        if (description !== undefined) req.gallery.description = description;
        if (ispublic !== undefined) req.gallery.ispublic = ispublic === 'true' || ispublic === true;
        if (gridxsize !== undefined) req.gallery.gridxsize = parseInt(gridxsize) || req.gallery.gridxsize;
        
        if (backgroundcolor) req.gallery.backgroundcolor = backgroundcolor;
        if (cardcolor) req.gallery.cardcolor = cardcolor;
        if (fontfamily) req.gallery.fontfamily = fontfamily; 
        
        if (backgroundfill) req.gallery.backgroundfill = backgroundfill;
        if (fontcolor) req.gallery.fontcolor = fontcolor;

        if (remove_background === 'true' || remove_background === true) {
            req.gallery.backgroundurl = null;
        }

        if (remove_cover === 'true' || remove_cover === true) {
            req.gallery.coverurl = null;
        }

        if (body.backgroundurl) req.gallery.backgroundurl = body.backgroundurl;
        if (body.coverurl) req.gallery.coverurl = body.coverurl;

        await req.gallery.save();

        if (layout) {
            let parsed;
            try { parsed = typeof layout === 'string' ? JSON.parse(layout) : layout; } catch (e) { parsed = null; }
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const { publicid, grid_w, grid_h, positionz, showtitle, objectfit, startpositionx, startpositiony } = item;
                    if (!publicid) continue;
                    
                    const updateData = {
                        positionz: positionz || 0
                    };
                    
                    if (showtitle !== undefined) updateData.showtitle = showtitle;
                    if (objectfit !== undefined) updateData.objectfit = objectfit;
                    
                    if (startpositionx !== undefined) {
                        updateData.startpositionx = parseInt(startpositionx) || 1;
                        if (grid_w !== undefined) updateData.endpositionx = updateData.startpositionx + (parseInt(grid_w) || 1) - 1;
                    }
                    if (startpositiony !== undefined) {
                        updateData.startpositiony = parseInt(startpositiony) || 1;
                        if (grid_h !== undefined) updateData.endpositiony = updateData.startpositiony + (parseInt(grid_h) || 1) - 1;
                    }

                    try {
                        await GaleriaItem.update(updateData, { where: { publicid, galleryId: req.gallery.id } });
                    } catch (e) { /* silent continue */ }
                }
            }
        }

        if (collaborators) {
            const colabsArray = typeof collaborators === 'string' ? JSON.parse(collaborators) : collaborators;
            if (Array.isArray(colabsArray)) {
                await GaleriaContributor.destroy({ where: { galleryId: req.gallery.id } });
                
                // Buscar IDs reais a partir dos publicids
                const users = await User.findAll({ where: { publicid: colabsArray }, attributes: ['id'] });
                const permissions = users.map(u => ({ galleryId: req.gallery.id, userId: u.id }));
                
                await GaleriaContributor.bulkCreate(permissions);
            }
        }

        res.json({ success: true, message: 'Gallery updated successfully.', gallery: req.gallery });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating gallery.', error: error.message });
    }
});

// GET /galerias/user/:publicid - Listar galerias de um usuário específico
router.get('/user/:publicid', async (req, res) => {
    try {
        const publicid = req.params.publicid;

        const targetUser = await User.findOne({ where: { publicid: publicid } });
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found.' });

        const whereClause = { createdbyUserId: targetUser.id };

        const galleries = await Galeria.findAll({
            where: whereClause,
            order: [['createdat', 'DESC']],
            include: [{ model: User, as: 'owner', attributes: ['username', 'profileimage', 'publicid'] }]
        });
        res.json({ success: true, galleries });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching user galleries.', error: error.message });
    }
});

module.exports = router;