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
                if (m.type === 'video') {
                    mediaHtml += `<video src="${m.url}" style="max-width: 250px; border: 1px dashed var(--retro-border-dark); object-fit: cover;" controls></video>`;
                } else {
                    mediaHtml += `<img src="${m.url}" style="max-width: 250px; border: 1px dashed var(--retro-border-dark); cursor: pointer; object-fit: cover;" onclick="window.open('${m.url}')">`;
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
                pMediaHtml = '<div style="margin-top: 5px; display: flex; gap: 5px; flex-wrap: wrap;">';
                p.media.forEach(m => {
                    if (m.type === 'video') {
                        pMediaHtml += `<video src="${m.url}" style="max-width: 150px; border: 1px dashed var(--retro-border-dark); object-fit: cover;" controls></video>`;
                    } else {
                        pMediaHtml += `<img src="${m.url}" style="max-width: 150px; border: 1px dashed var(--retro-border-dark); cursor: pointer; object-fit: cover;" onclick="window.open('${m.url}')">`;
                    }
                });
                pMediaHtml += '</div>';
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
        const isLiked = post.likes && post.likes.some(l => l.user && l.user.username === currentUsername);
        const likeColor = isLiked ? 'red' : 'var(--retro-link-hover)';
        const likeFontWeight = isLiked ? 'bold' : 'normal';
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
                    <a href="/${post.author.username}/status/${post.publicid}" style="font-weight: bold;">[ABRIR]</a>
                    <a href="javascript:void(0)" onclick="handleRetroLike('${post.publicid}')" style="color: ${likeColor}; font-weight: ${likeFontWeight};" id="retro-like-btn-${post.publicid}">[LIKE ${post.likecount || 0}]</a>
                    <a href="javascript:void(0)" onclick="handleRetroReply('${post.publicid}', '${post.author.username}')" style="color: var(--retro-header-bg);">[REPLY ${post.replycount || 0}]</a>
                    <a href="javascript:void(0)" onclick="handleRetroRepost('${post.publicid}')" style="color: #555;">[REPOST ${post.repostcount || 0}]</a>
                    <a href="javascript:void(0)" onclick="handleRetroCopyLink('${post.author.username}', '${post.publicid}')" style="color: var(--retro-link);">[LINK]</a>
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
            const confirmacao = await confirm('Tem certeza que deseja apagar esta mensagem permanentemente?', 'Confirmar Exclusão');
            if (!confirmacao) return;
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
                if (res.ok) {
                    const data = await res.json();
                    const btn = document.getElementById(`retro-like-btn-${postId}`);
                    if (btn) {
                        btn.style.color = data.liked ? 'red' : 'var(--retro-link-hover)';
                        btn.style.fontWeight = data.liked ? 'bold' : 'normal';
                        btn.textContent = `[LIKE ${data.likecount}]`;
                    }
                }
            } catch (e) { console.error(e); }
        };

        window.handleRetroReply = (postId, username) => {
            window.location.href = `/${username}/status/${postId}`;
        };

        window.handleRetroCopyLink = (username, postId) => {
            const url = `${window.location.origin}/${username}/status/${postId}`;
            navigator.clipboard.writeText(url).then(async () => {
                await alert('Link copiado para a área de transferência!');
            });
        };

        window.handleRetroRepost = async (postId) => {
            const confirmed = await confirm('Deseja compartilhar este post em seu perfil?', 'Repostar');
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
                            sentinel.innerHTML = '<hr style="border: 0; border-top: 1px dashed var(--retro-border-dark);"><p style="text-align: center; color: #888; font-size: 11px;">Fim do feed.</p>';
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
    },

    /**
     * Configura o comportamento da área de novo post (Retrô)
     */
    setupNewPost: function(config) {
        const { textareaId, mediaInputId, previewId, btnPostarId, progressContainerId, progressBarId, callbackReload, extraFormData } = config;
        const textarea = document.getElementById(textareaId);
        const mediaInput = document.getElementById(mediaInputId);
        const preview = document.getElementById(previewId);
        const btnPostar = document.getElementById(btnPostarId);
        
        let selectedFiles = [];

        const renderPreview = () => {
            preview.innerHTML = '';
            selectedFiles.forEach((file, index) => {
                const container = document.createElement('div');
                container.style.position = 'relative';
                container.style.display = 'inline-block';
                container.style.marginRight = '5px';
                
                const mediaUrl = URL.createObjectURL(file);
                
                if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = mediaUrl;
                    video.style = "width: 50px; height: 50px; border: 1px solid var(--retro-border-dark); object-fit: cover;";
                    video.muted = true;
                    video.autoplay = true;
                    video.loop = true;
                    container.appendChild(video);
                } else {
                    const img = document.createElement('img');
                    img.src = mediaUrl;
                    img.style = "width: 50px; height: 50px; border: 1px solid var(--retro-border-dark); object-fit: cover;";
                    container.appendChild(img);
                }
                
                const removeBtn = document.createElement('div');
                removeBtn.innerHTML = '&times;';
                removeBtn.style = "position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; width: 15px; height: 15px; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: pointer; font-weight: bold; z-index: 10;";
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    selectedFiles.splice(index, 1);
                    renderPreview();
                };
                
                container.appendChild(removeBtn);
                preview.appendChild(container);
            });
        };

        if (mediaInput) {
            mediaInput.addEventListener('change', (e) => {
                const newFiles = Array.from(e.target.files);
                selectedFiles = selectedFiles.concat(newFiles);
                if (selectedFiles.length > 4) {
                    alert('Máximo de 4 arquivos permitidos.');
                    selectedFiles = selectedFiles.slice(0, 4);
                }
                renderPreview();
                e.target.value = '';
            });
        }

        if (btnPostar) {
            btnPostar.addEventListener('click', () => {
                const content = textarea.value.trim();
                if (!content && selectedFiles.length === 0) return;

                btnPostar.disabled = true;
                btnPostar.textContent = 'ENVIANDO...';

                const formData = new FormData();
                formData.append('content', content);
                
                if (extraFormData) {
                    for (const key in extraFormData) {
                        formData.append(key, extraFormData[key]);
                    }
                } else {
                    formData.append('type', 'post');
                }
                
                selectedFiles.forEach(file => formData.append('media', file));

                const progressContainer = document.getElementById(progressContainerId);
                const progressBar = document.getElementById(progressBarId);
                
                if (selectedFiles.length > 0 && progressContainer && progressBar) {
                    progressContainer.style.display = 'block';
                    progressBar.style.width = '0%';
                }

                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/posts', true);
                
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && progressBar) {
                        const percentComplete = (event.loaded / event.total) * 100;
                        progressBar.style.width = percentComplete + '%';
                    }
                };

                xhr.onload = async () => {
                    if (progressContainer && progressBar) {
                        progressContainer.style.display = 'none';
                        progressBar.style.width = '0%';
                    }
                    
                    if (xhr.status >= 200 && xhr.status < 300) {
                        textarea.value = '';
                        if (mediaInput) mediaInput.value = '';
                        selectedFiles = [];
                        renderPreview();
                        if (callbackReload) await callbackReload();
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            alert(err.error || 'Erro ao postar!');
                        } catch (e) {
                            alert('Erro ao postar!');
                        }
                    }
                    btnPostar.disabled = false;
                    btnPostar.textContent = 'POSTAR';
                };

                xhr.onerror = () => {
                    if (progressContainer && progressBar) {
                        progressContainer.style.display = 'none';
                        progressBar.style.width = '0%';
                    }
                    alert('Erro de conexão!');
                    btnPostar.disabled = false;
                    btnPostar.textContent = 'POSTAR';
                };

                xhr.send(formData);
            });
        }
    }
};