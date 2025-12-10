const { z } = require('zod');

const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const data = req[source];
            const validated = schema.parse(data);
            req[source] = validated; // Substitui pelos dados validados
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors?.map(err => ({
                    field: err.path?.join('.') || 'unknown',
                    message: err.message
                })) || [];
                return res.status(400).json({ 
                    message: "Erro de validação", 
                    errors 
                });
            }
            return res.status(500).json({ message: "Erro interno de validação" });
        }
    };
};

module.exports = validate;
