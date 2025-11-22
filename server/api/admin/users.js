const express = require("express");
const AdminUsersRouter = express.Router();
const pool = require("../../config/bd");
const bcrypt = require("bcrypt");

// ==================== Endpoints Administrativos de Usuários ====================

// GET /admin/users - Listar todos usuários (admin)
AdminUsersRouter.get('/', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            "SELECT id, username, role, profile_image, created_at, last_access FROM users"
        );
        connection.release();
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar usuários" });
    }
});

// PUT /admin/users/:id - Atualizar qualquer usuário (admin)
AdminUsersRouter.put('/:id', async (req, res) => {
    const userId = req.params.id;
    const { username, role, bio } = req.body;

    if (!username) return res.status(400).json({ message: "Username é obrigatório" });

    // Impede que o usuário edite a si mesmo (exceto Dono)
    if (req.user.id == userId && req.user.role < 2) {
        return res.status(403).json({ message: "Você não pode editar seu próprio usuário" });
    }

    // Normaliza o username
    let nomeUser = username.trim();
    if (!nomeUser.startsWith('@')) nomeUser = '@' + nomeUser;
    if (nomeUser.length > 13) nomeUser = nomeUser.slice(0, 13);
    nomeUser = nomeUser.toLowerCase();

    try {
        const connection = await pool.getConnection();

        // Busca o usuário alvo
        const [targetUser] = await connection.execute(
            "SELECT role FROM users WHERE id = ?",
            [userId]
        );

        if (targetUser.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Impede editar usuário de nível igual ou superior (exceto se for o próprio Dono)
        if (targetUser[0].role >= req.user.role && req.user.id != userId) {
            connection.release();
            return res.status(403).json({ message: "Você não pode editar usuários de nível igual ou superior" });
        }

        // Impede definir role igual ou superior ao próprio (exceto Dono editando a si mesmo)
        if (role >= req.user.role && req.user.id != userId) {
            connection.release();
            return res.status(403).json({ message: "Você não pode atribuir um cargo igual ou superior ao seu" });
        }

        // Verifica se já existe outro usuário com esse username
        const [existing] = await connection.execute(
            "SELECT id FROM users WHERE username = ? AND id != ?",
            [nomeUser, userId]
        );

        if (existing.length > 0) {
            connection.release();
            return res.status(409).json({ message: "Username já está em uso" });
        }

        await connection.execute(
            "UPDATE users SET username = ?, role = ?, bio = ? WHERE id = ?",
            [nomeUser, role, bio, userId]
        );

        connection.release();
        res.json({ message: "Usuário atualizado com sucesso", username: nomeUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
});

// POST /admin/users - Criar usuário (admin)
AdminUsersRouter.post('/', async (req, res) => {
    const { username, password, role = 0 } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username e senha obrigatórios" });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await pool.getConnection();
        await connection.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
            [username, hashedPassword, role]);
        connection.release();
        res.status(201).json({ message: "Usuário criado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar usuário" });
    }
});

// DELETE /admin/users/:id - Deletar usuário (admin)
AdminUsersRouter.delete('/:id', async (req, res) => {
    const userId = req.params.id;

    // Impede que o usuário delete a si mesmo (incluindo Dono por segurança)
    if (req.user.id == userId) {
        return res.status(403).json({ message: "Você não pode deletar seu próprio usuário" });
    }

    try {
        const connection = await pool.getConnection();

        // Busca o usuário alvo
        const [targetUser] = await connection.execute(
            "SELECT role FROM users WHERE id = ?",
            [userId]
        );

        if (targetUser.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Impede deletar usuário de nível igual ou superior
        if (targetUser[0].role >= req.user.role) {
            connection.release();
            return res.status(403).json({ message: "Você não pode deletar usuários de nível igual ou superior" });
        }

        await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
        connection.release();
        res.json({ message: "Usuário deletado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar usuário" });
    }
});

// PUT /admin/users/:id/reset-password - Reset de senha para 12345 (admin)
AdminUsersRouter.put('/:id/reset-password', async (req, res) => {
    const userId = req.params.id;

    try {
        const connection = await pool.getConnection();

        // Busca o usuário alvo
        const [targetUser] = await connection.execute(
            "SELECT role FROM users WHERE id = ?",
            [userId]
        );

        if (targetUser.length === 0) {
            connection.release();
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Impede resetar senha de usuário de nível igual ou superior (exceto Dono)
        if (targetUser[0].role >= req.user.role && req.user.role < 2) {
            connection.release();
            return res.status(403).json({ message: "Você não pode resetar senha de usuários de nível igual ou superior" });
        }

        const senhaPadrao = "12345";
        const hash = await bcrypt.hash(senhaPadrao, 10);

        await connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [hash, userId]
        );
        connection.release();

        res.json({ message: "Senha resetada para 12345" });
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao resetar senha" });
    }
});

module.exports = AdminUsersRouter;