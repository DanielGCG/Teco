/**
 * UI Utilities - Funções compartilhadas para renderização de componentes
 * Reutilizável em DMs, Lista de Amigos, etc.
 */

if (typeof window.UIUtils !== 'undefined') {
    console.warn('[UIUtils] Já foi carregado anteriormente');
} else {
    window.UIUtils = (() => {
    // Retorna a cor do status do usuário ('online', 'ausente', 'offline')
    function getStatusColor(status) {
        switch(status) {
            case 'online': return '#28a745';    // Verde
            case 'ausente': return '#ffc107';   // Amarelo
            default: return '#6c757d';          // Cinza (offline)
        }
    }

    // Cria HTML do avatar com indicador de status
    function createAvatarWithStatus(user, size = 40) {
        if (!user) return `<div style="width:${size}px;height:${size}px;"></div>`;
        
        const profileImage = user.profileimage;
        const statusColor = getStatusColor(user.status || 'offline');
        
        return `
            <div class="position-relative" style="width:${size}px;height:${size}px;flex-shrink:0;align-self:flex-start;">
                <img src="${profileImage}" 
                     class="rounded" 
                     style="width:100%;height:100%;object-fit:cover;"
                     alt="${user.username}">
                <span class="position-absolute bottom-0 end-0 border border-white rounded-circle" 
                      style="width:${Math.round(size * 0.3)}px;height:${Math.round(size * 0.3)}px;background:${statusColor};"></span>
            </div>
        `;
    }

    // Cria um card de usuário genérico (types: 'conversation', 'friend', 'search')
    function createUserCard(user, options = {}) {
        const {
            type = 'conversation',
            avatarSize = 40,
            showUnreadBadge = true,
            actions = []
        } = options;

        const card = document.createElement('div');
        card.className = `card ${type === 'conversation' ? 'dm-card' : 'friend-card'}`;
        
        const badgeFriend = user.isFriend ? `<small class="badge bg-success ms-1">Amigo</small>` : '';
        const bioHtml = user.bio ? `<small class="text-muted d-block text-truncate">${user.bio}</small>` : '';
        const sinceHtml = user.friend_since ? `<br><small class="text-muted">Amigos desde ${formatarData(user.friend_since)}</small>` : '';

        if (type === 'conversation') {
            const unreadBadgeHtml = showUnreadBadge && user.unreadCount > 0 ? `<span class="unread-badge">${user.unreadCount}</span>` : '';
            card.innerHTML = `
                <div class="card-body d-flex gap-2 align-items-start">
                    ${createAvatarWithStatus(user, avatarSize)}
                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
                        <div class="d-flex justify-content-between align-items-start gap-1">
                            <a href="/${user.username}" class="text-decoration-none text-dark text-truncate">
                                <strong>${user.username}</strong>
                            </a>
                            ${unreadBadgeHtml}
                        </div>
                        <small class="text-muted text-truncate d-block" style="margin-top:0.25rem;">
                            ${user.lastMessage ?? 'Sem mensagens'}
                        </small>
                    </div>
                </div>
            `;
        } else {
            // Types 'friend' and 'search' simplificados
            card.innerHTML = `
                <div class="card-body d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-2" style="flex:1;min-width:0;">
                        ${createAvatarWithStatus(user, avatarSize)}
                        <div style="flex:1;min-width:0;">
                            <div class="d-flex align-items-center">
                                <a href="/${user.username}" class="text-decoration-none text-dark text-truncate">
                                    <h6 class="mb-0 fw-bold">${user.username}</h6>
                                </a>
                                ${badgeFriend}
                            </div>
                            ${bioHtml}
                            ${sinceHtml}
                        </div>
                    </div>
                    <div class="action-buttons d-flex gap-2"></div>
                </div>
            `;
            
            if (actions.length > 0) {
                const actionsDiv = card.querySelector('.action-buttons');
                actions.forEach(action => actionsDiv.appendChild(action));
            }
        }
        
        return card;
    }

    // Atualiza o status indicator de um usuário em todos os cards e elementos
    function updateUserStatus(userId, status) {
        if (!userId || !status) return;

        // 1. Atualiza indicadores em elementos que usam data-user-id (cards, itens de lista, etc)
        const userElements = document.querySelectorAll(`[data-user-id="${userId}"]`);
        userElements.forEach(el => {
            // Suporte para indicador via style (UIUtils.createAvatarWithStatus)
            const indicator = el.querySelector('.position-absolute.rounded-circle');
            if (indicator) {
                indicator.style.background = getStatusColor(status);
            }

            // Suporte para indicador via classe (ex: .status-dot em profile.ejs)
            const dot = el.querySelector('.status-dot');
            if (dot) {
                dot.classList.remove('online', 'offline', 'ausente');
                dot.classList.add(status);
                dot.title = status.charAt(0).toUpperCase() + status.slice(1);
            }
        });
    }

    // Eventos globais de status
    document.addEventListener('user:statusChanged', (e) => {
        if (e.detail && e.detail.userId && e.detail.status) {
            updateUserStatus(e.detail.userId, e.detail.status);
        }
    });

    document.addEventListener('user:statusBatch', (e) => {
        if (e.detail && e.detail.statusMap) {
            Object.entries(e.detail.statusMap).forEach(([userId, status]) => {
                updateUserStatus(userId, status);
            });
        }
    });

    // Solicita o status de todos os usuários presentes na página
    function requestPageStatuses() {
        const socket = window.appSocket || (window.SocketConnector ? window.SocketConnector.getSocket() : null);
        if (!socket) return;

        const ids = [...new Set(
            [...document.querySelectorAll('[data-user-id]')]
                .map(el => el.getAttribute('data-user-id'))
                .filter(id => id && id !== 'null' && id !== 'undefined')
        )];

        if (ids.length > 0) {
            socket.emit('requestUserStatus', { userIds: ids });
        }
    }

    /**
     * Utilitários de Formatação e Componentes
     */
    function formatarData(dataISO) {
        if (!dataISO) return '-';
        try {
            const data = new Date(dataISO);
            const agora = new Date();
            const diffMs = agora - data;
            const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDias === 0) {
                return `Hoje às ${data.getHours().toString().padStart(2, '0')}:${data.getMinutes().toString().padStart(2, '0')}`;
            } else if (diffDias === 1) {
                return `Ontem às ${data.getHours().toString().padStart(2, '0')}:${data.getMinutes().toString().padStart(2, '0')}`;
            } else if (diffDias < 7) {
                return `${diffDias} dias atrás`;
            } else {
                return data.toLocaleDateString('pt-BR');
            }
        } catch (e) {
            return dataISO;
        }
    }

    function createActionButton(options) {
        const { icon, text, variant = 'primary', size = 'sm', onClick, className = '' } = options;
        const btn = document.createElement('button');
        btn.className = `btn btn-${variant} btn-${size} ${className}`;
        btn.innerHTML = icon ? `<i class="${icon}"></i> ${text || ''}` : text;
        if (onClick) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                onClick(e);
            });
        }
        return btn;
    }

    function createActionLink(options) {
        const { icon, text, href = '#', variant = 'primary', size = 'sm', className = '' } = options;
        const a = document.createElement('a');
        a.href = href;
        a.className = `btn btn-${variant} btn-${size} ${className}`;
        a.innerHTML = icon ? `<i class="${icon}"></i> ${text || ''}` : text;
        return a;
    }

    // Inicialização automática para o usuário logado
    function initLoggedUserStatus() {
        const user = window.UserContext ? window.UserContext.get() : null;
        if (user && user.publicid) {
            // Garantimos que o próprio usuário sempre apareça online para si mesmo se estiver conectado
            updateUserStatus(user.publicid, 'online');
        }
    }

    // Tentar inicializar após um breve delay para garantir que o DOM e Contexto estejam prontos
    setTimeout(initLoggedUserStatus, 500);

    // API pública
    return {
        getStatusColor,
        createAvatarWithStatus,
        createUserCard,
        updateUserStatus,
        requestPageStatuses,
        formatarData,
        createActionButton,
        createActionLink
    };
    })();
}
