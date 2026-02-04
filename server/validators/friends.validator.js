const { z } = require('zod');

// ==================== Validadores de Amizades (Seguidores) ====================

const publicidSchema = z.object({
    publicid: z.string().uuid("ID de usuário inválido")
});

module.exports = {
    publicidSchema
};
