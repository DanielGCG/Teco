const express = require('express');
const { Galeria, GaleriaItem, GaleriaContributor, User, UserSession } = require("../models");
const { uploadImage, uploadVideo } = require('../utils/upload');
const { uploadToFileServer } = require('../utils/fileServer');
const { sanitizeFilename } = require('../utils/sanitize');
const axios = require('axios'); 
const FormData = require('form-data'); 
const { Op } = require('sequelize');
const router = express.Router();

const validateFileSize = (req, res, next) => {
    const file = req.file || (req.files && req.files.media && req.files.media[0]);
    if (!file) return next();

    const isVideo = (file.mimetype || '').startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv|avi|mpg|mpeg)$/i.test(file.originalname || '');
    const limit = isVideo ? 100 * 1024 * 1024 : 50 * 1024 * 1024;

    if (file.size > limit) {
        const typeLabel = isVideo ? 'video' : 'image';
        return res.status(413).json({ 
            success: false, 
            message: `File too large for ${typeLabel}. Limit: ${limit / (1024 * 1024)}MB` 
        });
    }
    next();
};

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

router.post('/', uploadImage.single('cover'), async (req, res) => {
    const { name, description, ispublic, backgroundcolor, cardcolor, gridxsize } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    try {
        let coverurl = null;
        if (req.file) {
            const sanitizedFilename = sanitizeFilename(req.file.originalname);
            try {
                coverurl = await uploadToFileServer({
                    buffer: req.file.buffer,
                    filename: sanitizedFilename,
                    folder: 'galerias/capas',
                    mimetype: req.file.mimetype
                });
            } catch (err) {
                return res.status(502).json({ success: false, message: 'Error uploading cover.', remoteData: err.response?.data });
            }
        }

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

router.post('/:publicid/upload', checkGalleryPermission, (req, res, next) => {
    uploadVideo.fields([{ name: 'media', maxCount: 1 }, { name: 'cover', maxCount: 1 }, { name: 'link_cover', maxCount: 1 }])(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'File too large. Limit: 100MB' });
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        next();
    });
}, validateFileSize, async (req, res) => {
    try {
        const itemType = req.body.item_type || 'media';
        let fileUrl = null;
        let coverUrl = req.body.cover_url || null;
        let mediaType = 'image';
        let originalName = req.body.title || 'Sem título';
        let textBody = null;

        if (itemType === 'media') {
            const mainFile = req.file || (req.files && req.files.media && req.files.media[0]);
            if (!mainFile) return res.status(400).json({ success: false, message: 'No media file provided.' });
            
            const sanitizedFilename = sanitizeFilename(mainFile.originalname);
            fileUrl = await uploadToFileServer({
                buffer: mainFile.buffer,
                filename: sanitizedFilename,
                folder: `galerias/${req.gallery.publicid}`,
                mimetype: mainFile.mimetype
            });
            originalName = req.body.title || mainFile.originalname;
            mediaType = mainFile.mimetype.startsWith('video/') ? 'video' : 
                        mainFile.mimetype.startsWith('audio/') ? 'audio' : 'image/gif';

            const coverFile = req.files && req.files.cover && req.files.cover[0];
            if (coverFile) {
                try {
                    const sanitizedCover = sanitizeFilename(coverFile.originalname);
                    coverUrl = await uploadToFileServer({
                        buffer: coverFile.buffer,
                        filename: sanitizedCover,
                        folder: `galerias/${req.gallery.publicid}/covers`,
                        mimetype: coverFile.mimetype
                    });
                } catch (err) {
                    coverUrl = coverUrl || fileUrl;
                }
            } else {
                coverUrl = coverUrl || fileUrl;
            }
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

            const coverFile = req.files && req.files.link_cover && req.files.link_cover[0];
            if (coverFile) {
                try {
                    const sanitizedCover = sanitizeFilename(coverFile.originalname);
                    coverUrl = await uploadToFileServer({
                        buffer: coverFile.buffer,
                        filename: sanitizedCover,
                        folder: `galerias/${req.gallery.publicid}/covers`,
                        mimetype: coverFile.mimetype
                    });
                } catch (err) { }
            }
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

router.patch('/:publicid/item/:itemPublicId', checkGalleryPermission, uploadImage.single('cover'), async (req, res) => {
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

        if (req.file) {
            const isImageItem = (item.type || '').toLowerCase().startsWith('image/');
            if (isImageItem) {
                console.warn(`Ignoring cover upload for image item id=${item.id}`);
            } else {
                try {
                    const sanitized = sanitizeFilename(req.file.originalname);
                    const coverUrl = await uploadToFileServer({ buffer: req.file.buffer, filename: sanitized, folder: `galerias/${req.gallery.publicid}/covers`, mimetype: req.file.mimetype });

                    item.coverurl = coverUrl;
                } catch (err) { }
            }
        }

        const remove_cover = req.body.remove_cover;
        if (!req.file && (remove_cover === 'true' || remove_cover === true)) {

            item.coverurl = null;
        }

        await item.save();
        res.json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating item.', error: error.message });
    }
});

// PATCH Gallery (Settings & Layout)
router.patch('/:publicid', 
    checkGalleryPermission, 
    uploadImage.fields([{ name: 'background', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), 
    async (req, res) => {
    
    const getBodyValue = (key) => {
        const val = req.body[key];
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

        const files = req.files || {};
        
        if (files.background && files.background[0]) {
            const file = files.background[0];
            const sanitizedFilename = sanitizeFilename(file.originalname);
            req.gallery.backgroundurl = await uploadToFileServer({
                buffer: file.buffer,
                filename: sanitizedFilename,
                folder: `galerias/${req.gallery.publicid}/style`,
                mimetype: file.mimetype
            });
        }

        if (files.cover && files.cover[0]) {
            const file = files.cover[0];
            const sanitizedFilename = sanitizeFilename(file.originalname);
            req.gallery.coverurl = await uploadToFileServer({
                buffer: file.buffer,
                filename: sanitizedFilename,
                folder: 'galerias/capas',
                mimetype: file.mimetype
            });
        }

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