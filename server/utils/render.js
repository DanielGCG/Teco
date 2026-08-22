const renderPage = async (req, res, viewPath, options = {}) => {
    const layout = options.layout || 'layouts/main';
    
    const locals = {
        title: options.title || 'Teco',
        description: options.description || '',
        icon: options.icon || '',
        version: process.env.VERSION,
        loggedUser: req.user,
        globalConfig: res.locals.systemConfig || {},
        imagemDoDia: res.locals.imagemDoDia || null,
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

module.exports = { renderPage, renderStaticPage };
