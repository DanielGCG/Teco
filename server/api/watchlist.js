const express = require('express');
const { Filme, User } = require("../models");
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
    try {
        // Extrai os campos já mapeados do body (seguindo o modelo)
        const {
            id,
            title,
            overview,
            popularity,
            type,
            originallang,
            posterurl,
            backdropurl,
            releasedate,
            voteaverage,
            votecount
        } = req.body;

        // Insere ou atualiza o filme/série na tabela movie
        const [movie, created] = await Filme.upsert({
            id,
            title,
            overview: overview || '',
            popularity: popularity || 0,
            type,
            originallang: originallang || '',
            posterurl: posterurl || '',
            backdropurl: backdropurl || '',
            releasedate,
            voteaverage: voteaverage || 0,
            votecount: votecount || 0,
            createdbyUserId: req.user.id
        });

        // Retornar o registro salvo para o frontend (útil para atualizações locais)
        const saved = await Filme.findByPk(id, {
            include: [{
                model: User,
                as: 'requester',
                attributes: ['username']
            }]
        });
        res.json({ success: true, message: 'Filme/série adicionado com sucesso.', fileUrl: null, saved: saved.toJSON() });
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

        if (watched !== undefined) movie.iswatched = watched;
        if (custom_rating !== undefined) movie.voteboteco = custom_rating;

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
