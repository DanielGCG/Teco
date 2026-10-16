const { createUploadTicket } = require('./fileServer');
const { sanitizeFilename } = require('./sanitize');

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv|avi|mpg|mpeg)$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|aac)$/i;

const MB = 1024 * 1024;

/**
 * Valida os metadados do arquivo e emite um ticket para upload direto ao servidor de arquivos.
 * Retorna { status, body } pronto para responder.
 */
function issueMediaTicket({ name, type, size, folder, allowAudio = false, videoLimitMB = 500, otherLimitMB = 500 }) {
    const mime = String(type || '');
    const filename = sanitizeFilename(String(name || ''));
    const fileSize = Number(size);

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
        return { status: 400, body: { success: false, error: 'Tamanho do arquivo inválido.' } };
    }

    const isVideo = mime.startsWith('video/') || VIDEO_EXT.test(filename);
    const isAudio = mime.startsWith('audio/') || AUDIO_EXT.test(filename);
    const isImage = mime.startsWith('image/');

    if (!isVideo && !isImage && !(allowAudio && isAudio)) {
        return { status: 400, body: { success: false, error: 'Tipo de arquivo não permitido.' } };
    }

    const limitMB = isVideo ? videoLimitMB : otherLimitMB;
    if (fileSize > limitMB * MB) {
        return { status: 413, body: { success: false, error: `Arquivo muito grande. Limite: ${limitMB}MB` } };
    }

    const mimePrefixes = isVideo ? ['video/', 'application/octet-stream']
        : isAudio ? ['audio/', 'application/octet-stream']
        : ['image/', 'application/octet-stream'];

    const { uploadUrl, expiresAt } = createUploadTicket({
        folder,
        filename,
        maxBytes: limitMB * MB,
        mimePrefixes
    });

    const mediaType = isVideo ? 'video' : isAudio ? 'audio' : 'image/gif';
    return { status: 200, body: { success: true, uploadUrl, expiresAt, mediaType, filename } };
}

module.exports = { issueMediaTicket };
