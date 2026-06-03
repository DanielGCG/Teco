const { User, UserSession } = require("../models");
const { Op } = require("sequelize");

const PUBLIC_ROUTES = ['/register', '/login', '/logout', '/validate-session']; // rotas públicas

const setUserCookie = (res, user) => {
    const userData = user.get ? user.get({ plain: true }) : user;
    const userInfo = JSON.stringify({
        publicid: userData.publicid,
        username: userData.username,
        profileimage: userData.profileimage,
        backgroundimage: userData.backgroundimage,
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
// 1=dono, 5=admin, 10=moderador, 11=botecor, 20=usuário
const authMiddleware = (minRole = 20, refresh = true) => {
    return async (req, res, next) => {
        let isPublic = false;
        try {
            isPublic = PUBLIC_ROUTES.includes(req.path);
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
                    attributes: ['id', 'publicid', 'username', 'roleId', 'profileimage', 'backgroundimage']
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

            // Dono (1) sempre tem acesso a tudo
            const isDono = user.roleId === 1;

            // Verifica role mínima
            if (!isPublic && !isDono && user.roleId > minRole) {
                if (res && res.status) {
                    const message = "Acesso negado: nível de privilégio insuficiente.";
                    if (req.accepts('html')) {
                        // Poderíamos redirecionar para um erro 403 amigável
                        return res.status(403).render('utils/modal-aviso', {
                            layout: 'layouts/empty',
                            locals: { title: '403', description: 'Acesso Negado', version: process.env.VERSION },
                            aviso: { titulo: "Acesso Negado", mensagem: message, botao: "Voltar", link: "javascript:history.back()" }
                        });
                    }
                    return res.status(403).json({ message });
                }
                return next(new Error("Acesso negado"));
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
                roleId: userData.roleId,
                profileimage: userData.profileimage,
                backgroundimage: userData.backgroundimage
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
