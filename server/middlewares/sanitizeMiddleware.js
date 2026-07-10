const { sanitizeObject } = require('../utils/sanitize');

const sanitizeMiddleware = (req, res, next) => {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);
    next();
};

module.exports = sanitizeMiddleware;
