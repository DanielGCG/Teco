/**
 * Utilitários de Posts
 */

const RetroPosts = {
    renderPost: function(post, currentUsername, currentUserRole = 20) {
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
        const isMod = currentUserRole <= 10;
        const deleteBtn = (isAuthor || isMod) ? `<a href="javascript:void(0)" onclick="handleRetroDelete('${post.publicid}')" style="color: red;">[DELETAR]</a>` : '';

        return `
            <div class="feed-post" id="post-${post.publicid}" style="border-bottom: 1px solid var(--retro-border-light); padding-bottom: 10px; margin-bottom: 15px;">
                <div style="margin-bottom: 5px; display: flex; align-items: start; gap: 8px;">
                    <img src="${post.author.profileimage}" style="width: 32px; height: 32px; border: 1px solid var(--retro-border-dark); object-fit: cover; cursor: pointer;" onclick="window.location.href='/${post.author.username}'">
                    <div style="flex-grow: 1;">
                        <strong class="post-author" style="cursor: pointer;" onclick="window.location.href='/${post.author.username}'">${post.author.username}</strong>
                        <div style="font-size: 10px; color: var(--retro-border-dark);">${date}</div>
                    </div>
                    <div style="display: flex; gap: 5px; align-items: center; align-self: flex-start;">
                        ${deleteBtn}
                    </div>
                </div>
                <div style="word-wrap: break-word; margin: 10px 0; line-height: 1.4;">${post.content || ''}</div>
                ${repostHtml}
                ${mediaHtml}
                <div style="margin-top: 10px; font-size: 11px; border-top: 1px dashed var(--retro-border-dark); padding-top: 5px; display: flex; gap: 15px; align-items: center;">
                    <a href="/${post.author.username}/status/${post.publicid}" style="font-weight: bold;">[ABRIR POST]</a>
                    <a href="javascript:void(0)" onclick="handleRetroLike('${post.publicid}')" style="color: var(--retro-link-hover);">[CURTIR ${post.likecount || 0}]</a>
                    <a href="javascript:void(0)" onclick="handleRetroReply('${post.publicid}', '${post.author.username}')" style="color: var(--retro-header-bg);">[RESPONDER ${post.replycount || 0}]</a>
                    <a href="javascript:void(0)" onclick="handleRetroRepost('${post.publicid}')" style="color: #555;">[REPOSTAR ${post.repostcount || 0}]</a>
                    <a href="javascript:void(0)" onclick="handleRetroCopyLink('${post.author.username}', '${post.publicid}')" style="color: var(--retro-link);">[COPIAR LINK]</a>
                    <span style="margin-left: auto; color: #888; display: none;"></b>Curtidas: <b>${post.likecount || 0}</b> | Comentários: <b>${post.replycount || 0}</b> | Reposts: <b>${post.repostcount || 0}</span>
                </div>
            </div>
        `;
    },

    /**
     * Handlers globais para ações de post (Delete, Like, Repost)
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

        window.handleRetroReply = (postId, username) => {
            window.location.href = `/${username}/status/${postId}`;
        };

        window.handleRetroCopyLink = (username, postId) => {
            const url = `${window.location.origin}/${username}/status/${postId}`;
            navigator.clipboard.writeText(url).then(() => {
                alert('Link copiado para a área de transferência!');
            });
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
    },

    /**
     * Gerenciador de scroll infinito (Lazy Loading)
     */
    setupInfiniteScroll: function(containerId, fetchUrl, currentUsername) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let offset = 20;
        let limit = 20;
        let loading = false;
        let hasMore = true;

        // Criar o sensor de scroll ao final do container
        const sentinel = document.createElement('div');
        sentinel.id = `sentinel-${containerId}`;
        sentinel.style.padding = '20px 0';
        sentinel.innerHTML = '<p style="text-align: center; color: #888; font-size: 11px;">Carregando mais posts...</p>';
        container.after(sentinel);

        const observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && !loading && hasMore) {
                loading = true;
                const msg = sentinel.querySelector('p');
                if (msg) msg.textContent = 'Carregando mais posts...';

                try {
                    // Se for uma URL relativa, precisamos construir corretamente
                    let targetUrl = fetchUrl;
                    if (!targetUrl.startsWith('http') && !targetUrl.startsWith('/')) {
                        targetUrl = '/' + targetUrl;
                    }
                    
                    const url = new URL(targetUrl, window.location.origin);
                    url.searchParams.set('offset', offset);
                    url.searchParams.set('limit', limit);

                    const res = await fetch(url.toString(), { credentials: 'include' });
                    if (res.ok) {
                        const posts = await res.json();
                        
                        if (!posts || posts.length < limit) {
                            hasMore = false;
                            sentinel.innerHTML = '<hr style="border: 0; border-top: 1px dashed var(--retro-border-dark); margin: 20px 0;"><p style="text-align: center; color: #888; font-size: 11px;">Fim do feed.</p>';
                        }

                        if (posts && posts.length > 0) {
                            const currentTargetUsername = new URL(fetchUrl, window.location.origin).searchParams.get('username');
                            
                            posts.forEach(post => {
                                if (currentTargetUsername && post.author.username !== currentTargetUsername) return;
                                container.insertAdjacentHTML('beforeend', this.renderPost(post, currentUsername));
                            });
                            offset += limit;
                        }
                    }
                } catch (e) {
                    console.error('Erro no lazy loading:', e);
                } finally {
                    loading = false;
                }
            }
        }, { 
            rootMargin: '400px',
            threshold: 0.1 
        });

        observer.observe(sentinel);

        // Retorna função para resetar o estado
        return () => {
            offset = 20;
            hasMore = true;
            loading = false;
            const msg = sentinel.querySelector('p');
            if (msg) msg.textContent = 'Carregando mais posts...';
        };
    }
};