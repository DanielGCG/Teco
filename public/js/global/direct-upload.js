(function () {
    async function directUpload(file, { folder, onProgress } = {}) {
        const ticketResponse = await fetch('/api/uploads/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder, name: file.name, type: file.type, size: file.size })
        });
        const ticket = await ticketResponse.json().catch(() => ({}));
        if (!ticketResponse.ok || !ticket.uploadUrl) {
            throw new Error(ticket.error || ticket.message || 'Não foi possível iniciar o upload.');
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', ticket.uploadUrl);
            xhr.upload.onprogress = event => {
                if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total);
            };
            xhr.onload = () => {
                let result = {};
                try { result = JSON.parse(xhr.responseText); } catch (error) {
                    reject(new Error('Resposta inválida do servidor de arquivos.'));
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 300 && result.url) resolve(result.url);
                else reject(new Error(result.error || 'Falha no upload.'));
            };
            xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
            const body = new FormData();
            body.append('file', file);
            xhr.send(body);
        });
    }

    window.directUpload = directUpload;
})();
