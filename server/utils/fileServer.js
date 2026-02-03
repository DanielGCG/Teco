const axios = require('axios');
const FormData = require('form-data');


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

async function deleteFromFileServer({ fileUrl }) {
    if (!fileUrl) return;
    let relPath = fileUrl;
    // Remove domínio e /files/
    relPath = relPath.replace(/^https?:\/\/[^/]+\/files\//, '');
    // Remove query params (?token=...)
    relPath = relPath.split('?')[0];
    try {
        await axios.delete(`${SERVER_URL}/delete`, {
            data: { filepath: relPath },
            headers: { 'x-api-key': API_KEY }
        });
        return true;
    } catch (err) {
        // Log do erro para diagnóstico, mas não propague para evitar travar o fluxo
        console.warn(`[fileServer] Falha ao deletar arquivo remoto: ${relPath} - ${err.message}`);
        // Para debug mais profundo, inclua resposta quando disponível
        if (err.response) console.debug('[fileServer] response data:', err.response.data);
        return false;
    }
}

module.exports = {
    uploadToFileServer,
    deleteFromFileServer
};
