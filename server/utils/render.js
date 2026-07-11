const renderPage = (req, res, viewPath, options = {}) => {
    const layout = options.layout || 'layouts/main';
    const locals = {
        title: options.title || 'Teco',
        description: options.description || '',
        icon: options.icon || '',
        version: process.env.VERSION,
        loggedUser: req.user,
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
        renderPage(req, res, viewPath, options);
    };
};

module.exports = { renderPage, renderStaticPage };
