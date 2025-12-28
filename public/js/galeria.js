const Utils = {
    alert: (msg, title) => window.mostrarAviso ? window.mostrarAviso(msg, title) : alert(`${title || 'Aviso'}: ${msg}`),
    confirm: async (msg, title) => window.mostrarConfirmacao ? await window.mostrarConfirmacao(msg, title) : confirm(msg),
    escapeHtml: (str) => (!str ? '' : str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")),
    formatSize: (bytes) => (bytes / (1024 * 1024)).toFixed(2) + ' MB',
    debounce: (func, wait) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

const GaleriaManager = {
    data: null,
    galeriaId: null,
    colaboradores: [],
    originalStyles: null,
    previewBgUrl: null,
    editMode: false,
    lastAppliedFont: null,
    resizeObserver: null,
    draggedItemDims: null,

    async init() {
        const mainEl = document.getElementById('conteudo-principal');
        if (!mainEl) return;
        
        let id = mainEl.dataset.galeriaId;
        if (!id || id === 'undefined') {
            const parts = window.location.pathname.split('/').filter(p => p);
            const last = parts.pop();
            if (last && !['galeria', 'galerias'].includes(last.toLowerCase())) id = last;
        }

        if (!id) return Utils.alert('ID da galeria não encontrado.', 'Erro Crítico');
        
        this.galeriaId = id;
        
        // Observer para manter os quadrados quadrados e o background alinhado
        this.resizeObserver = new ResizeObserver(Utils.debounce(() => this.updateGridMetrics(), 50));
        const grid = document.getElementById('lista-imagens');
        if (grid) this.resizeObserver.observe(grid);

        await this.carregarDados();
        this.setupEventListeners();
        this.setupDragAndDrop();
    },

    markRemoveCover(id) {
        const flag = document.getElementById('edit-flag-remove-cover');
        if (flag) flag.value = 'true';
        const current = document.getElementById('edit-item-current-cover');
        if (current) {
            current.innerHTML = `<div class="small text-danger">Capa marcada para remoção</div>`;
            // keep the area visible so user can still cancel by choosing a new file
            current.style.display = '';
        }
    },

    async carregarDados() {
        try {
            const res = await fetch(`/api/galeria/${this.galeriaId}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            
            this.data = {
                ...json.galeria,
                background_fill: json.galeria.background_fill || 'cover',
                font_color: json.galeria.font_color || '#3E3F29'
            };
            this.colaboradores = (this.data.colaboradores || []).map(c => ({ id: c.id, username: c.username }));
            this.renderizar();
        } catch (err) { console.error(err); Utils.alert('Erro ao carregar.', 'Erro'); }
    },

    // --- CÁLCULO DE MÉTRICAS (Pixels Reais para CSS) ---
    updateGridMetrics() {
        const grid = document.getElementById('lista-imagens');
        if (!grid || !this.data) return;

        const cols = parseInt(this.data.grid_columns || 12);
        const gap = 15; // Deve corresponder ao CSS gap
        const containerWidth = grid.getBoundingClientRect().width;

        // Calcula a largura exata de um slot (célula)
        if (containerWidth > 0) {
            const cellWidth = (containerWidth - ((cols - 1) * gap)) / cols;
            // Injeta variáveis CSS para uso no background-size e altura
            grid.style.setProperty('--cell-size', `${cellWidth}px`);
            grid.style.setProperty('--row-height', `${Math.floor(cellWidth)}px`);
        }
    },

    garantirCoordenadas() {
        if (!this.data.imagens) return;
        
        const cols = parseInt(this.data.grid_columns || 12);
        const map = {}; 
        const isOccupied = (x, y, w, h) => {
            for(let i=0; i<w; i++) {
                for(let j=0; j<h; j++) { if(map[`${x+i},${y+j}`]) return true; }
            }
            return false;
        };
        const markOccupied = (x, y, w, h) => {
            for(let i=0; i<w; i++) {
                for(let j=0; j<h; j++) { map[`${x+i},${y+j}`] = true; }
            }
        };

        this.data.imagens.forEach(img => {
            if(img.col_start && img.row_start) markOccupied(img.col_start, img.row_start, img.grid_w || 1, img.grid_h || 1);
        });

        let currentY = 1, currentX = 1;
        this.data.imagens.forEach(img => {
            const w = img.grid_w || 1, h = img.grid_h || 1;
            if(!img.col_start || !img.row_start) {
                while(true) {
                    if (currentX + w - 1 > cols) { currentX = 1; currentY++; }
                    if (!isOccupied(currentX, currentY, w, h)) {
                        img.col_start = currentX; img.row_start = currentY;
                        markOccupied(currentX, currentY, w, h); break; 
                    }
                    currentX++;
                }
            }
        });
    },

    renderizar() {
        if (!this.data) return;
        const titulo = document.getElementById('galeria-titulo');
        if (titulo) titulo.textContent = this.data.nome;
        
        const desc = document.getElementById('galeria-descricao');
        if (desc) desc.textContent = this.data.descricao || '';
        
        const autor = document.getElementById('galeria-autor');
        if (autor) autor.textContent = this.data.owner?.username || 'Desconhecido';
        
        this.aplicarEstilos(this.data);
        this.renderizarBotoesAcao();
        this.renderizarGrid();
    },

    renderizarBotoesAcao() {
        const container = document.getElementById('acoes-galeria');
        if (!container) return;

        const editClass = this.editMode ? 'btn-warning' : 'btn-outline-secondary';
        const label = this.editMode ? 'Sair' : 'Editar';
        
        const html = `
            <button class="btn btn-primary shadow-sm" onclick="GaleriaManager.abrirModalUpload()">
                <i class="bi bi-plus-lg"></i> <span class="d-none d-sm-inline">Adicionar</span>
            </button>
            <button class="btn ${editClass} ms-2" onclick="GaleriaManager.toggleEditMode()" title="Alternar modo de edição">
                <i class="bi bi-grid-3x3-gap-fill"></i> <span class="d-none d-sm-inline">${label}</span>
            </button>
            ${this.editMode ? `<button class="btn btn-success ms-2" onclick="GaleriaManager.saveLayout()" title="Salvar alterações de layout"><i class="bi bi-save"></i> Salvar</button>` : ''}
            <button class="btn btn-light border shadow-sm" onclick="GaleriaManager.abrirModalConfig()" title="Abrir configurações da galeria"><i class="bi bi-gear-fill"></i></button>
        `;
        container.innerHTML = html;
    },

    renderizarGrid() {
        const grid = document.getElementById('lista-imagens');
        if (!grid) return;
        
        if (this.editMode) grid.parentElement.classList.add('edit-mode');
        else grid.parentElement.classList.remove('edit-mode');

        if (!this.data.imagens?.length) {
            grid.innerHTML = '<div class="col-12 text-center text-muted py-5 grid-full-width">Galeria vazia. Adicione conteúdo!</div>';
            return;
        }

        this.garantirCoordenadas();
        this.updateGridMetrics(); // Atualiza métricas para alinhamento perfeito

        const cols = this.data.grid_columns || 12;
        grid.style.setProperty('--gallery-columns', cols);

        // Prepara HTML dos itens
        const itemsHtml = this.data.imagens.map(img => {
            const safeNome = Utils.escapeHtml(img.nome || 'Sem nome');
            const safeUrl = (img.content_url || '').replace(/'/g, "\\'");
            const type = this.getMediaType(img);
            
            const w = img.grid_w || 1;
            const h = img.grid_h || 1;
            const x = img.col_start || 1;
            const y = img.row_start || 1;
            
            const showTitle = (img.show_title !== false);
            const fit = img.img_fit || 'cover';
            
            const previewSrc = img.cover_url || (type === 'image' ? img.content_url : '');
            let content = '';
            if (type === 'video') {
                if (img.cover_url) {
                    content = `<img src="${img.cover_url}" class="media-preview-box fit-${fit}" loading="lazy">`;
                } else {
                    content = `<video src="${img.content_url}" class="media-preview-box fit-${fit}" controls preload="metadata" playsinline muted></video>`;
                }
            } else if (type === 'audio') {
                if (previewSrc) {
                    content = `<img src="${previewSrc}" class="media-preview-box fit-${fit}" loading="lazy">`;
                } else {
                    content = `<div class="media-preview-box placeholder-audio d-flex align-items-center justify-content-center"><div class="audio-cover"><i class="bi bi-volume-up-fill audio-icon" aria-hidden="true"></i></div></div>`;
                }
            } else {
                // image / gif
                const imgSrc = previewSrc || img.content_url || '';
                content = `<img src="${imgSrc}" class="media-preview-box fit-${fit}" loading="lazy">`;
            }

            const editOverlay = this.editMode ? this.getEditOverlayHtml(img.id, w, h, cols, fit, showTitle, img.z_index || 0) : '';
            const dragAttr = this.editMode ? 'draggable="true"' : '';
            const style = `grid-column: ${x} / span ${w}; grid-row: ${y} / span ${h}; z-index: ${img.z_index || 0};`;

            // Adiciona data-w e data-h para facilitar o Drag & Drop
            return `
            <div class="grid-item" data-id="${img.id}" data-w="${w}" data-h="${h}" ${dragAttr} style="${style}">
                <div class="image-card ${showTitle ? 'has-title' : 'no-title'}" onclick="GaleriaManager.abrirMedia('${safeUrl}', '${type}', '${safeNome}')">
                    ${content}
                    ${showTitle ? `<div class="card-body"><small class="text-truncate fw-bold w-100">${safeNome}</small></div>` : ''}
                    ${this.editMode ? `<button class="position-absolute bottom-0 start-0 m-2 btn btn-xs btn-danger" style="z-index:30" onclick="event.stopPropagation(); GaleriaManager.excluirImagem(${img.id})" title="Excluir item"><i class="bi bi-trash"></i></button>` : ''}
                </div>
                ${this.editMode ? `<div class="resize-handle" data-id="${img.id}" title="Arraste para redimensionar"><i class="bi bi-arrows-angle-expand"></i></div>` : ''}
                ${editOverlay}
            </div>`;
        }).join('');

        // Adiciona o elemento de Highlight (oculto por padrão)
        const highlightHtml = `<div id="drag-highlight" class="grid-highlight"></div>`;
        
        grid.innerHTML = itemsHtml + highlightHtml;
    },

    getEditOverlayHtml(id, w, h, maxCols, fit, showTitle, z_index) {
        return `
        <div class="edit-overlay">
            <button class="btn btn-xs btn-light border" title="Editar atributos" onclick="event.stopPropagation(); GaleriaManager.abrirEditarItem(${id})">
                <i class="bi bi-pencil-square"></i>
            </button>
        </div>`;
    },

    abrirEditarItem(id) {
        const item = this.data.imagens.find(i => i.id === id);
        if (!item) return Utils.alert('Item não encontrado.');
        const form = document.getElementById('formEditItem');
        if (!form) return Utils.alert('Formulário de edição não encontrado.');

        document.getElementById('edit-item-id').value = item.id;
        document.getElementById('edit-item-nome').value = item.nome || '';
        document.getElementById('edit-item-showtitle').checked = item.show_title !== false;
        document.getElementById('edit-item-fit').value = item.img_fit || 'cover';
        // z-index field (moved to modal)
        const zinput = document.getElementById('edit-item-zindex');
        if (zinput) zinput.value = item.z_index || 0;

        const current = document.getElementById('edit-item-current-cover');
        const type = this.getMediaType(item);
        // Se o item for imagem/gif, não mostramos opção de enviar capa (desnecessário)
        const coverInput = form.querySelector('input[name="cover"]');
        // sempre limpar o valor antigo ao abrir o modal para evitar enviar arquivos residuais
        if (coverInput) try { coverInput.value = ''; } catch(e) {}
        if (coverInput) {
            try { coverInput.value = ''; } catch(e) { /* ignore */ }
            // se o usuário escolher um novo arquivo, garante que a flag de remoção seja resetada
            coverInput.onchange = () => {
                const flag = document.getElementById('edit-flag-remove-cover');
                if (flag) flag.value = 'false';
            };
        }
        // reset remove flag by default
        const removeFlag = document.getElementById('edit-flag-remove-cover');
        if (removeFlag) removeFlag.value = 'false';

        // Se for imagem, escondemos a opção de enviar capa e o bloco de capa atual
        if (type === 'image') {
            if (coverInput) coverInput.style.display = 'none';
            if (current) { current.style.display = 'none'; current.innerHTML = ''; }
        } else {
            if (coverInput) coverInput.style.display = '';
            if (current) {
                if (item.cover_url) {
                    current.style.display = '';
                    current.innerHTML = `
                        <div class="d-flex align-items-center gap-2">
                            <img src="${item.cover_url}" style="max-height:80px; max-width:120px; object-fit:cover; border-radius:8px;"/>
                            <div>
                                <div class="small text-muted">Capa atual</div>
                                <div class="mt-2">
                                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="GaleriaManager.markRemoveCover(${item.id})">Remover capa</button>
                                </div>
                            </div>
                        </div>`;
                } else {
                    current.style.display = 'none'; current.innerHTML = '';
                }
            }
        }

        // attach submit handler (once)
        if (!form._hasHandler) {
            form.addEventListener('submit', (e) => this.handleEditItemSubmit(e));
            form._hasHandler = true;
        }

        new bootstrap.Modal(document.getElementById('modalEditItem')).show();
    },

    async handleEditItemSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const id = document.getElementById('edit-item-id').value;
        if (!id) return Utils.alert('ID do item faltando.');

        const fd = new FormData(form);
        // Se o checkbox estiver desmarcado, não envia 'show_title' -> manda explicitamente
        fd.set('show_title', document.getElementById('edit-item-showtitle').checked);
        // garante que z_index seja enviado como número
        const zEl = document.getElementById('edit-item-zindex');
        if (zEl) fd.set('z_index', parseInt(zEl.value) || 0);

        try {
            const res = await fetch(`/api/galeria/${this.galeriaId}/imagem/${id}`, { method: 'PATCH', body: fd });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Erro ao atualizar item');

            // Atualiza item localmente com os campos retornados (imagem atualizado)
            const updated = json.imagem;
            const idx = this.data.imagens.findIndex(i => i.id === parseInt(id));
            if (idx > -1) {
                this.data.imagens[idx] = { ...this.data.imagens[idx], ...updated };
            }

            bootstrap.Modal.getInstance(document.getElementById('modalEditItem')).hide();
            this.renderizarGrid();
            Utils.alert('Item atualizado com sucesso!', 'Sucesso');
        } catch (err) {
            console.error(err);
            Utils.alert(err.message || 'Erro ao atualizar item', 'Erro');
        }
    },

    updateImg(id, changes) {
        const idx = this.data.imagens.findIndex(i => i.id === id);
        if (idx === -1) return;
        Object.assign(this.data.imagens[idx], changes);
        
        if(changes.grid_w) {
            const img = this.data.imagens[idx];
            const cols = parseInt(this.data.grid_columns || 12);
            if (img.col_start + img.grid_w - 1 > cols) {
                img.col_start = Math.max(1, cols - img.grid_w + 1);
            }
        }
        this.renderizarGrid();
    },

    toggleEditMode() {
        this.editMode = !this.editMode;
        this.renderizarBotoesAcao();
        this.renderizarGrid();
    },

    async saveLayout() {
        const layout = this.data.imagens.map((it) => ({ 
            id: it.id, 
            grid_w: it.grid_w || 1, 
            grid_h: it.grid_h || 1, 
            col_start: it.col_start || 1,
            row_start: it.row_start || 1,
            z_index: it.z_index || 0,
            show_title: it.show_title, 
            img_fit: it.img_fit 
        }));
        
        const formData = new FormData();
        formData.set('layout', JSON.stringify(layout));
        
        try {
            const res = await fetch(`/api/galeria/${this.galeriaId}`, { method: 'PATCH', body: formData });
            const json = await res.json();
            if (json.success) {
                this.editMode = false;
                this.renderizarBotoesAcao();
                this.renderizarGrid();
                Utils.alert('Layout salvo com sucesso!', 'Sucesso');
            } else throw new Error(json.message);
        } catch (err) { Utils.alert('Erro ao salvar layout', 'Erro'); }
    },

    aplicarEstilos(s) {
        const el = document.getElementById('conteudo-principal');
        if (!el) return;
        
        const bg = s.background_url || this.previewBgUrl;
        
        Object.assign(el.style, {
            backgroundColor: s.background_color || '',
            backgroundImage: bg ? `url('${bg}')` : 'none',
            backgroundRepeat: s.background_fill === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundSize: s.background_fill === 'repeat' ? 'auto' : 'cover',
            backgroundAttachment: 'fixed',
            color: s.font_color || '#3E3F29'
        });

        if (s.grid_columns) {
            document.getElementById('lista-imagens')?.style.setProperty('--gallery-columns', s.grid_columns);
            this.updateGridMetrics();
        }
        const cardColor = s.card_color || '#ffffff';
        el.style.setProperty('--gallery-card-bg', cardColor);
        document.querySelectorAll('.image-card .card-body').forEach(cb => cb.style.backgroundColor = cardColor);

        if (s.font_color) el.querySelectorAll('h2, p, small').forEach(t => t.style.color = s.font_color);
        this.gerenciarFonte(s.custom_font);
    },

    gerenciarFonte(fontName) {
        if (!fontName || fontName === this.lastAppliedFont) return;
        this.lastAppliedFont = fontName;
        
        const clean = fontName.trim();
        let family = `'Inter', sans-serif`;

        if (clean.toLowerCase().includes('comic sans')) {
            family = `'Comic Sans MS', cursive`;
        } else if (clean) {
            let apiParam = clean.replace(/\s+/g, '+');
            if (!apiParam.includes(':')) apiParam += ':ital,wght@0,300;0,400;0,700;1,400';
            
            const oldLink = document.querySelector(`link[data-custom-font]`);
            if (oldLink) oldLink.remove();

            const link = document.createElement('link');
            link.href = `https://fonts.googleapis.com/css2?family=${apiParam}&display=swap`;
            link.rel = 'stylesheet';
            link.setAttribute('data-custom-font', 'true');
            document.head.appendChild(link);
            
            const familyName = clean.split(':')[0];
            family = `'${familyName}', sans-serif`;
        }
        document.getElementById('conteudo-principal').style.fontFamily = family;
    },

    showFontOptions() {
        const inp = document.getElementById('config-custom-font');
        if (!inp) return;
        try {
            inp.focus();
            // Tenta abrir a lista simulando ArrowDown — alguns navegadores respeitam, outros abrem pelo botão nativo
            const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, which: 40, bubbles: true });
            inp.dispatchEvent(ev);
        } catch (e) {
            inp.focus();
        }
    },

    // --- Upload e Modais ---
    abrirModalUpload() { new bootstrap.Modal(document.getElementById('modalUpload')).show(); },
    
    async handleUpload(e) { 
        e.preventDefault();
        const form = e.target;
        const file = form.fileInput.files[0];
        if (!file) return;
        
        const btn = document.getElementById('btn-submit-upload');
        const prog = document.getElementById('upload-progress-wrapper');
        btn.disabled = true; prog.style.display = 'block';

        try {
            const res = await this.uploadFileXHR(file, form);
            if (res.success) {
                const cols = parseInt(this.data.grid_columns) || 4;
                res.imagem.grid_w = res.imagem.grid_h = (cols >= 9 ? 3 : (cols >= 6 ? 2 : 1));
                this.data.imagens.push(res.imagem);
                this.garantirCoordenadas(); 
                this.renderizarGrid();
                bootstrap.Modal.getInstance(document.getElementById('modalUpload')).hide();
                form.reset();
                Utils.alert('Upload concluído!');
            }
        } catch (err) { Utils.alert(err.message, 'Erro'); }
        finally { btn.disabled = false; prog.style.display = 'none'; this.resetProgress(); }
    },

    uploadFileXHR(file, form) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const data = new FormData(form);
            data.delete('fileInput'); data.append('imagem', file);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100) + '%';
                    document.getElementById('upload-progress-bar').style.width = pct;
                    document.getElementById('upload-percent-text').textContent = pct;
                    document.getElementById('upload-size-text').textContent = `${Utils.formatSize(e.loaded)} / ${Utils.formatSize(e.total)}`;
                }
            };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(JSON.parse(xhr.responseText)) : reject(new Error('Falha no upload'));
            xhr.onerror = () => reject(new Error('Erro de rede'));
            xhr.open('POST', `/api/galeria/${this.galeriaId}/upload`);
            xhr.send(data);
        });
    },

    resetProgress() {
        document.getElementById('upload-progress-bar').style.width = '0%';
        document.getElementById('upload-percent-text').textContent = '0%';
    },

    abrirMedia(url, type, nome) {
        const container = document.getElementById('media-container');
        document.getElementById('media-caption').textContent = nome || '';
        let content = '';
        if (type === 'video') content = `<video src="${url}" controls autoplay class="img-fluid rounded shadow" style="max-height:80vh"></video>`;
        else if (type === 'audio') content = `<div class="p-5 bg-dark rounded border"><i class="bi bi-music-note-beamed display-1 text-info"></i><audio controls autoplay class="d-block mt-3" oncanplay="this.volume=0.4"><source src="${url}"></audio></div>`;
        else content = `<img src="${url}" class="img-fluid rounded shadow" style="max-height:80vh">`;

        container.innerHTML = `<div class="position-relative d-inline-block"><button type="button" class="btn-close bg-white position-absolute top-0 end-0 m-2" style="z-index:10" data-bs-dismiss="modal"></button>${content}</div>`;
        new bootstrap.Modal(document.getElementById('modalMedia')).show();
    },

    // --- Configurações e Preview ---
    abrirModalConfig() {
        const principal = document.getElementById('conteudo-principal');
        if (principal) this.originalStyles = principal.getAttribute('style');
        
        const f = document.getElementById('formConfig'); 
        if (f) f.reset();
        
        const d = this.data;
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
        const setCheck = (id, v) => { const el = document.getElementById(id); if(el) el.checked = v; };

        setVal('config-nome', d.nome);
        setVal('config-descricao', d.descricao || '');
        setCheck('config-is-public', d.is_public);
        setVal('config-bg-color', d.background_color);
        setVal('config-bg-fill', d.background_fill);
        setVal('config-card-color', d.card_color || '#ffffff');
        setVal('config-grid-columns', d.grid_columns || 12);
        setVal('config-font-color', d.font_color);
        setVal('config-custom-font', d.custom_font || '');
        
        ['cover','bg'].forEach(k => {
             const flag = document.getElementById(`flag-remove-${k}`);
             if (flag) flag.value = 'false';
             const status = document.getElementById(`status-${k}`);
             if (status) status.classList.add('d-none');
        });
        
        this.togglePublicSection();
        this.renderColaboradores();
        new bootstrap.Modal(document.getElementById('modalConfig')).show();
    },

    toggleRemove(type) {
        const k = (type === 'background') ? 'bg' : type;
        const flag = document.getElementById(`flag-remove-${k}`);
        if (flag) flag.value = 'true';
        const status = document.getElementById(`status-${k}`);
        if (status) status.classList.remove('d-none');
        if (k === 'bg') { this.previewBgUrl = null; this.applyPreview(); }
    },

    applyPreview() {
        const bgInput = document.getElementById('input-bg');
        const hasBg = !!this.data.background_url || (bgInput && bgInput.files && bgInput.files.length > 0);
        const groupBg = document.getElementById('group-bg-fill');
        if (groupBg) groupBg.style.display = hasBg ? '' : 'none';

        const getVal = (id) => document.getElementById(id)?.value || '';
        const flagBg = document.getElementById('flag-remove-bg');
        const removeBg = flagBg ? flagBg.value === 'true' : false;

        const s = {
            background_color: getVal('config-bg-color'),
            background_fill: getVal('config-bg-fill'),
            custom_font: getVal('config-custom-font'),
            font_color: getVal('config-font-color'),
            card_color: getVal('config-card-color'),
            grid_columns: getVal('config-grid-columns'),
            background_url: removeBg ? null : (this.previewBgUrl || this.data.background_url)
        };
        this.aplicarEstilos(s);
    },

    async buscarUsuarios() {
        const inp = document.getElementById('search-user-input');
        if (!inp) return;
        const q = inp.value;
        if (q.length < 2) return;
        try {
            const res = await fetch(`/api/users/buscar?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            const results = document.getElementById('search-results');
            if (results) {
                results.innerHTML = (json.usuarios || [])
                    .map(u => `<button type="button" class="list-group-item list-group-item-action" onclick="GaleriaManager.addColaborador(${u.id}, '${u.username}')">${u.username}</button>`).join('');
            }
        } catch (e) { console.error(e); }
    },

    addColaborador(id, username) {
        if (!this.colaboradores.find(c => c.id === id)) this.colaboradores.push({ id, username });
        this.renderColaboradores();
        const results = document.getElementById('search-results');
        if (results) results.innerHTML = '';
    },
    removeColaborador(id) { this.colaboradores = this.colaboradores.filter(c => c.id !== id); this.renderColaboradores(); },
    renderColaboradores() {
        const container = document.getElementById('colaboradores-selecionados');
        if (container) {
            container.innerHTML = this.colaboradores
                .map(c => `<span class="badge bg-primary p-2">${c.username} <i class="bi bi-x-circle cursor-pointer ms-1" onclick="GaleriaManager.removeColaborador(${c.id})"></i></span>`).join('');
        }
    },
    togglePublicSection() {
        const section = document.getElementById('colaboradores-section');
        const check = document.getElementById('config-is-public');
        if (section && check) section.style.display = check.checked ? 'none' : 'block';
    },

    setupEventListeners() {
        const formUp = document.getElementById('formUpload');
        if (formUp) formUp.addEventListener('submit', (e) => this.handleUpload(e));
        
        const formConfig = document.getElementById('formConfig');
        if (formConfig) {
            formConfig.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                fd.append('colaboradores', JSON.stringify(this.colaboradores.map(c => c.id)));
                const checkPublic = document.getElementById('config-is-public');
                if (checkPublic) fd.set('is_public', checkPublic.checked);
                
                try {
                    const res = await fetch(`/api/galeria/${this.galeriaId}`, { method: 'PATCH', body: fd });
                    const json = await res.json();
                    if (json.success) {
                        Object.assign(this.data, json.galeria);
                        this.originalStyles = null;
                        bootstrap.Modal.getInstance(document.getElementById('modalConfig')).hide();
                        this.renderizar();
                        Utils.alert('Salvo com sucesso!');
                    }
                } catch (err) { Utils.alert('Erro ao salvar.'); }
            });
        }

        const preview = Utils.debounce(() => {
            const inpBg = document.getElementById('input-bg');
            if (inpBg && inpBg.files.length) {
                const flag = document.getElementById('flag-remove-bg');
                if (flag) flag.value = 'false';
                const status = document.getElementById('status-bg');
                if (status) status.classList.add('d-none');
            }
            this.applyPreview();
        }, 150);
        
        document.querySelectorAll('.preview-trigger').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', preview));
        const checkPublic = document.getElementById('config-is-public');
        if (checkPublic) checkPublic.addEventListener('change', () => this.togglePublicSection());
        const modalConfig = document.getElementById('modalConfig');
        if (modalConfig) {
            modalConfig.addEventListener('hidden.bs.modal', () => {
                if (this.originalStyles) {
                    const el = document.getElementById('conteudo-principal');
                    if (el) el.setAttribute('style', this.originalStyles);
                    const grid = document.getElementById('lista-imagens');
                    if (grid) grid.style.setProperty('--gallery-columns', this.data.grid_columns || 12);
                    this.originalStyles = null; this.previewBgUrl = null; this.lastAppliedFont = null;
                }
            });
        }
        const modalMedia = document.getElementById('modalMedia');
        if (modalMedia) {
            modalMedia.addEventListener('hidden.bs.modal', () => { const c = document.getElementById('media-container'); if (c) c.innerHTML = ''; });
        }
    },

    // --- DRAG AND DROP COM HIGHLIGHT ---
    setupDragAndDrop() {
        const gridContainer = document.getElementById('lista-imagens');
        if (!gridContainer) return;
        
        let draggedId = null;
        let resizing = null; // { id, itemEl, idx, colStart, rowStart, startW, startH }

        // Pointer-based resize: aceita arrastar o handle no canto inferior direito
        gridContainer.addEventListener('pointerdown', (e) => {
            if (!this.editMode) return;
            const handle = e.target.closest('.resize-handle');
            if (!handle) return;
            e.preventDefault(); e.stopPropagation();
            const id = parseInt(handle.dataset.id);
            const itemEl = gridContainer.querySelector(`.grid-item[data-id="${id}"]`);
            if (!itemEl) return;
            const idx = this.data.imagens.findIndex(i => i.id === id);
            if (idx === -1) return;

            const img = this.data.imagens[idx];
            resizing = {
                id,
                itemEl,
                idx,
                colStart: img.col_start || 1,
                rowStart: img.row_start || 1,
                startW: img.grid_w || 1,
                startH: img.grid_h || 1
            };

            try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
        });

        const _onPointerMove = (e) => {
            if (!resizing || !this.editMode) return;
            const rect = gridContainer.getBoundingClientRect();
            const cols = parseInt(this.data.grid_columns || 12);
            const gap = 15;
            const cellW = (rect.width - ((cols - 1) * gap)) / cols;
            const cellH = cellW;

            const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const offsetY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

            let targetCol = Math.ceil(offsetX / ((rect.width + gap)/cols));
            let targetRow = Math.ceil(offsetY / (cellH + gap));
            if (targetCol < 1) targetCol = 1; if (targetCol > cols) targetCol = cols;
            if (targetRow < 1) targetRow = 1;

            const newW = Math.max(1, Math.min(cols - resizing.colStart + 1, targetCol - resizing.colStart + 1));
            const newH = Math.max(1, targetRow - resizing.rowStart + 1);

            // Apply visual changes directly to element without full re-render
            resizing.itemEl.style.gridColumnEnd = `span ${newW}`;
            resizing.itemEl.style.gridRowEnd = `span ${newH}`;
            resizing.itemEl.dataset.w = newW;
            resizing.itemEl.dataset.h = newH;
        };

        const _onPointerUp = (e) => {
            if (!resizing) return;
            // Commit to data model
            const finalW = parseInt(resizing.itemEl.dataset.w) || resizing.startW;
            const finalH = parseInt(resizing.itemEl.dataset.h) || resizing.startH;
            const img = this.data.imagens[resizing.idx];
            img.grid_w = finalW; img.grid_h = finalH;
            // cleanup
            try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (err) {}
            resizing = null;
            // Re-render to update overlays, handles and internal state
            this.renderizarGrid();
        };

        window.addEventListener('pointermove', _onPointerMove);
        window.addEventListener('pointerup', _onPointerUp);

        // Modal z-index helper
        this.changeModalZ = (delta) => {
            const el = document.getElementById('edit-item-zindex');
            if (!el) return;
            const v = parseInt(el.value) || 0;
            el.value = Math.max(0, v + delta);
        };

        gridContainer.addEventListener('dragstart', (e) => {
            if (!this.editMode) return;
            const item = e.target.closest('.grid-item');
            if (item) {
                draggedId = parseInt(item.dataset.id);
                // Armazena dimensões para desenhar o highlight corretamente
                this.draggedItemDims = { w: parseInt(item.dataset.w), h: parseInt(item.dataset.h) };
                
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.classList.add('dragging'), 0);
                
                // Exibe o highlight imediatamente (mesmo que na posição inicial)
                const hl = document.getElementById('drag-highlight');
                if(hl) {
                    hl.style.display = 'block';
                    hl.style.gridColumn = item.style.gridColumn;
                    hl.style.gridRow = item.style.gridRow;
                }
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            const item = e.target.closest('.grid-item');
            if (item) item.classList.remove('dragging');
            draggedId = null;
            this.draggedItemDims = null;
            
            // Esconde highlight
            const hl = document.getElementById('drag-highlight');
            if(hl) hl.style.display = 'none';
        });

        gridContainer.addEventListener('dragover', (e) => {
            if (!this.editMode || !draggedId) return;
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';

            const hl = document.getElementById('drag-highlight');
            if (!hl) return;

            // Cálculos
            const rect = gridContainer.getBoundingClientRect();
            const cols = parseInt(this.data.grid_columns || 12);
            const gap = 15;
            // Largura calculada sem o gap final (mesma lógica do updateMetrics)
            const cellW = (rect.width - ((cols - 1) * gap)) / cols;
            const cellH = cellW; // Quadrado

            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            // Adiciona metade da largura da célula ao offset para centralizar melhor o "snap" sob o mouse
            let targetCol = Math.ceil(offsetX / (cellW + gap)); 
            targetCol = Math.ceil(offsetX / (cellW + (gap/2))); 
            
            // Revertendo para método simples que funciona bem visualmente
            targetCol = Math.ceil(offsetX / ((rect.width + gap)/cols));
            let targetRow = Math.ceil(offsetY / (cellH + gap));

            if (targetCol < 1) targetCol = 1;
            if (targetCol > cols) targetCol = cols;
            if (targetRow < 1) targetRow = 1;

            // Ajusta se o item for largo e sair da tela
            const w = this.draggedItemDims.w;
            if (targetCol + w - 1 > cols) {
                targetCol = Math.max(1, cols - w + 1);
            }

            // Atualiza Highlight em tempo real
            hl.style.gridColumnStart = targetCol;
            hl.style.gridColumnEnd = `span ${w}`;
            hl.style.gridRowStart = targetRow;
            hl.style.gridRowEnd = `span ${this.draggedItemDims.h}`;
        });

        gridContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.editMode || !draggedId) return;
            
            // A lógica é a mesma do DragOver para consistência
            const hl = document.getElementById('drag-highlight');
            if(!hl) return;

            // Pega a posição final do highlight (que já foi calculada e validada no dragover)
            const style = window.getComputedStyle(hl);
            const targetCol = parseInt(style.gridColumnStart);
            const targetRow = parseInt(style.gridRowStart);

            const imgIndex = this.data.imagens.findIndex(i => i.id === draggedId);
            if (imgIndex > -1) {
                const img = this.data.imagens[imgIndex];
                img.col_start = targetCol;
                img.row_start = targetRow;
                this.renderizarGrid();
            }
        });
    },
    
    excluirImagem: async (id) => {
        if (!(await Utils.confirm('Excluir mídia?'))) return;
        await GaleriaManager.apiDelete(`/api/galeria/${GaleriaManager.galeriaId}/imagem/${id}`, id);
        // Se estivermos com o modal de edição aberto para esse id, fecha-o após remoção
        try {
            const modalEl = document.getElementById('modalEditItem');
            const currentId = document.getElementById('edit-item-id')?.value;
            if (modalEl && currentId && parseInt(currentId) === parseInt(id)) {
                const bs = bootstrap.Modal.getInstance(modalEl);
                if (bs) bs.hide();
            }
        } catch (e) { /* silent */ }
    },
    excluirGaleria: async () => { if (await Utils.confirm('Excluir TUDO?')) GaleriaManager.apiDelete(`/api/galeria/${GaleriaManager.galeriaId}`, null, '/galerias'); },
    
    async apiDelete(url, imgId, redirect) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if ((await res.json()).success) {
                if (redirect) window.location.href = redirect;
                else { this.data.imagens = this.data.imagens.filter(i => i.id !== imgId); this.renderizarGrid(); }
            }
        } catch(e) { Utils.alert('Erro ao excluir'); }
    },
    
    getMediaType: (arg) => {
        // Accept either an object (image record) or a url string
        if (!arg) return 'image';
        if (typeof arg === 'object') {
            const mt = (arg.mimetype || '').toLowerCase();
            if (mt.startsWith('video/')) return 'video';
            if (mt.startsWith('audio/')) return 'audio';
            // fallback to content_url/cover_url-based detection
            arg = arg.content_url || arg.cover_url || '';
        }
        const u = (arg || '').toLowerCase();
        if (/\.(mp4|mov|webm|m4v|mkv|avi)(?:\?|$)/.test(u)) return 'video';
        if (/\.(mp3|wav|ogg|flac|m4a)(?:\?|$)/.test(u)) return 'audio';
        return 'image';
    }
};

document.addEventListener('DOMContentLoaded', () => GaleriaManager.init());