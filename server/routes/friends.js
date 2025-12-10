const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const friendsAPI = require('../api/friends');

// Todas as rotas requerem autenticação
router.use(authMiddleware(0));

// Página de lista de amigos
router.get('/', async (req, res) => {
    res.render('pages/social/lista-amigos', {
        layout: 'layouts/main',
        user: req.user,
        title: 'Meus Amigos',
        description: 'Gerencie suas amizades e pedidos',
        icon: '👥'
    });
});

// API endpoints
router.use('/api', friendsAPI);

module.exports = router;
