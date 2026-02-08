const express = require("express");
const BadgesRouter = express.Router();
const { Badge, User } = require("../models");

// GET /badges/:publicid - Pegar badge por publicid
BadgesRouter.get('/:publicid', async (req, res) => {
    try {
        const badge = await Badge.findOne({
            where: { publicid: req.params.publicid }
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

// GET /badges/user/:publicid - Pegar badges de um usuário específico
BadgesRouter.get('/user/:publicid', async (req, res) => {
    try {
        const user = await User.findOne({ where: { publicid: req.params.publicid } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const badges = await user.getBadges({
            joinTableAttributes: []
        });
        
        res.json(badges);
    } catch (error) {
        console.error('Error fetching user badges:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = BadgesRouter;