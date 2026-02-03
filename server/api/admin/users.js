const express = require("express");
const AdminUsersRouter = express.Router();
const { User } = require("../../models");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

const { deleteFromFileServer } = require("../../utils/fileServer");

// ==================== Endpoints Administrativos de Usuários ====================

// GET /admin/users - Listar todos usuários (admin)
AdminUsersRouter.get('/', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'roleId', 'profileimage', 'bio', 'createdat', 'lastaccess']
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
    const { username, roleId, bio } = req.body;

    if (!username) return res.status(400).json({ message: "Username é obrigatório" });

    // Impede que o usuário edite a si mesmo (exceto Dono)
    // No novo sistema: 1 = dono, 5 = admin
    if (req.user.id == userId && req.user.roleId > 1) {
        return res.status(403).json({ message: "Você não pode editar seu próprio usuário administrativamente (use a página de perfil)" });
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

        // Admin (5) só pode editar usuários de nível inferior
        if (req.user.roleId >= 5 && targetUser.roleId <= 5 && req.user.id != targetUser.id) {
            if (req.user.roleId !== 1) {
                return res.status(403).json({ message: "Você não tem permissão para editar este usuário (nível superior ou igual)" });
            }
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
            roleId: roleId !== undefined ? roleId : targetUser.roleId,
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
    let { newPassword } = req.body || {};

    // Se não for enviada senha, define o padrão 12345
    if (!newPassword) {
        newPassword = "12345";
    }

    if (newPassword.length < 5) {
        return res.status(400).json({ message: "Nova senha deve ter no mínimo 5 caracteres" });
    }

    // Impede que o usuário resete sua própria senha por aqui (exceto Dono)
    if (req.user.id == userId && req.user.roleId > 1) {
        return res.status(403).json({ message: "Use a rota de perfil para alterar sua própria senha" });
    }

    try {
        const targetUser = await User.findByPk(userId);

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        // Admin (>=5) só pode resetar senha de níveis inferiores
        if (req.user.roleId >= 5 && targetUser.roleId <= 5 && req.user.id != targetUser.id) {
             return res.status(403).json({ message: "Você não pode resetar senha de administradores ou donos" });
        }

        // Atualiza a senha
        const hash = await bcrypt.hash(newPassword, 10);
        await targetUser.update({ passwordhash: hash });

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

        // Admin (>=5) só pode deletar usuários de nível inferior
        if (req.user.roleId >= 5 && targetUser.roleId <= 5) {
            return res.status(403).json({ message: "Você não pode deletar administradores ou donos" });
        }

        // Verifica se é o último dono
        if (targetUser.roleId === 1) {
            const ownerCount = await User.count({ where: { roleId: 1 } });
            if (ownerCount <= 1) {
                return res.status(403).json({ message: "Não é possível deletar o último dono do sistema" });
            }
        }


        // Deleta do servidor de arquivos antes de remover do BD
        if (targetUser.profileimage) {
            await deleteFromFileServer({ fileUrl: targetUser.profileimage });
        }
        if (targetUser.backgroundimage) {
            await deleteFromFileServer({ fileUrl: targetUser.backgroundimage });
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
            attributes: ['id', 'username', 'roleId', 'backgroundimage', 'profileimage', 'bio', 'createdat', 'lastaccess']
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
