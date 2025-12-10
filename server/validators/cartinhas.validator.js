const { z } = require('zod');

// ==================== Validadores de Cartinhas ====================

const createCartinhaSchema = z.object({
    destinatario_username: z.string().min(1, "Username do destinatário é obrigatório"),
    titulo: z.string().min(1, "Título é obrigatório").max(40, "Título deve ter no máximo 40 caracteres"),
    conteudo: z.string().min(1, "Conteúdo é obrigatório").max(560, "Conteúdo deve ter no máximo 560 caracteres")
});

const updateCartinhaSchema = z.object({
    titulo: z.string().min(1, "Título é obrigatório").max(40, "Título deve ter no máximo 40 caracteres"),
    conteudo: z.string().min(1, "Conteúdo é obrigatório").max(560, "Conteúdo deve ter no máximo 560 caracteres")
});

const cartinhaIdSchema = z.object({
    cartinhaId: z.coerce.number().int().positive()
});

module.exports = {
    createCartinhaSchema,
    updateCartinhaSchema,
    cartinhaIdSchema
};
