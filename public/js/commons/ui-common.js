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
        
        const profileImage = user.profile_image || '/images/placeholder.png';
        const statusColor = getStatusColor(user.status || 'offline');
        const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
        
        return `
            <div class="position-relative" style="width:${size}px;height:${size}px;flex-shrink:0;align-self:flex-start;">
                ${profileImage && profileImage !== '/images/placeholder.png' ? 
                    `<img src="${profileImage}" 
                         class="rounded-circle" 
                         style="width:100%;height:100%;object-fit:cover;"
                         alt="${user.username}"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                     <div class="rounded-circle d-none" 
                          style="width:100%;height:100%;background:#6c757d;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">
                         ${initial}
                     </div>` :
                    `<div class="rounded-circle" 
                          style="width:100%;height:100%;background:#6c757d;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">
                         ${initial}
                     </div>`
                }
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
        
            if (type === 'conversation') {
                const unreadBadgeHtml = showUnreadBadge && user.unreadCount > 0
                    ? `<span class="unread-badge">${user.unreadCount}</span>`
                    : '';

                card.innerHTML = `
                    <div class="card dm-card">
                        <div class="card-body d-flex gap-2 align-items-start">
                            ${createAvatarWithStatus(user, avatarSize)}
                            <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
                                <div class="d-flex justify-content-between align-items-start gap-1">
                                    <strong class="text-truncate">${user.username}</strong>
                                    ${unreadBadgeHtml}
                                </div>
                                <small class="text-muted text-truncate d-block" style="margin-top:0.25rem;">
                                    ${user.lastMessage ?? 'Sem mensagens'}
                                </small>
                            </div>
                        </div>
                    </div>
                `;
            } else if (type === 'friend') {
            card.className = 'card friend-card';
            
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body d-flex align-items-center justify-content-between';
            
            const leftDiv = document.createElement('div');
            leftDiv.className = 'd-flex align-items-center gap-2';
            leftDiv.style.flex = '1';
            leftDiv.style.minWidth = '0';
            
            // Avatar
            const avatarDiv = document.createElement('div');
            avatarDiv.innerHTML = createAvatarWithStatus(user, avatarSize);
            
            // Info
            const infoDiv = document.createElement('div');
            infoDiv.style.flex = '1';
            infoDiv.style.minWidth = '0';
            
            const nameDiv = document.createElement('div');
            const nameEl = document.createElement('h6');
            nameEl.className = 'mb-0';
            nameEl.textContent = user.username;
            nameDiv.appendChild(nameEl);
            
            if (user.bio) {
                const bioEl = document.createElement('small');
                bioEl.className = 'text-muted d-block text-truncate';
                bioEl.textContent = user.bio;
                infoDiv.appendChild(bioEl);
            }
            
            if (user.friend_since) {
                const sinceEl = document.createElement('small');
                sinceEl.className = 'text-muted';
                sinceEl.textContent = `Amigos desde ${formatarData(user.friend_since)}`;
                const br = document.createElement('br');
                infoDiv.appendChild(br);
                infoDiv.appendChild(sinceEl);
            }
            
            infoDiv.insertBefore(nameDiv, infoDiv.firstChild);
            
            leftDiv.appendChild(avatarDiv);
            leftDiv.appendChild(infoDiv);
            
            cardBody.appendChild(leftDiv);
            
            // Ações
            if (actions.length > 0) {
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'action-buttons';
                actions.forEach(action => actionsDiv.appendChild(action));
                cardBody.appendChild(actionsDiv);
            }
            
            card.appendChild(cardBody);
        } else if (type === 'search') {
            card.className = 'card friend-card';
            
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body d-flex align-items-center justify-content-between';
            
            const leftDiv = document.createElement('div');
            leftDiv.className = 'd-flex align-items-center gap-2';
            leftDiv.style.flex = '1';
            
            // Avatar
            const avatarDiv = document.createElement('div');
            avatarDiv.innerHTML = createAvatarWithStatus(user, avatarSize);
            
            // Info
            const infoDiv = document.createElement('div');
            infoDiv.style.flex = '1';
            
            const nameEl = document.createElement('strong');
            nameEl.textContent = user.username;
            infoDiv.appendChild(nameEl);
            
            if (user.isFriend) {
                const badge = document.createElement('small');
                badge.className = 'badge bg-success ms-1';
                badge.textContent = 'Amigo';
                infoDiv.appendChild(badge);
            }
            
            leftDiv.appendChild(avatarDiv);
            leftDiv.appendChild(infoDiv);
            
            cardBody.appendChild(leftDiv);
            
            // Ações
            if (actions.length > 0) {
                const actionsDiv = document.createElement('div');
                actions.forEach(action => actionsDiv.appendChild(action));
                cardBody.appendChild(actionsDiv);
            }
            
            card.appendChild(cardBody);
        }
        
        return card;
    }

    // Atualiza o status indicator de um usuário em todos os cards
    function updateUserStatus(userId, status) {
        const cards = document.querySelectorAll(`[data-user-id="${userId}"]`);
        cards.forEach(card => {
            const indicator = card.querySelector('.position-absolute.rounded-circle');
            if (indicator) {
                indicator.style.background = getStatusColor(status);
            }
        });
    }

    // Formata data relativa (hoje, ontem, há X dias, etc)
    function formatarData(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'hoje';
        if (days === 1) return 'ontem';
        if (days < 7) return `há ${days} dias`;
        if (days < 30) return `há ${Math.floor(days / 7)} semanas`;
        if (days < 365) return `há ${Math.floor(days / 30)} meses`;
        return `há ${Math.floor(days / 365)} anos`;
    }

    // Cria botão de ação
    function createActionButton(config) {
        const {
            text = '',
            icon = '',
            variant = 'primary',
            size = 'sm',
            onClick = () => {},
            className = ''
        } = config;

        const btn = document.createElement('button');
        btn.className = `btn btn-${size} btn-${variant} ${className}`.trim();
        
        if (icon) {
            const iconEl = document.createElement('i');
            iconEl.className = icon;
            btn.appendChild(iconEl);
            if (text) btn.appendChild(document.createTextNode(' ' + text));
        } else {
            btn.textContent = text;
        }
        
        btn.addEventListener('click', onClick);
        return btn;
    }

    // Cria link de ação
    function createActionLink(config) {
        const {
            text = '',
            icon = '',
            href = '#',
            variant = 'primary',
            size = 'sm',
            className = ''
        } = config;

        const link = document.createElement('a');
        link.href = href;
        link.className = `btn btn-${size} btn-outline-${variant} ${className}`.trim();
        
        if (icon) {
            const iconEl = document.createElement('i');
            iconEl.className = icon;
            link.appendChild(iconEl);
            if (text) link.appendChild(document.createTextNode(' ' + text));
        } else {
            link.textContent = text;
        }
        
        return link;
    }

    // API pública
    return {
        getStatusColor,
        createAvatarWithStatus,
        createUserCard,
        updateUserStatus,
        formatarData,
        createActionButton,
        createActionLink
    };
    })();
}
