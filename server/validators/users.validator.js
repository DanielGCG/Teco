const { z } = require('zod');
const { sanitizeString } = require('../utils/sanitize');

// ==================== Validadores de Usuários ====================

const registerSchema = z.object({
    username: z.string()
        .min(1, "Username é obrigatório")
        .max(13, "Username deve ter no máximo 13 caracteres")
        .transform(sanitizeString),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    bio: z.string()
        .max(160, "Bio deve ter no máximo 160 caracteres")
        .optional()
        .transform(val => val ? sanitizeString(val) : undefined)
});

const loginSchema = z.object({
    username: z.string()
        .min(1, "Username é obrigatório")
        .transform(sanitizeString),
    password: z.string().min(1, "Senha é obrigatória")
});

const updateProfileSchema = z.object({
    username: z.string()
        .min(1, "Username é obrigatório")
        .max(13, "Username deve ter no máximo 13 caracteres")
        .transform(sanitizeString),
    pronouns: z.string()
        .max(12, "Pronomes devem ter no máximo 12 caracteres")
        .optional()
        .transform(val => val ? sanitizeString(val) : undefined),
    background_image: z.string().url().optional().or(z.literal('')),
    profile_image: z.string().url().optional().or(z.literal('')),
    bio: z.string()
        .max(160, "Bio deve ter no máximo 160 caracteres")
        .optional()
        .transform(val => val ? sanitizeString(val) : undefined)
});

const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "Nova senha deve ter no mínimo 6 caracteres")
});

const validateSessionSchema = z.object({
    cookie: z.string().optional()
});

const searchUsersSchema = z.object({
    q: z.string().optional().transform(val => val ? sanitizeString(val) : undefined),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10)
});

module.exports = {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    updatePasswordSchema,
    validateSessionSchema,
    searchUsersSchema
};
