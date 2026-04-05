/**
 * Utilitários de Posts para o tema Retrô
 * Unifica a renderização de feeds e posts entre index e perfil
 */

const RetroPosts = {
    renderPost: function(post, currentUsername) {
        const date = new Date(post.createdat).toLocaleString();
        
        // Renderizar múltiplas imagens/vídeos
        let mediaHtml = '';
        if (post.media && post.media.length > 0) {
            mediaHtml = '<div style="margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;">';
            post.media.forEach(m => {
                const borderStyle = 'border: 1px dashed var(--retro-border-dark);';
                if (m.type === 'video') {
                    mediaHtml += `<video src="${m.url}" style="max-width: 250px; ${borderStyle} object-fit: cover;" controls></video>`;
                } else {
                    mediaHtml += `<img src="${m.url}" style="max-width: 250px; ${borderStyle} cursor: pointer; object-fit: cover;" onclick="window.open('${m.url}')">`;
                }
            });
            mediaHtml += '</div>';
        }

        // Renderizar Repost/Citação
        let repostHtml = '';
        if ((post.type === 'repost' || post.type === 'reply') && post.parent) {
            const p = post.parent;
            const pDate = new Date(p.createdat).toLocaleString();
            let pMediaHtml = '';
            if (p.media && p.media.length > 0) {
                pMediaHtml = `<div style="margin-top: 5px;"><img src="${p.media[0].url}" style="max-width: 150px; border: 1px dashed var(--retro-border-dark); object-fit: cover;"></div>`;
            }
            
            repostHtml = `
                <div style="margin: 10px 0; padding: 10px; border: 1px dashed var(--retro-border-dark); background: var(--retro-sidebar-bg); font-size: 11px;">
                    <strong style="cursor: pointer;" onclick="window.location.href='/${p.author.username}'">${p.author.username}</strong> em ${pDate}
                    <div style="margin-top: 5px;">${p.content || ''}</div>
                    ${pMediaHtml}
                    <div style="margin-top: 5px;"><a href="/${p.author.username}/status/${p.publicid}">[Ver Original]</a></div>
                </div>
            `;
        }
        
        const isAuthor = post.author.username === currentUsername;
        const deleteBtn = isAuthor ? `<a href="javascript:void(0)" onclick="handleRetroDelete('${post.publicid}')" style="color: red;">[DELETAR]</a>` : '';

        return `
            <div class="feed-post" id="post-${post.publicid}" style="border-bottom: 1px solid var(--retro-border-light); padding-bottom: 10px; margin-bottom: 15px;">
                <div style="margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                    <img src="${post.author.profileimage}" style="width: 32px; height: 32px; border: 1px solid var(--retro-border-dark); object-fit: cover; cursor: pointer;" onclick="window.location.href='/${post.author.username}'">
                    <div>
                        <strong class="post-author" style="cursor: pointer;" onclick="window.location.href='/${post.author.username}'">${post.author.username}</strong>
                        <div style="font-size: 10px; color: var(--retro-border-dark);">${date}</div>
                    </div>
                </div>
                <div style="word-wrap: break-word; margin: 10px 0; line-height: 1.4;">${post.content || ''}</div>
                ${repostHtml}
                ${mediaHtml}
                <div style="margin-top: 10px; font-size: 11px; border-top: 1px dashed var(--retro-border-dark); padding-top: 5px; display: flex; gap: 15px; align-items: center;">
                    <a href="/${post.author.username}/status/${post.publicid}" style="font-weight: bold;">[ABRIR POST]</a>
                    <a href="javascript:void(0)" onclick="handleRetroLike('${post.publicid}')" style="color: var(--retro-link-hover);">[CURTIR]</a>
                    <a href="javascript:void(0)" onclick="handleRetroRepost('${post.publicid}')" style="color: var(--retro-header-bg);">[REPOSTAR]</a>
                    ${deleteBtn}
                    <span style="margin-left: auto;"></b>Curtidas: <b>${post.likecount || 0}</b> | Comentários: <b>${post.replycount || 0}</b> | Reposts: <b>${post.repostcount || 0}</span>
                </div>
            </div>
        `;
    },

    /**
     * Handlers globais para ações de post (Delete, Like, Repost)
     * Estes devem ser disparados por window.handleRetro...
     */
    initHandlers: function(callbackReload) {
        window.handleRetroDelete = async (postId) => {
            const confirm = await window.confirmRetro('Tem certeza que deseja apagar esta mensagem permanentemente?', 'Confirmar Exclusão');
            if (!confirm) return;
            try {
                const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
                if (res.ok) {
                    document.getElementById(`post-${postId}`)?.remove();
                }
            } catch (e) { console.error(e); }
        };

        window.handleRetroLike = async (postId) => {
            try {
                const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
                if (res.ok && callbackReload) callbackReload();
            } catch (e) { console.error(e); }
        };

        window.handleRetroRepost = async (postId) => {
            const confirmed = await window.confirmRetro('Deseja compartilhar este post em seu perfil?', 'Repostar');
            if (!confirmed) return;
            try {
                const res = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'repost', attachedPostPublicId: postId })
                });
                if (res.ok) {
                    if (callbackReload) callbackReload();
                }
            } catch (e) { console.error(e); }
        };
    }
};