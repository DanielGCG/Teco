const express = require('express');
const { Galeria, GaleriaItem, GaleriaPermissao, User } = require("../models");
const multer = require('multer');
const { uploadToFileServer, deleteFromFileServer } = require('../utils/fileServer');
const axios = require('axios'); 
const FormData = require('form-data'); 
const { Op } = require('sequelize');
const router = express.Router();

function sanitizeFilename(filename) {
    if (!filename) return `file_${Date.now()}`;
    const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); 
    const sanitized = normalized.replace(/[^a-zA-Z0-9-_ .]/g, '').replace(/\s+/g, '_'); 
    return sanitized || `file_${Date.now()}`;
}

const uploadImage = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 50 * 1024 * 1024 } 
});

const uploadVideo = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 100 * 1024 * 1024 } 
});

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
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        const gallery = await Galeria.findByPk(id);
        if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });

        if (userRole >= 1) { req.gallery = gallery; return next(); }
        if (gallery.user_id === userId) { req.gallery = gallery; return next(); }
        if (gallery.is_public) { req.gallery = gallery; return next(); }

        const permission = await GaleriaPermissao.findOne({ where: { gallery_id: id, user_id: userId } });
        if (permission) { req.gallery = gallery; return next(); }

        return res.status(403).json({ success: false, message: 'You do not have permission to edit this gallery.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Permission check failed.', error: error.message });
    }
}

router.get('/', async (req, res) => {
    try {
        const galleries = await Galeria.findAll({
            include: [{ model: User, as: 'owner', attributes: ['username', 'profile_image'] }],
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, galleries });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching galleries.', error: error.message });
    }
});

router.post('/', uploadImage.single('cover'), async (req, res) => {
    const { name, description, is_public, card_color, grid_columns } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    try {
        let cover_url = null;
        if (req.file) {
            const sanitizedFilename = sanitizeFilename(req.file.originalname);
            try {
                cover_url = await uploadToFileServer({
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
            cover_url,
            user_id: req.user.id,
            is_public: is_public === 'true' || is_public === true,
            card_color: card_color || undefined,
            grid_columns: grid_columns ? parseInt(grid_columns) : undefined
        });

        res.status(201).json({ success: true, gallery });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating gallery.', error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const gallery = await Galeria.findByPk(req.params.id, {
            include: [
                { model: User, as: 'owner', attributes: ['username', 'profile_image'] },
                { 
                    model: GaleriaItem, 
                    as: 'items',
                    include: [{ model: User, as: 'uploader', attributes: ['username'] }]
                },
                { 
                    model: User, 
                    as: 'collaborators',
                    attributes: ['id', 'username'] 
                }
            ]
        });

        if (!gallery) return res.status(404).json({ success: false, message: 'Gallery not found.' });
        res.json({ success: true, gallery });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching details.', error: error.message });
    }
});

router.post('/:id/upload', checkGalleryPermission, (req, res, next) => {
    uploadVideo.fields([{ name: 'media', maxCount: 1 }, { name: 'cover', maxCount: 1 }])(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'File too large. Limit: 100MB' });
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        }
        next();
    });
}, validateFileSize, async (req, res) => {
    const mainFile = req.file || (req.files && req.files.media && req.files.media[0]);
    if (!mainFile) return res.status(400).json({ success: false, message: 'No media file provided.' });

    try {
        const sanitizedFilename = sanitizeFilename(mainFile.originalname);
        const fileUrl = await uploadToFileServer({
            buffer: mainFile.buffer,
            filename: sanitizedFilename,
            folder: `galerias/${req.params.id}`,
            mimetype: mainFile.mimetype
        });

        let coverUrl = req.body.cover_url || null;
        const coverFile = req.files && req.files.cover && req.files.cover[0];
        
        if (coverFile) {
            try {
                const sanitizedCover = sanitizeFilename(coverFile.originalname);
                coverUrl = await uploadToFileServer({
                    buffer: coverFile.buffer,
                    filename: sanitizedCover,
                    folder: `galerias/${req.params.id}/covers`,
                    mimetype: coverFile.mimetype
                });
            } catch (err) {
                console.warn('Failed to upload cover, using content fallback', err.message);
                coverUrl = coverUrl || fileUrl;
            }
        } else {
            coverUrl = coverUrl || fileUrl;
        }

        const maxZ = await GaleriaItem.max('z_index', { where: { gallery_id: req.params.id } });
        
        const item = await GaleriaItem.create({
            gallery_id: req.params.id,
            cover_url: coverUrl,
            content_url: fileUrl,
            name: req.body.name || mainFile.originalname,
            mimetype: mainFile.mimetype,
            user_id: req.user.id,
            z_index: (maxZ || 0) + 1,
            grid_w: 1,
            grid_h: 1,
            col_start: req.body.col_start ? parseInt(req.body.col_start) : null,
            row_start: req.body.row_start ? parseInt(req.body.row_start) : null
        });
        
        return res.status(201).json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal processing error.', error: error.message });
    }
});

router.delete('/:id/item/:itemId', checkGalleryPermission, async (req, res) => {
    try {
        const item = await GaleriaItem.findOne({ where: { id: req.params.itemId, gallery_id: req.params.id } });
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
        
        if (item.content_url) await deleteFromFileServer({ fileUrl: item.content_url });
        if (item.cover_url) await deleteFromFileServer({ fileUrl: item.cover_url });
        
        await item.destroy();
        res.json({ success: true, message: 'Item removed successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error removing item.', error: error.message });
    }
});

router.delete('/:id', checkGalleryPermission, async (req, res) => {
    try {
        if (req.gallery.user_id !== req.user.id && req.user.role < 1) return res.status(403).json({ success: false, message: 'Only owner can delete.' });
        
        if (req.gallery.cover_url) await deleteFromFileServer({ fileUrl: req.gallery.cover_url });
        if (req.gallery.background_url) await deleteFromFileServer({ fileUrl: req.gallery.background_url });
        
        const items = await GaleriaItem.findAll({ where: { gallery_id: req.params.id } });
        for (const img of items) {
            if (img.content_url) await deleteFromFileServer({ fileUrl: img.content_url });
            if (img.cover_url) await deleteFromFileServer({ fileUrl: img.cover_url });
        }
        
        await req.gallery.destroy();
        res.json({ success: true, message: 'Gallery deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error deleting gallery.', error: error.message });
    }
});

router.patch('/:id/item/:itemId', checkGalleryPermission, uploadImage.single('cover'), async (req, res) => {
    try {
        const item = await GaleriaItem.findOne({ where: { id: req.params.itemId, gallery_id: req.params.id } });
        if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

        const getVal = (k) => {
            const v = req.body[k];
            if (typeof v === 'string' && (v === 'true' || v === 'false')) return v === 'true';
            return v;
        };

        const name = getVal('name');
        const object_fit = getVal('object_fit'); 
        const show_title = getVal('show_title');
        const z_index = getVal('z_index');

        if (name !== undefined) item.name = name; 
        if (object_fit !== undefined) item.object_fit = object_fit;
        if (show_title !== undefined) item.show_title = show_title;
        if (z_index !== undefined) item.z_index = parseInt(z_index) || 0;

        if (req.file) {
            const isImageItem = (item.mimetype || '').toLowerCase().startsWith('image/');
            if (isImageItem) {
                console.warn(`Ignoring cover upload for image item id=${item.id}`);
            } else {
                try {
                    const sanitized = sanitizeFilename(req.file.originalname);
                    const coverUrl = await uploadToFileServer({ buffer: req.file.buffer, filename: sanitized, folder: `galerias/${req.params.id}/covers`, mimetype: req.file.mimetype });
                    
                    if (item.cover_url && item.cover_url !== item.content_url) {
                        try { await deleteFromFileServer({ fileUrl: item.cover_url }); } catch (e) { }
                    }
                    item.cover_url = coverUrl;
                } catch (err) { }
            }
        }

        const remove_cover = req.body.remove_cover;
        if (!req.file && (remove_cover === 'true' || remove_cover === true)) {
            if (item.cover_url && item.cover_url !== item.content_url) {
                try { await deleteFromFileServer({ fileUrl: item.cover_url }); } catch (e) { }
            }
            item.cover_url = null;
        }

        await item.save();
        res.json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating item.', error: error.message });
    }
});

// PATCH Gallery (Settings & Layout)
router.patch('/:id', 
    checkGalleryPermission, 
    uploadImage.fields([{ name: 'background', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), 
    async (req, res) => {
    
    const getBodyValue = (key) => {
        const val = req.body[key];
        return Array.isArray(val) ? val[0] : val;
    };

    const name = getBodyValue('name');
    const description = getBodyValue('description');
    const is_public = getBodyValue('is_public');
    const collaborators = getBodyValue('collaborators');
    const card_color = getBodyValue('card_color');
    const grid_columns = getBodyValue('grid_columns');
    const layout = getBodyValue('layout');
    
    const background_color = getBodyValue('background_color');
    const font_family = getBodyValue('font_family');
    const font_color = getBodyValue('font_color');
    const background_fill = getBodyValue('background_fill');
    
    const remove_background = getBodyValue('remove_background');
    const remove_cover = getBodyValue('remove_cover');

    try {
        if (name) req.gallery.name = name; 
        if (description !== undefined) req.gallery.description = description;
        if (is_public !== undefined) req.gallery.is_public = is_public === 'true' || is_public === true;
        if (card_color !== undefined) req.gallery.card_color = card_color;
        if (grid_columns !== undefined) req.gallery.grid_columns = parseInt(grid_columns) || req.gallery.grid_columns;
        
        if (background_color) req.gallery.background_color = background_color;
        if (font_family) req.gallery.font_family = font_family; 
        
        if (background_fill) req.gallery.background_fill = background_fill;
        if (font_color) req.gallery.font_color = font_color;

        if (remove_background === 'true' || remove_background === true) {
            if (req.gallery.background_url) await deleteFromFileServer({ fileUrl: req.gallery.background_url });
            req.gallery.background_url = null;
        }

        if (remove_cover === 'true' || remove_cover === true) {
            if (req.gallery.cover_url) await deleteFromFileServer({ fileUrl: req.gallery.cover_url });
            req.gallery.cover_url = null;
        }

        const files = req.files || {};
        
        if (files.background && files.background[0]) {
            const file = files.background[0];
            if (req.gallery.background_url) await deleteFromFileServer({ fileUrl: req.gallery.background_url });
            const sanitizedFilename = sanitizeFilename(file.originalname);
            req.gallery.background_url = await uploadToFileServer({
                buffer: file.buffer,
                filename: sanitizedFilename,
                folder: `galerias/${req.params.id}/style`,
                mimetype: file.mimetype
            });
        }

        if (files.cover && files.cover[0]) {
            const file = files.cover[0];
            if (req.gallery.cover_url) await deleteFromFileServer({ fileUrl: req.gallery.cover_url });
            const sanitizedFilename = sanitizeFilename(file.originalname);
            req.gallery.cover_url = await uploadToFileServer({
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
                    const { id, grid_w, grid_h, z_index, show_title, object_fit, col_start, row_start } = item;
                    if (!id) continue;
                    
                    const updateData = {
                        grid_w: grid_w || 1,
                        grid_h: grid_h || 1,
                        z_index: z_index || 0
                    };
                    
                    if (show_title !== undefined) updateData.show_title = show_title;
                    if (object_fit !== undefined) updateData.object_fit = object_fit;
                    if (col_start !== undefined) updateData.col_start = col_start === null ? null : parseInt(col_start);
                    if (row_start !== undefined) updateData.row_start = row_start === null ? null : parseInt(row_start);

                    try {
                        await GaleriaItem.update(updateData, { where: { id, gallery_id: req.params.id } });
                    } catch (e) { /* silent continue */ }
                }
            }
        }

        if (collaborators) {
            const colabsArray = typeof collaborators === 'string' ? JSON.parse(collaborators) : collaborators;
            if (Array.isArray(colabsArray)) {
                await GaleriaPermissao.destroy({ where: { gallery_id: req.params.id } });
                const permissions = colabsArray.map(uId => ({ gallery_id: req.params.id, user_id: uId }));
                await GaleriaPermissao.bulkCreate(permissions);
            }
        }

        res.json({ success: true, message: 'Gallery updated successfully.', gallery: req.gallery });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating gallery.', error: error.message });
    }
});

module.exports = router;