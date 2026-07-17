const express = require("express");
const UsersRouter = express.Router();
const { User, UserSession, Role } = require("../../models");
const { authMiddleware, setUserCookie } = require("../../middlewares/authMiddleware");
const validate = require("../../middlewares/validate");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { upload } = require('../../utils/upload');
const { processImage } = require("../../utils/imageProcessor");
const { uploadToFileServer } = require('../../utils/fileServer');
const axios = require('axios'); // Mantém para outros usos
const FormData = require('form-data'); // Mantém para outros usos
const {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    updatePasswordSchema,
    validateSessionSchema,
    searchUsersSchema
} = require("../../validators/users.validator");

// Helper para proteger rotas
const protect = (minRole = 20) => authMiddleware(minRole);

UsersRouter.get('/', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['publicid', 'username', 'profileimage'],
            order: [['username', 'ASC']]
        });
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao listar usuários" });
    }
});

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
                cookie: cookie,
                expiresat: { [Op.gt]: new Date() }
            },
            include: [{
                model: User,
                attributes: ['publicid', 'username', 'roleId']
            }]
        });

        if (!session) return res.json({ valid: false });

        res.json({ 
            valid: true, 
            user: { 
                publicid: session.User.publicid, 
                username: session.User.username, 
                roleId: session.User.roleId 
            } 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ valid: false });
    }
});

UsersRouter.post('/register', validate(registerSchema), async (req, res) => {
    let { username, password, bio } = req.body;
    username = ('@' + username.trim().replace(/^@/, '')).slice(0, 16).toLowerCase();

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const existing = await User.findOne({ where: { username } });
        if (existing) {
            return res.status(409).json({ message: "Username já existe" });
        }

        await User.create({
            username,
            passwordhash: hashedPassword,
            bio: bio
        });

        res.status(201).json({ message: "Conta criada com sucesso", username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar conta" });
    }
});

UsersRouter.post('/login', validate(loginSchema), async (req, res) => {
    let { username, password } = req.body;
    username = ('@' + username.trim().replace(/^@/, '')).toLowerCase();

    try {
        const user = await User.findOne({ 
            where: { username },
            attributes: ['id', 'username', 'passwordhash', 'profileimage', 'bannerimage', 'backgroundimage', 'roleId']
        });

        if (!user || !(await bcrypt.compare(password, user.passwordhash))) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        const userId = user.id;
        const expiresAt = new Date(Date.now() + 7*24*60*60*1000); // 7 dias

        const existingSession = await UserSession.findOne({
            where: {
                userId: userId,
                expiresat: { [Op.gt]: new Date() }
            }
        });

        let cookieValue;
        if (existingSession) {
            cookieValue = existingSession.cookie;
            await existingSession.update({ expiresat: expiresAt });
        } else {
            cookieValue = crypto.randomBytes(32).toString('hex');
            await UserSession.create({
                userId: userId,
                cookie: cookieValue,
                expiresat: expiresAt
            });
        }

        res.cookie('session', cookieValue, { httpOnly: true, maxAge: 7*24*60*60*1000 });
        setUserCookie(res, user);

        res.json({ message: "Login realizado com sucesso", cookie: cookieValue, expiresAt });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao fazer login" });
    }
});

// Logout
UsersRouter.post('/logout', async (req, res) => {
    const cookieValue = req.cookies?.['session'];
    if (!cookieValue || !req.user || !req.user.id) {
        res.clearCookie('session');
        res.clearCookie('teco_user');
        return res.json({ message: "Logout realizado com sucesso" });
    }
    try {
        await UserSession.destroy({ where: { cookie: cookieValue, userId: req.user.id } });
    } catch (err) {
        console.error(err);
    }
    res.clearCookie('session');
    res.clearCookie('teco_user');
    res.json({ message: "Logout realizado com sucesso" });
});

UsersRouter.get('/me', protect(20), async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['publicid', 'username', 'roleId', 'bannerimage', 'backgroundimage', 'backgroundcolor', 'backgroundfill', 'profileimage', 'bio', 'pronouns', 'lastfmusername']
        });

        if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

        res.json(user);
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar perfil" });
    }
});

UsersRouter.put('/me', protect(20), upload.fields([{ name: 'profile_file', maxCount: 1 }, { name: 'banner_file', maxCount: 1 }, { name: 'background_file', maxCount: 1 }]), validate(updateProfileSchema), async (req, res) => {
    let { username, bannerimage, backgroundimage, backgroundcolor, backgroundfill, profileimage, bio, pronouns, lastfmusername } = req.body;
    username = ('@' + username.trim().replace(/^@/, '')).slice(0, 16).toLowerCase();
    
    if (!backgroundcolor || backgroundcolor.trim() === "") backgroundcolor = null;

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

        // Upload de foto de perfil se houver arquivo
        if (req.files && req.files['profile_file']) {
            const file = req.files['profile_file'][0];
            const user = await User.findByPk(req.user.id, { attributes: ['profileimage'] });
            const { buffer, filename, mimetype } = await processImage(file, { name: 'profile' });
            profileimage = await uploadToFileServer({
                buffer, filename, mimetype, folder: 'profiles'
            });
        }

        // Upload de banner se houver arquivo
        if (req.files && req.files['banner_file']) {
            const file = req.files['banner_file'][0];
            const user = await User.findByPk(req.user.id, { attributes: ['bannerimage'] });
            const { buffer, filename, mimetype } = await processImage(file, { name: 'banner' });
            bannerimage = await uploadToFileServer({
                buffer, filename, mimetype, folder: 'backgrounds'
            });
        }

        // Upload de imagem de fundo da pagina se houver arquivo
        if (req.files && req.files['background_file']) {
            const file = req.files['background_file'][0];
            const user = await User.findByPk(req.user.id, { attributes: ['backgroundimage'] });
            const { buffer, filename, mimetype } = await processImage(file, { name: 'background' });
            backgroundimage = await uploadToFileServer({
                buffer, filename, mimetype, folder: 'pagebackgrounds'
            });
        } else if (backgroundimage === "") {
            backgroundimage = null;
        }

        await User.update(
            { username, bannerimage, backgroundimage, backgroundcolor, backgroundfill, profileimage, bio, pronouns, lastfmusername },
            { where: { id: req.user.id } }
        );

        const updatedUser = await User.findByPk(req.user.id);
        setUserCookie(res, updatedUser);

        res.json({ message: "Perfil atualizado com sucesso", username, bannerimage, backgroundimage, backgroundcolor, backgroundfill, profileimage, bio, pronouns });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
});

// Atualizar senha do próprio usuário
UsersRouter.put('/me/password', protect(20), validate(updatePasswordSchema), async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'passwordhash']
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const valid = await bcrypt.compare(currentPassword, user.passwordhash);
        if (!valid) {
            return res.status(401).json({ message: "Senha atual está incorreta." });
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await user.update({ passwordhash: hash });

        res.json({ message: "Senha atualizada com sucesso!" });
    } catch(err) {
        console.error("Erro interno ao atualizar a senha:", err);
        return res.status(500).json({ message: "Ocorreu um erro interno. Tente novamente mais tarde." });
    }
});

UsersRouter.get('/buscar', protect(20), validate(searchUsersSchema, 'query'), async (req, res) => {
    let { q = '', page = 1, limit = 10 } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = (page - 1) * limit;

    try {
        let queryStr = q.toLowerCase();
        if (!queryStr.startsWith('@')) queryStr = '@' + queryStr;
        
        const searchTerm = `${queryStr}%`;

        const { count, rows: usuarios } = await User.findAndCountAll({
            where: {
                username: { [Op.like]: searchTerm },
                id: { [Op.ne]: req.user.id }
            },
            attributes: ['publicid', 'username', 'profileimage'],
            order: [
                [
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

        res.json({
            usuarios,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            totalItems: count
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao buscar usuários" });
    }
});

UsersRouter.get('/music-widget/:lastfmUser', protect(20), async (req, res) => {
    try {
        const lastfmUser = req.params.lastfmUser;
        const botecoUrl = process.env.BOTECOANALYTICS_URL;
        const botecoToken = process.env.BOTECOANALYTICS_WIDGET_TOKEN ? process.env.BOTECOANALYTICS_WIDGET_TOKEN.trim() : null;

        if (!botecoUrl || !botecoToken) {
            return res.status(500).json({ error: "Integração musical não configurada no servidor." });
        }

        const baseUrl = botecoUrl.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/api/widget/${encodeURIComponent(lastfmUser)}`.replace('localhost', '127.0.0.1');
        
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'TecoApp/1.0',
                'Authorization': `Bearer ${botecoToken}`
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: "Erro na API de músicas" });
        }

        const rawText = await response.text();
        if (rawText.trim().startsWith('<')) {
            return res.status(502).json({ error: "A API retornou HTML em vez de JSON." });
        }

        res.json(JSON.parse(rawText));
    } catch (err) {
        console.error("Erro interno no proxy widget:", err);
        res.status(500).json({ error: "Falha na comunicação com o Analytics." });
    }
});

UsersRouter.get('/:username', protect(20), async (req, res) => {
    try {
        let username = req.params.username;

        const user = await User.findOne({
            where: { username: username },
            attributes: ['publicid', 'username', 'bannerimage', 'backgroundimage', 'backgroundcolor', 'backgroundfill', 'profileimage', 'bio', 'pronouns', 'postcount', 'createdat', 'lastaccess', 'roleId', 'lastfmusername'],
            include: [{ model: Role, as: 'role', attributes: ['name'] }]
        });
        if (!user) return res.status(404).json({
            message: "Usuário não encontrado"
        });

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao carregar perfil do usuário" });
    }
});

module.exports = UsersRouter;
