const express = require("express");
const AdminUsersRouter = express.Router();
const { User } = require("../../models");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

const { deleteFromFileServer } = require("../../utils/fileServer");

// ==================== Endpoints Administrativos de Usuários ====================

// GET /admin/users - Listar todos usuários (admin)
// Suporta ?search= para busca parcial
AdminUsersRouter.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let whereClause = {};

        if (search) {
            let term = search.trim().toLowerCase();
            if (!term.startsWith('@')) term = '@' + term;
            whereClause = {
                username: { [Op.like]: `%${term.substring(1)}%` }
            };
        }

        const users = await User.findAll({
            where: whereClause,
            attributes: ['publicid', 'username', 'roleId', 'profileimage', 'bio', 'createdat', 'lastaccess'],
            limit: 20
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar usuários" });
    }
});

// GET /admin/users/:publicid - Obter um único usuário (admin)
AdminUsersRouter.get('/:publicid', async (req, res) => {
    try {
        const user = await User.findOne({
            where: { publicid: req.params.publicid },
            attributes: ['publicid', 'username', 'roleId', 'profileimage', 'bio', 'createdat', 'lastaccess']
        });
        if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar usuário" });
    }
});

// PUT /admin/users/:publicid - Atualizar qualquer usuário (admin)
AdminUsersRouter.put('/:publicid', async (req, res) => {
    const publicid = req.params.publicid;
    const { username, roleId, bio } = req.body;

    if (!username) return res.status(400).json({ message: "Username é obrigatório" });

    try {
        // Busca o usuário alvo
        const targetUser = await User.findOne({ where: { publicid } });

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const userId = targetUser.id;

        // Impede que o usuário edite a si mesmo (exceto Dono)
        // No novo sistema: 1 = dono, 5 = admin
        if (req.user.id == userId && req.user.roleId > 1) {
            return res.status(403).json({ message: "Você não pode editar seu próprio usuário administrativamente (use a página de perfil)" });
        }

        // Normaliza o username
        let nomeUser = username.trim();
        if (!nomeUser.startsWith('@')) nomeUser = '@' + nomeUser;
        if (nomeUser.length > 16) nomeUser = nomeUser.slice(0, 16);
        nomeUser = nomeUser.toLowerCase();

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

// PUT /admin/users/:publicid/reset-password - Resetar senha de qualquer usuário (admin)
AdminUsersRouter.put('/:publicid/reset-password', async (req, res) => {
    const publicid = req.params.publicid;
    let { newPassword } = req.body || {};

    // Se não for enviada senha, define o padrão 12345
    if (!newPassword) {
        newPassword = "12345";
    }

    if (newPassword.length < 5) {
        return res.status(400).json({ message: "Nova senha deve ter no mínimo 5 caracteres" });
    }

    try {
        const targetUser = await User.findOne({ where: { publicid } });

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const userId = targetUser.id;

        // Impede que o usuário resete sua própria senha por aqui (exceto Dono)
        if (req.user.id == userId && req.user.roleId > 1) {
            return res.status(403).json({ message: "Use a rota de perfil para alterar sua própria senha" });
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

// DELETE /admin/users/:publicid - Deletar qualquer usuário (admin)
AdminUsersRouter.delete('/:publicid', async (req, res) => {
    const publicid = req.params.publicid;

    try {
        const targetUser = await User.findOne({ where: { publicid } });

        if (!targetUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const userId = targetUser.id;

        // Impede que o usuário delete a si mesmo
        if (req.user.id == userId) {
            return res.status(403).json({ message: "Você não pode deletar sua própria conta" });
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

module.exports = AdminUsersRouter;
