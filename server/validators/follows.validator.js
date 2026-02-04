const { z } = require('zod');

const publicidSchema = z.object({
    publicid: z.string().uuid("ID de usuário inválido")
});

module.exports = {
    publicidSchema
};
