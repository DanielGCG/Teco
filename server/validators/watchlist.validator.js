const { z } = require('zod');

// ==================== Validadores de Watchlist ====================

const searchMoviesSchema = z.object({
    query: z.string().min(3, "Por favor, insira pelo menos 3 caracteres")
});

const uploadMovieSchema = z.object({
    id: z.number().int(),
    title: z.string().optional().nullable(),
    name: z.string().optional().nullable(),
    overview: z.string().optional().nullable(),
    popularity: z.number().optional().nullable(),
    media_type: z.enum(['movie', 'tv']),
    original_language: z.string().optional().nullable(),
    poster_path: z.string().optional().nullable(),
    backdrop_path: z.string().optional().nullable(),
    release_date: z.string().optional().nullable(),
    first_air_date: z.string().optional().nullable(),
    vote_average: z.number().optional().nullable(),
    vote_count: z.number().optional().nullable(),
    genre_ids: z.array(z.number()).optional().nullable()
});

const deleteMovieSchema = z.object({
    id: z.coerce.number().int().positive("ID do filme/série é obrigatório")
});

module.exports = {
    searchMoviesSchema,
    uploadMovieSchema,
    deleteMovieSchema
};
