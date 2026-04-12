const { z } = require('zod');
const { sanitizeString } = require('../utils/sanitize');

// ==================== Validadores de Usuários ====================

const registerSchema = z.object({
    username: z.string()
        .min(1, "Username é obrigatório")
        .max(16, "Username deve ter no máximo 16 caracteres")
        .transform(sanitizeString),
    password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
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
    username: z.string().optional(),
    pronouns: z.string().optional().nullable().or(z.literal('')),
    backgroundimage: z.any().optional().nullable().or(z.literal('')),
    profileimage: z.any().optional().nullable().or(z.literal('')),
    bio: z.string().optional().nullable().or(z.literal('')),
    lastfmusername: z.preprocess(val => Array.isArray(val) ? val[0] : val, z.string().optional().nullable().or(z.literal('')))
});

const updatePasswordSchema = z.object({
    currentPassword: z.string({
        required_error: "A senha atual é obrigatória.",
        invalid_type_error: "A senha atual deve ser um texto."
    }).min(1, "A senha atual não pode estar vazia."),
    newPassword: z.string({
        required_error: "A nova senha é obrigatória.",
        invalid_type_error: "A nova senha deve ser um texto."
    }).min(8, "Sua nova senha deve ter no mínimo 8 caracteres para sua segurança.")
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
