const express = require("express");
const UsersRouter = express.Router();
const { User, UserSession, Role, LegalDocument, UserConsentHistory, Galeria, GaleriaItem, GaleriaContributor } = require("../../models");
const { authMiddleware, setUserCookie } = require("../../middlewares/authMiddleware");
const validate = require("../../middlewares/validate");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { upload } = require('../../utils/upload');
const { processImage } = require("../../utils/imageProcessor");
const { uploadToFileServer } = require('../../utils/fileServer');
const { Resend } = require('resend');
// Initialize Resend only if API key is present; otherwise keep null to avoid crash
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    updatePasswordSchema,
    validateSessionSchema,
    searchUsersSchema
} = require("../../validators/users.validator");

// Helper para envio de email de verificação
async function sendVerificationEmail(user, req) {
    if (!process.env.RESEND_API_KEY) return;
    
    user.verificationToken = crypto.randomUUID();
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const link = `${req.protocol}://${req.get('host')}/api/users/verify-email?token=${user.verificationToken}`;
    try {
        await resend.emails.send({
            from: 'Teco <noreply@sitedoboteco.com.br>',
            to: user.email,
            subject: 'Confirme seu e-mail no Teco',
            html: `<p>Olá ${user.username},</p><p>Bem-vindo ao Teco! Por favor, confirme seu e-mail clicando no link abaixo:</p><p><a href="${link}">${link}</a></p><p>Válido por 24 horas.</p>`
        });
    } catch (err) { console.error("Erro envio e-mail:", err); }
}

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
    let { username, password, bio, consent, email } = req.body;
    username = ('@' + username.trim().replace(/^@/, '')).slice(0, 16).toLowerCase();

    try {
        const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']], attributes: ['id', 'version'] });
        const currentConsentVersion = latestDoc ? latestDoc.version : 0;

        if (currentConsentVersion > 0 && !consent) {
            return res.status(400).json({ message: "Você deve aceitar os Termos de Uso e a Política de Privacidade para se registrar." });
        }

        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            return res.status(409).json({ message: "E-mail já cadastrado." });
        }

        const existing = await User.findOne({ where: { username } });
        if (existing) {
            return res.status(409).json({ message: "Username já existe" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await User.create({
            username,
            passwordhash: hashedPassword,
            email,
            emailVerified: false,
            bio: bio,
            consentVersion: currentConsentVersion
        });

        if (currentConsentVersion > 0 && latestDoc) {
            await UserConsentHistory.create({ userId: newUser.id, legalDocumentId: latestDoc.id });
        }

        await sendVerificationEmail(newUser, req);
        res.status(201).json({ message: "Conta criada. Verifique seu e-mail.", username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao criar conta" });
    }
});

// GET /api/users/verify-email?token=...
UsersRouter.get('/verify-email', async (req, res) => {
    try {
        const user = await User.findOne({ where: { verificationToken: req.query.token || '' } });
        if (!user || (user.verificationExpires && user.verificationExpires < new Date())) {
            return res.send("Token inválido ou expirado. Faça login e solicite um novo envio.");
        }

        user.emailVerified = true;
        user.verificationToken = null;
        user.verificationExpires = null;
        await user.save();
        res.redirect('/');
    } catch (err) { res.status(500).send("Erro ao verificar."); }
});

// POST /api/users/resend-verification
UsersRouter.post('/resend-verification', protect(20), async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
        if (user.emailVerified || !user.email) return res.status(400).json({ message: "Inválido" });

        // Cooldown de 60 segundos baseado no tempo de expiração do token atual
        if (user.verificationExpires) {
            const timeSinceLastEmail = (24 * 60 * 60 * 1000) - (user.verificationExpires.getTime() - Date.now());
            if (timeSinceLastEmail < 60000 && timeSinceLastEmail >= 0) {
                const waitTime = Math.ceil((60000 - timeSinceLastEmail) / 1000);
                return res.status(429).json({ message: `Aguarde ${waitTime} segundos antes de reenviar.` });
            }
        }

        await sendVerificationEmail(user, req);
        res.json({ message: "E-mail reenviado." });
    } catch (err) { res.status(500).json({ message: "Erro." }); }
});

// POST /api/users/update-email (Para usuários legados)
UsersRouter.post('/update-email', protect(20), async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ message: "E-mail inválido." });

    try {
        const existing = await User.findOne({ where: { email } });
        if (existing && existing.id !== req.user.id) return res.status(409).json({ message: "E-mail em uso." });

        const user = await User.findByPk(req.user.id);
        
        // Cooldown de 60 segundos baseado no tempo de expiração do token atual
        if (user.verificationExpires) {
            const timeSinceLastEmail = (24 * 60 * 60 * 1000) - (user.verificationExpires.getTime() - Date.now());
            if (timeSinceLastEmail < 60000 && timeSinceLastEmail >= 0) {
                const waitTime = Math.ceil((60000 - timeSinceLastEmail) / 1000);
                return res.status(429).json({ message: `Aguarde ${waitTime} segundos antes de tentar novamente.` });
            }
        }

        user.email = email;
        user.emailVerified = false;
        
        await sendVerificationEmail(user, req);
        res.json({ message: "E-mail atualizado. Verifique sua caixa de entrada." });
    } catch (err) { res.status(500).json({ message: "Erro ao atualizar." }); }
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

// POST /api/users/consent - Consentimento de usuário logado
UsersRouter.post('/consent', protect(20), async (req, res) => {
    try {
        const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']] });
        if (!latestDoc) {
            return res.status(400).json({ message: "Não há termos cadastrados." });
        }

        await User.update({ consentVersion: latestDoc.version }, { where: { id: req.user.id } });
        
        await UserConsentHistory.create({
            userId: req.user.id,
            legalDocumentId: latestDoc.id
        });

        // Atualiza cookie local do frontend, não da session do DB, pois o authMiddleware vai refazer depois, ou recriar a sessão
        res.json({ message: "Consentimento atualizado com sucesso." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erro ao atualizar consentimento." });
    }
});

// DELETE /api/users/delete-account
UsersRouter.delete('/delete-account', protect(20), async (req, res) => {
    try {
        // Remover todas as sessões para deslogar
        await UserSession.destroy({ where: { userId: req.user.id } });

        // --- Exclusão em cascata de Galerias ---
        const userGalleries = await Galeria.findAll({ where: { createdbyUserId: req.user.id } });
        for (const galeria of userGalleries) {
            await GaleriaItem.destroy({ where: { galleryId: galeria.id } });
            await GaleriaContributor.destroy({ where: { galleryId: galeria.id } });
            await galeria.destroy();
        }
        await GaleriaContributor.destroy({ where: { userId: req.user.id } });
        // ----------------------------------------

        // Apagar completamente o usuário do banco de dados (o CASCADE tratará do resto)
        await User.destroy({ where: { id: req.user.id } });

        res.clearCookie('session');
        res.clearCookie('teco_user');
        res.json({ message: "Conta deletada com sucesso." });
    } catch (err) {
        console.error("Erro ao deletar conta:", err);
        res.status(500).json({ message: "Erro interno ao deletar conta." });
    }
});

UsersRouter.get('/me', protect(20), async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['publicid', 'username', 'roleId', 'bannerimage', 'backgroundimage', 'backgroundcolor', 'backgroundfill', 'profileimage', 'bio', 'pronouns', 'lastfmusername', 'postcount', 'createdat', 'email', 'emailVerified']
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
        const botecoUrl = process.env.BOTECOANALYTICS_URL ? process.env.BOTECOANALYTICS_URL.trim() : null;
        const botecoToken = process.env.BOTECOANALYTICS_WIDGET_TOKEN ? process.env.BOTECOANALYTICS_WIDGET_TOKEN.trim() : null;

        if (!botecoUrl || !botecoToken) {
            return res.status(500).json({ error: "Integração musical não configurada no servidor." });
        }

        const baseUrl = botecoUrl.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/api/widget/${encodeURIComponent(req.params.lastfmUser)}`.replace('localhost', '127.0.0.1');
        
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
