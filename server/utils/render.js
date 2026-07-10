/**
 * Utilitário central para renderização de páginas.
 * Uniformiza a injeção de layout, locais (usuário, versão, etc) e HOST.
 */

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
        layout,
        locals,
        HOST: process.env.HOST
    });
};

/**
 * Retorna um middleware que renderiza a página.
 * Ideal para rotas que não precisam de lógica de banco de dados antes da renderização.
 */
const renderStaticPage = (viewPath, options = {}) => {
    return async (req, res) => {
        renderPage(req, res, viewPath, options);
    };
};

module.exports = { renderPage, renderStaticPage };
