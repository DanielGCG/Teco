const { z } = require('zod');

// ==================== Validadores de Chats ====================

const chatIdentifierSchema = z.object({
    chatIdentifier: z.string().min(1)
});

const getMessagesSchema = z.object({
    chatIdentifier: z.string().min(1),
    page: z.coerce.number().int().positive().default(1)
});

const sendMessageSchema = z.object({
    mensagem: z.string().min(1, "Mensagem não pode ser vazia").max(5000, "Mensagem muito longa")
});

const markAsReadSchema = z.object({
    messageId: z.coerce.number().int().positive().optional()
});

module.exports = {
    chatIdentifierSchema,
    getMessagesSchema,
    sendMessageSchema,
    markAsReadSchema
};
