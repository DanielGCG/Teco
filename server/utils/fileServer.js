const axios = require('axios');
const crypto = require('crypto');

/**
 * Cliente do servidor de arquivos (FileBrowser Quantum - files.sitedoboteco.com.br)
 *
 * Interface pública mantida igual à do servidor antigo:
 *   uploadToFileServer({ buffer, filename, folder, mimetype }) -> Promise<string url>
 *   deleteFromFileServer(fileUrl)                              -> Promise<boolean>
 *
 * Como funciona:
 * - Escrita/remoção: API autenticada (/api/resources) com Bearer token, na fonte (source) "srv".
 * - Leitura pública: um compartilhamento (share) somente-leitura da raiz da fonte. As URLs salvas
 *   no banco apontam para /public/api/resources/download?hash=...&file=/pasta/arquivo&inline=true,
 *   que entrega os bytes com o Content-Type correto, sem login.
 */

const SERVER_URL = (process.env.SERVIDORDEARQUIVOS_URL || '').replace(/\/+$/, '');
const PUBLIC_URL = (process.env.SERVIDORDEARQUIVOS_PUBLIC_URL || SERVER_URL).replace(/\/+$/, '');
const API_KEY = process.env.SERVIDORDEARQUIVOS_KEY;
const SOURCE = process.env.SERVIDORDEARQUIVOS_SOURCE || 'srv';
let SHARE_HASH = process.env.SERVIDORDEARQUIVOS_SHARE_HASH || null;

const PUBLIC_DOWNLOAD_PATH = '/public/api/resources/download';

function authHeaders(extra = {}) {
    return { Authorization: `Bearer ${API_KEY}`, ...extra };
}

function ensureConfig() {
    if (!SERVER_URL || !API_KEY) {
        console.error('[fileServer] Configurações ausentes: SERVIDORDEARQUIVOS_URL ou SERVIDORDEARQUIVOS_KEY');
        throw new Error('Configuração do servidor de arquivos ausente no .env');
    }
}

/** Normaliza um caminho dentro da fonte: "/pasta/sub/arquivo.ext" */
function normalizePath(p) {
    return ('/' + String(p || '').replace(/\\/g, '/')).replace(/\/+/g, '/');
}

/** Codifica cada segmento do caminho preservando as barras (URL legível) */
function encodePath(p) {
    return normalizePath(p).split('/').map(encodeURIComponent).join('/');
}

/**
 * Obtém (ou cria, se não existir) o hash do compartilhamento público somente-leitura da raiz.
 */
async function getShareHash() {
    if (SHARE_HASH) return SHARE_HASH;
    ensureConfig();

    const { data } = await axios.get(`${SERVER_URL}/api/share/list`, { headers: authHeaders() });
    const existing = (data || []).find(s => s.path === '/' && s.source === SOURCE && !s.hasPassword);
    if (existing) {
        SHARE_HASH = existing.hash;
    } else {
        const created = await axios.post(`${SERVER_URL}/api/share`, {
            path: '/', source: SOURCE, expires: '', unit: 'days', password: '',
            title: 'Teco - arquivos públicos',
            allowCreate: false, allowDelete: false, allowModify: false, allowReplacements: false,
            disableAnonymous: false, disableDownload: false, quickDownload: true, keepAfterExpiration: true
        }, { headers: authHeaders() });
        SHARE_HASH = created.data.hash;
        console.log(`[fileServer] Compartilhamento público criado. Adicione ao .env: SERVIDORDEARQUIVOS_SHARE_HASH=${SHARE_HASH}`);
    }
    return SHARE_HASH;
}

/** Monta a URL pública (que vai para o banco) a partir do caminho na fonte */
async function buildPublicUrl(filePath) {
    const hash = await getShareHash();
    return `${PUBLIC_URL}${PUBLIC_DOWNLOAD_PATH}?hash=${hash}&file=${encodePath(filePath)}&inline=true`;
}

/**
 * Converte a URL pública no caminho dentro da fonte.
 * Suporta o formato oficial do FileBrowser Quantum:
 *  - https://files.../public/api/resources/download?hash=...&file=/profiles/a.png&inline=true
 *  - /public/api/resources/download?hash=...&file=/profiles/a.png
 *  - /profiles/a.png
 * Retorna "/profiles/a.png" ou null se não for uma URL válida.
 */
function urlToPath(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return null;
    const raw = fileUrl.trim().replace(/&amp;/g, '&').replace(/\\u0026/g, '&');

    try {
        if (raw.includes(PUBLIC_DOWNLOAD_PATH)) {
            const u = new URL(raw, PUBLIC_URL || 'https://files.sitedoboteco.com.br');
            const file = u.searchParams.get('file');
            return file ? normalizePath(file) : null;
        }

        if (raw.startsWith('/') && !raw.startsWith('//')) {
            return normalizePath(raw.split(/[?#]/)[0]);
        }
    } catch (e) {
        return null;
    }
    return null;
}

/** Gera nome único para nunca sobrescrever arquivos com o mesmo nome */
function uniqueName(filename) {
    const safe = String(filename || 'arquivo').replace(/[\/\\]/g, '_');
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`;
}

/**
 * Upload de arquivo.
 * @returns {Promise<string>} URL pública final do arquivo (salva no banco)
 */
async function uploadToFileServer({ buffer, filename, folder, mimetype }) {
    ensureConfig();

    const cleanFolder = folder ? String(folder).replace(/^\/+|\/+$/g, '') : '';

    // override=false: o servidor responde 409 se o caminho já existir -> geramos outro nome
    for (let attempt = 0; attempt < 5; attempt++) {
        const filePath = normalizePath(`${cleanFolder}/${uniqueName(filename)}`);
        const url = `${SERVER_URL}/api/resources?source=${encodeURIComponent(SOURCE)}&path=${encodeURIComponent(filePath)}&override=false`;

        try {
            await axios.post(url, buffer, {
                headers: authHeaders({ 'Content-Type': mimetype || 'application/octet-stream' }),
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            return await buildPublicUrl(filePath);
        } catch (err) {
            if (err.response && err.response.status === 409) continue; // colisão: tenta outro nome
            console.error(`[fileServer] Erro no upload: ${err.message}`);
            if (err.response) {
                console.error(`[fileServer] Status: ${err.response.status}`);
                console.error(`[fileServer] Resposta:`, err.response.data);
            }
            throw err;
        }
    }
    throw new Error('Não foi possível gerar um nome de arquivo único no servidor de arquivos');
}

/**
 * Remove um arquivo a partir da URL salva no banco (formato novo ou legado).
 */
async function deleteFromFileServer(fileUrl) {
    if (!SERVER_URL || !API_KEY) return false;
    const filePath = urlToPath(fileUrl);
    if (!filePath || filePath === '/') return false;

    try {
        await axios.delete(`${SERVER_URL}/api/resources?source=${encodeURIComponent(SOURCE)}&path=${encodeURIComponent(filePath)}`, {
            headers: authHeaders()
        });
        return true;
    } catch (err) {
        if (err.response && err.response.status === 404) return true; // já não existe
        console.error(`[fileServer] Erro ao deletar ${filePath}: ${err.message}`);
        return false;
    }
}

/** Lista um diretório da fonte. Retorna { folders: [], files: [] } ou null */
async function listFileServerResources(dirPath) {
    if (!SERVER_URL || !API_KEY) return null;
    try {
        const p = normalizePath(dirPath).replace(/\/?$/, '/');
        const { data } = await axios.get(`${SERVER_URL}/api/resources?source=${encodeURIComponent(SOURCE)}&path=${encodeURIComponent(p)}`, {
            headers: authHeaders()
        });
        return data;
    } catch (err) {
        return null;
    }
}

/** Verifica se um arquivo existe na fonte */
async function fileExists(filePath) {
    try {
        await axios.get(`${SERVER_URL}/api/resources?source=${encodeURIComponent(SOURCE)}&path=${encodeURIComponent(normalizePath(filePath))}&skipExtendedAttrs=true`, {
            headers: authHeaders()
        });
        return true;
    } catch (err) {
        return false;
    }
}

/** Copia um arquivo dentro da fonte (lado do servidor), criando as pastas necessárias */
async function copyWithinServer(fromPath, toPath) {
    ensureConfig();
    const from = normalizePath(fromPath);
    const to = normalizePath(toPath);

    try {
        const patchRes = await axios.patch(`${SERVER_URL}/api/resources`, {
            action: 'copy', overwrite: false, rename: false,
            items: [{ fromSource: SOURCE, fromPath: from, toSource: SOURCE, toPath: to }]
        }, { headers: authHeaders() });

        if (patchRes.data && Array.isArray(patchRes.data.failed) && patchRes.data.failed.length > 0) {
            throw new Error(patchRes.data.failed[0].message || 'Falha no copy da API');
        }
        return true;
    } catch (err) {
        // Fallback: baixa e reenvia (o upload cria as pastas pai automaticamente)
        const dl = await axios.get(`${SERVER_URL}/api/resources/download?source=${encodeURIComponent(SOURCE)}&file=${encodeURIComponent(from)}`, {
            headers: authHeaders(), responseType: 'arraybuffer'
        });
        await axios.post(`${SERVER_URL}/api/resources?source=${encodeURIComponent(SOURCE)}&path=${encodeURIComponent(to)}&override=false`, Buffer.from(dl.data), {
            headers: authHeaders({ 'Content-Type': 'application/octet-stream' }),
            maxContentLength: Infinity, maxBodyLength: Infinity
        });
        return true;
    }
}

module.exports = {
    uploadToFileServer,
    deleteFromFileServer,
    // utilitários (garbage collector / migração)
    urlToPath,
    buildPublicUrl,
    getShareHash,
    listFileServerResources,
    fileExists,
    copyWithinServer,
    normalizePath,
    SERVER_URL,
    PUBLIC_URL,
    SOURCE
};
