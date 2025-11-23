const express = require("express");
const FriendsRouter = express.Router();
const pool = require("../config/bd");
const authMiddleware = require("../middlewares/authMiddleware");
const { createNotification } = require("./notifications");
const socketRouter = require("../routes/socket.router");

// Helper para proteger rotas
const protect = (minRole = 0) => {
    return authMiddleware(minRole);
};

// Helper para obter status do usuário
function getUserStatus(userId) {
    if (socketRouter.getUserStatus) {
        return socketRouter.getUserStatus(userId);
    }
    return 'offline';
}

// ==================== Rotas de Amizades ====================

// GET /friends - Listar amigos aceitos
FriendsRouter.get('/', protect(0), async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // Busca amizades onde o usuário é o requester OU o addressee e status é 'accepted'
        const [friends] = await connection.execute(`
            SELECT 
                u.id,
                u.username,
                u.profile_image as avatar,
                u.bio,
                f.created_at as friend_since
            FROM friendships f
            JOIN users u ON (
                CASE 
                    WHEN f.requester_id = ? THEN u.id = f.addressee_id
                    WHEN f.addressee_id = ? THEN u.id = f.requester_id
                END
            )
            WHERE (f.requester_id = ? OR f.addressee_id = ?)
                AND f.status = 'accepted'
            ORDER BY u.username
        `, [req.user.id, req.user.id, req.user.id, req.user.id]);

        // Adiciona status de cada amigo
        friends.forEach(friend => {
            friend.status = getUserStatus(friend.id);
        });
        
        // Ordena por status (online -> ausente -> offline)
        friends.sort((a, b) => {
            const statusOrder = { online: 0, ausente: 1, offline: 2 };
            return statusOrder[a.status] - statusOrder[b.status];
        });

        connection.release();
        res.json({ friends });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar amigos" });
    }
});

// GET /friends/requests - Listar pedidos de amizade recebidos
FriendsRouter.get('/requests', protect(0), async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [requests] = await connection.execute(`
            SELECT 
                f.id as friendship_id,
                u.id,
                u.username,
                u.profile_image as avatar,
                u.bio,
                f.created_at
            FROM friendships f
            JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = ? AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        connection.release();
        res.json({ requests });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar pedidos" });
    }
});

// GET /friends/sent - Listar pedidos de amizade enviados
FriendsRouter.get('/sent', protect(0), async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [sent] = await connection.execute(`
            SELECT 
                f.id as friendship_id,
                u.id,
                u.username,
                u.profile_image as avatar,
                u.bio,
                f.status,
                f.created_at
            FROM friendships f
            JOIN users u ON u.id = f.addressee_id
            WHERE f.requester_id = ? AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `, [req.user.id]);

        connection.release();
        res.json({ sent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar pedidos enviados" });
    }
});

// GET /friends/check/:userId - Verificar status de amizade com um usuário
FriendsRouter.get('/check/:userId', protect(0), async (req, res) => {
    const targetUserId = parseInt(req.params.userId);

    if (targetUserId === req.user.id) {
        return res.json({ status: 'self' });
    }

    try {
        const connection = await pool.getConnection();
        
        const [result] = await connection.execute(`
            SELECT status, requester_id, addressee_id
            FROM friendships
            WHERE (requester_id = ? AND addressee_id = ?)
               OR (requester_id = ? AND addressee_id = ?)
        `, [req.user.id, targetUserId, targetUserId, req.user.id]);

        connection.release();

        if (result.length === 0) {
            return res.json({ status: 'none' });
        }

        const friendship = result[0];
        if (friendship.status === 'accepted') {
            return res.json({ status: 'friends' });
        }

        if (friendship.requester_id === req.user.id) {
            return res.json({ status: 'pending_sent' });
        } else {
            return res.json({ status: 'pending_received' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao verificar amizade" });
    }
});

// POST /friends/request - Enviar pedido de amizade
FriendsRouter.post('/request', protect(0), async (req, res) => {
    const { addressee_id } = req.body;

    if (!addressee_id) {
        return res.status(400).json({ message: "ID do destinatário é obrigatório" });
    }

    if (addressee_id === req.user.id) {
        return res.status(400).json({ message: "Você não pode adicionar a si mesmo como amigo" });
    }

    try {
        const connection = await pool.getConnection();

        // Verifica se o usuário de destino existe
        const [targetUser] = await connection.execute(
            "SELECT id FROM users WHERE id = ?",
            [addressee_id]
        );

        if (targetUser.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Verifica se já existe um pedido ou amizade
        const [existing] = await connection.execute(`
            SELECT id, status, requester_id
            FROM friendships
            WHERE (requester_id = ? AND addressee_id = ?)
               OR (requester_id = ? AND addressee_id = ?)
        `, [req.user.id, addressee_id, addressee_id, req.user.id]);

        if (existing.length > 0) {
            connection.release();
            const friendship = existing[0];
            
            if (friendship.status === 'accepted') {
                return res.status(409).json({ message: "Vocês já são amigos" });
            }
            
            if (friendship.requester_id === req.user.id) {
                return res.status(409).json({ message: "Pedido já foi enviado" });
            } else {
                return res.status(409).json({ message: "Este usuário já enviou um pedido para você" });
            }
        }

        // Cria o pedido de amizade
        await connection.execute(
            "INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')",
            [req.user.id, addressee_id]
        );

        // Busca username do solicitante
        const [requester] = await connection.execute(
            "SELECT username FROM users WHERE id = ?",
            [req.user.id]
        );

        // Cria notificação persistente
        await createNotification({
            userId: addressee_id,
            type: 'FRIEND_REQUEST',
            title: 'Novo pedido de amizade',
            body: `${requester[0].username} enviou um pedido de amizade`,
            link: '/amigos',
            data: { requesterId: req.user.id }
        });

        // Notifica o destinatário em tempo real via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${addressee_id}`).emit('newFriendRequest');
            io.to(`user_${addressee_id}`).emit('newNotification', { type: 'friend' });
        }

        connection.release();
        res.status(201).json({ message: "Pedido de amizade enviado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao enviar pedido" });
    }
});

// PUT /friends/accept/:friendshipId - Aceitar pedido de amizade
FriendsRouter.put('/accept/:friendshipId', protect(0), async (req, res) => {
    const friendshipId = parseInt(req.params.friendshipId);

    try {
        const connection = await pool.getConnection();

        // Verifica se o pedido existe e se o usuário é o destinatário
        const [friendship] = await connection.execute(
            "SELECT id, addressee_id, status FROM friendships WHERE id = ?",
            [friendshipId]
        );

        if (friendship.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Pedido não encontrado" });
        }

        if (friendship[0].addressee_id !== req.user.id) {
            connection.release();
            return res.status(403).json({ message: "Você não pode aceitar este pedido" });
        }

        if (friendship[0].status !== 'pending') {
            connection.release();
            return res.status(400).json({ message: "Este pedido já foi processado" });
        }

        // Atualiza o status para 'accepted'
        await connection.execute(
            "UPDATE friendships SET status = 'accepted' WHERE id = ?",
            [friendshipId]
        );

        // Busca o ID do solicitante para notificar
        const [friendshipData] = await connection.execute(
            "SELECT requester_id, addressee_id FROM friendships WHERE id = ?",
            [friendshipId]
        );

        // Busca username de quem aceitou
        const [accepter] = await connection.execute(
            "SELECT username FROM users WHERE id = ?",
            [req.user.id]
        );

        connection.release();

        if (friendshipData.length > 0) {
            const requesterId = friendshipData[0].requester_id;
            
            // Cria notificação persistente
            await createNotification({
                userId: requesterId,
                type: 'FRIEND_ACCEPTED',
                title: 'Pedido aceito!',
                body: `${accepter[0].username} aceitou seu pedido de amizade`,
                link: '/amigos',
                data: { friendId: req.user.id }
            });

            // Notifica ambos usuários via Socket.IO
            const io = req.app.get('io');
            if (io) {
                // Notifica o solicitante que o pedido foi aceito
                io.to(`user_${requesterId}`).emit('friendRequestAccepted');
                io.to(`user_${requesterId}`).emit('newNotification', { type: 'friend' });
                // Atualiza a contagem do destinatário
                io.to(`user_${req.user.id}`).emit('friendRequestsUpdated');
            }
        }

        res.json({ message: "Pedido de amizade aceito" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao aceitar pedido" });
    }
});

// PUT /friends/reject/:friendshipId - Rejeitar pedido de amizade
FriendsRouter.put('/reject/:friendshipId', protect(0), async (req, res) => {
    const friendshipId = parseInt(req.params.friendshipId);

    try {
        const connection = await pool.getConnection();

        // Verifica se o pedido existe e se o usuário é o destinatário
        const [friendship] = await connection.execute(
            "SELECT id, addressee_id, status FROM friendships WHERE id = ?",
            [friendshipId]
        );

        if (friendship.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Pedido não encontrado" });
        }

        if (friendship[0].addressee_id !== req.user.id) {
            connection.release();
            return res.status(403).json({ message: "Você não pode rejeitar este pedido" });
        }

        if (friendship[0].status !== 'pending') {
            connection.release();
            return res.status(400).json({ message: "Este pedido já foi processado" });
        }

        // Remove o pedido (ou poderia apenas atualizar status para 'rejected')
        await connection.execute(
            "DELETE FROM friendships WHERE id = ?",
            [friendshipId]
        );

        connection.release();

        // Notifica o destinatário que a contagem mudou
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${req.user.id}`).emit('friendRequestsUpdated');
        }

        res.json({ message: "Pedido de amizade rejeitado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao rejeitar pedido" });
    }
});

// DELETE /friends/:friendshipId - Remover amizade
FriendsRouter.delete('/:userId', protect(0), async (req, res) => {
    const targetUserId = parseInt(req.params.userId);

    try {
        const connection = await pool.getConnection();

        // Remove a amizade onde o usuário está envolvido
        const [result] = await connection.execute(`
            DELETE FROM friendships
            WHERE ((requester_id = ? AND addressee_id = ?)
               OR (requester_id = ? AND addressee_id = ?))
            AND status = 'accepted'
        `, [req.user.id, targetUserId, targetUserId, req.user.id]);

        connection.release();

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Amizade não encontrada" });
        }

        res.json({ message: "Amizade removida" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao remover amizade" });
    }
});

// DELETE /friends/cancel/:friendshipId - Cancelar pedido enviado
FriendsRouter.delete('/cancel/:friendshipId', protect(0), async (req, res) => {
    const friendshipId = parseInt(req.params.friendshipId);

    try {
        const connection = await pool.getConnection();

        // Verifica se o pedido existe e se o usuário é o remetente
        const [friendship] = await connection.execute(
            "SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?",
            [friendshipId]
        );

        if (friendship.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Pedido não encontrado" });
        }

        if (friendship[0].requester_id !== req.user.id) {
            connection.release();
            return res.status(403).json({ message: "Você não pode cancelar este pedido" });
        }

        if (friendship[0].status !== 'pending') {
            connection.release();
            return res.status(400).json({ message: "Este pedido já foi processado" });
        }

        // Remove o pedido
        await connection.execute(
            "DELETE FROM friendships WHERE id = ?",
            [friendshipId]
        );

        // Busca o ID do destinatário para notificar
        const addresseeId = friendship[0].addressee_id;

        connection.release();

        // Notifica o destinatário que a contagem mudou
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${addresseeId}`).emit('friendRequestsUpdated');
        }

        res.json({ message: "Pedido cancelado" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao cancelar pedido" });
    }
});

module.exports = FriendsRouter;
