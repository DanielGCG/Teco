const pool = require('../config/bd');
const { createNotification } = require('../api/notifications');

// ==================== Socket.IO Event Handlers ====================

// Mantém Set de usuários online (userId -> Set de socketIds)
const onlineUsers = new Map();

// Rastreia última atividade de cada usuário (userId -> timestamp)
const userLastActivity = new Map();

// Rastreia última emissão de status para evitar spam (userId -> timestamp)
const lastStatusEmission = new Map();

// Rastreia timeouts de desconexão pendentes (userId -> timeoutId)
const disconnectionTimeouts = new Map();

// Função para obter status do usuário baseado em atividade
function getUserStatus(userId) {
    // Se não está no Map de usuários online, está offline
    if (!onlineUsers.has(userId) || onlineUsers.get(userId).size === 0) {
        return 'offline';
    }
    
    // Usuário está conectado, verifica última atividade
    const lastActivity = userLastActivity.get(userId);
    if (!lastActivity) return 'online'; // Se não tem registro, acabou de conectar
    
    const inactiveMinutes = (Date.now() - lastActivity) / (1000 * 60);
    
    // Mesmo com inatividade, se está conectado, não pode ser offline
    // No máximo pode ser "ausente"
    if (inactiveMinutes >= 5) return 'ausente';  // 5+ minutos = ausente
    return 'online';                              // < 5 minutos = online
}

// Função helper para verificar se usuário está online (qualquer estado)
function isUserOnline(userId) {
    return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

// Atualiza atividade do usuário
function updateUserActivity(userId) {
    userLastActivity.set(userId, Date.now());
}

// Emite mudança de status com debounce (evita múltiplas emissões rápidas)
function emitStatusChange(io, userId, status) {
    const now = Date.now();
    const lastEmission = lastStatusEmission.get(userId) || 0;
    
    // Só emite se passou mais de 10 segundos desde a última emissão
    // OU se está mudando para offline (desconexão é imediata)
    if (status === 'offline' || (now - lastEmission) > 10000) {
        io.emit('userStatusChanged', { userId, status });
        lastStatusEmission.set(userId, now);
        return true;
    }
    return false;
}

// Exporta função helper
module.exports.isUserOnline = isUserOnline;
module.exports.getUserStatus = getUserStatus;

module.exports = (io) => {
    // Timer para verificar mudanças de status por inatividade
    const statusCheckInterval = setInterval(() => {
        const now = Date.now();
        onlineUsers.forEach((sockets, userId) => {
            if (sockets.size > 0) {
                const lastActivity = userLastActivity.get(userId);
                if (lastActivity) {
                    const previousStatus = getUserStatus(userId);
                    const inactiveMinutes = (now - lastActivity) / (1000 * 60);
                    
                    let newStatus = 'online';
                    if (inactiveMinutes >= 5) {
                        newStatus = 'ausente'; // Usuário conectado mas inativo
                    }
                    
                    // Notifica se o status mudou
                    if (previousStatus !== newStatus) {
                        io.emit('userStatusChanged', { userId, status: newStatus });
                        console.log('[Socket] Status do usuário', userId, 'mudou de', previousStatus, 'para', newStatus, '(inativo há', Math.round(inactiveMinutes), 'min)');
                    }
                }
            }
        });
    }, 60000); // Verifica a cada 60 segundos

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
                // Atualiza atividade do usuário ao entrar no chat
                if (socket.userId) {
                    updateUserActivity(socket.userId);
                    const newStatus = getUserStatus(socket.userId);
                    
                    // Emite status com debounce
                    emitStatusChange(io, socket.userId, newStatus);
                }
                
                socket.join(`chat_${chatId}`);
                socket.emit('joinedChat', { chatId, success: true });
                console.log('[Socket] Cliente entrou no chat:', chatId);
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

                // Atualiza atividade do usuário
                updateUserActivity(userId);

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

                // Busca participantes do chat para notificar
                const [participants] = await connection.execute(
                    `SELECT user_id FROM chat_participants WHERE chat_id = ? AND user_id != ?`,
                    [chatId, userId]
                );

                // Busca info do chat
                const [chatInfo] = await connection.execute(
                    `SELECT tipo FROM chats WHERE id = ?`,
                    [chatId]
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

                // Se é DM, cria notificação para usuários que não estão no chat
                if (chatInfo.length > 0 && chatInfo[0].tipo === 'dm') {
                    for (const participant of participants) {
                        const otherUserId = participant.user_id;
                        
                        // Pula se for o próprio remetente
                        if (otherUserId === userId) continue;
                        
                        // Verifica se o usuário está na sala do chat (online no chat)
                        const socketsInRoom = await io.in(`chat_${chatId}`).fetchSockets();
                        const userInChat = socketsInRoom.some(s => {
                            const cookies = s.handshake.headers.cookie;
                            // Simplificação: assume que se está na sala, está vendo
                            return true; // Melhorar depois
                        });
                        
                        // Se não está no chat, cria ou atualiza notificação
                        if (!userInChat || socketsInRoom.length <= 1) {
                            const conn = await pool.getConnection();
                            
                            // Verifica se já existe notificação não lida deste chat
                            const [existingNotif] = await conn.execute(`
                                SELECT id, body FROM notifications 
                                WHERE user_id = ? 
                                AND type = 'NEW_DM' 
                                AND read_at IS NULL 
                                AND JSON_EXTRACT(data, '$.chatId') = ?
                                ORDER BY created_at DESC
                                LIMIT 1
                            `, [otherUserId, chatId]);

                            if (existingNotif.length > 0) {
                                // Atualiza a notificação existente
                                const currentBody = existingNotif[0].body;
                                const match = currentBody.match(/\((\d+) mensagens?\)/);
                                const currentCount = match ? parseInt(match[1]) : 1;
                                const newCount = currentCount + 1;
                                
                                await conn.execute(`
                                    UPDATE notifications 
                                    SET body = ?, created_at = NOW()
                                    WHERE id = ?
                                `, [
                                    `${msgs[0].username} (${newCount} mensagens)`,
                                    existingNotif[0].id
                                ]);
                            } else {
                                // Cria nova notificação
                                await conn.execute(
                                    `INSERT INTO notifications (user_id, type, title, body, link, data) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [
                                        otherUserId,
                                        'NEW_DM',
                                        `Nova mensagem de ${msgs[0].username}`,
                                        mensagem.substring(0, 100) + (mensagem.length > 100 ? '...' : ''),
                                        '/conversas',
                                        JSON.stringify({ chatId, senderId: userId })
                                    ]
                                );
                            }
                            
                            conn.release();
                            
                            // Notifica em tempo real
                            io.to(`user_${otherUserId}`).emit('newNotification', { type: 'message' });
                            
                            // Atualiza contagem de DMs não lidas para o destinatário
                            io.to(`user_${otherUserId}`).emit('newMessage');
                        }
                    }
                }

                console.log('[Socket] Mensagem enviada para chat', chatId);
            } catch (err) {
                console.error('[Socket] Erro ao enviar mensagem:', err);
                socket.emit('error', { message: 'Erro ao enviar mensagem' });
            }
        });

        // ==================== Mark As Read ====================
        socket.on('markAsRead', async ({ chatId }) => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId, connection } = auth;

                // Atualiza atividade do usuário
                updateUserActivity(userId);

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
                    
                    // Atualiza contagem de DMs não lidas para o usuário que leu
                    socket.emit('messageRead');
                }

                connection.release();
            } catch (err) {
                console.error('[Socket] Erro ao marcar mensagens como lidas:', err);
                socket.emit('error', { message: 'Erro ao marcar mensagens' });
            }
        });

        // ==================== Friend Requests Count ====================
        socket.on('getFriendRequestsCount', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) {
                    socket.emit('error', { message: 'Não autenticado' });
                    return;
                }

                const { userId, connection } = auth;

                // Busca contagem de pedidos de amizade pendentes
                const [result] = await connection.execute(
                    `SELECT COUNT(*) as count
                     FROM friendships
                     WHERE addressee_id = ? AND status = 'pending'`,
                    [userId]
                );

                connection.release();

                socket.emit('friendRequestsCount', { count: result[0].count });
                console.log('[Socket] Contagem de pedidos enviada:', result[0].count);
            } catch (err) {
                console.error('[Socket] Erro ao buscar pedidos:', err);
                socket.emit('error', { message: 'Erro ao buscar pedidos' });
            }
        });

        // ==================== Join User Room ====================
        socket.on('joinUserRoom', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId, connection } = auth;
                
                // Atualiza last_access no banco
                await connection.execute(
                    `UPDATE users SET last_access = NOW() WHERE id = ?`,
                    [userId]
                );
                
                connection.release();

                socket.join(`user_${userId}`);
                
                // Verifica se o usuário já estava online (reconexão vs nova conexão)
                const wasOnline = onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
                
                // Se estava com desconexão pendente, cancela (reconexão rápida)
                if (disconnectionTimeouts.has(userId)) {
                    clearTimeout(disconnectionTimeouts.get(userId));
                    disconnectionTimeouts.delete(userId);
                    console.log('[Socket] Desconexão pendente cancelada para usuário', userId);
                }
                
                // Adiciona ao Set de usuários online
                if (!onlineUsers.has(userId)) {
                    onlineUsers.set(userId, new Set());
                }
                onlineUsers.get(userId).add(socket.id);
                
                // Registra atividade inicial
                updateUserActivity(userId);
                
                // Associa userId ao socket para usar no disconnect
                socket.userId = userId;
                
                console.log('[Socket] Usuário', userId, wasOnline ? 'reconectou' : 'conectou', '| Online:', onlineUsers.size);
                
                // Só notifica se é uma NOVA conexão (não estava online antes)
                if (!wasOnline) {
                    io.emit('userStatusChanged', { userId, status: 'online' });
                    lastStatusEmission.set(userId, Date.now());
                }
            } catch (err) {
                console.error('[Socket] Erro ao entrar na sala:', err);
            }
        });

        // ==================== User Activity ====================
        socket.on('userActivity', () => {
            if (socket.userId) {
                const previousStatus = getUserStatus(socket.userId);
                updateUserActivity(socket.userId);
                const newStatus = getUserStatus(socket.userId);
                
                // Só emite se mudou de ausente para online (com debounce)
                if (previousStatus === 'ausente' && newStatus === 'online') {
                    if (emitStatusChange(io, socket.userId, 'online')) {
                        console.log('[Socket] Usuário', socket.userId, 'voltou a ficar online');
                    }
                }
            }
        });

        // ==================== Request User Status ====================
        socket.on('requestUserStatus', ({ userIds }) => {
            if (!userIds || !Array.isArray(userIds)) return;
            
            const statusMap = {};
            userIds.forEach(userId => {
                statusMap[userId] = getUserStatus(userId);
            });
            
            socket.emit('userStatusBatch', statusMap);
        });

        // ==================== Get Unread DMs Count ====================
        socket.on('getUnreadDMsCount', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId, connection } = auth;

                const [result] = await connection.execute(
                    `SELECT COUNT(DISTINCT c.id) as count
                     FROM chats c
                     JOIN chat_participants cp ON c.id = cp.chat_id
                     WHERE cp.user_id = ? 
                     AND c.tipo = 'dm'
                     AND EXISTS (
                        SELECT 1 
                        FROM chat_messages cm
                        WHERE cm.chat_id = c.id
                        AND cm.user_id != ?
                        AND cm.id > COALESCE((
                            SELECT last_read_message_id
                            FROM chat_reads
                            WHERE chat_id = c.id AND user_id = ?
                        ), 0)
                     )`,
                    [userId, userId, userId]
                );

                connection.release();
                socket.emit('unreadDMsCount', { count: result[0].count });
            } catch (err) {
                console.error('[Socket] Erro ao buscar DMs não lidas:', err);
            }
        });

        // ==================== Get Notifications Count ====================
        socket.on('getNotificationsCount', async () => {
            try {
                const auth = await authenticateSocket(socket);
                if (!auth) return;

                const { userId, connection } = auth;

                const [result] = await connection.execute(
                    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
                    [userId]
                );

                connection.release();

                socket.emit('notificationsCount', { count: result[0].count });
            } catch (err) {
                console.error('[Socket] Erro ao buscar notificações:', err);
            }
        });

        // ==================== Disconnect ====================
        socket.on('disconnect', async () => {
            console.log('[Socket.IO] Cliente desconectado:', socket.id);
            
            // Remove do Set de usuários online
            if (socket.userId) {
                const userId = socket.userId;
                const userSockets = onlineUsers.get(userId);
                
                if (userSockets) {
                    userSockets.delete(socket.id);
                    
                    // Se não há mais sockets deste usuário, agenda desconexão com delay
                    if (userSockets.size === 0) {
                        console.log('[Socket] Agendando desconexão do usuário', userId, 'em 5 segundos...');
                        
                        // Cria timeout para marcar como offline após 5 segundos
                        const timeoutId = setTimeout(async () => {
                            // Verifica novamente se usuário realmente não tem mais sockets
                            const stillOffline = !onlineUsers.has(userId) || onlineUsers.get(userId).size === 0;
                            
                            if (stillOffline) {
                                onlineUsers.delete(userId);
                                
                                try {
                                    const connection = await pool.getConnection();
                                    await connection.execute(
                                        `UPDATE users SET last_access = NOW() WHERE id = ?`,
                                        [userId]
                                    );
                                    connection.release();
                                    
                                    console.log('[Socket] Usuário', userId, 'ficou offline. Online:', onlineUsers.size);
                                    
                                    // Notifica que usuário ficou offline
                                    io.emit('userStatusChanged', { userId, status: 'offline' });
                                    lastStatusEmission.delete(userId);
                                    disconnectionTimeouts.delete(userId);
                                } catch (err) {
                                    console.error('[Socket] Erro ao atualizar last_access:', err);
                                }
                            } else {
                                console.log('[Socket] Usuário', userId, 'reconectou antes do timeout');
                                disconnectionTimeouts.delete(userId);
                            }
                        }, 5000); // 5 segundos de grace period
                        
                        disconnectionTimeouts.set(userId, timeoutId);
                    }
                }
            }
        });
    });
};
