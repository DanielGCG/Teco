const express = require("express");
const AdminUsersRouter = express.Router();
const { User } = require("../../models");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

// ==================== Endpoints Administrativos de Usuários ====================

// GET /admin/users - Listar todos usuários (admin)
AdminUsersRouter.get('/', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'profile_image', 'created_at', 'last_access']
        });
        res.json(users);
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
        // Busca o usuário alvo
        const targetUser = await User.findByPk(userId);

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Admin (1) só pode editar usuários comuns (0)
        if (req.user.role === 1 && targetUser.role >= 1) {
            return res.status(403).json({ message: "Você não pode editar administradores ou donos" });
        }

        // Verifica se username já está em uso por outro usuário
        const existing = await User.findOne({
            where: {
                username: nomeUser,
                id: { [Op.ne]: userId }
            }
        });

        if (existing) {
            return res.status(409).json({ message: "Username já está em uso" });
        }

        // Atualiza o usuário
        await targetUser.update({
            username: nomeUser,
            role: role !== undefined ? role : targetUser.role,
            bio: bio !== undefined ? bio : targetUser.bio
        });

        res.json({ message: "Usuário atualizado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
});

// PUT /admin/users/:id/reset-password - Resetar senha de qualquer usuário (admin)
AdminUsersRouter.put('/:id/reset-password', async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "Nova senha deve ter no mínimo 6 caracteres" });
    }

    // Impede que o usuário resete sua própria senha por aqui (exceto Dono)
    if (req.user.id == userId && req.user.role < 2) {
        return res.status(403).json({ message: "Use a rota de perfil para alterar sua própria senha" });
    }

    try {
        const targetUser = await User.findByPk(userId);

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Admin (1) só pode resetar senha de usuários comuns (0)
        if (req.user.role === 1 && targetUser.role >= 1) {
            return res.status(403).json({ message: "Você não pode resetar senha de administradores ou donos" });
        }

        // Atualiza a senha
        const hash = await bcrypt.hash(newPassword, 10);
        await targetUser.update({ password_hash: hash });

        res.json({ message: "Senha resetada com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao resetar senha" });
    }
});

// DELETE /admin/users/:id - Deletar qualquer usuário (admin)
AdminUsersRouter.delete('/:id', async (req, res) => {
    const userId = req.params.id;

    // Impede que o usuário delete a si mesmo
    if (req.user.id == userId) {
        return res.status(403).json({ message: "Você não pode deletar sua própria conta" });
    }

    try {
        const targetUser = await User.findByPk(userId);

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Admin (1) só pode deletar usuários comuns (0)
        if (req.user.role === 1 && targetUser.role >= 1) {
            return res.status(403).json({ message: "Você não pode deletar administradores ou donos" });
        }

        // Verifica se é o último dono
        if (targetUser.role === 2) {
            const ownerCount = await User.count({ where: { role: 2 } });
            if (ownerCount <= 1) {
                return res.status(403).json({ message: "Não é possível deletar o último dono do sistema" });
            }
        }

        await targetUser.destroy();

        res.json({ message: "Usuário deletado com sucesso" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao deletar usuário" });
    }
});

// GET /admin/users/:id - Buscar usuário específico (admin)
AdminUsersRouter.get('/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'role', 'background_image', 'profile_image', 'bio', 'created_at', 'last_access']
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar usuário" });
    }
});

module.exports = AdminUsersRouter;
