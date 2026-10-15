/**
 * Migração das URLs de mídia do banco para o FileBrowser Quantum (files.sitedoboteco.com.br)
 *
 * Uso:
 *   node scripts/migrateFileServer.js           # Simulação: só mostra o que faria (nada é alterado)
 *   node scripts/migrateFileServer.js --apply   # Copia arquivos faltantes e atualiza o banco
 *
 * Para cada URL de arquivo encontrada no banco (formato legado ou /files/srv/...?token=...):
 *   1. Descobre o caminho na fonte (ex: /profiles/1770225527074-profile.png)
 *   2. Se o arquivo não existir nesse caminho, copia de /boteco-legacy/<mesmo caminho>
 *   3. Troca a URL no banco pela URL pública nova (sem ?token):
 *      https://files.sitedoboteco.com.br/public/api/resources/download?hash=...&file=/profiles/...&inline=true
 *
 * Cada URL antiga mapeia para o seu próprio caminho, então URLs diferentes que apontavam para o mesmo
 * arquivo físico viram cópias independentes — nada se sobrescreve (cópias usam overwrite=false).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('../server/config/database');
const {
    buildPublicUrl, fileExists, copyWithinServer, getShareHash, listFileServerResources, normalizePath, SERVER_URL, SOURCE
} = require('../server/utils/fileServer');

const APPLY = process.argv.includes('--apply');
const LEGACY_ROOT = '/boteco-legacy';

// URLs de arquivo no formato antigo (qualquer domínio + /files/...), incluindo redirect de login e ?token=...
const LEGACY_URL_REGEX = /https?:\/\/[^\s"'<>()\\]+?\/files\/[^\s"'<>()\\]+/gi;

/**
 * Converte qualquer URL de formato legado no caminho dentro da fonte.
 * Apenas o script de migração precisa conhecer essas variações históricas.
 */
function legacyUrlToPath(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return null;
    let raw = fileUrl.trim().replace(/&amp;/g, '&').replace(/\\u0026/g, '&');

    try {
        let decoded = raw;
        try { decoded = decodeURIComponent(raw); } catch (e) {}

        const idx = decoded.indexOf('/files/');
        if (idx !== -1) {
            let rel = decoded.substring(idx + '/files/'.length).split(/[?#&"'\s]/)[0];
            if (rel.startsWith(`${SOURCE}/`)) rel = rel.substring(SOURCE.length + 1);
            return normalizePath(rel);
        }

        if (decoded.startsWith('/') && !decoded.startsWith('//')) {
            return normalizePath(decoded.split(/[?#&"'\s]/)[0]);
        }
    } catch (e) {
        return null;
    }
    return null;
}

function cleanFilename(name) {
    if (!name) return '';
    return name.replace(/^\d+-([a-f0-9]+-)?/i, '').toLowerCase();
}

async function getMediaColumns() {
    const [cols] = await sequelize.query(`
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'json')
    `);
    return cols;
}

// Índice nome-do-arquivo -> [caminhos] e nome-limpo -> [caminhos] de todo o /boteco-legacy
async function buildLegacyIndex(dir = LEGACY_ROOT, index = { exact: new Map(), clean: new Map() }) {
    const data = await listFileServerResources(dir);
    if (!data) return index;

    for (const f of data.files || []) {
        const full = `${dir}/${f.name}`;
        
        // Índice exato
        if (!index.exact.has(f.name)) index.exact.set(f.name, []);
        index.exact.get(f.name).push(full);

        // Índice sem prefixo de timestamp
        const clean = cleanFilename(f.name);
        if (clean) {
            if (!index.clean.has(clean)) index.clean.set(clean, []);
            index.clean.get(clean).push(full);
        }
    }

    for (const d of data.folders || []) {
        await buildLegacyIndex(`${dir}/${d.name}`, index);
    }
    return index;
}

async function ensureFile(filePath, cache, report, legacyIndex) {
    if (cache.has(filePath)) return cache.get(filePath);

    let ok = false;
    if (await fileExists(filePath)) {
        ok = true;
        report.alreadyThere.push(filePath);
    } else {
        const base = path.posix.basename(filePath);
        const exact = `${LEGACY_ROOT}${filePath}`;
        
        let source = null;
        // 1. Caminho exato no boteco-legacy
        const exactMatches = legacyIndex.exact.get(base) || [];
        if (exactMatches.includes(exact)) {
            source = exact;
        } else if (exactMatches.length > 0) {
            source = exactMatches[0];
        } else {
            // 2. Busca por nome limpo (sem prefixo timestamp)
            const clean = cleanFilename(base);
            const cleanMatches = legacyIndex.clean.get(clean) || [];
            if (cleanMatches.length > 0) {
                // Prioriza correspondência na mesma pasta pai se possível
                const parentDirName = path.posix.basename(path.posix.dirname(filePath));
                const sameFolder = cleanMatches.find(p => p.includes(`/${parentDirName}/`));
                source = sameFolder || cleanMatches[0];
            }
        }

        if (!source) {
            report.missing.push(filePath);
        } else if (APPLY) {
            try {
                await copyWithinServer(source, filePath);
                ok = true;
                report.copied.push(`${source} -> ${filePath}`);
            } catch (e) {
                report.errors.push(`${source} -> ${filePath}: ${e.response ? e.response.status : e.message}`);
            }
        } else {
            ok = true; // simulação: copiaria
            report.copied.push(`${source} -> ${filePath} (simulado)`);
        }
    }
    cache.set(filePath, ok);
    return ok;
}

async function run() {
    console.log('========================================================');
    console.log(' MIGRAÇÃO DE URLS -> FILEBROWSER QUANTUM');
    console.log(` Servidor: ${SERVER_URL} | Fonte: ${SOURCE}`);
    console.log(` Modo: ${APPLY ? 'APLICAR (altera banco e arquivos)' : 'SIMULAÇÃO (nada é alterado)'}`);
    console.log('========================================================\n');

    const hash = await getShareHash();
    console.log(`Compartilhamento público: ${hash}`);
    const legacyIndex = await buildLegacyIndex();
    console.log(`Arquivos indexados em ${LEGACY_ROOT}: ${[...legacyIndex.exact.values()].flat().length}\n`);

    const report = { alreadyThere: [], copied: [], missing: [], errors: [], rowsUpdated: 0, urlsRewritten: 0 };
    const fileCache = new Map();
    const columns = await getMediaColumns();

    for (const { TABLE_NAME: table, COLUMN_NAME: column } of columns) {
        let rows;
        try {
            [rows] = await sequelize.query(
                `SELECT \`${column}\` AS val FROM \`${table}\` WHERE \`${column}\` LIKE '%/files/%' OR \`${column}\` LIKE '%redirect=%'`
            );
        } catch (e) { continue; }
        if (!rows.length) continue;

        for (const { val } of rows) {
            if (typeof val !== 'string') continue;
            const matches = [...new Set(val.match(LEGACY_URL_REGEX) || [])];
            if (!matches.length) continue;

            let newVal = val;
            for (const oldUrl of matches) {
                const filePath = legacyUrlToPath(oldUrl);
                if (!filePath || filePath === '/') continue;

                await ensureFile(filePath, fileCache, report, legacyIndex);
                const newUrl = await buildPublicUrl(filePath);
                newVal = newVal.split(oldUrl).join(newUrl);
                report.urlsRewritten++;
                console.log(`[${table}.${column}] ${oldUrl}\n    -> ${newUrl}`);
            }

            if (newVal !== val) {
                report.rowsUpdated++;
                if (APPLY) {
                    await sequelize.query(
                        `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${column}\` = ?`,
                        { replacements: [newVal, val] }
                    );
                }
            }
        }
    }

    const reportPath = path.join(__dirname, `migration_report_${APPLY ? 'apply' : 'dryrun'}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n========================================================');
    console.log(` URLs reescritas:          ${report.urlsRewritten}`);
    console.log(` Registros atualizados:    ${report.rowsUpdated}${APPLY ? '' : ' (simulado)'}`);
    console.log(` Arquivos já no lugar:     ${report.alreadyThere.length}`);
    console.log(` Arquivos copiados:        ${report.copied.length}${APPLY ? '' : ' (simulado)'}`);
    console.log(` Arquivos NÃO encontrados: ${report.missing.length}`);
    console.log(` Erros:                    ${report.errors.length}`);
    console.log(` Relatório: ${reportPath}`);
    if (!APPLY) console.log('\n Para aplicar de verdade: node scripts/migrateFileServer.js --apply');
    console.log('========================================================\n');
    process.exit(0);
}

run().catch(err => {
    console.error('Erro crítico na migração:', err.response ? err.response.data : err);
    process.exit(1);
});
