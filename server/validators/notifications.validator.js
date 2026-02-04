const { z } = require('zod');

// ==================== Validadores de Notificações ====================

const getNotificationsSchema = z.object({
    limit: z.coerce.number().int().positive().max(100).default(20),
    page: z.coerce.number().int().positive().default(1),
    unread: z.enum(['true', 'false']).optional()
});

const notificationIdSchema = z.object({
    publicid: z.string()
});

module.exports = {
    getNotificationsSchema,
    notificationIdSchema
};
