const { User, UserSession, LegalDocument } = require("../models");
const { Op } = require("sequelize");

const PUBLIC_ROUTES = ['/register', '/login', '/logout', '/validate-session', '/termos', '/privacidade']; // rotas públicas

const setUserCookie = (res, user) => {
    const userData = user.get ? user.get({ plain: true }) : user;
    const userInfo = JSON.stringify({
        publicid: userData.publicid,
        username: userData.username,
        profileimage: userData.profileimage,
        bannerimage: userData.bannerimage,
        backgroundimage: userData.backgroundimage,
        backgroundcolor: userData.backgroundcolor,
        backgroundfill: userData.backgroundfill,
        roleId: userData.roleId
    });
    res.cookie('teco_user', Buffer.from(userInfo).toString('base64'), {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: false, // Permitir acesso via JS
        secure: false, // Desativado para facilitar desenvolvimento local
        sameSite: 'lax',
        path: '/'
    });
};

// authMiddleware(minRole, refresh = true)
// 1=dono, 5=admin, 10=moderador, 11=boteco, 20=usuário
const authMiddleware = (minRole = 20, refresh = true) => {
    return async (req, res, next) => {
        let isPublic = false;
        try {
            isPublic = PUBLIC_ROUTES.includes(req.path);

            // Se a requisição já passou por um authMiddleware anterior
            if (req.user) {
                if (!isPublic && req.user.roleId > minRole) {
                    if (res && res.status) {
                        const message = "Acesso negado: nível de privilégio insuficiente.";
                        if (req.accepts('html')) {
                            return res.status(403).send(`
                                <h1>Acesso Negado</h1>
                                    <p>${message}</p>
                                    <button onclick="window.history.back()" style="padding: 10px 20px; cursor: pointer; background: #ddd; border: 1px solid #aaa; border-radius: 4px;">Voltar</button>
                            `);
                        }
                        return res.status(403).json({ message });
                    }
                    return next(new Error("Acesso negado"));
                }
                return next();
            }

            const cookieValue = req.cookies?.session;

            // Se não houver cookie e for rota pública, segue sem usuário
            if (!cookieValue && isPublic) {
                return next();
            }

            // Se não houver cookie e NÃO for rota pública, redireciona/erro
            if (!cookieValue && !isPublic) {
                if (res && res.status) {
                    if (req.accepts('html')) return res.redirect('/login');
                    return res.status(401).json({ message: "Sessão não encontrada" });
                }
                return next(new Error("Sessão não encontrada"));
            }

            // Busca sessão válida
            const session = await UserSession.findOne({
                where: {
                    cookie: cookieValue,
                    expiresat: { [Op.gt]: new Date() }
                },
                include: [{
                    model: User,
                    attributes: ['id', 'publicid', 'username', 'email', 'emailVerified', 'roleId', 'profileimage', 'bannerimage', 'backgroundimage', 'backgroundcolor', 'backgroundfill', 'consentVersion']
                }]
            });

            // Se sessão for inválida
            if (!session) {
                if (isPublic) return next(); // Se for pública, ignora erro de sessão

                if (res && res.status) {
                    if (req.accepts('html')) return res.redirect('/login');
                    return res.status(401).json({ message: "Sessão inválida ou expirada" });
                }
                return next(new Error("Sessão inválida ou expirada"));
            }

            const user = session.User;

            // Verifica role mínima
            // Cargos com valor mais baixo têm mais poderes (ex: 1=dono, 5=admin, 20=usuário)
            if (!isPublic && user.roleId > minRole) {
                if (res && res.status) {
                    const message = "Acesso negado: nível de privilégio insuficiente.";
                    if (req.accepts('html')) {
                        // Poderíamos redirecionar para um erro 403 amigável
                        return res.status(403).send(`
                            <!DOCTYPE html>
                            <html>
                            <head><title>Acesso Negado</title></head>
                            <body style="font-family: sans-serif; text-align: center; margin-top: 50px; background: #f4f4f4; color: #333;">
                                <h1>Acesso Negado</h1>
                                <p>${message}</p>
                                <button onclick="window.history.back()" style="padding: 10px 20px; cursor: pointer; background: #ddd; border: 1px solid #aaa; border-radius: 4px;">Voltar</button>
                            </body>
                            </html>
                        `);
                    }
                    return res.status(403).json({ message });
                }
                return next(new Error("Acesso negado"));
            }

            // Verifica consentimento e e-mail para usuários em rotas restritas
            // Isenta apenas o Dono (Dono = 1) dessas exigências
            if (!isPublic && user.roleId > 1) {
                const isApi = req.originalUrl.startsWith('/api/');

                // 1. Consentimento
                const latestDoc = await LegalDocument.findOne({ order: [['version', 'DESC']], attributes: ['version'] });
                const currentConsentVersion = latestDoc?.version || 0;

                if (currentConsentVersion > 0 && user.consentVersion < currentConsentVersion) {
                    const consentRoutes = ['/consentimento', '/api/users/consent', '/api/users/delete-account', '/logout', '/api/users/logout'];
                    if (!consentRoutes.includes(req.originalUrl.split('?')[0])) {
                        if (res?.status) {
                            if (req.accepts('html') && !isApi) return res.redirect('/consentimento');
                            return res.status(403).json({ message: "Consentimento obrigatório pendente.", requireConsent: true });
                        }
                        return next(new Error("Consentimento obrigatório pendente."));
                    }
                } 
                // 2. E-mail (só verifica se já consentiu)
                else if (!user.emailVerified) {
                    const emailRoutes = ['/verificar-email', '/api/users/update-email', '/api/users/resend-verification', '/logout', '/api/users/logout'];
                    if (!emailRoutes.includes(req.originalUrl.split('?')[0])) {
                        if (res?.status) {
                            if (req.accepts('html') && !isApi) return res.redirect('/verificar-email');
                            return res.status(403).json({ message: "Verificação de e-mail pendente.", requireEmailVerification: true });
                        }
                        return next(new Error("Verificação de e-mail pendente."));
                    }
                }
            }

            // Atualiza expiresat se refresh ativado
            if (refresh) {
                const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await session.update({ expiresat: newExpires });
            }

            // Anexa informações do usuário
            const userData = user.get ? user.get({ plain: true }) : user;
            req.user = {
                id: userData.id, // Mantém id interno para operações no banco
                publicid: userData.publicid,
                username: userData.username,
                email: userData.email,
                emailVerified: userData.emailVerified,
                roleId: userData.roleId,
                profileimage: userData.profileimage,
                bannerimage: userData.bannerimage,
                backgroundimage: userData.backgroundimage,
                backgroundcolor: userData.backgroundcolor,
                backgroundfill: userData.backgroundfill,
                consentVersion: userData.consentVersion
            };

            if (res.locals) {
                res.locals.loggedUser = req.user;
                // Mantém res.locals.user por compatibilidade, mas loggedUser é a "opção certa"
                res.locals.user = req.user;
            }

            // Define um cookie não-HttpOnly com informações básicas para o frontend
            setUserCookie(res, user);

            next();
        } catch (err) {
            console.error("Erro no authMiddleware:", err);
            if (isPublic) return next();
            if (res && res.status) {
                return res.status(500).json({ message: "Erro na autenticação" });
            } else {
                return next(new Error("Erro na autenticação"));
            }
        }
    };
};

const limparSessoesExpiradas = async () => {
    try {
        const result = await UserSession.destroy({
            where: {
                expiresat: { [Op.lt]: new Date() }
            }
        });

        console.log(`[Sessoes] ${result} sessão(ões) expiradas removida(s)`);
    } catch (err) {
        console.error("Erro ao limpar sessões expiradas:", err);
    }
};

// Limpa sessões expiradas a cada hora
setInterval(() => {
    limparSessoesExpiradas();
}, 60 * 60 * 1000); // 60 minutos   

module.exports = { authMiddleware, setUserCookie };
