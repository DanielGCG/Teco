const express = require('express');
const { issueMediaTicket } = require('../utils/directUpload');

const router = express.Router();

const FOLDER_RULES = {
    profiles: { folder: 'profiles', image: true },
    backgrounds: { folder: 'backgrounds', image: true },
    pagebackgrounds: { folder: 'pagebackgrounds', image: true },
    blogs: { image: true },
    configs: { folder: 'configs', admin: true, image: true },
    badges: { folder: 'badges', admin: true, image: true },
    stamps: { folder: 'stamps', admin: true, image: true },
    galerias: { folder: 'galerias/capas', image: true },
    'imagemdodia': { folder: 'imagemdodia', image: true },
    'imagemdodia/borders': { folder: 'imagemdodia/borders', admin: true, image: true }
};

router.post('/ticket', (req, res) => {
    const { name, type, size, folder } = req.body || {};
    const rule = FOLDER_RULES[folder];
    if (!rule) return res.status(400).json({ success: false, error: 'Pasta de upload inválida.' });
    if (rule.admin && req.user.roleId > 10) {
        return res.status(403).json({ success: false, error: 'Sem permissão para este upload.' });
    }

    const targetFolder = rule.folder || `${folder}/${req.user.publicid}`;
    const result = issueMediaTicket({
        name,
        type,
        size,
        folder: targetFolder,
        allowAudio: false,
        videoLimitMB: 500,
        otherLimitMB: 500
    });
    res.status(result.status).json(result.body);
});

module.exports = router;
