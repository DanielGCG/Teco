/**
 * Friendship API - Funções compartilhadas para operações de amizade
 * Reutilizável em DMs, Lista de Amigos, Perfil, etc.
 */

const FriendshipAPI = (() => {
    // Envia um pedido de amizade
    async function enviarPedido(userId, options = {}) {
        const {
            onSuccess = null,
            onError = null,
            showAlert = true
        } = options;

        try {
            const res = await fetch('/amigos/api/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ addressee_id: userId })
            });

            const data = await res.json();
            
            if (res.ok) {
                if (showAlert) alert('Pedido de amizade enviado!');
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao enviar pedido:', err);
            if (showAlert) alert('Erro ao enviar pedido de amizade');
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Aceita um pedido de amizade
    async function aceitarPedido(friendshipId, options = {}) {
        const {
            onSuccess = null,
            onError = null,
            showAlert = true
        } = options;

        try {
            const res = await fetch(`/amigos/api/accept/${friendshipId}`, {
                method: 'PUT',
                credentials: 'include'
            });

            const data = await res.json();
            
            if (res.ok) {
                if (showAlert) alert('Pedido aceito!');
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao aceitar pedido:', err);
            if (showAlert) alert('Erro ao aceitar pedido');
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Rejeita um pedido de amizade
    async function rejeitarPedido(friendshipId, options = {}) {
        const {
            onSuccess = null,
            onError = null,
            showAlert = true,
            confirmMessage = 'Tem certeza que deseja rejeitar este pedido?'
        } = options;

        if (confirmMessage && !confirm(confirmMessage)) {
            return { success: false, cancelled: true };
        }

        try {
            const res = await fetch(`/amigos/api/reject/${friendshipId}`, {
                method: 'PUT',
                credentials: 'include'
            });

            const data = await res.json();
            
            if (res.ok) {
                if (showAlert) alert('Pedido rejeitado');
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao rejeitar pedido:', err);
            if (showAlert) alert('Erro ao rejeitar pedido');
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Cancela um pedido de amizade enviado
    async function cancelarPedido(friendshipId, options = {}) {
        const {
            onSuccess = null,
            onError = null,
            showAlert = true,
            confirmMessage = 'Tem certeza que deseja cancelar este pedido?'
        } = options;

        if (confirmMessage && !confirm(confirmMessage)) {
            return { success: false, cancelled: true };
        }

        try {
            const res = await fetch(`/amigos/api/cancel/${friendshipId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await res.json();
            
            if (res.ok) {
                if (showAlert) alert('Pedido cancelado');
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao cancelar pedido:', err);
            if (showAlert) alert('Erro ao cancelar pedido');
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Remove um amigo
    async function removerAmigo(userId, options = {}) {
        const {
            onSuccess = null,
            onError = null,
            showAlert = true,
            confirmMessage = 'Tem certeza que deseja remover este amigo?'
        } = options;

        if (confirmMessage && !confirm(confirmMessage)) {
            return { success: false, cancelled: true };
        }

        try {
            const res = await fetch(`/amigos/api/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await res.json();
            
            if (res.ok) {
                if (showAlert) alert('Amigo removido');
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao remover amigo:', err);
            if (showAlert) alert('Erro ao remover amigo');
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Verifica o status de amizade com um usuário
    async function verificarStatus(userId) {
        try {
            const res = await fetch(`/amigos/api/check/${userId}`, { 
                credentials: 'include' 
            });
            const data = await res.json();
            return { success: true, status: data.status };
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao verificar status:', err);
            return { success: false, error: err };
        }
    }

    // Carrega lista de amigos
    async function carregarAmigos() {
        try {
            const res = await fetch('/amigos/api/', { credentials: 'include' });
            if (!res.ok) throw new Error('Erro ao carregar amigos');
            const data = await res.json();
            return { success: true, friends: data.friends || [] };
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao carregar amigos:', err);
            return { success: false, error: err, friends: [] };
        }
    }

    // Carrega pedidos recebidos
    async function carregarPedidosRecebidos() {
        try {
            const res = await fetch('/amigos/api/requests', { credentials: 'include' });
            if (!res.ok) throw new Error('Erro ao carregar pedidos');
            const data = await res.json();
            return { success: true, requests: data.requests || [] };
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao carregar pedidos:', err);
            return { success: false, error: err, requests: [] };
        }
    }

    // Carrega pedidos enviados
    async function carregarPedidosEnviados() {
        try {
            const res = await fetch('/amigos/api/sent', { credentials: 'include' });
            if (!res.ok) throw new Error('Erro ao carregar pedidos enviados');
            const data = await res.json();
            return { success: true, sent: data.sent || [] };
        } catch (err) {
            console.error('[FriendshipAPI] Erro ao carregar pedidos enviados:', err);
            return { success: false, error: err, sent: [] };
        }
    }

    // API pública
    return {
        enviarPedido,
        aceitarPedido,
        rejeitarPedido,
        cancelarPedido,
        removerAmigo,
        verificarStatus,
        carregarAmigos,
        carregarPedidosRecebidos,
        carregarPedidosEnviados
    };
})();

// Exporta para uso global
if (typeof window !== 'undefined') {
    window.FriendshipAPI = FriendshipAPI;
}
