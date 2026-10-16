const axios = require('axios');
const crypto = require('crypto');


const SERVER_URL = process.env.SERVIDORDEARQUIVOS_URL;
const API_KEY = process.env.SERVIDORDEARQUIVOS_KEY;

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

function getPublicUrl() {
    return (SERVER_URL || '').replace(/\/+$/, '');
}

/**
 * Emite um ticket de upload direto (navegador -> servidor de arquivos).
 * O chamador deve ter autenticado o usuário e validado permissão/tipo/tamanho antes.
 * Formato espelhado em servidor-de-arquivos/src/auth.js
 */
function createUploadTicket({ folder, filename, maxBytes, size, mimePrefixes = [], ttlMs = 10 * 60 * 1000 }) {
    if (!SERVER_URL || !API_KEY) {
        throw new Error('Configuração do servidor de arquivos ausente no .env');
    }
    const publicUrl = getPublicUrl();
    const payload = {
        f: folder || '',
        n: filename,
        m: maxBytes,
        s: Number.isFinite(Number(size)) ? Number(size) : undefined,
        t: mimePrefixes,
        e: Date.now() + ttlMs,
        j: crypto.randomBytes(12).toString('hex')
    };
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', API_KEY + ':upload-ticket').update(b64).digest('base64url');
    const ticket = `${b64}.${sig}`;
    return {
        ticket,
        uploadUrl: `${publicUrl}/upload-direct?ticket=${encodeURIComponent(ticket)}`,
        expiresAt: payload.e
    };
}

module.exports = {
    createUploadTicket,
    getPublicUrl,
    deleteFromFileServer
};
