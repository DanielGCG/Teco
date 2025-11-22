const express = require('express');
const pool = require("../config/bd");
const router = express.Router();

router.get('/watchlistsearch-movies', async (req, res) => {
  const query = req.query.query;
  const BASE_URL = 'https://api.themoviedb.org/3';

  if (!query || query.length < 3) {
    return res.status(400).json({ message: 'Por favor, insira pelo menos 3 caracteres.' });
  }

  // Determinar o idioma, pode ser 'pt-BR' ou 'en-US'
  const language = 'pt-BR';  // Se não houver 'language', usa 'pt-BR' por padrão

  try {
    // Normalizar texto para remover acentos e caracteres especiais
    const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Fazer a busca na API do TMDb
    const response = await fetch(`${BASE_URL}/search/multi?api_key=${process.env.TMDB_APIKEY}&query=${encodeURIComponent(normalizedQuery)}&language=${language}`);
    const data = await response.json();

    console.log(data);

    if (data.results.length === 0) {
      return res.status(404).json({ message: 'No movies found.' });
    }

    // Filtrar apenas filmes e séries
    const filteredResults = data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');

    // Limitar para os 6 primeiros resultados
    const limitedResults = filteredResults.slice(0, 8);

    res.json(limitedResults);  // Enviar apenas filmes e séries, limitados a 6
  } catch (error) {
    console.error('Error fetching movie data:', error);
    res.status(500).json({ message: 'Erro ao buscar filmes.' });
  }
});

router.post('/watchlistupload-movies', async (req, res) => {
  const newMovie = req.body; // Dados do filme/série enviados
  const connection = await pool.getConnection();
  
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

    // Insere o filme/série na tabela wl_filme
    await connection.execute(
      `INSERT INTO wl_filme (id, title, overview, popularity, media_type, original_language, poster_path, backdrop_path, release_date, vote_average, vote_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), overview=VALUES(overview), popularity=VALUES(popularity), media_type=VALUES(media_type), original_language=VALUES(original_language), poster_path=VALUES(poster_path), backdrop_path=VALUES(backdrop_path), release_date=VALUES(release_date), vote_average=VALUES(vote_average), vote_count=VALUES(vote_count)`,
      [
        id,
        movieTitle,
        overview || '',
        popularity || 0,
        media_type,
        original_language || '',
        poster_path || '',
        backdrop_path || '',
        releaseDate,
        vote_average || 0,
        vote_count || 0
      ]
    );

    // Insere os gêneros na tabela de relação N:N
    if (Array.isArray(genre_ids)) {
      for (const genero_id of genre_ids) {
        await connection.execute(
          `INSERT IGNORE INTO wl_filme_genero (filme_id, genero_id) VALUES (?, ?)`,
          [id, genero_id]
        );
      }
    }

    connection.release();
    res.json({ success: true, message: 'Filme/série adicionado com sucesso.' });
  } catch (error) {
    console.error('Erro ao adicionar filme/série:', error);
    connection.release();
    res.status(500).json({ success: false, message: 'Erro ao adicionar filme/série.' });
  }
});

router.delete('/watchlistdelete-movie', async (req, res) => {
  const { id } = req.query; // ID do filme a ser removido

  if (!id) {
    return res.status(400).json({ success: false, message: 'ID do filme/série é obrigatório.' });
  }

  const connection = await pool.getConnection();
  
  try {
    // Remove o filme da tabela wl_filme (as relações N:N serão removidas por ON DELETE CASCADE)
    const [result] = await connection.execute('DELETE FROM wl_filme WHERE id = ?', [id]);
    connection.release();
    
    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Filme/série removido com sucesso.' });
    } else {
      res.status(404).json({ success: false, message: 'Filme/série não encontrado.' });
    }
  } catch (error) {
    console.error('Erro ao remover filme/série:', error);
    connection.release();
    res.status(500).json({ success: false, message: 'Erro ao remover filme/série.' });
  }
});

router.get('/watchlistdownload-movies', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute('SELECT * FROM wl_filme ORDER BY title ASC');
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Erro ao baixar a lista de filmes:', error);
    connection.release();
    res.status(500).json({ success: false, message: 'Erro ao baixar a lista de filmes.' });
  }
});

module.exports = router;