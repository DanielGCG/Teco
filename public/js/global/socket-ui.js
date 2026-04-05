/**
 * Sistema Unificado de UI Socket
 * Gerencia a atualização visual de elementos baseados em eventos de socket
 * (Status de usuários, notificações, contadores, etc.)
 */

const SocketUI = (() => {
    let socket = null;

    /**
     * Inicializa os listeners globais do socket
     */
    function init(appSocket) {
        socket = appSocket;
        if (!socket) return;

        // Listener para mudança de status de usuários
        socket.on('userStatusChanged', (data) => {
            updateUserStatus(data.userId, data.status);
        });

        // Listener para resposta em lote de status
        socket.on('userStatusResponse', (statusMap) => {
            for (const [publicid, status] of Object.entries(statusMap)) {
                updateUserStatus(publicid, status);
            }
        });

        // Listener para notificações (se houver elementos na página)
        socket.on('newNotification', (data) => {
            // Se existir uma função global de refresh de notificações, chama ela
            if (typeof window.refreshNotifications === 'function') {
                window.refreshNotifications(data);
            }
        });

        console.log('[SocketUI] Sistema unificado inicializado');
        
        // Se houver elementos de status na página ao carregar, solicita os status
        requestInitialStatus();
    }

    /**
     * Procura todos os elementos que precisam de status e solicita ao servidor
     */
    function requestInitialStatus() {
        const statusElements = document.querySelectorAll('[data-user-id]');
        const ids = new Set();
        statusElements.forEach(el => {
            const id = el.getAttribute('data-user-id');
            if (id && id !== 'null' && id !== 'undefined') ids.add(id);
        });

        if (ids.size > 0 && socket && socket.connected) {
            socket.emit('requestUserStatus', { userIds: Array.from(ids) });
        }
    }

    /**
     * Atualiza visualmente um elemento de status de usuário
     */
    function updateUserStatus(publicid, status) {
        // Encontra todos os elementos que representam este usuário
        const elements = document.querySelectorAll(`[data-user-id="${publicid}"]`);
        
        const colors = { online: '#00ff00', ausente: '#ffff00', offline: '#808080' };
        const labels = { online: 'Online', ausente: 'Ausente', offline: 'Offline' };

        elements.forEach(el => {
            // 1. Atualiza a bolinha de status (classe .status-dot)
            const dot = el.querySelector('.status-dot') || (el.classList.contains('status-dot') ? el : null);
            if (dot) {
                dot.style.background = colors[status] || colors.offline;
                // Também atualiza classes se necessário (para o perfil retrô)
                dot.classList.remove('online', 'ausente', 'offline');
                dot.classList.add(status);
            }

            // 2. Atualiza o texto de status (classe .status-text)
            const text = el.querySelector('.status-text');
            if (text) {
                text.textContent = labels[status] || labels.offline;
            }
            
            // 3. Caso o elemento seja uma imagem de perfil que deva ter borda de status
            if (el.classList.contains('profile-image-status')) {
                el.style.borderColor = colors[status] || colors.offline;
            }
        });
    }

    return {
        init,
        requestInitialStatus,
        updateUserStatus
    };
})();

// Inicialização automática se o script for carregado após o socket
document.addEventListener('DOMContentLoaded', () => {
    if (window.appSocket) {
        SocketUI.init(window.appSocket);
    }
});
