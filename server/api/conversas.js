const express = require("express");
const ConversasRouter = express.Router();
const pool = require("../config/bd");

// ==================== Endpoints de Conversas (DMs - 2 pessoas) ====================

// GET /conversas - Lista todas as conversas (DMs) do usuário
ConversasRouter.get('/', async (req, res) => {
    try {
        const connection = await pool.getConnection();

        // Busca apenas chats tipo 'dm' do usuário
        const [dms] = await connection.execute(
            `SELECT c.id, c.nome, c.tipo
             FROM chats c
             JOIN chat_participants cp ON c.id = cp.chat_id
             WHERE cp.user_id = ? AND c.tipo = 'dm'`,
            [req.user.id]
        );

        const dmList = [];

        for (const dm of dms) {
            // Participantes da conversa (deve ser exatamente 2)
            const [participants] = await connection.execute(
                `SELECT u.id, u.username, u.profile_image
                 FROM chat_participants cp
                 JOIN users u ON cp.user_id = u.id
                 WHERE cp.chat_id = ?`,
                [dm.id]
            );

            // O outro usuário (não o atual)
            const otherUser = participants.find(p => p.id !== req.user.id);

            // Última mensagem
            const [lastMsgRows] = await connection.execute(
                `SELECT mensagem, created_at, user_id FROM chat_messages
                 WHERE chat_id = ?
                 ORDER BY created_at DESC LIMIT 1`,
                [dm.id]
            );

            const lastMessage = lastMsgRows[0]?.mensagem || null;
            const lastMessageAt = lastMsgRows[0]?.created_at || null;
            const lastMessageIsMine = lastMsgRows[0]?.user_id === req.user.id;

            // Contagem não lidas (apenas mensagens do outro usuário)
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
                [dm.id, req.user.id, dm.id, req.user.id]
            );

            dmList.push({
                id: dm.id,
                nome: dm.nome,
                otherUser: {
                    id: otherUser?.id,
                    username: otherUser?.username,
                    avatar: otherUser?.profile_image
                },
                lastMessage,
                lastMessageAt,
                lastMessageIsMine,
                unreadCount: unreadRows[0].unreadCount
            });
        }

        connection.release();
        res.json(dmList);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar conversas" });
    }
});

// GET /conversas/users - Lista usuários disponíveis para iniciar conversa
ConversasRouter.get('/users', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const userId = req.user.id;

        const [users] = await connection.execute(
            `SELECT u.id, u.username, u.profile_image
            FROM users u
            WHERE u.id != ?
            AND NOT EXISTS (
                SELECT 1
                FROM chats c
                JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = u.id
                JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
                WHERE c.tipo = 'dm'
            )`,
            [userId, userId]
        );

        connection.release();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar usuários" });
    }
});

// POST /conversas - Criar nova conversa (DM)
ConversasRouter.post('/', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "Informe o username do outro usuário" });

    try {
        const connection = await pool.getConnection();

        // ID do usuário destinatário
        const [users] = await connection.execute(
            `SELECT id FROM users WHERE username = ?`,
            [username]
        );
        if (!users.length) {
            connection.release();
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const otherUserId = users[0].id;

        // Verifica se já existe conversa entre os dois
        const [existingDMs] = await connection.execute(
            `SELECT c.id FROM chats c
             JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
             JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
             WHERE c.tipo = 'dm'`,
            [req.user.id, otherUserId]
        );

        if (existingDMs.length > 0) {
            connection.release();
            return res.status(409).json({ message: "Conversa já existe", conversaId: existingDMs[0].id });
        }

        // Cria nova conversa (DM)
        const [result] = await connection.execute(
            `INSERT INTO chats (tipo, criado_por) VALUES ('dm', ?)`,
            [req.user.id]
        );
        const conversaId = result.insertId;

        // Insere os 2 participantes
        await connection.execute(
            `INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)`,
            [conversaId, req.user.id, conversaId, otherUserId]
        );

        connection.release();
        res.status(201).json({ message: "Conversa criada", conversaId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar conversa" });
    }
});

// GET /conversas/:conversaId/messages - Buscar mensagens de uma conversa
ConversasRouter.get('/:conversaId/messages', async (req, res) => {
    const conversaId = parseInt(req.params.conversaId);
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        const connection = await pool.getConnection();

        // Verifica se é DM e se o usuário tem acesso
        const [chat] = await connection.execute(
            `SELECT id, tipo FROM chats WHERE id = ? AND tipo = 'dm'`,
            [conversaId]
        );

        if (chat.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Conversa não encontrada" });
        }

        const [participants] = await connection.execute(
            `SELECT user_id FROM chat_participants WHERE chat_id = ?`,
            [conversaId]
        );
        
        const participantIds = participants.map(p => p.user_id);
        if (!participantIds.includes(req.user.id)) {
            connection.release();
            return res.status(403).json({ message: "Você não tem acesso a esta conversa" });
        }

        // Busca mensagens (mais recentes primeiro)
        const [messages] = await connection.execute(
            `SELECT cm.id, cm.user_id, u.username, cm.mensagem, cm.created_at,
                    CASE 
                        WHEN cm.user_id = ? THEN (
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
            [req.user.id, conversaId, req.user.id, conversaId]
        );

        // Inverte para ordem cronológica (mais antigas primeiro)
        messages.reverse();

        // Marca mensagens como lidas
        if (messages.length > 0) {
            const [lastMsg] = await connection.execute(
                `SELECT id FROM chat_messages 
                 WHERE chat_id = ? AND user_id != ? 
                 ORDER BY created_at DESC LIMIT 1`,
                [conversaId, req.user.id]
            );

            if (lastMsg.length > 0) {
                await connection.execute(
                    `INSERT INTO chat_reads (chat_id, user_id, last_read_message_id)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE last_read_message_id = GREATEST(last_read_message_id, ?)`,
                    [conversaId, req.user.id, lastMsg[0].id, lastMsg[0].id]
                );
            }
        }

        connection.release();

        res.json({
            page,
            messages: messages.map(m => ({
                id: m.id,
                username: m.username,
                mensagem: m.mensagem,
                isMine: m.user_id === req.user.id,
                createdAt: m.created_at,
                seen: m.user_id === req.user.id ? Boolean(m.isReadByOthers) : true
            }))
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar mensagens" });
    }
});

// POST /conversas/:conversaId/messages - Enviar mensagem em uma conversa
ConversasRouter.post('/:conversaId/messages', async (req, res) => {
    const conversaId = parseInt(req.params.conversaId);
    const { mensagem } = req.body;

    if (!mensagem || mensagem.trim() === '')
        return res.status(400).json({ message: "Mensagem não pode ser vazia" });

    try {
        const connection = await pool.getConnection();

        // Verifica se é DM e se tem acesso
        const [chat] = await connection.execute(
            `SELECT id, tipo FROM chats WHERE id = ? AND tipo = 'dm'`,
            [conversaId]
        );

        if (chat.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Conversa não encontrada" });
        }

        const [participants] = await connection.execute(
            `SELECT user_id FROM chat_participants WHERE chat_id = ?`,
            [conversaId]
        );
        
        const participantIds = participants.map(p => p.user_id);
        if (!participantIds.includes(req.user.id)) {
            connection.release();
            return res.status(403).json({ message: "Você não pode enviar mensagens para esta conversa" });
        }

        // Insere mensagem
        const [result] = await connection.execute(
            `INSERT INTO chat_messages (chat_id, user_id, mensagem) VALUES (?, ?, ?)`,
            [conversaId, req.user.id, mensagem]
        );

        // Busca mensagem recém-criada
        const [rows] = await connection.execute(
            `SELECT cm.id, cm.mensagem, u.username, cm.user_id, cm.created_at
             FROM chat_messages cm 
             JOIN users u ON cm.user_id = u.id 
             WHERE cm.id = ?`,
            [result.insertId]
        );

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

module.exports = ConversasRouter;
