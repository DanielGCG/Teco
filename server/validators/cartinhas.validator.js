const { z } = require('zod');

// ==================== Validadores de Cartinhas ====================

const createCartinhaSchema = z.object({
    recipientusername: z.string().min(1, "Username do destinatário é obrigatório"),
    title: z.string().min(1, "Título é obrigatório").max(160, "Título deve ter no máximo 160 caracteres"),
    body: z.string().min(1, "Conteúdo é obrigatório").max(2000, "Conteúdo deve ter no máximo 2000 caracteres")
});

const updateCartinhaSchema = z.object({
    title: z.string().min(1, "Título é obrigatório").max(160, "Título deve ter no máximo 160 caracteres"),
    body: z.string().min(1, "Conteúdo é obrigatório").max(2000, "Conteúdo deve ter no máximo 2000 caracteres")
});

const cartinhaIdSchema = z.object({
    cartinhaId: z.coerce.number().int().positive()
});

module.exports = {
    createCartinhaSchema,
    updateCartinhaSchema,
    cartinhaIdSchema
};
