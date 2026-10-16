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
                try {
                    result = JSON.parse(xhr.responseText);
                } catch (error) {
                    const responseText = xhr.responseText ? ` ${xhr.responseText.slice(0, 200)}` : '';
                    reject(new Error(`Servidor de arquivos respondeu HTTP ${xhr.status}.${responseText}`));
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 300 && result.url) resolve(result.url);
                else reject(new Error(
                    result.error || result.message || `Falha no upload (HTTP ${xhr.status}).`
                ));
            };
            xhr.onerror = () => reject(new Error(
                'Não foi possível conectar ao servidor de arquivos. Verifique a URL pública, HTTPS e CORS.'
            ));
            const body = new FormData();
            body.append('file', file);
            xhr.send(body);
        });
    }

    window.directUpload = directUpload;
})();
