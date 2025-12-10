const { z } = require('zod');

// ==================== Validadores de Watchlist ====================

const searchMoviesSchema = z.object({
    query: z.string().min(3, "Por favor, insira pelo menos 3 caracteres")
});

const uploadMovieSchema = z.object({
    id: z.number().int(),
    title: z.string().optional(),
    name: z.string().optional(),
    overview: z.string().optional(),
    popularity: z.number().optional(),
    media_type: z.enum(['movie', 'tv']),
    original_language: z.string().optional(),
    poster_path: z.string().optional(),
    backdrop_path: z.string().optional(),
    release_date: z.string().optional(),
    first_air_date: z.string().optional(),
    vote_average: z.number().optional(),
    vote_count: z.number().optional(),
    genre_ids: z.array(z.number()).optional()
});

const deleteMovieSchema = z.object({
    id: z.coerce.number().int().positive("ID do filme/série é obrigatório")
});

module.exports = {
    searchMoviesSchema,
    uploadMovieSchema,
    deleteMovieSchema
};
