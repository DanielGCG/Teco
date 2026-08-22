const { SystemConfig, ImagemDoDia, ImagemDoDiaBorder } = require('../models');
const { Op } = require('sequelize');

// Cache para evitar sobrecarga no banco de dados a cada requisição
let systemConfigCache = null;
let imagemDoDiaCache = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minuto (60.000 ms)

// Chaves que são estritamente visuais e podem ir para as views com segurança
const PUBLIC_KEYS = [
    'marquee',
    'global_bg_color',
    'global_bg_repeat',
    'global_bg_image'
];

const systemConfigMiddleware = async (req, res, next) => {
    try {
        const now = Date.now();

        // Se o cache não for válido ou não existir, busca TUDO no banco
        if (!systemConfigCache || (now - lastFetch >= CACHE_TTL)) {
            const configsArray = await SystemConfig.findAll();
            
            systemConfigCache = {};
            // Converte o array em um objeto chave-valor
            configsArray.forEach(config => {
                systemConfigCache[config.key] = config.value;
            });
            
            // Busca também a Imagem do Dia para injetar globalmente
            const activeIotd = await ImagemDoDia.findOne({
                where: { position: { [Op.gt]: 0 } },
                order: [['position', 'DESC']],
                include: [{ model: ImagemDoDiaBorder, as: 'border' }]
            });
            
            imagemDoDiaCache = activeIotd ? activeIotd.toJSON() : null;

            lastFetch = now;
        }

        // 1. Disponibiliza o objeto COMPLETO apenas para o Backend (rotas e APIs)
        req.systemConfig = systemConfigCache;
        
        // 2. Filtra e disponibiliza apenas as configurações VISUAIS para as Views (Frontend)
        const publicConfigs = {};
        PUBLIC_KEYS.forEach(key => {
            if (systemConfigCache[key] !== undefined) {
                publicConfigs[key] = systemConfigCache[key];
            }
        });
        
        res.locals.systemConfig = publicConfigs;
        
        // Mantém atalhos para variáveis muito utilizadas nas views (Retrocompatibilidade)
        res.locals.marqueeText = publicConfigs.marquee || "Bem-vindo ao Teco!";
        
        // Injeta a Imagem do Dia para o EJS renderizar sem precisar de fetch() no frontend
        res.locals.imagemDoDia = imagemDoDiaCache;

    } catch (err) {
        console.error("Erro no systemConfigMiddleware:", err);
        // Fallbacks
        req.systemConfig = {};
        res.locals.systemConfig = {};
        res.locals.marqueeText = "Bem-vindo ao Teco!";
    }

    next();
};

// Permite limpar o cache manualmente (útil para quando o admin atualiza configurações)
systemConfigMiddleware.clearCache = () => {
    lastFetch = 0;
};

module.exports = systemConfigMiddleware;
