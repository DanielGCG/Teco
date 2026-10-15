const sequelize = require('../config/database');
const { deleteFromFileServer, listFileServerResources, urlToPath, normalizePath, SERVER_URL } = require('./fileServer');

// Apenas estas pastas são varridas. /boteco-legacy e qualquer outra pasta NUNCA são tocadas.
const MANAGED_FOLDERS = [
    'backgrounds',
    'blogs',
    'configs',
    'badges',
    'galerias',
    'imagemdodia',
    'pagebackgrounds',
    'posts',
    'profiles',
    'stamps'
];

// Encontra URLs de arquivos no formato oficial do FileBrowser Quantum (inclui markdown/JSON)
const URL_REGEX = /(https?:\/\/[^\s"'<>()\\]+?\/public\/api\/resources\/download\?[^\s"'<>()\\]+)/gi;

async function collectFilesRecursively(dirPath) {
    const files = [];
    const data = await listFileServerResources(dirPath);
    if (!data) return files;

    const base = normalizePath(dirPath).replace(/\/$/, '');
    for (const f of data.files || []) files.push(`${base}/${f.name}`);
    for (const d of data.folders || []) files.push(...await collectFilesRecursively(`${base}/${d.name}`));
    return files;
}

async function runGarbageCollector() {
    if (!SERVER_URL || !process.env.SERVIDORDEARQUIVOS_KEY) {
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

        const tables = {};
        for (const col of columns) {
            if (!tables[col.TABLE_NAME]) tables[col.TABLE_NAME] = [];
            tables[col.TABLE_NAME].push(col.COLUMN_NAME);
        }

        const validPaths = new Set();

        for (const [tableName, cols] of Object.entries(tables)) {
            const where = cols.map(c => `\`${c}\` LIKE '%/public/api/resources/download%'`).join(' OR ');
            const select = cols.map(c => `\`${c}\``).join(', ');
            try {
                const [rows] = await sequelize.query(`SELECT ${select} FROM \`${tableName}\` WHERE ${where}`);
                for (const row of rows) {
                    for (const col of cols) {
                        const val = row[col];
                        if (typeof val !== 'string') continue;
                        // JSON pode ter "&" como \u0026 e barras escapadas
                        const text = val.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
                        let m;
                        URL_REGEX.lastIndex = 0;
                        while ((m = URL_REGEX.exec(text)) !== null) {
                            const p = urlToPath(m[1]);
                            if (p) validPaths.add(p);
                        }
                    }
                }
            } catch (e) {
                console.error(`[GarbageCollector] Erro ao escanear tabela ${tableName}:`, e.message);
            }
        }

        console.log(`[GarbageCollector] Encontrados ${validPaths.size} caminhos válidos no banco de dados.`);

        // Trava de segurança: se o banco não retornou nada, não apaga nada
        if (validPaths.size === 0) {
            console.warn('[GarbageCollector] Nenhum caminho válido encontrado. Abortando para evitar remoção em massa.');
            return { success: false, error: 'Nenhum caminho válido encontrado no banco' };
        }

        let scannedCount = 0;
        let deletedCount = 0;

        for (const folder of MANAGED_FOLDERS) {
            const remoteFiles = await collectFilesRecursively(`/${folder}`);
            for (const filePath of remoteFiles) {
                scannedCount++;
                if (!validPaths.has(filePath)) {
                    console.log(`[GarbageCollector] Arquivo órfão: ${filePath}. Removendo...`);
                    if (await deleteFromFileServer(filePath)) deletedCount++;
                }
            }
        }

        console.log(`[GarbageCollector] Concluído! Arquivos verificados: ${scannedCount}, Deletados: ${deletedCount}`);
        return { success: true, scannedCount, deletedCount, validPathsCount: validPaths.size };
    } catch (err) {
        console.error(`[GarbageCollector] Erro na execução: ${err.message}`);
        return { error: err.message };
    }
}

module.exports = {
    runGarbageCollector
};
