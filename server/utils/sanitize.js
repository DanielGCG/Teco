/**
 * Utilitários de sanitização para XSS prevention
 * Remove caracteres perigosos de strings de usuários
 */

function sanitizeString(text) {
    if (typeof text !== 'string') return '';
    
    // Remove caracteres HTML/JS perigosos
    return text
        .replace(/[<>]/g, '') // Remove < e >
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers (onclick=, etc)
}

function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }
    
    return obj;
}

module.exports = {
    sanitizeString,
    sanitizeObject
};
