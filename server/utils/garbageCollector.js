const axios = require('axios');
const sequelize = require('../config/database');

const SERVER_URL = process.env.SERVIDORDEARQUIVOS_URL;
const API_KEY = process.env.SERVIDORDEARQUIVOS_KEY;

async function runGarbageCollector() {
    if (!SERVER_URL || !API_KEY) {
        console.error('[GarbageCollector] Configurações ausentes: SERVIDORDEARQUIVOS_URL ou SERVIDORDEARQUIVOS_KEY');
        return { error: 'Configurações ausentes' };
    }

    try {
        console.log('[GarbageCollector] Iniciando coleta dinâmica de URLs do banco de dados (Apenas colunas de Mídia)...');

        const [columns] = await sequelize.query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND DATA_TYPE IN ('varchar', 'text', 'mediumtext', 'longtext', 'json')
            AND (
                COLUMN_NAME LIKE '%url%' 
                OR COLUMN_NAME LIKE '%image%' 
                OR TABLE_NAME = 'systemconfig'
                OR (TABLE_NAME = 'blog' AND COLUMN_NAME = 'content')
            )
        `);

        // Agrupar colunas por tabela
        const tables = {};
        for (const col of columns) {
            if (!tables[col.TABLE_NAME]) tables[col.TABLE_NAME] = [];
            tables[col.TABLE_NAME].push(col.COLUMN_NAME);
        }

        const validPaths = new Set();

        // Expressão regular para encontrar URLs do servidor de arquivos.
        const escapedServerUrl = SERVER_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const urlRegex = new RegExp(escapedServerUrl + '/files/([^"\'<>\\n? )]+)', 'g');

        // 2. Procurar nas tabelas e colunas filtradas
        for (const [tableName, cols] of Object.entries(tables)) {
            const whereClause = cols.map(c => `\`${c}\` LIKE '%${SERVER_URL}/files/%'`).join(' OR ');
            const selectClause = cols.map(c => `\`${c}\``).join(', ');

            const query = `SELECT ${selectClause} FROM \`${tableName}\` WHERE ${whereClause}`;

            try {
                const [rows] = await sequelize.query(query);
                for (const row of rows) {
                    for (const col of cols) {
                        const val = row[col];
                        if (typeof val === 'string' && val.includes(SERVER_URL + '/files/')) {
                            let match;
                            while ((match = urlRegex.exec(val)) !== null) {
                                // Limpar espaços em branco acidentais e decodificar a URI
                                let relPath = match[1].trim();
                                validPaths.add(decodeURIComponent(relPath));
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[GarbageCollector] Erro ao escanear tabela ${tableName}:`, e.message);
            }
        }

        const validPathsArray = Array.from(validPaths);
        console.log(`[GarbageCollector] Encontrados ${validPathsArray.length} caminhos válidos. Enviando para sincronização...`);

        // 3. Enviar para o servidor de arquivos
        const response = await axios.post(`${SERVER_URL}/sync`, { validPaths: validPathsArray }, {
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
    runGarbageCollector
};
