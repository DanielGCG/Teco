const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');


const SERVER_URL = process.env.SERVIDORDEARQUIVOS_URL;
const API_KEY = process.env.SERVIDORDEARQUIVOS_KEY;

async function uploadToFileServer({ buffer, filename, folder, mimetype }) {
    if (!SERVER_URL || !API_KEY) {
        console.error('[fileServer] Configurações ausentes: SERVIDORDEARQUIVOS_URL ou SERVIDORDEARQUIVOS_KEY');
        throw new Error('Configuração do servidor de arquivos ausente no .env');
    }
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimetype || 'application/octet-stream' });
    if (folder) form.append('folder', folder);
    const url = `${SERVER_URL}/upload${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`;

    try {
        const res = await axios.post(url, form, {
            headers: { ...form.getHeaders(), 'x-api-key': API_KEY },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        return res.data.url;
    } catch (err) {
        console.error(`[fileServer] Erro no upload: ${err.message}`);
        if (err.response) {
            console.error(`[fileServer] Status: ${err.response.status}`);
            console.error(`[fileServer] Resposta:`, err.response.data);
        }
        throw err;
    }
}

async function deleteFromFileServer(fileUrl) {
    if (!SERVER_URL || !API_KEY) return;
    try {
        // Extrai o caminho relativo a partir da URL do File Server
        const urlObj = new URL(fileUrl);
        let filepath = urlObj.pathname.replace(/^\/files\//, '');
        
        const deleteUrl = `${SERVER_URL}/delete`;
        await axios.delete(deleteUrl, {
            headers: { 'x-api-key': API_KEY },
            data: { filepath }
        });
        return true;
    } catch (err) {
        console.error(`[fileServer] Erro ao deletar: ${err.message}`);
        return false;
    }
}

// URL do servidor de arquivos acessível pelo navegador (pode diferir da URL interna usada pelo backend)
function getPublicUrl() {
    return (process.env.SERVIDORDEARQUIVOS_PUBLIC_URL || SERVER_URL || '').replace(/\/+$/, '');
}

/**
 * Emite um ticket de upload direto (navegador -> servidor de arquivos).
 * O chamador deve ter autenticado o usuário e validado permissão/tipo/tamanho antes.
 * Formato espelhado em servidor-de-arquivos/src/auth.js
 */
function createUploadTicket({ folder, filename, maxBytes, mimePrefixes = [], ttlMs = 10 * 60 * 1000 }) {
    if (!SERVER_URL || !API_KEY) {
        throw new Error('Configuração do servidor de arquivos ausente no .env');
    }
    const payload = {
        f: folder || '',
        n: filename,
        m: maxBytes,
        t: mimePrefixes,
        e: Date.now() + ttlMs,
        j: crypto.randomBytes(12).toString('hex')
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', API_KEY + ':upload-ticket').update(b64).digest('base64url');
    const ticket = `${b64}.${sig}`;
    return {
        ticket,
        uploadUrl: `${getPublicUrl()}/upload-direct?ticket=${encodeURIComponent(ticket)}`,
        expiresAt: payload.e
    };
}

module.exports = {
    createUploadTicket,
    getPublicUrl,
    uploadToFileServer,
    deleteFromFileServer
};
