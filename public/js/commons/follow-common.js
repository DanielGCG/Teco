/**
 * Follow API - Funções compartilhadas para operações de seguir/seguidores
 */

const FollowAPI = (() => {
    // Seguir um usuário
    async function seguir(userId, options = {}) {
        const { onSuccess = null, onError = null, showAlert = true } = options;
        try {
            const res = await fetch(`/api/follows/${userId}`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FollowAPI] Erro ao seguir:', err);
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Deixar de seguir um usuário
    async function deixarDeSeguir(userId, options = {}) {
        const { onSuccess = null, onError = null, showAlert = true, confirmMessage = 'Deseja parar de seguir este usuário?' } = options;
        if (confirmMessage && !confirm(confirmMessage)) return { success: false, cancelled: true };
        try {
            const res = await fetch(`/api/follows/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                if (onSuccess) await onSuccess(data);
                return { success: true, data };
            } else {
                if (showAlert) alert(data.message);
                if (onError) onError(data);
                return { success: false, data };
            }
        } catch (err) {
            console.error('[FollowAPI] Erro ao deixar de seguir:', err);
            if (onError) onError(err);
            return { success: false, error: err };
        }
    }

    // Verificar status de seguimento
    async function verificarStatus(userId) {
        try {
            const res = await fetch(`/api/follows/status/${userId}`, { credentials: 'include' });
            return await res.json();
        } catch (err) {
            console.error('[FollowAPI] Erro ao verificar status:', err);
            return null;
        }
    }

    // Listar amigos (seguidores mútuos)
    async function carregarAmigos(userId = null) {
        try {
            const url = userId ? `/api/friends/user/${userId}` : '/api/friends';
            const res = await fetch(url, { credentials: 'include' });
            const data = await res.json();
            return data.friends || [];
        } catch (err) {
            console.error('[FollowAPI] Erro ao carregar amigos:', err);
            return [];
        }
    }

    return {
        seguir,
        deixarDeSeguir,
        verificarStatus,
        carregarAmigos
    };
})();
