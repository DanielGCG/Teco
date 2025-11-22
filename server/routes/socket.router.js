const pool = require('../config/bd');

// ==================== Socket.IO Event Handlers ====================

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('[Socket.IO] Cliente conectado:', socket.id);

        // ==================== Autenticação ====================
        async function authenticateSocket(socket) {
            const cookies = socket.handshake.headers.cookie;
            if (!cookies) return null;

            const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('session='));
            if (!sessionCookie) return null;

            const cookieValue = sessionCookie.split('=')[1];
            const connection = await pool.getConnection();

            try {
                const [sessions] = await connection.execute(
                    `SELECT user_id FROM user_sessions WHERE cookie_value = ? AND expires_at > NOW()`,
                    [cookieValue]
                );

                if (sessions.length === 0) return null;
                return { userId: sessions[0].user_id, connection };
            } catch (err) {
                connection.release();
                throw err;
            }
        }

        // ==================== Join Chat ====================
        socket.on('joinChat', async (chatId) => {
            try {
                console.log('[Socket] Tentando entrar no chat:', chatId);
                socket.join(`chat_${chatId}`);
                socket.emit('joinedChat', { chatId, success: true });
                console.log('[Socket] Cliente', socket.id, 'entrou no chat', chatId);
            } catch (err) {
                console.error('[Socket] Erro ao entrar no chat:', err);
                socket.emit('error', { message: 'Erro ao entrar no chat' });
            }
        });

        // ==================== Send Message ====================
        socket.on('sendMessage', async ({ chatId, mensagem }) => {
            try {
                console.log('[Socket] Mensagem recebida:', chatId, mensagem);
                
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId, connection } = auth;

                // Insere mensagem no banco
                const [result] = await connection.execute(
                    `INSERT INTO chat_messages (chat_id, user_id, mensagem) VALUES (?, ?, ?)`,
                    [chatId, userId, mensagem]
                );

                // Busca mensagem completa
                const [msgs] = await connection.execute(
                    `SELECT cm.id, cm.mensagem, u.username, cm.user_id, cm.created_at
                     FROM chat_messages cm 
                     JOIN users u ON cm.user_id = u.id 
                     WHERE cm.id = ?`,
                    [result.insertId]
                );

                connection.release();

                // Emite para todos no chat
                io.to(`chat_${chatId}`).emit('newMessage', {
                    chatId,
                    message: {
                        id: msgs[0].id,
                        text: msgs[0].mensagem,
                        username: msgs[0].username,
                        user_id: msgs[0].user_id,
                        created_at: msgs[0].created_at
                    }
                });

                console.log('[Socket] Mensagem enviada para chat', chatId);
            } catch (err) {
                console.error('[Socket] Erro ao enviar mensagem:', err);
                socket.emit('error', { message: 'Erro ao enviar mensagem' });
            }
        });

        // ==================== Mark As Read ====================
        socket.on('markAsRead', async ({ chatId }) => {
            try {
                console.log('[Socket] Marcando mensagens como lidas:', chatId);
                
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId, connection } = auth;

                // Busca última mensagem de outros usuários no chat
                const [lastMsg] = await connection.execute(
                    `SELECT id FROM chat_messages 
                     WHERE chat_id = ? AND user_id != ? 
                     ORDER BY created_at DESC LIMIT 1`,
                    [chatId, userId]
                );

                if (lastMsg.length > 0) {
                    const lastMessageId = lastMsg[0].id;
                    
                    // Marca como lida
                    await connection.execute(
                        `INSERT INTO chat_reads (chat_id, user_id, last_read_message_id)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE last_read_message_id = GREATEST(last_read_message_id, ?)`,
                        [chatId, userId, lastMessageId, lastMessageId]
                    );

                    // Notifica todos no chat sobre a atualização de leitura
                    io.to(`chat_${chatId}`).emit('messageRead', {
                        chatId,
                        userId,
                        lastReadMessageId: lastMessageId
                    });

                    console.log('[Socket] Mensagens marcadas como lidas para usuário', userId, 'até mensagem', lastMessageId);
                }

                connection.release();
            } catch (err) {
                console.error('[Socket] Erro ao marcar mensagens como lidas:', err);
                socket.emit('error', { message: 'Erro ao marcar mensagens' });
            }
        });

        // ==================== Disconnect ====================
        socket.on('disconnect', () => {
            console.log('[Socket.IO] Cliente desconectado:', socket.id);
        });
    });
};
