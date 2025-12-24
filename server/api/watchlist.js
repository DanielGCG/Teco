const express = require('express');
const { Filme, Genero, FilmeGenero, User } = require("../models");
const validate = require("../middlewares/validate");
const {
    searchMoviesSchema,
    uploadMovieSchema,
    deleteMovieSchema,
    updateMovieStatusSchema
} = require("../validators/watchlist.validator");
const watchlistRouter = express.Router();

watchlistRouter.get('/watchlistsearch-movies', validate(searchMoviesSchema, 'query'), async (req, res) => {
    const query = req.query.query;
    const BASE_URL = 'https://api.themoviedb.org/3';
    const language = 'pt-BR';

    try {
        // Normalizar texto para remover acentos e caracteres especiais
        const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Fazer a busca na API do TMDb
        const response = await fetch(`${BASE_URL}/search/multi?api_key=${process.env.TMDB_APIKEY}&query=${encodeURIComponent(normalizedQuery)}&language=${language}`);
        const data = await response.json();

        if (data.results.length === 0) {
            return res.status(404).json({ message: 'No movies found.' });
        }

        // Filtrar apenas filmes e séries
        const filteredResults = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');

        // Limitar para os 8 primeiros resultados
        const limitedResults = filteredResults.slice(0, 8);

        res.json(limitedResults);
    } catch (error) {
        console.error('Error fetching movie data:', error);
        res.status(500).json({ message: 'Erro ao buscar filmes.' });
    }
});

watchlistRouter.post('/watchlistupload-movies', validate(uploadMovieSchema), async (req, res) => {
    const newMovie = req.body;
    
    try {
        // Extrai os campos necessários do objeto recebido
        const {
            id,
            title,
            name,
            overview,
            popularity,
            media_type,
            original_language,
            poster_path,
            backdrop_path,
            release_date,
            first_air_date,
            vote_average,
            vote_count,
            genre_ids
        } = newMovie;

        // title pode vir como 'name' para séries
        const movieTitle = title || name || '';
        // release_date pode vir como 'first_air_date' para séries
        const releaseDate = release_date || first_air_date || null;

        // Insere ou atualiza o filme/série na tabela wl_filme
        await Filme.upsert({
            id,
            title: movieTitle,
            overview: overview || '',
            popularity: popularity || 0,
            media_type,
            original_language: original_language || '',
            poster_path: poster_path || '',
            backdrop_path: backdrop_path || '',
            release_date: releaseDate,
            vote_average: vote_average || 0,
            vote_count: vote_count || 0,
            user_id: req.user.id
        });

        // Insere os gêneros na tabela de relação N:N
        if (Array.isArray(genre_ids)) {
            for (const genero_id of genre_ids) {
                // Garantir que o gênero exista na tabela wl_genero antes de criar a relação
                await Genero.findOrCreate({
                    where: { id: genero_id },
                    defaults: { name: `Desconhecido ${genero_id}` }
                });

                await FilmeGenero.findOrCreate({
                    where: {
                        filme_id: id,
                        genero_id: genero_id
                    }
                });
            }
        }

        // Retornar o registro salvo para o frontend (útil para atualizações locais)
        const saved = await Filme.findByPk(id, {
            include: [{
                model: User,
                as: 'requester',
                attributes: ['username']
            }]
        });
        res.json({ success: true, message: 'Filme/série adicionado com sucesso.', fileUrl: null, saved });
    } catch (error) {
        console.error('Erro ao adicionar filme/série:', error);
        const message = error && error.message ? error.message : 'Erro ao adicionar filme/série.';
        res.status(500).json({ success: false, message });
    }
});

watchlistRouter.delete('/watchlistdelete-movie', validate(deleteMovieSchema, 'query'), async (req, res) => {
    const { id } = req.query;

    try {
        // Remove o filme da tabela wl_filme (as relações N:N serão removidas por ON DELETE CASCADE)
        const result = await Filme.destroy({
            where: { id }
        });
        
        if (result > 0) {
            res.json({ success: true, message: 'Filme/série removido com sucesso.' });
        } else {
            res.status(404).json({ success: false, message: 'Filme/série não encontrado.' });
        }
    } catch (error) {
        console.error('Erro ao remover filme/série:', error);
        res.status(500).json({ success: false, message: 'Erro ao remover filme/série.' });
    }
});

watchlistRouter.patch('/watchlistupdate-status', validate(updateMovieStatusSchema), async (req, res) => {
    const { id, watched, custom_rating } = req.body;

    try {
        const movie = await Filme.findByPk(id);
        if (!movie) {
            return res.status(404).json({ success: false, message: 'Filme/série não encontrado.' });
        }

        if (watched !== undefined) movie.watched = watched;
        if (custom_rating !== undefined) movie.custom_rating = custom_rating;

        await movie.save();

        res.json({ success: true, message: 'Status atualizado com sucesso.', movie });
    } catch (error) {
        console.error('Erro ao atualizar status do filme/série:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar status.' });
    }
});

watchlistRouter.get('/watchlistdownload-movies', async (req, res) => {
    try {
        const filmes = await Filme.findAll({
            include: [{
                model: User,
                as: 'requester',
                attributes: ['username'],
                required: false
            }],
            order: [['title', 'ASC']]
        });
        res.json(filmes);
    } catch (error) {
        console.error('Erro ao baixar a lista de filmes:', error);
        res.status(500).json({ success: false, message: 'Erro ao baixar a lista de filmes.' });
    }
});

module.exports = watchlistRouter;
