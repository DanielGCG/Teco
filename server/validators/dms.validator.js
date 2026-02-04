const { z } = require('zod');
const { sanitizeString } = require('../utils/sanitize');

// ==================== Validadores de Conversas (DMs) ====================

const publicidSchema = z.object({
    publicid: z.string().uuid("ID da conversa inválido")
});

const getMessagesSchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1)
});

const sendMessageSchema = z.object({
    mensagem: z.string()
        .min(1, "Mensagem não pode ser vazia")
        .max(5000, "Mensagem muito longa")
        .transform(sanitizeString)
});

const createDmSchema = z.object({
    username: z.string()
        .min(1, "Username é obrigatório")
        .transform(sanitizeString)
});

const searchUsersSchema = z.object({
    q: z.string().optional().transform(val => val ? sanitizeString(val) : undefined)
});

module.exports = {
    publicidSchema,
    getMessagesSchema,
    sendMessageSchema,
    createDmSchema,
    searchUsersSchema
};
