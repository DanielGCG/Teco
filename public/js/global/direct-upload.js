(function () {
    const CHUNK_SIZE = 8 * 1024 * 1024;
    const MAX_CHUNK_ATTEMPTS = 3;

    async function directUpload(file, { folder, ticketEndpoint = '/api/uploads/ticket', onProgress } = {}) {
        const ticketResponse = await fetch(ticketEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder, name: file.name, type: file.type, size: file.size })
        });
        const ticket = await ticketResponse.json().catch(() => ({}));
        if (!ticketResponse.ok || !ticket.uploadUrl) {
            throw new Error(ticket.error || ticket.message || 'Não foi possível iniciar o upload.');
        }

        return uploadInChunks(file, ticket.uploadUrl, onProgress);
    }

    async function uploadInChunks(file, uploadUrl, onProgress) {
        const separator = uploadUrl.includes('?') ? '&' : '?';
        const total = Math.ceil(file.size / CHUNK_SIZE);
        let uploaded = 0;

        for (let index = 0; index < total; index += 1) {
            const start = index * CHUNK_SIZE;
            const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
            const chunkUrl = `${uploadUrl}${separator}chunked=1&index=${index}&total=${total}`;
            const result = await uploadChunkWithRetry(chunk, chunkUrl, (loaded) => {
                    if (onProgress) onProgress(uploaded + loaded, file.size);
                });
            uploaded += chunk.size;
            if (onProgress) onProgress(uploaded, file.size);
            if (index === total - 1) {
                if (!result.url) throw new Error('Servidor de arquivos não retornou a URL do upload.');
                return result.url;
            }
        }

        throw new Error('Upload não foi finalizado.');
    }

    async function uploadChunkWithRetry(chunk, chunkUrl, onProgress) {
        let lastError;
        for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt += 1) {
            try {
                return await uploadRequest(chunk, chunkUrl, onProgress);
            } catch (error) {
                lastError = error;
                if (attempt < MAX_CHUNK_ATTEMPTS) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                }
            }
        }
        throw lastError;
    }

    function uploadRequest(bodyFile, uploadUrl, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl);
            xhr.upload.onprogress = event => {
                if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total);
            };
            xhr.onload = () => {
                let result = {};
                try {
                    result = JSON.parse(xhr.responseText);
                } catch (error) {
                    reject(new Error(`Servidor de arquivos respondeu HTTP ${xhr.status}.`));
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 300) resolve(result);
                else reject(new Error(result.error || result.message || `Falha no upload (HTTP ${xhr.status}).`));
            };
            xhr.onerror = () => reject(new Error('Não foi possível conectar ao servidor de arquivos.'));
            const form = new FormData();
            form.append('file', bodyFile);
            xhr.send(form);
        });
    }


    window.directUpload = directUpload;
})();
