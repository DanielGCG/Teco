const axios = require('axios');
const FormData = require('form-data');


const SERVER_URL = process.env.SERVIDORDEARQUIVOS_URL;
const API_KEY = process.env.SERVIDORDEARQUIVOS_KEY;

async function uploadToFileServer({ buffer, filename, folder, mimetype }) {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimetype || 'application/octet-stream' });
    if (folder) form.append('folder', folder);
    const url = `${SERVER_URL}/upload${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`;
    const res = await axios.post(url, form, {
        headers: { ...form.getHeaders(), 'x-api-key': API_KEY },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });
    return res.data.url;
}

async function deleteFromFileServer({ fileUrl }) {
    if (!fileUrl) return;
    let relPath = fileUrl;
    // Remove domínio e /files/
    relPath = relPath.replace(/^https?:\/\/[^/]+\/files\//, '');
    // Remove query params (?token=...)
    relPath = relPath.split('?')[0];
    await axios.delete(`${SERVER_URL}/delete`, {
        data: { filepath: relPath },
        headers: { 'x-api-key': API_KEY }
    });
}

module.exports = {
    uploadToFileServer,
    deleteFromFileServer
};
