const { SystemConfig } = require('../models');

let configCache = {};
let lastCacheTime = 0;
const CACHE_TTL = 60000; // 1 minuto

async function getGlobalConfigs() {
    const now = Date.now();
    if (now - lastCacheTime < CACHE_TTL && Object.keys(configCache).length > 0) {
        return configCache;
    }
    try {
        const configs = await SystemConfig.findAll({
            where: {
                key: ['global_bg_image', 'global_bg_color', 'global_bg_repeat']
            }
        });
        configCache = {};
        configs.forEach(c => configCache[c.key] = c.value);
        lastCacheTime = now;
    } catch (e) {
        console.error('Erro ao buscar configs globais:', e);
    }
    return configCache;
}

const renderPage = async (req, res, viewPath, options = {}) => {
    const layout = options.layout || 'layouts/main';
    const globalConfig = await getGlobalConfigs();
    
    const locals = {
        title: options.title || 'Teco',
        description: options.description || '',
        icon: options.icon || '',
        version: process.env.VERSION,
        loggedUser: req.user,
        globalConfig: globalConfig,
        ...(options.locals || {})
    };

    res.render(viewPath, {
        ...options,
        layout,
        locals,
        HOST: process.env.HOST
    });
};

const renderStaticPage = (viewPath, options = {}) => {
    return async (req, res) => {
        await renderPage(req, res, viewPath, options);
    };
};

module.exports = { renderPage, renderStaticPage, getGlobalConfigs };
