const axios = require('axios');
const sequelize = require('../config/database');

const SERVER_URL = process.env.SERVIDORDEARQUIVOS_URL;
const API_KEY = process.env.SERVIDORDEARQUIVOS_KEY;

// Lista configurável de tabelas e colunas que contêm URLs de arquivos.
const FILE_REFERENCES = [
    { table: 'user', column: 'bannerimage' },
    { table: 'user', column: 'backgroundimage' },
    { table: 'user', column: 'profileimage' },
    { table: 'postmedia', column: 'url' },
    { table: 'gallery', column: 'coverurl' },
    { table: 'gallery', column: 'backgroundurl' },
    { table: 'galleryitem', column: 'coverurl' },
    { table: 'galleryitem', column: 'contenturl' },
    { table: 'imagemdodiaborder', column: 'url' },
    { table: 'imagemdodia', column: 'url' },
    { table: 'cartinha', column: 'contenturl' },
    { table: 'badge', column: 'url' },
    { table: 'item', column: 'imageurl' }
];

async function runGarbageCollector() {
    if (!SERVER_URL || !API_KEY) {
        console.error('[GarbageCollector] Configurações ausentes: SERVIDORDEARQUIVOS_URL ou SERVIDORDEARQUIVOS_KEY');
        return { error: 'Configurações ausentes' };
    }

    try {
        console.log('[GarbageCollector] Iniciando coleta de URLs do banco de dados...');
        
        let queries = [];
        for (const ref of FILE_REFERENCES) {
            queries.push(`SELECT ${ref.column} AS url FROM ${ref.table} WHERE ${ref.column} IS NOT NULL`);
        }
        
        const fullQuery = queries.join(' UNION ');
        
        const [results] = await sequelize.query(fullQuery);
        
        const validPaths = [];
        for (const row of results) {
            let url = row.url;
            if (url && url.startsWith(SERVER_URL + '/files/')) {
                // Extrai o caminho relativo
                let relPath = url.replace(SERVER_URL + '/files/', '');
                // Remove query params (como ?token=...)
                relPath = relPath.split('?')[0];
                validPaths.push(decodeURIComponent(relPath));
            }
        }
        
        console.log(`[GarbageCollector] Encontrados ${validPaths.length} caminhos válidos. Enviando para sincronização...`);
        
        const response = await axios.post(`${SERVER_URL}/sync`, { validPaths }, {
            headers: { 'x-api-key': API_KEY }
        });
        
        console.log('[GarbageCollector] Sincronização concluída no servidor de arquivos:', response.data);
        return response.data;
        
    } catch (err) {
        console.error(`[GarbageCollector] Erro na execução: ${err.message}`);
        if (err.response) {
            console.error(`[GarbageCollector] Resposta do servidor:`, err.response.data);
        }
        return { error: err.message };
    }
}

module.exports = {
    FILE_REFERENCES,
    runGarbageCollector
};
