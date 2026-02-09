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
    data: {},
    galleryId: null,
    collaborators: [],
    originalStyles: null,
    previewBgUrl: null,
    editMode: false,
    lastAppliedFont: null,
    resizeObserver: null,
    draggedItemDims: null,

    async init() {
        const mainEl = document.getElementById('conteudo-principal');
        if (!mainEl) return;
        
        let id = mainEl.dataset.galleryId;
        if (!id || id === 'undefined' || id === '') {
            const parts = window.location.pathname.split('/').filter(p => p);
            const last = parts.pop();
            // Evita pegar 'galeria' ou 'galerias' como ID
            if (last && !['galeria', 'galerias', 'features'].includes(last.toLowerCase())) {
                id = last;
            }
        }

        if (!id) {
            console.error('Gallery ID is missing');
            return;
        }
        
        this.galleryId = id;
        
        // Inicializa observador de redimensionamento
        this.resizeObserver = new ResizeObserver(Utils.debounce(() => this.updateGridMetrics(), 50));
        const grid = document.getElementById('image-list');
        if (grid) this.resizeObserver.observe(grid);

        await this.loadData();
        this.setupEventListeners();
        this.setupDragAndDrop();
    },

    markRemoveCover(id) {
        const flag = document.getElementById('edit-flag-remove-cover');
        if (flag) flag.value = 'true';
        const current = document.getElementById('edit-item-current-cover');
        if (current) {
            current.innerHTML = `<div class="small text-danger">Capa marcada para remoção</div>`;
            current.style.display = '';
        }
    },

    async loadData() {
        try {
            const res = await fetch(`/api/galeria/${this.galleryId}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            
            this.data = json.gallery;
            
            // Computar grid_w e grid_h para os itens
            if (this.data.items) {
                this.data.items.forEach(item => {
                    // Garantir coordenadas mínimas de 1
                    item.startpositionx = Math.max(1, parseInt(item.startpositionx) || 1);
                    item.startpositiony = Math.max(1, parseInt(item.startpositiony) || 1);
                    
                    // Cálculo consistente da largura/altura
                    item.grid_w = item.endpositionx ? (item.endpositionx - item.startpositionx + 1) : 1;
                    item.grid_h = item.endpositiony ? (item.endpositiony - item.startpositiony + 1) : 1;
                    
                    // Sanity check
                    if (item.grid_w < 1) item.grid_w = 1;
                    if (item.grid_h < 1) item.grid_h = 1;
                });
            }

            this.collaborators = (this.data.collaborators || []).map(c => ({ publicid: c.publicid, username: c.username }));
            this.render();
        } catch (err) { console.error(err); Utils.alert('Erro ao carregar dados.', 'Erro'); }
    },

    updateGridMetrics() {
        const grid = document.getElementById('image-list');
        if (!grid || !this.data || !this.data.gridxsize) return;

        const cols = parseInt(this.data.gridxsize) || 12;
        const gap = 15;
        const containerWidth = grid.getBoundingClientRect().width;

        if (containerWidth > 0) {
            const cellWidth = (containerWidth - ((cols - 1) * gap)) / cols;
            grid.style.setProperty('--cell-size', `${cellWidth}px`);
            grid.style.setProperty('--row-height', `${cellWidth}px`);
        }
    },

    ensureCoordinates() {
        if (!this.data.items) return;

        const cols = parseInt(this.data.gridxsize) || 12;
        let currentY = 1, currentX = 1;

        this.data.items.forEach(item => {
            if (!item.startpositionx || !item.startpositiony) {
                const w = item.grid_w || 1;
                if (currentX + w - 1 > cols) { currentX = 1; currentY++; }
                item.startpositionx = currentX;
                item.startpositiony = currentY;
                currentX += w;
            }
        });
    },

    render() {
        if (!this.data) return;
        const title = document.getElementById('gallery-title');
        if (title) title.textContent = this.data.name;
        
        const desc = document.getElementById('gallery-description');
        if (desc) desc.textContent = this.data.description;
        
        const author = document.getElementById('gallery-author');
        if (author) {
            const username = this.data.owner?.username;
            if (username) {
                author.innerHTML = `<a href="/${username}" class="text-decoration-none" style="color: inherit;">${username}</a>`;
            } else {
                author.textContent = 'Desconhecido';
            }
        }
        
        this.applyStyles(this.data);
        this.renderGrid();
    },

    renderGrid() {
        const grid = document.getElementById('image-list');
        if (!grid) return;
        
        if (this.editMode) grid.parentElement.classList.add('edit-mode');
        else grid.parentElement.classList.remove('edit-mode');

        if (!this.data.items?.length) {
            grid.innerHTML = '<div class="col-12 text-center text-muted py-5 grid-full-width">A galeria está vazia. Adicione conteúdo!</div>';
            return;
        }

        this.ensureCoordinates();
        this.updateGridMetrics();

        const cols = this.data.gridxsize;
        grid.style.setProperty('--gallery-columns', cols);

        const itemsHtml = this.data.items.map(item => {
            // ALTERAR PARA MAIOR SEGURANÇA CUIDADO COM CONCATENAÇÃO DE STRINGS
            const safeName = Utils.escapeHtml(item.title || 'Sem título');
            const safeUrl = (item.contenturl || '').replace(/'/g, "\\'");
            const type = this.getMediaType(item);
            
            const w = item.grid_w;
            const h = item.grid_h;
            const x = item.startpositionx;
            const y = item.startpositiony;
            
            const showTitle = (item.showtitle !== false);
            const fit = item.objectfit; 
            const previewSrc = item.coverurl || (type === 'image' ? item.contenturl : '');
            
            let content;
            if (type === 'video') {
                content = item.coverurl ? `<img src="${item.coverurl}" class="media-preview-box fit-${fit}" loading="lazy">` : `<video src="${item.contenturl}" class="media-preview-box fit-${fit}" controls preload="metadata" playsinline muted></video>`;
            } else if (type === 'audio') {
                content = previewSrc ? `<img src="${previewSrc}" class="media-preview-box fit-${fit}" loading="lazy">` : `<div class="media-preview-box placeholder-audio d-flex align-items-center justify-content-center"><div class="audio-cover"><i class="bi bi-volume-up-fill audio-icon"></i></div></div>`;
            } else {
                content = `<img src="${previewSrc || item.contenturl || ''}" class="media-preview-box fit-${fit}" loading="lazy">`;
            }

            const editControls = this.editMode ? `
                <div class="edit-overlay">
                    <button class="btn btn-xs btn-light border" title="Editar" onclick="event.stopPropagation(); GaleriaManager.openEditItem('${item.publicid}')">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
                <button class="btn-delete" onclick="event.stopPropagation(); GaleriaManager.deleteItem('${item.publicid}')" title="Excluir"><i class="bi bi-trash"></i></button>
                <div class="resize-handle" data-id="${item.publicid}" title="Redimensionar"><i class="bi bi-arrows-angle-expand"></i></div>
            ` : '';

            return `
            <div class="grid-item" data-id="${item.publicid}" data-w="${w}" data-h="${h}" ${this.editMode ? 'draggable="true"' : ''} style="grid-column: ${x} / span ${w}; grid-row: ${y} / span ${h};">
                <div class="image-card ${showTitle ? 'has-title' : 'no-title'}" style="position: relative; z-index: ${item.positionz || 0};" onclick="GaleriaManager.openMedia('${safeUrl}', '${type}', '${safeName}')">
                    ${content}
                    ${showTitle ? `<div class="card-body"><small class="text-truncate fw-bold w-100">${safeName}</small></div>` : ''}
                </div>
                ${editControls}
            </div>`;
        }).join('');

        grid.innerHTML = itemsHtml + `<div id="drag-highlight" class="grid-highlight"></div>`;
    },

    openEditItem(id) {
        const item = this.data.items.find(i => i.publicid === id);
        if (!item) return Utils.alert('Item não encontrado.');
        const form = document.getElementById('formEditItem');
        if (!form) return Utils.alert('Formulário de edição não encontrado.');

        document.getElementById('edit-item-id').value = item.publicid;
        document.getElementById('edit-item-name').value = item.title || "";
        document.getElementById('edit-item-showtitle').checked = item.showtitle !== false;
        document.getElementById('edit-item-fit').value = item.objectfit;
        const zinput = document.getElementById('edit-item-zindex');
        if (zinput) zinput.value = item.positionz || 0;

        const current = document.getElementById('edit-item-current-cover');
        const type = this.getMediaType(item);
        const coverInput = form.querySelector('input[name="cover"]');
        const coverWrapper = coverInput ? coverInput.closest('.mb-3') : null;

        if (coverInput) { try { coverInput.value = ''; } catch(e) {} coverInput.onchange = () => { const f=document.getElementById('edit-flag-remove-cover'); if(f)f.value='false'; }; }
        const removeFlag = document.getElementById('edit-flag-remove-cover');
        if (removeFlag) removeFlag.value = 'false';

        if (type === 'image') {
            if (coverWrapper) coverWrapper.style.display = 'none';
            if (current) { current.style.display = 'none'; current.innerHTML = ''; }
        } else {
            if (coverWrapper) coverWrapper.style.display = '';
            if (current) {
                if (item.coverurl) {
                    current.style.display = '';
                    current.innerHTML = `
                        <div class="d-flex align-items-center gap-2">
                            <img src="${item.coverurl}" style="max-height:80px; max-width:120px; object-fit:cover; border-radius:8px;"/>
                            <div>
                                <div class="small text-muted">Capa Atual</div>
                                <div class="mt-2"><button type="button" class="btn btn-sm btn-outline-danger" onclick="GaleriaManager.markRemoveCover('${item.id}')">Remover Capa</button></div>
                            </div>
                        </div>`;
                } else {
                    current.style.display = 'none'; current.innerHTML = '';
                }
            }
        }

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
        // Garante que o checkbox seja enviado como booleano reconhecível pelo backend
        fd.set('showtitle', document.getElementById('edit-item-showtitle').checked);
        const zEl = document.getElementById('edit-item-zindex');
        if (zEl) fd.set('positionz', parseInt(zEl.value) || 0);

        try {
            const res = await fetch(`/api/galeria/${this.galleryId}/item/${id}`, { method: 'PATCH', body: fd });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Erro ao atualizar item');

            const idx = this.data.items.findIndex(i => i.publicid === id);
            if (idx > -1) this.data.items[idx] = { ...this.data.items[idx], ...json.item };

            bootstrap.Modal.getInstance(document.getElementById('modalEditItem')).hide();
            this.renderGrid();
            Utils.alert('Item atualizado com sucesso!', 'Sucesso');
        } catch (err) { console.error(err); Utils.alert(err.message, 'Erro'); }
    },

    toggleEditMode() {
        this.editMode = !this.editMode;
        
        // Manipula os botões estáticos via classe
        const btnEdit = document.getElementById('btn-edit-mode');
        const spanEdit = btnEdit ? btnEdit.querySelector('span') : null;
        const btnSave = document.getElementById('btn-save-layout');
        
        if (this.editMode) {
            if(btnEdit) {
                btnEdit.classList.remove('btn-outline-secondary');
                btnEdit.classList.add('btn-warning');
            }
            if(spanEdit) spanEdit.textContent = 'Sair';
            if(btnSave) btnSave.classList.remove('d-none');
        } else {
            if(btnEdit) {
                btnEdit.classList.remove('btn-warning');
                btnEdit.classList.add('btn-outline-secondary');
            }
            if(spanEdit) spanEdit.textContent = 'Editar';
            if(btnSave) btnSave.classList.add('d-none');
        }
        
        this.renderGrid();
    },

    async saveLayout() {
        const layout = this.data.items.map((it) => ({ 
            publicid: it.publicid, 
            grid_w: it.grid_w, 
            grid_h: it.grid_h, 
            startpositionx: it.startpositionx, 
            startpositiony: it.startpositiony,
            positionz: it.positionz, 
            showtitle: it.showtitle, 
            objectfit: it.objectfit 
        }));
        
        const formData = new FormData();
        formData.set('layout', JSON.stringify(layout));
        try {
            const res = await fetch(`/api/galeria/${this.galleryId}`, { method: 'PATCH', body: formData });
            const json = await res.json();
            if (json.success) {
                this.toggleEditMode();
                Utils.alert('Layout salvo com sucesso!', 'Sucesso');
            } else throw new Error(json.message);
        } catch (err) { Utils.alert('Erro ao salvar layout', 'Erro'); }
    },

    applyStyles(s) {
        const el = document.getElementById('conteudo-principal');
        if (!el) return;
        const bg = s.backgroundurl;
        
        Object.assign(el.style, {
            backgroundColor: s.backgroundcolor,
            backgroundImage: bg ? `url('${bg}')` : 'none',
            backgroundRepeat: s.backgroundfill === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundSize: s.backgroundfill === 'repeat' ? 'auto' : 'cover',
            backgroundAttachment: 'fixed',
            color: s.fontcolor
        });

        if (s.gridxsize) {
            document.getElementById('image-list')?.style.setProperty('--gallery-columns', s.gridxsize);
            this.updateGridMetrics();
        }
        const cardColor = s.cardcolor || s.backgroundcolor;
        el.style.setProperty('--gallery-card-bg', cardColor);
        document.querySelectorAll('.image-card .card-body').forEach(cb => cb.style.backgroundColor = cardColor);
        if (s.fontcolor) el.querySelectorAll('h2, p, small').forEach(t => t.style.color = s.fontcolor);
        this.manageFont(s.fontfamily);
    },

    manageFont(fontName) {
        if (!fontName || fontName === this.lastAppliedFont) return;
        this.lastAppliedFont = fontName;
        const clean = fontName.trim();
        let family = `'Inter', sans-serif`;

        if (clean.toLowerCase().includes('comic sans')) family = `'Comic Sans MS', cursive`;
        else if (clean) {
            let apiParam = clean.replace(/\s+/g, '+');
            if (!apiParam.includes(':')) apiParam += ':ital,wght@0,300;0,400;0,700;1,400';
            const oldLink = document.querySelector(`link[data-custom-font]`);
            if (oldLink) oldLink.remove();

            const link = document.createElement('link');
            link.href = `https://fonts.googleapis.com/css2?family=${apiParam}&display=swap`;
            link.rel = 'stylesheet';
            link.setAttribute('data-custom-font', 'true');
            document.head.appendChild(link);
            family = `'${clean.split(':')[0]}', sans-serif`;
        }
        document.getElementById('conteudo-principal').style.fontFamily = family;
    },

    showFontOptions() {
        const inp = document.getElementById('config-font-family');
        if (inp) { inp.focus(); try{inp.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',keyCode:40,which:40,bubbles:true}));}catch(e){}}
    },

    openUploadModal() { new bootstrap.Modal(document.getElementById('modalUpload')).show(); },
    
    async handleUpload(e) { 
        e.preventDefault();
        const form = e.target;
        const file = form.fileInput.files[0];
        if (!file) return;
        
        const btn = document.getElementById('btn-submit-upload');
        const prog = document.getElementById('upload-progress-wrapper');
        btn.disabled = true; prog.style.display = 'block';

        const cols = parseInt(this.data.gridxsize) || 12;
        const suggestedSize = (cols >= 9 ? 3 : (cols >= 6 ? 2 : 1));

        try {
            // Criar FormData manualmente para incluir sugestão de tamanho
            const fd = new FormData(form);
            fd.delete('fileInput');
            fd.append('media', file);
            fd.append('grid_w', suggestedSize);
            fd.append('grid_h', suggestedSize);

            const res = await this.uploadFileXHR(file, fd); // Passar o FD já pronto
            if (res.success) {
                res.item.grid_w = res.item.grid_h = suggestedSize;
                this.data.items.push(res.item);
                this.ensureCoordinates();
                this.renderGrid();
                bootstrap.Modal.getInstance(document.getElementById('modalUpload')).hide();
                form.reset();
                Utils.alert('Upload concluído!');
            }
        } catch (err) { Utils.alert(err.message, 'Erro'); }
        finally { btn.disabled = false; prog.style.display = 'none'; this.resetProgress(); }
    },

    uploadFileXHR(file, formDataOrForm) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const data = (formDataOrForm instanceof FormData) ? formDataOrForm : new FormData(formDataOrForm);
            if (!(formDataOrForm instanceof FormData)) {
                data.delete('fileInput'); 
                data.append('media', file);
            }
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
            xhr.open('POST', `/api/galeria/${this.galleryId}/upload`);
            xhr.send(data);
        });
    },

    resetProgress() {
        document.getElementById('upload-progress-bar').style.width = '0%';
        document.getElementById('upload-percent-text').textContent = '0%';
    },

    openMedia(url, type, name) {
        const container = document.getElementById('media-container');
        document.getElementById('media-caption').textContent = name || '';
        let content;
        if (type === 'video') content = `<video src="${url}" controls autoplay class="img-fluid rounded shadow" style="max-height:80vh"></video>`;
        else if (type === 'audio') content = `<div class="p-5 bg-dark rounded border"><i class="bi bi-music-note-beamed display-1 text-info"></i><audio controls autoplay class="d-block mt-3" oncanplay="this.volume=0.4"><source src="${url}"></audio></div>`;
        else content = `<img src="${url}" class="img-fluid rounded shadow" style="max-height:80vh">`;

        container.innerHTML = `<div class="position-relative d-inline-block"><button type="button" class="btn-close bg-white position-absolute top-0 end-0 m-2" style="z-index:10" data-bs-dismiss="modal"></button>${content}</div>`;
        new bootstrap.Modal(document.getElementById('modalMedia')).show();
    },

    openConfigModal() {
        const principal = document.getElementById('conteudo-principal'); // ID corrigido
        if (principal) this.originalStyles = principal.getAttribute('style');
        
        const f = document.getElementById('formConfig'); 
        if (f) f.reset();
        
        const d = this.data;
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
        const setCheck = (id, v) => { const el = document.getElementById(id); if(el) el.checked = v; };

        setVal('config-name', d.name);
        setVal('config-description', d.description);
        setCheck('config-is-public', d.ispublic);
        setVal('config-bg-color', d.backgroundcolor);
        setVal('config-bg-fill', d.backgroundfill);
        setVal('config-card-color', d.cardcolor || d.backgroundcolor);
        setVal('config-grid-columns', d.gridxsize);
        setVal('config-font-color', d.fontcolor);
        setVal('config-font-family', d.fontfamily);
        
        ['cover','bg'].forEach(k => {
             const flag = document.getElementById(`flag-remove-${k}`);
             if (flag) flag.value = 'false';
             const status = document.getElementById(`status-${k}`);
             if (status) status.classList.add('d-none');
        });

        const showCurrent = (inputId, url) => {
            const input = document.getElementById(inputId);
            if(!input) return;
            const parent = input.closest('.mb-3');
            if(!parent) return;
            const old = parent.querySelector('.current-file-preview');
            if(old) old.remove();
            
            if(url) {
                const div = document.createElement('div');
                div.className = 'current-file-preview mt-2 d-flex align-items-center gap-2 p-2 border rounded bg-light';
                div.innerHTML = `
                    <img src="${url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" class="border">
                    <div class="small text-truncate flex-grow-1 text-muted">
                        <strong>Atual:</strong> ${url.split('/').pop()}
                    </div>
                `;
                parent.appendChild(div);
            }
        };

        showCurrent('input-bg', d.background_url);
        showCurrent('input-cover', d.coverurl);
        
        this.togglePublicSection();
        this.renderCollaborators();
        new bootstrap.Modal(document.getElementById('modalConfig')).show();
    },

    toggleRemove(type) {
        const k = (type === 'background') ? 'bg' : type;
        const flag = document.getElementById(`flag-remove-${k}`);
        if (flag) flag.value = 'true';
        const status = document.getElementById(`status-${k}`);
        if (status) status.classList.remove('d-none');
        
        const inputId = (type === 'background') ? 'input-bg' : 'input-cover';
        const input = document.getElementById(inputId);
        if(input) {
            const preview = input.closest('.mb-3')?.querySelector('.current-file-preview');
            if(preview) preview.style.opacity = '0.3';
        }

        if (k === 'bg') { this.previewBgUrl = null; this.applyPreview(); }
    },

    applyPreview() {
        const bgInput = document.getElementById('input-bg');
        const hasBg = !!this.data.backgroundurl || (bgInput && bgInput.files && bgInput.files.length > 0);
        document.getElementById('group-bg-fill').style.display = hasBg ? '' : 'none';

        const getVal = (id) => document.getElementById(id)?.value || '';
        const flagBg = document.getElementById('flag-remove-bg');
        const removeBg = flagBg ? flagBg.value === 'true' : false;

        const s = {
            backgroundcolor: getVal('config-bg-color'),
            backgroundfill: getVal('config-bg-fill'),
            fontfamily: getVal('config-font-family'),
            fontcolor: getVal('config-font-color'),
            cardcolor: getVal('config-card-color'),
            gridxsize: getVal('config-grid-columns'),
            backgroundurl: removeBg ? null : (this.previewBgUrl || this.data.backgroundurl)
        };
        this.applyStyles(s);
    },

    async searchUsers() {
        const q = document.getElementById('search-user-input')?.value;
        if (q?.length < 2) return;
        try {
            const res = await fetch(`/api/users/buscar?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            const results = document.getElementById('search-results');
            if (results) {
                const list = json.users || json.usuarios || [];
                results.innerHTML = list.map(u => `<button type="button" class="list-group-item list-group-item-action" onclick="GaleriaManager.addCollaborator('${u.publicid}', '${u.username}')">${u.username}</button>`).join('');
            }
        } catch (e) { console.error(e); }
    },

    addCollaborator(id, username) {
        if (!this.collaborators.find(c => c.publicid === id)) this.collaborators.push({ publicid: id, username });
        this.renderCollaborators();
        document.getElementById('search-results').innerHTML = '';
    },
    removeCollaborator(id) { this.collaborators = this.collaborators.filter(c => c.publicid !== id); this.renderCollaborators(); },
    renderCollaborators() {
        const container = document.getElementById('collaborators-list');
        if (container) container.innerHTML = this.collaborators.map(c => `<span class="badge bg-primary p-2">${c.username} <i class="bi bi-x-circle cursor-pointer ms-1" onclick="GaleriaManager.removeCollaborator('${c.publicid}')"></i></span>`).join('');
    },
    togglePublicSection() {
        const section = document.getElementById('collaborators-section');
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
                fd.append('collaborators', JSON.stringify(this.collaborators.map(c => c.publicid)));
                if (document.getElementById('config-is-public')) fd.set('ispublic', document.getElementById('config-is-public').checked);
                try {
                    const res = await fetch(`/api/galeria/${this.galleryId}`, { method: 'PATCH', body: fd });
                    const json = await res.json();
                    if (json.success) {
                        Object.assign(this.data, json.gallery);
                        this.originalStyles = null;
                        bootstrap.Modal.getInstance(document.getElementById('modalConfig')).hide();
                        this.render();
                        Utils.alert('Salvo com sucesso!');
                    }
                } catch (err) { Utils.alert('Erro ao salvar.'); }
            });
        }

        const preview = Utils.debounce(() => {
            const inpBg = document.getElementById('input-bg');
            if (inpBg && inpBg.files.length) {
                if(document.getElementById('flag-remove-bg')) document.getElementById('flag-remove-bg').value='false';
                if(document.getElementById('status-bg')) document.getElementById('status-bg').classList.add('d-none');
                
                const previewDiv = inpBg.closest('.mb-3')?.querySelector('.current-file-preview');
                if(previewDiv) previewDiv.style.display = 'none';
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
                    const el = document.getElementById('conteudo-principal'); // ID corrigido
                    if (el) el.setAttribute('style', this.originalStyles);
                    if (document.getElementById('image-list')) document.getElementById('image-list').style.setProperty('--gallery-columns', this.data.gridxsize || 12);
                    this.originalStyles = null; this.previewBgUrl = null; this.lastAppliedFont = null;
                }
            });
        }
        const modalMedia = document.getElementById('modalMedia');
        if (modalMedia) modalMedia.addEventListener('hidden.bs.modal', () => { const c = document.getElementById('media-container'); if (c) c.innerHTML = ''; });
    },

    setupDragAndDrop() {
        const gridContainer = document.getElementById('image-list');
        if (!gridContainer) return;
        
        let draggedId = null;
        let resizing = null;

        gridContainer.addEventListener('pointerdown', (e) => {
            if (!this.editMode) return;
            const handle = e.target.closest('.resize-handle');
            if (!handle) return;
            e.preventDefault(); e.stopPropagation();
            const id = handle.dataset.id;
            const itemEl = gridContainer.querySelector(`.grid-item[data-id="${id}"]`);
            if (!itemEl) return;
            const idx = this.data.items.findIndex(i => i.publicid === id);
            if (idx === -1) return;

            const item = this.data.items[idx];
            resizing = { id, itemEl, idx, colStart: item.startpositionx || 1, rowStart: item.startpositiony || 1, startW: item.grid_w || 1, startH: item.grid_h || 1 };
            try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
        });

        const _onPointerMove = (e) => {
            if (!resizing || !this.editMode) return;
            const rect = gridContainer.getBoundingClientRect();
            const cols = parseInt(this.data.gridxsize);
            const gap = 15;
            const cellW = (rect.width - ((cols - 1) * gap)) / cols;
            const cellH = cellW;

            const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const offsetY = Math.max(0, e.clientY - rect.top);

            let targetCol = Math.ceil(offsetX / ((rect.width + gap)/cols));
            let targetRow = Math.ceil(offsetY / (cellH + gap));
            if (targetCol < 1) targetCol = 1; if (targetCol > cols) targetCol = cols;
            if (targetRow < 1) targetRow = 1;

            const newW = Math.max(1, Math.min(cols - resizing.colStart + 1, targetCol - resizing.colStart + 1));
            const newH = Math.max(1, targetRow - resizing.rowStart + 1);

            resizing.itemEl.style.gridColumnEnd = `span ${newW}`;
            resizing.itemEl.style.gridRowEnd = `span ${newH}`;
            resizing.itemEl.dataset.w = newW;
            resizing.itemEl.dataset.h = newH;
        };

        const _onPointerUp = (e) => {
            if (!resizing) return;
            const finalW = parseInt(resizing.itemEl.dataset.w) || resizing.startW;
            const finalH = parseInt(resizing.itemEl.dataset.h) || resizing.startH;
            this.data.items[resizing.idx].grid_w = finalW;
            this.data.items[resizing.idx].grid_h = finalH;
            try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (err) {}
            resizing = null;
            this.renderGrid();
        };

        window.addEventListener('pointermove', _onPointerMove);
        window.addEventListener('pointerup', _onPointerUp);

        this.changeModalZ = (delta) => {
            const el = document.getElementById('edit-item-zindex');
            if (el) el.value = Math.max(0, (parseInt(el.value) || 0) + delta);
        };

        gridContainer.addEventListener('dragstart', (e) => {
            if (!this.editMode) return;
            const item = e.target.closest('.grid-item');
            if (item) {
                draggedId = item.dataset.id;
                this.draggedItemDims = { w: parseInt(item.dataset.w), h: parseInt(item.dataset.h) };
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => item.classList.add('dragging'), 0);
                const hl = document.getElementById('drag-highlight');
                if(hl) { hl.style.display = 'block'; hl.style.gridColumn = item.style.gridColumn; hl.style.gridRow = item.style.gridRow; }
            }
        });

        gridContainer.addEventListener('dragend', (e) => {
            const item = e.target.closest('.grid-item');
            if (item) item.classList.remove('dragging');
            draggedId = null; this.draggedItemDims = null;
            const hl = document.getElementById('drag-highlight');
            if(hl) hl.style.display = 'none';
        });

        gridContainer.addEventListener('dragover', (e) => {
            if (!this.editMode || !draggedId) return;
            e.preventDefault(); e.dataTransfer.dropEffect = 'move';
            const hl = document.getElementById('drag-highlight');
            if (!hl) return;

            const rect = gridContainer.getBoundingClientRect();
            const cols = parseInt(this.data.gridxsize);
            const gap = 15;
            const cellW = (rect.width - ((cols - 1) * gap)) / cols;
            const cellH = cellW;
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            let targetCol = Math.ceil(offsetX / ((rect.width + gap)/cols));
            let targetRow = Math.ceil(offsetY / (cellH + gap));
            if (targetCol < 1) targetCol = 1; if (targetCol > cols) targetCol = cols;
            if (targetRow < 1) targetRow = 1;

            if (targetCol + this.draggedItemDims.w - 1 > cols) targetCol = Math.max(1, cols - this.draggedItemDims.w + 1);

            hl.style.gridColumnStart = targetCol; hl.style.gridColumnEnd = `span ${this.draggedItemDims.w}`;
            hl.style.gridRowStart = targetRow; hl.style.gridRowEnd = `span ${this.draggedItemDims.h}`;
        });

        gridContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.editMode || !draggedId) return;
            const hl = document.getElementById('drag-highlight');
            if(!hl) return;

            const style = window.getComputedStyle(hl);
            const targetCol = parseInt(style.gridColumnStart);
            const targetRow = parseInt(style.gridRowStart);

            const imgIndex = this.data.items.findIndex(i => i.publicid === draggedId);
            if (imgIndex > -1) {
                this.data.items[imgIndex].startpositionx = targetCol;
                this.data.items[imgIndex].startpositiony = targetRow;
                this.renderGrid();
            }
        });
    },
    
    deleteItem: async (id) => {
        if (!(await Utils.confirm('Excluir esta mídia?'))) return;
        await GaleriaManager.apiDelete(`/api/galeria/${GaleriaManager.galleryId}/item/${id}`, id);
        try {
            const modalEl = document.getElementById('modalEditItem');
            const currentId = document.getElementById('edit-item-id')?.value;
            if (modalEl && currentId && currentId === id) { bootstrap.Modal.getInstance(modalEl)?.hide(); }
        } catch (e) {}
    },
    deleteGallery: async () => { if (await Utils.confirm('Excluir a galeria INTEIRA?')) GaleriaManager.apiDelete(`/api/galeria/${GaleriaManager.galleryId}`, null, '/galerias'); },
    
    apiDelete(url, itemId, redirect) {
        return fetch(url, { method: 'DELETE' }).then(res => res.json()).then(json => {
            if (json.success) {
                if (redirect) window.location.href = redirect;
                else { this.data.items = this.data.items.filter(i => i.publicid !== itemId); this.renderGrid(); }
            } else { Utils.alert('Falha na exclusão'); }
        }).catch(e => Utils.alert('Falha na exclusão'));
    },
    
    getMediaType: (arg) => {
        if (!arg) return 'image';
        if (typeof arg === 'object') {
            const mt = (arg.mimetype || '').toLowerCase();
            if (mt.startsWith('video/')) return 'video';
            if (mt.startsWith('audio/')) return 'audio';
            arg = arg.contenturl || arg.coverurl || '';
        }
        const u = (arg || '').toLowerCase();
        if (/\.(mp4|mov|webm|m4v|mkv|avi)(?:\?|$)/.test(u)) return 'video';
        if (/\.(mp3|wav|ogg|flac|m4a)(?:\?|$)/.test(u)) return 'audio';
        return 'image';
    }
};

document.addEventListener('DOMContentLoaded', () => GaleriaManager.init());