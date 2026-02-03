/**
 * User Context - Gerencia as informações do usuário logado no frontend
 * Recupera dados do cookie 'teco_user' de forma síncrona
 */

window.UserContext = (() => {
    let currentUser = null;

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    function init() {
        let cookieValue = getCookie('teco_user');
        if (cookieValue) {
            try {
                // 1. Limpa o valor do cookie (remove aspas e espaços)
                cookieValue = decodeURIComponent(cookieValue).replace(/^"|"$/g, '').trim();

                // 2. Decodifica Base64 para string binária
                const binaryString = atob(cookieValue);
                
                // 3. Converte string binária para bytes e depois para UTF-8
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decoded = new TextDecoder().decode(bytes);

                currentUser = JSON.parse(decoded);
                window.currentUser = currentUser;
                console.log('[UserContext] Usuário carregado do cookie:', currentUser.username);
            } catch (e) {
                console.error('[UserContext] Erro ao decodificar cookie de usuário:', e);
                // Se falhar, tenta limpar o cookie malformado
                document.cookie = "teco_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            }
        } else {
            console.warn('[UserContext] Cookie teco_user não encontrado.');
        }
    }

    // Inicializa imediatamente
    init();

    return {
        get: () => currentUser,
        isLoggedIn: () => !!currentUser,
        isAdmin: () => currentUser && currentUser.roleId <= 5,
        refresh: async () => {
            try {
                const res = await fetch('/api/users/me');
                if (res.ok) {
                    currentUser = await res.json();
                    window.currentUser = currentUser;
                    return currentUser;
                }
            } catch (e) {
                console.error('[UserContext] Erro ao atualizar usuário:', e);
            }
            return null;
        },
        logout: async () => {
            try {
                const res = await fetch('/api/users/logout', { method: 'POST' });
                if (res.ok) {
                    window.location.href = '/login';
                }
            } catch (e) {
                console.error('[UserContext] Erro ao fazer logout:', e);
            }
        }
    };
})();
