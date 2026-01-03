/**
 * Teco - Sistema Global de Posts
 * Gerencia renderização, interações e modais de posts
 */

const PostUI = {
    // Inicializa listeners globais para modais
    init: function() {
        document.addEventListener('DOMContentLoaded', () => {
            // Listeners para o modal de Novo Post
            const novoPostMedia = document.getElementById('novo-post-media');
            if (novoPostMedia) novoPostMedia.onchange = (e) => this.handleMediaSelect(e, 'novo-post-preview');

            const novoPostTextarea = document.getElementById('novo-post-textarea');
            if (novoPostTextarea) novoPostTextarea.oninput = (e) => this.handleTextareaInput(e, 'novo-post-char-counter');

            // Listeners para o modal de Interação (Repost/Reply)
            const interacaoMedia = document.getElementById('interacao-media');
            if (interacaoMedia) interacaoMedia.onchange = (e) => this.handleMediaSelect(e, 'interacao-preview');

            const interacaoTextarea = document.getElementById('interacao-textarea');
            if (interacaoTextarea) interacaoTextarea.oninput = (e) => this.handleTextareaInput(e, 'interacao-char-counter');
        });
    },

    // Renderiza o HTML de um post
    renderPost: function(post, currentUser, isThread = false) {
        if (post.is_deleted) {
            return `
                <div class="post-card deleted-post p-3 border-bottom">
                    <div class="post-content text-muted fst-italic">Este post foi deletado pelo autor.</div>
                </div>
            `;
        }

        const isLiked = post.likes && post.likes.some(l => currentUser && l.user_id === currentUser.id);
        const isBookmarked = post.bookmarks && post.bookmarks.some(b => currentUser && b.user_id === currentUser.id);
        
        const mediaCount = post.media ? Math.min(post.media.length, 4) : 0;
        const mediaHtml = mediaCount > 0 
            ? `<div class="post-media-grid grid-${mediaCount}">
                ${post.media.slice(0, 4).map(m => m.type === 'video' 
                    ? `<video src="${m.url}" class="post-media-item" controls></video>` 
                    : `<img src="${m.url}" class="post-media-item" loading="lazy" onclick="event.stopPropagation(); window.open('${m.url}')">`).join('')}
               </div>`
            : '';

        let repostHtml = '';
        if (post.type === 'repost' && post.parent && !isThread) {
            if (post.parent.is_deleted) {
                repostHtml = `
                    <div class="repost-container deleted p-2 mt-2 border rounded">
                        <div class="post-content text-muted small fst-italic">Este post foi deletado.</div>
                    </div>
                `;
            } else {
                const parentMediaCount = post.parent.media ? Math.min(post.parent.media.length, 4) : 0;
                const parentMediaHtml = parentMediaCount > 0 
                    ? `<div class="post-media-grid grid-${parentMediaCount}">
                        ${post.parent.media.slice(0, 4).map(m => m.type === 'video' 
                            ? `<video src="${m.url}" class="post-media-item" controls></video>` 
                            : `<img src="${m.url}" class="post-media-item" loading="lazy" onclick="event.stopPropagation(); window.open('${m.url}')">`).join('')}
                       </div>`
                    : '';

                const parentUsername = post.parent.author.username;

                repostHtml = `
                    <div class="repost-container p-2 mt-2 border rounded" onclick="event.stopPropagation(); PostUI.abrirModal(${post.parent.id}, '${parentUsername}')">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <img src="${post.parent.author.profile_image}" class="rounded object-fit-cover" style="width: 20px; height: 20px;">
                            <span class="post-author-name fw-bold small">${parentUsername}</span>
                            <span class="text-muted small">· ${new Date(post.parent.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="post-content small mb-0">${this.formatContent(post.parent.content, post.parent.mentions)}</div>
                        ${parentMediaHtml}
                    </div>
                `;
            }
        }

        const deleteBtn = (currentUser && currentUser.id === post.user_id) 
            ? `<button class="post-action delete d-flex align-items-center" onclick="event.stopPropagation(); PostActions.deletar(${post.id})" title="Deletar">
                <i class="bi bi-trash"></i>
               </button>` 
            : '';

        const threadLine = isThread ? '<div class="thread-line"></div>' : '';
        const cardClass = `post-card d-flex gap-3 p-3 border-bottom position-relative ${isThread ? 'in-thread' : ''}`;

        const authorUsername = post.author.username;

        return `
            <div class="${cardClass}" id="post-${post.id}" onclick="PostUI.abrirModal(${post.id}, '${authorUsername}')">
                <div class="flex-shrink-0 position-relative">
                    <img src="${post.author.profile_image}" class="rounded object-fit-cover" style="width: 48px; height: 48px; z-index: 2; position: relative;">
                    ${threadLine}
                </div>
                <div class="flex-grow-1 min-width-0">
                    <div class="d-flex align-items-center gap-1 mb-1 flex-wrap">
                        <a href="/${authorUsername}" class="post-author-name fw-bold text-decoration-none" onclick="event.stopPropagation()">${authorUsername}</a>
                        <span class="text-muted">· ${new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="post-content mb-2 text-break">${this.formatContent(post.content, post.mentions)}</div>
                    ${mediaHtml}
                    ${repostHtml}
                    <div class="post-actions d-flex justify-content-between mt-2">
                        <button class="post-action reply d-flex align-items-center gap-1" onclick="event.stopPropagation(); PostUI.abrirModal(${post.id}, '${authorUsername}', true)" title="Responder">
                            <i class="bi bi-chat"></i> <span>${post.replies_count || 0}</span>
                        </button>
                        <button class="post-action repost d-flex align-items-center gap-1 ${post.type === 'repost' ? 'reposted' : ''}" onclick="event.stopPropagation(); PostUI.abrirModalInteracao(${post.id}, 'repost')" title="Repostar">
                            <i class="bi bi-arrow-repeat"></i> <span>${post.reposts_count || 0}</span>
                        </button>
                        <button class="post-action like d-flex align-items-center gap-1 ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation(); PostActions.like(${post.id})" title="Curtir">
                            <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i> <span>${post.likes_count || 0}</span>
                        </button>
                        <button class="post-action bookmark d-flex align-items-center gap-1 ${isBookmarked ? 'bookmarked' : ''}" onclick="event.stopPropagation(); PostActions.toggleBookmark(${post.id})" title="Salvar">
                            <i class="bi ${isBookmarked ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i>
                        </button>
                        <button class="post-action share d-flex align-items-center gap-1" onclick="event.stopPropagation(); PostActions.compartilhar(${post.id}, '${post.author.username}')" title="Compartilhar">
                            <i class="bi bi-share"></i>
                        </button>
                        ${deleteBtn}
                    </div>
                </div>
            </div>
        `;
    },

    // Formata o conteúdo com menções, hashtags e links
    formatContent: function(text, mentions = []) {
        if (!text) return '';
        let formatted = text;
        
        // Escapar HTML básico para segurança
        formatted = formatted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Formatar menções
        formatted = formatted.replace(/@(\w+)/g, (match, p1) => {
            return `<a href="/@${p1}" class="mention" onclick="event.stopPropagation()">@${p1}</a>`;
        });

        // Formatar hashtags
        formatted = formatted.replace(/#(\w+)/g, (match, p1) => {
            return `<a href="/search?q=%23${p1}" class="hashtag" onclick="event.stopPropagation()">#${p1}</a>`;
        });

        // Formatar links (simples)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formatted = formatted.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" class="post-link" onclick="event.stopPropagation()">${url}</a>`;
        });

        return formatted;
    },

    // Redireciona para a página de detalhes do post
    abrirModal: function(postId, username, showComments = false) {
        let url = `/${username}/status/${postId}`;
        if (showComments) {
            url += '?reply=true';
        }
        
        window.location.href = url;
    },

    // Abre o modal de interação (reply/repost)
    abrirModalInteracao: function(postId, type) {
        const modalEl = document.getElementById('modalPostInteracao');
        if (!modalEl) return;

        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);

        document.getElementById('interacao-post-id').value = postId;
        document.getElementById('interacao-type').value = type;
        document.getElementById('modalPostInteracaoLabel').textContent = type === 'repost' ? 'Repostar' : 'Responder';
        document.getElementById('interacao-textarea').value = '';
        document.getElementById('interacao-preview').innerHTML = '';
        window.selectedFiles = [];
        modal.show();
    },

    // Abre o modal de novo post
    abrirModalNovoPost: function() {
        const modalEl = document.getElementById('modalNovoPost');
        if (!modalEl) return;
        
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);

        document.getElementById('novo-post-textarea').value = '';
        document.getElementById('novo-post-preview').innerHTML = '';
        document.getElementById('novo-post-char-counter').textContent = '0/300';
        window.selectedFiles = [];
        modal.show();
    },

    // Renderiza preview de arquivos selecionados
    renderPreview: function(containerId) {
        const preview = document.getElementById(containerId);
        if (!preview) return;
        
        preview.innerHTML = window.selectedFiles.map((file, index) => `
            <div class="preview-item">
                ${file.type.startsWith('video/') 
                    ? `<video src="${URL.createObjectURL(file)}"></video>` 
                    : `<img src="${URL.createObjectURL(file)}">`}
                <div class="preview-remove" onclick="PostUI.removeFile('${containerId}', ${index})">&times;</div>
            </div>
        `).join('');
    },

    // Remove arquivo do preview
    removeFile: function(containerId, index) {
        window.selectedFiles.splice(index, 1);
        this.renderPreview(containerId);
    },

    // Gerencia seleção de mídia
    handleMediaSelect: function(e, containerId) {
        const files = Array.from(e.target.files);
        if (window.selectedFiles.length + files.length > 4) {
            alert('Máximo de 4 arquivos permitidos.');
            e.target.value = '';
            return;
        }
        window.selectedFiles = [...window.selectedFiles, ...files];
        this.renderPreview(containerId);
        e.target.value = '';
    },

    // Gerencia contador de caracteres
    handleTextareaInput: function(e, counterId) {
        const len = e.target.value.length;
        const counter = document.getElementById(counterId);
        if (counter) {
            counter.textContent = `${len}/300`;
            counter.classList.toggle('limit', len >= 300);
        }
    }
};

const PostActions = {
    // Curtir post
    like: async function(postId) {
        try {
            const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
            const data = await res.json();
            
            // Atualizar todos os elementos deste post na página (pode estar no feed e no modal)
            const buttons = document.querySelectorAll(`#post-${postId} .post-action.like`);
            buttons.forEach(btn => {
                const span = btn.querySelector('span');
                const icon = btn.querySelector('i');
                
                if (data.liked) {
                    btn.classList.add('liked');
                    icon.classList.replace('bi-heart', 'bi-heart-fill');
                } else {
                    btn.classList.remove('liked');
                    icon.classList.replace('bi-heart-fill', 'bi-heart');
                }
                if (span) span.textContent = data.likes_count;
            });
        } catch (e) {
            console.error('Erro ao curtir:', e);
        }
    },

    // Favoritar post
    toggleBookmark: async function(postId) {
        try {
            const res = await fetch(`/api/posts/${postId}/bookmark`, { method: 'POST' });
            const data = await res.json();
            
            const buttons = document.querySelectorAll(`#post-${postId} .post-action.bookmark`);
            buttons.forEach(btn => {
                const icon = btn.querySelector('i');
                if (data.bookmarked) {
                    btn.classList.add('bookmarked');
                    icon.classList.replace('bi-bookmark', 'bi-bookmark-fill');
                } else {
                    btn.classList.remove('bookmarked');
                    icon.classList.replace('bi-bookmark-fill', 'bi-bookmark');
                }
            });

            // Se estiver na aba de favoritos e desfavoritou, remove o card
            if (!data.bookmarked && window.currentTab === 'bookmarks') {
                const postEl = document.getElementById(`post-${postId}`);
                if (postEl) {
                    postEl.style.opacity = '0';
                    setTimeout(() => postEl.remove(), 300);
                }
            }
        } catch (e) {
            console.error('Erro ao favoritar:', e);
        }
    },


    // Compartilhar post
    compartilhar: function(postId, authorUsername) {
        const url = `${window.location.origin}/${authorUsername}/status/${postId}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copiado para a área de transferência!');
        });
    },

    // Deletar post
    deletar: async function(postId) {
        const confirmacao = typeof mostrarConfirmacao === 'function' 
            ? await mostrarConfirmacao('Tem certeza que deseja deletar este post? Esta ação não pode ser desfeita.', 'Deletar Post')
            : confirm('Tem certeza que deseja deletar este post?');

        if (!confirmacao) return;

        try {
            const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });

            if (response.ok) {
                // Se estivermos na página de detalhes do post deletado, volta para o perfil
                if (window.location.pathname.includes('/status/' + postId)) {
                    const pathParts = window.location.pathname.split('/');
                    const username = pathParts[1];
                    window.location.href = '/' + username;
                    return;
                }

                const postEl = document.getElementById(`post-${postId}`);
                if (postEl) {
                    postEl.style.opacity = '0';
                    setTimeout(() => postEl.remove(), 300);
                }
            } else {
                alert('Erro ao deletar post.');
            }
        } catch (error) {
            console.error('Erro ao deletar post:', error);
        }
    },

    // Enviar interação (reply/repost)
    enviarInteracao: async function() {
        const postId = document.getElementById('interacao-post-id').value;
        const type = document.getElementById('interacao-type').value;
        const content = document.getElementById('interacao-textarea').value.trim();
        const btn = document.getElementById('btn-confirmar-interacao');
        this.enviarPost(content, window.selectedFiles, { parent_id: postId, type }, btn, 'modalPostInteracao');
    },

    // Enviar novo post
    enviarNovoPost: async function() {
        const content = document.getElementById('novo-post-textarea').value.trim();
        const btn = document.getElementById('btn-confirmar-novo-post');
        this.enviarPost(content, window.selectedFiles, { type: 'post' }, btn, 'modalNovoPost');
    },

    // Função genérica para enviar posts
    enviarPost: async function(content, files, extraData, btn, modalId) {
        if (!content && (!files || files.length === 0) && extraData.type !== 'repost') return;

        const originalBtnHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        const formData = new FormData();
        formData.append('content', content);
        if (files) files.forEach(file => formData.append('media', file));
        for (const key in extraData) formData.append(key, extraData[key]);

        try {
            const res = await fetch('/api/posts', { method: 'POST', body: formData });
            if (res.ok) {
                if (modalId) {
                    const modalEl = document.getElementById(modalId);
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
                
                // Se for uma interação em um modal aberto, recarrega o modal
                if (extraData.parent_id) {
                    // Se estivermos na página de detalhes do post, recarrega as respostas
                    if (typeof carregarRespostas === 'function') {
                        carregarRespostas();
                    }
                }

                if (window.carregarPosts && window.username) {
                    window.carregarPosts(window.username);
                }

                if (window.PostFeed && typeof window.PostFeed.reload === 'function') {
                    window.PostFeed.reload();
                }
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao enviar post.');
            }
        } catch (e) {
            console.error('Erro ao enviar post:', e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
};

const PostFeed = {
    container: null,
    loading: false,
    hasMore: true,
    offset: 0,
    limit: 10,
    type: 'for-you',

    init: function(containerId, type = 'for-you') {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.type = type;
        this.loadMore();

        window.addEventListener('scroll', () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !this.loading && this.hasMore) {
                this.loadMore();
            }
        });
    },

    switchFeed: function(type) {
        if (this.type === type) return;
        this.type = type;
        this.reload();
    },

    reload: function() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.offset = 0;
        this.hasMore = true;
        this.loadMore();
    },

    loadMore: async function() {
        if (this.loading || !this.hasMore) return;
        
        this.loading = true;
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'text-center p-3 loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner-border text-primary spinner-border-sm"></div>';
        this.container.appendChild(loadingIndicator);

        try {
            const res = await fetch(`/api/posts/feed?type=${this.type}&limit=${this.limit}&offset=${this.offset}`);
            const posts = await res.json();

            loadingIndicator.remove();

            if (posts.length < this.limit) {
                this.hasMore = false;
            }

            if (posts.length === 0 && this.offset === 0) {
                this.container.innerHTML = '<div class="text-center p-5 text-muted">Nenhum post encontrado.</div>';
                return;
            }

            posts.forEach(post => {
                const postHtml = PostUI.renderPost(post, window.currentUser);
                this.container.insertAdjacentHTML('beforeend', postHtml);
            });

            this.offset += posts.length;
            
            // Se carregou poucos posts e ainda tem espaço na tela, tenta carregar mais
            if (this.hasMore && document.body.offsetHeight <= window.innerHeight) {
                this.loadMore();
            }
        } catch (e) {
            console.error('Erro ao carregar feed:', e);
            if (loadingIndicator) {
                loadingIndicator.innerHTML = '<p class="text-danger">Erro ao carregar posts.</p>';
            }
        } finally {
            this.loading = false;
        }
    }
};

// Inicializar listeners globais
PostUI.init();
