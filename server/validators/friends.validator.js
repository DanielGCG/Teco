const { z } = require('zod');

// ==================== Validadores de Amizades (Seguidores) ====================

const userIdSchema = z.object({
    userId: z.string().uuid("ID de usuário inválido")
});

module.exports = {
    userIdSchema
};
