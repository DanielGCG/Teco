const { User, UserSession } = require("../models");
const { Op } = require("sequelize");

const PUBLIC_ROUTES = ['/register', '/login', '/logout', '/validate-session']; // rotas públicas

// authMiddleware(minRole, refresh = true)
const authMiddleware = (minRole = 0, refresh = true) => {
    return async (req, res, next) => {
        try {
            // Rotas públicas não precisam de verificação de cookies
            if (PUBLIC_ROUTES.includes(req.path)) {
                return next();
            }

            // Pega o cookie de sessão
            const cookieValue = req.cookies?.session;

            if (!cookieValue) {
                if (res && res.status) {
                    // Redireciona para login
                    if (req.accepts('html')) {
                        return res.redirect('/login');
                    }
                    return res.status(401).json({ message: "Sessão não encontrada" });
                } else {
                    return next(new Error("Sessão não encontrada")); // Para Socket.IO
                }
            }

            // Busca sessão válida
            const session = await UserSession.findOne({
                where: {
                    cookie_value: cookieValue,
                    expires_at: { [Op.gt]: new Date() }
                },
                include: [{
                    model: User,
                    attributes: ['id', 'username', 'role']
                }]
            });

            if (!session) {
                if (res && res.status) {
                    // Se for uma requisição de página (HTML), redireciona para login
                    if (req.accepts('html')) {
                        return res.redirect('/login');
                    }
                    return res.status(401).json({ message: "Sessão inválida ou expirada" });
                } else {
                    return next(new Error("Sessão inválida ou expirada")); // Para Socket.IO
                }
            }

            const user = session.User;

            // Verifica role mínima
            if (user.role < minRole) {
                if (res && res.status) {
                    return res.status(403).json({ message: "Acesso negado" });
                } else {
                    return next(new Error("Acesso negado")); // Para Socket.IO
                }
            }

            // Atualiza expires_at se refresh ativado
            if (refresh) {
                const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
                await session.update({ expires_at: newExpires });
            }

            // Anexa informações do usuário
            req.user = {
                id: user.id,
                username: user.username,
                role: user.role
            };

            next();
        } catch (err) {
            console.error(err);
            if (res && res.status) {
                return res.status(500).json({ message: "Erro na autenticação" });
            } else {
                return next(new Error("Erro na autenticação")); // Para Socket.IO
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

module.exports = authMiddleware;
