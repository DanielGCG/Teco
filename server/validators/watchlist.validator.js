const { z } = require('zod');

// ==================== Validadores de Watchlist ====================

const searchMoviesSchema = z.object({
    query: z.string().min(3, "Por favor, insira pelo menos 3 caracteres")
});

const uploadMovieSchema = z.object({
    id: z.number().int(),
    title: z.string().optional().nullable(),
    overview: z.string().optional().nullable(),
    popularity: z.number().optional().nullable(),
    type: z.enum(['movie', 'tv']),
    originallang: z.string().optional().nullable(),
    posterurl: z.string().optional().nullable(),
    backdropurl: z.string().optional().nullable(),
    releasedate: z.string().optional().nullable(),
    voteaverage: z.number().optional().nullable(),
    votecount: z.number().optional().nullable()
});

const deleteMovieSchema = z.object({
    id: z.coerce.number().int().positive("ID do filme/série é obrigatório")
});

const updateMovieStatusSchema = z.object({
    id: z.number().int(),
    watched: z.boolean().optional(),
    custom_rating: z.number().min(0).max(10).optional().nullable()
});

module.exports = {
    searchMoviesSchema,
    uploadMovieSchema,
    deleteMovieSchema,
    updateMovieStatusSchema
};
