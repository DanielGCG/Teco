const express = require("express");
const UsersRouter = express.Router();
const { User, UserSession } = require("../models");
const authMiddleware = require("../middlewares/authMiddleware");
const validate = require("../middlewares/validate");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { Op } = require("sequelize");
const {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    updatePasswordSchema,
    validateSessionSchema,
    searchUsersSchema
} = require("../validators/users.validator");

// Helper para proteger rotas específicas dentro deste router
const protect = (minRole = 0) => {
    return authMiddleware(minRole);
};

// ==================== Rotas públicas ====================

// POST /users/validate-session
UsersRouter.post('/validate-session', validate(validateSessionSchema), async (req, res) => {
    let cookie = req.body?.cookie;
    if (!cookie && req.headers.cookie) {
        const match = req.headers.cookie.match(/session=([^;]+)/);
        if (match) cookie = match[1];
    }

    if (!cookie) return res.status(400).json({ valid: false });

    try {
        const session = await UserSession.findOne({
            where: {
                cookie_value: cookie,
                expires_at: { [Op.gt]: new Date() }
            },
            include: [{
                model: User,
                attributes: ['id', 'username', 'role']
            }]
        });

        if (!session) return res.json({ valid: false });

        res.json({ 
            valid: true, 
            user: { 
                id: session.User.id, 
                username: session.User.username, 
                role: session.User.role 
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ valid: false });
    }
});

// Registro público
UsersRouter.post('/register', validate(registerSchema), async (req, res) => {
    let { username, password, bio } = req.body;

    // Normaliza o username: garante @, máximo 13 caracteres e minúsculo
    username = username.trim();
    if (!username.startsWith('@')) {
        username = '@' + username;
    }
    if (username.length > 13) {
        username = username.slice(0, 13);
    }
    username = username.toLowerCase();

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const existing = await User.findOne({ where: { username } });
        if (existing) {
            return res.status(409).json({ message: "Username já existe" });
        }

        await User.create({
            username,
            password_hash: hashedPassword,
            bio: bio || ""
        });

        res.status(201).json({ message: "Conta criada com sucesso", username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar conta" });
    }
});

// Login público
UsersRouter.post('/login', validate(loginSchema), async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ 
            where: { username },
            attributes: ['id', 'password_hash']
        });

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const userId = user.id;
        const expiresAt = new Date(Date.now() + 7*24*60*60*1000); // 7 dias

        const existingSession = await UserSession.findOne({
            where: {
                user_id: userId,
                expires_at: { [Op.gt]: new Date() }
            }
        });

        let cookieValue;
        if (existingSession) {
            cookieValue = existingSession.cookie_value;
            await existingSession.update({ expires_at: expiresAt });
        } else {
            cookieValue = crypto.randomBytes(32).toString('hex');
            await UserSession.create({
                user_id: userId,
                cookie_value: cookieValue,
                expires_at: expiresAt
            });
        }

        res.cookie('session', cookieValue, { httpOnly: true, maxAge: 7*24*60*60*1000 });
        res.json({ message: "Login realizado com sucesso", cookie: cookieValue, expiresAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao fazer login" });
    }
});

// Logout
UsersRouter.post('/logout', async (req, res) => {
    const cookieValue = req.cookies?.['session'];
    // Sempre limpa o cookie e responde sucesso, mesmo se não houver usuário autenticado
    if (!cookieValue || !req.user || !req.user.id) {
        res.clearCookie('session');
        return res.json({ message: "Logout realizado com sucesso" });
    }
    try {
        await UserSession.destroy({
            where: {
                cookie_value: cookieValue,
                user_id: req.user.id
            }
        });
    } catch (err) {
        console.error(err);
    }
    res.clearCookie('session');
    res.json({ message: "Logout realizado com sucesso" });
});

// ==================== Rotas protegidas ====================

// Perfil próprio
UsersRouter.get('/me', protect(0), async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'role', 'background_image', 'profile_image', 'bio']
        });

        if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

        res.json(user);
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar perfil" });
    }
});

// Atualizar perfil próprio
UsersRouter.put('/me', protect(0), validate(updateProfileSchema), async (req, res) => {
    let { username, background_image, profile_image, bio } = req.body;

    // Força @ no início
    if (!username.startsWith('@')) {
        username = '@' + username;
    }

    // Limita para no máximo 13 caracteres
    if (username.length > 13) {
        username = username.slice(0, 13);
    }

    // Converte para caixa baixa
    username = username.toLowerCase();

    try {
        // Verifica se já existe outro usuário com esse username
        const existing = await User.findOne({
            where: {
                username,
                id: { [Op.ne]: req.user.id }
            }
        });

        if (existing) {
            return res.status(409).json({ message: "Username já está em uso" });
        }

        await User.update(
            { username, background_image, profile_image, bio },
            { where: { id: req.user.id } }
        );

        res.json({ message: "Perfil atualizado com sucesso", username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
});

// Atualizar senha do próprio usuário
UsersRouter.put('/me/password', protect(0), validate(updatePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['password_hash']
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(401).json({ message: "Senha atual incorreta" });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await user.update({ password_hash: hash });

        res.json({ message: "Senha atualizada com sucesso" });
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar senha" });
    }
});

// GET /admin/users - Listar todos usuários
UsersRouter.get('/', async (req, res) => {
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

// GET /users/buscar - Buscar usuários por nome
UsersRouter.get('/buscar', protect(0), validate(searchUsersSchema, 'query'), async (req, res) => {
    const { q = '', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const searchTerm = `%${q.toLowerCase()}%`;

        const { count, rows: usuarios } = await User.findAndCountAll({
            where: {
                username: { [Op.like]: searchTerm },
                id: { [Op.ne]: req.user.id }
            },
            attributes: ['id', 'username', 'profile_image'],
            order: [
                [
                    // Ordena: exato, começa com, depois resto
                    User.sequelize.literal(`
                        CASE 
                            WHEN LOWER(username) = ${User.sequelize.escape(q.toLowerCase())} THEN 0
                            WHEN LOWER(username) LIKE ${User.sequelize.escape(`${q.toLowerCase()}%`)} THEN 1
                            ELSE 2
                        END
                    `), 
                    'ASC'
                ],
                ['username', 'ASC']
            ],
            limit,
            offset
        });

        const totalPages = Math.ceil(count / limit);

        res.json({
            usuarios,
            currentPage: page,
            totalPages,
            totalItems: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar usuários" });
    }
});

module.exports = UsersRouter;
