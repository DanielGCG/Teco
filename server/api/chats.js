const express = require("express");
const ChatsRouter = express.Router();
const pool = require("../config/bd");

// ==================== Funções Auxiliares ====================

// Verifica se o usuário tem acesso ao chat público (apenas tipo 'public')
async function verifyChatAccess(connection, chatIdentifier, userId) {
    let query, param;

    if (isNaN(chatIdentifier)) { // nome do chat
        query = `SELECT id, tipo FROM chats WHERE nome = ? AND tipo = 'public'`;
        param = [chatIdentifier];
    } else { // ID
        query = `SELECT id, tipo FROM chats WHERE id = ? AND tipo = 'public'`;
        param = [chatIdentifier];
    }

    const [chat] = await connection.execute(query, param);
    if (chat.length === 0) return false;

    // Para chats públicos, qualquer usuário autenticado pode acessar
    return true;
}

// Obtém ID do usuário pelo username
async function getUserIdByUsername(connection, username) {
    const [rows] = await connection.execute(`SELECT id FROM users WHERE username = ?`, [username]);
    if (rows.length === 0) return null;
    return rows[0].id;
}

// Marca mensagens como lidas até uma determinada mensagem (apenas mensagens de outros usuários)
async function markMessagesAsRead(connection, chatId, userId, upToMessageId = null) {
    try {
        let lastMessageId = upToMessageId;
        
        // Se não foi especificado um ID, pega a última mensagem do chat que NÃO seja do próprio usuário
        if (!lastMessageId) {
            const [lastMsg] = await connection.execute(
                `SELECT id FROM chat_messages 
                 WHERE chat_id = ? AND user_id != ? 
                 ORDER BY created_at DESC LIMIT 1`,
                [chatId, userId]
            );
            if (lastMsg.length === 0) return null; // Não há mensagens de outros usuários
            lastMessageId = lastMsg[0].id;
        } else {
            // Verifica se a mensagem especificada não é do próprio usuário
            const [msgCheck] = await connection.execute(
                `SELECT user_id FROM chat_messages WHERE id = ?`,
                [lastMessageId]
            );
            if (msgCheck.length === 0 || msgCheck[0].user_id === userId) {
                return null; // Não marca próprias mensagens como lidas
            }
        }

        // Atualiza ou insere registro de leitura
        await connection.execute(
            `INSERT INTO chat_reads (chat_id, user_id, last_read_message_id)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE last_read_message_id = GREATEST(last_read_message_id, ?)`,
            [chatId, userId, lastMessageId, lastMessageId]
        );

        return lastMessageId;
    } catch (err) {
        console.error('Erro ao marcar mensagens como lidas:', err);
        return null;
    }
}

// ==================== Endpoints de Mensagens ====================

// GET /chats/:chatIdentifier/messages?page=1
ChatsRouter.get('/:chatIdentifier/messages', async (req, res) => {
    const chatIdentifier = req.params.chatIdentifier;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    console.log('[GET /messages] chatIdentifier:', chatIdentifier);
    console.log('[GET /messages] page:', page);

    try {
        const connection = await pool.getConnection();

        // Obtém ID do chat
        let chatId;
        if (isNaN(chatIdentifier)) {
            console.log('[GET /messages] Buscando chat por nome:', chatIdentifier);
            const [chatRows] = await connection.execute(
                `SELECT id FROM chats WHERE nome = ? AND tipo = 'public'`,
                [chatIdentifier]
            );
            console.log('[GET /messages] Chat encontrado:', chatRows);
            if (chatRows.length === 0) {
                connection.release();
                return res.status(404).json({ message: "Chat não encontrado" });
            }
            chatId = chatRows[0].id;
        } else {
            chatId = parseInt(chatIdentifier, 10);
        }

        // Verifica acesso
        const canAccess = await verifyChatAccess(connection, chatId, req.user.id);
        if (!canAccess) {
            connection.release();
            return res.status(403).json({ message: "Você não pode acessar este chat" });
        }

        // Busca mensagens com informações de leitura (mais recentes primeiro)
        const [messages] = await connection.execute(
            `SELECT cm.id, cm.user_id, u.username, cm.mensagem, cm.created_at,
                    CASE 
                        WHEN cm.user_id = ? THEN (
                            -- Verifica se outros participantes leram esta mensagem
                            SELECT COUNT(*) > 0
                            FROM chat_reads cr
                            WHERE cr.chat_id = ? 
                            AND cr.user_id != ? 
                            AND cr.last_read_message_id >= cm.id
                        )
                        ELSE FALSE
                    END as isReadByOthers
             FROM chat_messages cm
             JOIN users u ON cm.user_id = u.id
             WHERE cm.chat_id = ?
             ORDER BY cm.created_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            [req.user.id, chatId, req.user.id, chatId]
        );

        // Inverte para ordem cronológica (mais antigas primeiro)
        messages.reverse();

        // Marca mensagens como lidas automaticamente quando carrega a página
        if (messages.length > 0) {
            await markMessagesAsRead(connection, chatId, req.user.id);
        }

        console.log('[GET /messages] Retornando', messages.length, 'mensagens');
        connection.release();

        res.json({
            page,
            messages: messages.map(m => ({
                id: m.id,
                username: m.username,
                mensagem: m.mensagem,
                isMine: m.user_id === req.user.id,
                createdAt: m.created_at,
                seen: m.user_id === req.user.id ? Boolean(m.isReadByOthers) : true // Minhas mensagens: se outros leram; Mensagens dos outros: sempre true (já estou vendo)
            }))
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar mensagens" });
    }
});

// POST /chats/:chatIdentifier/messages
ChatsRouter.post('/:chatIdentifier/messages', async (req, res) => {
    const chatIdentifier = req.params.chatIdentifier;
    const { mensagem } = req.body;

    console.log('[POST /messages] chatIdentifier:', chatIdentifier);
    console.log('[POST /messages] mensagem:', mensagem);
    console.log('[POST /messages] req.user:', req.user);

    if (!mensagem || mensagem.trim() === '')
        return res.status(400).json({ message: "Mensagem não pode ser vazia" });

    try {
        const connection = await pool.getConnection();

        // Obtém ID do chat
        let chatId;
        if (isNaN(chatIdentifier)) {
            console.log('[POST /messages] Buscando chat por nome:', chatIdentifier);
            const [chatRows] = await connection.execute(`SELECT id FROM chats WHERE nome = ? AND tipo = 'public'`, [chatIdentifier]);
            if (chatRows.length === 0) {
                connection.release();
                console.log('[POST /messages] Chat não encontrado');
                return res.status(404).json({ message: "Chat não encontrado" });
            }
            chatId = chatRows[0].id;
            console.log('[POST /messages] Chat ID encontrado:', chatId);
        } else {
            chatId = chatIdentifier;
            console.log('[POST /messages] Chat ID direto:', chatId);
        }

        // Verifica acesso
        const canAccess = await verifyChatAccess(connection, chatId, req.user.id);
        if (!canAccess) {
            connection.release();
            return res.status(403).json({ message: "Você não pode enviar mensagens para este chat" });
        }

        // Insere mensagem
        const [result] = await connection.execute(
            `INSERT INTO chat_messages (chat_id, user_id, mensagem) VALUES (?, ?, ?)`,
            [chatId, req.user.id, mensagem]
        );

        // Busca mensagem recém-criada
        const [rows] = await connection.execute(
            `SELECT cm.id, cm.mensagem, u.username, cm.user_id, cm.created_at
             FROM chat_messages cm 
             JOIN users u ON cm.user_id = u.id 
             WHERE cm.id = ?`,
            [result.insertId]
        );

        // REMOVIDO: Não marca automaticamente como lida pelo remetente
        // O remetente só deve marcar como lida quando realmente visualizar

        connection.release();

        res.json({
            id: rows[0].id,
            mensagem: rows[0].mensagem,
            username: rows[0].username,
            isMine: true,
            createdAt: rows[0].created_at
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
});

// ==================== Endpoints de Gerenciamento de Chats Públicos ====================

// GET /chats - Lista todos os chats públicos disponíveis
ChatsRouter.get('/', async (req, res) => {
    try {
        const connection = await pool.getConnection();

        // Busca apenas chats públicos
        const [chats] = await connection.execute(
            `SELECT c.id, c.nome, c.tipo, c.created_at
             FROM chats c
             WHERE c.tipo = 'public'
             ORDER BY c.created_at DESC`
        );

        const chatList = [];

        for (const chat of chats) {
            // Conta participantes ativos
            const [participantCount] = await connection.execute(
                `SELECT COUNT(*) as count FROM chat_participants WHERE chat_id = ?`,
                [chat.id]
            );

            // Última mensagem
            const [lastMsgRows] = await connection.execute(
                `SELECT cm.mensagem, cm.created_at, cm.user_id, u.username FROM chat_messages cm
                 JOIN users u ON u.id = cm.user_id
                 WHERE cm.chat_id = ?
                 ORDER BY cm.created_at DESC LIMIT 1`,
                [chat.id]
            );

            const lastMessage = lastMsgRows[0]?.mensagem || null;
            const lastMessageAt = lastMsgRows[0]?.created_at || null;
            const lastMessageUsername = lastMsgRows[0]?.username || null;

            // Contagem não lidas para o usuário atual
            const [unreadRows] = await connection.execute(
                `SELECT COUNT(*) AS unreadCount
                FROM chat_messages cm
                WHERE cm.chat_id = ?
                AND cm.user_id != ? 
                AND cm.id > COALESCE((
                    SELECT last_read_message_id
                    FROM chat_reads
                    WHERE chat_id = ? AND user_id = ?
                ), 0)`,
                [chat.id, req.user.id, chat.id, req.user.id]
            );

            chatList.push({
                id: chat.id,
                nome: chat.nome,
                tipo: chat.tipo,
                participantCount: participantCount[0].count,
                lastMessage,
                lastMessageAt,
                lastMessageUsername,
                unreadCount: unreadRows[0].unreadCount
            });
        }

        connection.release();
        res.json(chatList);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar chats" });
    }
});

// POST /chats/:chatIdentifier/read - Marcar mensagens como lidas
ChatsRouter.post('/:chatIdentifier/read', async (req, res) => {
    const chatIdentifier = req.params.chatIdentifier;
    const { messageId } = req.body; // Opcional: ID específico até onde marcar como lido

    try {
        const connection = await pool.getConnection();

        // Obtém ID do chat
        let chatId;
        if (isNaN(chatIdentifier)) {
            const [chatRows] = await connection.execute(`SELECT id FROM chats WHERE nome = ? AND tipo = 'public'`, [chatIdentifier]);
            if (chatRows.length === 0) {
                connection.release();
                return res.status(404).json({ message: "Chat não encontrado" });
            }
            chatId = chatRows[0].id;
        } else {
            chatId = parseInt(chatIdentifier, 10);
        }

        // Verifica acesso
        const canAccess = await verifyChatAccess(connection, chatId, req.user.id);
        if (!canAccess) {
            connection.release();
            return res.status(403).json({ message: "Você não pode acessar este chat" });
        }

        // Marca mensagens como lidas
        const lastReadMessageId = await markMessagesAsRead(connection, chatId, req.user.id, messageId);

        connection.release();

        if (lastReadMessageId) {
            res.json({ 
                message: "Mensagens marcadas como lidas",
                lastReadMessageId 
            });
        } else {
            res.status(404).json({ message: "Nenhuma mensagem encontrada" });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao marcar mensagens como lidas" });
    }
});

module.exports = ChatsRouter;
