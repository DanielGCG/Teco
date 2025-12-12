/**
 * Socket.IO Connection Manager
 * Gerencia conexão Socket.IO com reconexão automática
 */

const SocketConnector = (() => {
    let socket = null;
    let reconnectHandlers = [];

    // Inicializa conexão Socket.IO
    function init() {
        if (socket) return socket;

        socket = io({
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        // Eventos de conexão
        socket.on('connect', () => {
            console.log('[Socket] Conectado:', socket.id);
            
            // Executa handlers de reconexão
            reconnectHandlers.forEach(handler => handler());
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Desconectado:', reason);
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('[Socket] Reconectado após', attemptNumber, 'tentativas');
            
            // Executa handlers de reconexão
            reconnectHandlers.forEach(handler => handler());
        });

        socket.on('reconnect_attempt', (attemptNumber) => {
            console.log('[Socket] Tentativa de reconexão', attemptNumber);
        });

        socket.on('reconnect_error', (error) => {
            console.error('[Socket] Erro de reconexão:', error);
        });

        socket.on('reconnect_failed', () => {
            console.error('[Socket] Falha ao reconectar');
        });

        return socket;
    }

    // Adiciona handler para ser executado ao conectar/reconectar
    function onReconnect(handler) {
        if (typeof handler === 'function') {
            reconnectHandlers.push(handler);
            
            // Se já está conectado, executa imediatamente
            if (socket && socket.connected) {
                handler();
            }
        }
    }

    // Remove handler de reconexão
    function offReconnect(handler) {
        reconnectHandlers = reconnectHandlers.filter(h => h !== handler);
    }

    // Limpa todos os handlers de reconexão
    function clearReconnectHandlers() {
        reconnectHandlers = [];
    }

    // Retorna o socket atual
    function getSocket() {
        return socket;
    }

    // Verifica se está conectado
    function isConnected() {
        return socket && socket.connected;
    }

    // API pública
    return {
        init,
        onReconnect,
        offReconnect,
        clearReconnectHandlers,
        getSocket,
        isConnected
    };
})();

// Exporta para uso global
if (typeof window !== 'undefined') {
    window.SocketConnector = SocketConnector;
}
