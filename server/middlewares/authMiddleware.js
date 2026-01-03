const { User, UserSession } = require("../models");
const { Op } = require("sequelize");

const PUBLIC_ROUTES = ['/register', '/login', '/logout', '/validate-session']; // rotas públicas

const setUserCookie = (res, user) => {
    const userData = user.get ? user.get({ plain: true }) : user;
    const userInfo = JSON.stringify({
        id: userData.id,
        username: userData.username,
        profile_image: userData.profile_image,
        background_image: userData.background_image,
        role: userData.role
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
const authMiddleware = (minRole = 0, refresh = true) => {
    return async (req, res, next) => {
        try {
            const isPublic = PUBLIC_ROUTES.includes(req.path);
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
                    cookie_value: cookieValue,
                    expires_at: { [Op.gt]: new Date() }
                },
                include: [{
                    model: User,
                    attributes: ['id', 'username', 'role', 'profile_image', 'background_image']
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

            // Verifica role mínima (apenas se não for rota pública ou se minRole > 0)
            if (!isPublic && user.role < minRole) {
                if (res && res.status) {
                    return res.status(403).json({ message: "Acesso negado" });
                }
                return next(new Error("Acesso negado"));
            }

            // Atualiza expires_at se refresh ativado
            if (refresh) {
                const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await session.update({ expires_at: newExpires });
            }

            // Anexa informações do usuário
            const userData = user.get ? user.get({ plain: true }) : user;
            req.user = {
                id: userData.id,
                username: userData.username,
                role: userData.role,
                profile_image: userData.profile_image,
                background_image: userData.background_image
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
                expires_at: { [Op.lt]: new Date() }
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
