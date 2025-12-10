const { z } = require('zod');

// ==================== Validadores de Amizades ====================

const friendshipIdSchema = z.object({
    friendshipId: z.coerce.number().int().positive()
});

const userIdSchema = z.object({
    userId: z.coerce.number().int().positive()
});

const sendFriendRequestSchema = z.object({
    addressee_id: z.number().int().positive("ID do destinatário é obrigatório")
});

module.exports = {
    friendshipIdSchema,
    userIdSchema,
    sendFriendRequestSchema
};
