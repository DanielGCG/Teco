const Utils = {
    alert: (msg, title) => alert(msg),
    confirm: async (msg, title) => confirm(msg),
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
    originalDataItems: null,

    debouncedSearchUsers: Utils.debounce(function() {
        GaleriaManager.searchUsers();
    }, 300),

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

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-user-input') && !e.target.closest('#search-results')) {
                const results = document.getElementById('search-results');
                if (results) results.style.display = 'none';
            }
        });
    },

    copiarLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            Utils.alert('Link copiado para a área de transferência!', 'Sucesso');
        }).catch(err => {
            console.error('Erro ao copiar link', err);
            Utils.alert('Erro ao copiar link.', 'Erro');
        });
    },

    async exportarImagem() {
        const element = document.getElementById('image-list');
        if (!element) return;
        
        try {
            Utils.alert('Gerando imagem da galeria, aguarde...', 'Aviso');
            
            // Temporarily apply background image to element so html2canvas captures it
            const originalBgImage = element.style.backgroundImage;
            const originalBgSize = element.style.backgroundSize;
            const originalBgRepeat = element.style.backgroundRepeat;
            
            if (this.data.backgroundurl) {
                element.style.backgroundImage = `url('${this.data.backgroundurl}')`;
                element.style.backgroundRepeat = this.data.backgroundfill === 'repeat' ? 'repeat' : 'no-repeat';
                element.style.backgroundSize = this.data.backgroundfill === 'repeat' ? 'auto' : 'cover';
            }
            
            const canvas = await html2canvas(element, {
                useCORS: true,
                allowTaint: false,
                backgroundColor: this.data.backgroundcolor || '#d9d7bf',
                scale: 1.5 // Melhor qualidade
            });
            
            // Restore original styles
            element.style.backgroundImage = originalBgImage;
            element.style.backgroundSize = originalBgSize;
            element.style.backgroundRepeat = originalBgRepeat;
            
            const link = document.createElement('a');
            link.download = `galeria-${this.data.name || 'export'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error(err);
            Utils.alert('Erro ao exportar imagem.', 'Erro');
        }
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
            
            this.data.items?.forEach(item => {
                item.startpositionx = Math.max(1, parseInt(item.startpositionx) || 1);
                item.startpositiony = Math.max(1, parseInt(item.startpositiony) || 1);
                item.grid_w = Math.max(1, item.endpositionx ? (item.endpositionx - item.startpositionx + 1) : 1);
                item.grid_h = Math.max(1, item.endpositiony ? (item.endpositiony - item.startpositiony + 1) : 1);
            });

            this.collaborators = (this.data.collaborators || []).map(c => ({ publicid: c.publicid, username: c.username }));
            this.render();
        } catch (err) { console.error(err); Utils.alert('Erro ao carregar dados.', 'Erro'); }
    },

    updateGridMetrics(tempData = null) {
        const grid = document.getElementById('image-list');
        const data = tempData || this.data;
        if (!grid || !data || !data.gridxsize) return;

        const cols = parseInt(data.gridxsize) || 12;
        const containerWidth = grid.getBoundingClientRect().width;

        if (containerWidth > 0) {
            const gap = containerWidth * 0.0125;
            const cellWidth = (containerWidth - ((cols - 1) * gap)) / cols;
            grid.style.setProperty('--cell-size', `${cellWidth}px`);
            grid.style.setProperty('--row-height', `${cellWidth}px`);
            grid.style.setProperty('--gallery-gap', `${gap}px`);
            
            const radius = containerWidth * (16 / 1200);
            const radiusSmall = containerWidth * (8 / 1200);
            grid.style.setProperty('--gallery-radius', `${radius}px`);
            grid.style.setProperty('--gallery-radius-small', `${radiusSmall}px`);
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
        if (desc) {
            desc.textContent = this.data.description;
            if (this.data.description && this.data.description.trim() !== '') {
                desc.style.display = 'block';
            } else {
                desc.style.display = 'none';
            }
        }
        
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
            grid.innerHTML = `
                <div class="col-12 text-center py-5 grid-full-width" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; background: rgba(255, 255, 255, 0.1); border-radius: 12px; border: 2px dashed rgba(0, 0, 0, 0.2); margin: 20px;">
                    <h3 style="margin: 0 0 10px 0; opacity: 0.8;">Sua galeria está vazia</h3>
                    <p style="opacity: 0.7; margin-bottom: 20px;">Comece a adicionar fotos, vídeos ou áudios para dar vida a sua galeria.</p>
                    <button class="window-btn" onclick="GaleriaManager.openUploadModal()" style="font-size: 16px; padding: 10px 20px; cursor: pointer;">+ Adicionar Mídia</button>
                </div>
            `;
            return;
        }

        this.ensureCoordinates();
        this.updateGridMetrics();

        const cols = this.data.gridxsize;
        grid.style.setProperty('--gallery-columns', cols);

        let maxY = 0;
        this.data.items.forEach(item => {
            const endY = (item.startpositiony || 1) + (item.grid_h || 1) - 1;
            if (endY > maxY) maxY = endY;
        });
        
        // Garantir sempre 1 linha adicional abaixo do último item
        const totalRows = Math.max(maxY + 1, 3);
        grid.style.gridTemplateRows = `repeat(${totalRows}, var(--row-height))`;

        const itemsHtml = this.data.items.map(item => {
            const safeName = Utils.escapeHtml(item.title || 'Sem título');
            const safeUrl = (item.contenturl || '').replace(/'/g, "\\'");
            const type = this.getMediaType(item);
            
            const w = item.grid_w;
            const h = item.grid_h;
            const x = item.startpositionx;
            const y = item.startpositiony;
            
            const showTitle = (item.showtitle !== false);
            const fit = item.objectfit; 
            const isItemRounded = (item.roundedcorners !== false && item.roundedcorners !== 'false' && item.roundedcorners !== '0' && item.roundedcorners !== 0);
            const extraStyle = isItemRounded ? '' : '--gallery-radius: 0px;';
            
            let previewSrc = item.coverurl;
            if (previewSrc === item.contenturl && type !== 'image' && type !== 'link') previewSrc = '';
            if (!previewSrc && type === 'image') previewSrc = item.contenturl;
            
            let content;
            if (type === 'video') {
                content = previewSrc ? `<img src="${previewSrc}" class="media-preview-box fit-${fit}" loading="lazy">` : `<video src="${item.contenturl}" class="media-preview-box fit-${fit}" controls preload="metadata" playsinline muted></video>`;
            } else if (type === 'audio') {
                content = previewSrc ? `<img src="${previewSrc}" class="media-preview-box fit-${fit}" loading="lazy">` : `<div class="media-preview-box placeholder-audio" style="display:flex; align-items:center; justify-content:center; background:#ccc; font-size:48px;">🎵</div>`;
            } else if (type === 'text') {
                content = `<div class="media-preview-box" style="display: block; background: var(--gallery-card-bg, #ffffff); color: inherit; border: 2px inset #fff; padding: 10px; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; font-size: 14px; text-align: center; word-break: break-word; white-space: pre-wrap;">${Utils.escapeHtml(item.textbody || '')}</div>`;
            } else if (type === 'link') {
                content = previewSrc ? `<img src="${previewSrc}" class="media-preview-box fit-${fit}" loading="lazy">` : `<div class="media-preview-box" style="display:flex; align-items:center; justify-content:center; background: #eee; font-size:48px; border: 2px outset #fff;">🔗</div>`;
            } else {
                content = `<img src="${previewSrc || item.contenturl || ''}" class="media-preview-box fit-${fit}" loading="lazy">`;
            }

            const onclick = (type === 'link' && safeUrl) 
                ? `window.open('${safeUrl}', '_blank')` 
                : `GaleriaManager.openMedia('${safeUrl}', '${type}', '${safeName}', '${previewSrc || ''}', \`${(item.textbody || '').replace(/`/g, '\\`')}\`)`;

            const editControls = this.editMode ? `
                <div class="edit-overlay" style="display: flex; gap: 5px;">
                    <button type="button" class="window-btn" title="Editar" onclick="event.stopPropagation(); GaleriaManager.openEditItem('${item.publicid}')">
                        Editar
                    </button>
                    <button type="button" class="window-btn" title="Excluir" onclick="event.stopPropagation(); GaleriaManager.deleteItem('${item.publicid}')" style="color: red; font-weight: bold;">
                        X
                    </button>
                </div>
                <div class="resize-handle window-btn" data-id="${item.publicid}" title="Redimensionar" style="display: flex; align-items: center; justify-content: center; padding: 2px 6px; font-weight: bold; background: #c0c0c0; border: 2px outset #fff; border-bottom: 2px solid #555; border-right: 2px solid #555; position: absolute; bottom: 5px; right: 5px; cursor: nwse-resize; width: auto; height: auto; border-radius: 0;">
                    &#8690;
                </div>
            ` : '';

            return `
            <div class="grid-item" data-id="${item.publicid}" data-w="${w}" data-h="${h}" ${this.editMode ? 'draggable="true"' : ''} style="grid-column: ${x} / span ${w}; grid-row: ${y} / span ${h};">
                <div class="image-card ${showTitle ? 'has-title' : 'no-title'}" style="position: relative; z-index: ${item.positionz || 0}; ${extraStyle}" onclick="${onclick}">
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
        
        const roundedCheck = document.getElementById('edit-item-rounded');
        if (roundedCheck) roundedCheck.checked = (item.roundedcorners !== false && item.roundedcorners !== 'false' && item.roundedcorners !== '0' && item.roundedcorners !== 0);
        
        document.getElementById('edit-item-fit').value = item.objectfit;
        const zinput = document.getElementById('edit-item-zindex');
        if (zinput) zinput.value = item.positionz || 0;

        const current = document.getElementById('edit-item-current-cover');
        const type = this.getMediaType(item);
        
        const textGroup = document.getElementById('edit-item-text-group');
        const textBodyInput = document.getElementById('edit-item-textbody');
        if (type === 'text') {
            if (textGroup) textGroup.style.display = 'block';
            if (textBodyInput) textBodyInput.value = item.textbody || '';
        } else {
            if (textGroup) textGroup.style.display = 'none';
            if (textBodyInput) textBodyInput.value = '';
        }

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
                let actualCoverUrl = item.coverurl;
                if (actualCoverUrl === item.contenturl && type !== 'image') actualCoverUrl = '';
                
                if (actualCoverUrl) {
                    current.style.display = '';
                    current.innerHTML = `
                        <div class="d-flex align-items-center gap-2">
                            <img src="${actualCoverUrl}" style="max-height:80px; max-width:120px; object-fit:cover; border-radius:8px;"/>
                            <div style="flex: 1;">
                                <div style="font-size: 11px; color: gray;">Capa Atual</div>
                                <div style="margin-top: 5px;"><button type="button" onclick="GaleriaManager.markRemoveCover('${item.publicid}')" style="color: red; border: 1px solid red; background: transparent; border-radius: 4px; padding: 2px 5px; cursor: pointer;">Remover Capa</button></div>
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
        document.getElementById('modalEditItem').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
    },

    async handleEditItemSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('edit-item-id').value;
        if (!id) return Utils.alert('ID do item faltando.');

        try {
            const fd = new FormData(e.target);
            fd.set('showtitle', document.getElementById('edit-item-showtitle').checked);
            
            const roundedCheck = document.getElementById('edit-item-rounded');
            if (roundedCheck) fd.set('roundedcorners', roundedCheck.checked);
            
            if (document.getElementById('edit-flag-remove-cover').value === 'true') fd.set('remove_cover', 'true');
            
            const zEl = document.getElementById('edit-item-zindex');
            if (zEl) fd.set('positionz', parseInt(zEl.value) || 0);

            const res = await fetch(`/api/galeria/${this.galleryId}/item/${id}`, { method: 'PATCH', body: fd });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Erro ao atualizar item');

            const idx = this.data.items.findIndex(i => i.publicid === id);
            if (idx > -1) this.data.items[idx] = { ...this.data.items[idx], ...json.item };

            document.getElementById('modalEditItem').style.display = 'none';
            document.getElementById('modalBackdrop').style.display = 'none';
            this.renderGrid();
            Utils.alert('Item atualizado com sucesso!', 'Sucesso');
        } catch (err) { console.error(err); Utils.alert(err.message, 'Erro'); }
    },

    toggleEditMode() {
        this.editMode = !this.editMode;
        
        const btnEdit = document.getElementById('btn-edit-mode');
        const btnSave = document.getElementById('btn-save-layout');
        
        if (this.editMode) {
            this.originalDataItems = JSON.stringify(this.data.items);
            if(btnEdit) {
                btnEdit.classList.remove('btn-outline-secondary');
                btnEdit.classList.add('btn-warning');
                btnEdit.textContent = 'Sair da Edição';
            }
            if(btnSave) {
                btnSave.style.display = 'inline-block';
                btnSave.style.fontWeight = 'normal';
                btnSave.style.color = '';
                btnSave.textContent = 'Salvar Layout';
            }
        } else {
            if (this.originalDataItems) {
                this.data.items = JSON.parse(this.originalDataItems);
                this.originalDataItems = null;
            }
            if(btnEdit) {
                btnEdit.classList.remove('btn-warning');
                btnEdit.classList.add('btn-outline-secondary');
                btnEdit.textContent = 'Editar Layout';
            }
            if(btnSave) {
                btnSave.style.display = 'none';
                btnSave.style.fontWeight = 'normal';
                btnSave.style.color = '';
                btnSave.textContent = 'Salvar Layout';
            }
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
                this.originalDataItems = JSON.stringify(this.data.items);
                const btnSave = document.getElementById('btn-save-layout');
                if (btnSave) {
                    btnSave.style.fontWeight = 'normal';
                    btnSave.style.color = '';
                    btnSave.textContent = 'Salvar Layout';
                }
                this.toggleEditMode();
                Utils.alert('Layout salvo com sucesso!', 'Sucesso');
            } else throw new Error(json.message);
        } catch (err) { Utils.alert('Erro ao salvar layout', 'Erro'); }
    },

    markLayoutChanged() {
        const btnSave = document.getElementById('btn-save-layout');
        if (btnSave) {
            btnSave.style.fontWeight = 'bold';
            btnSave.style.color = 'red';
            btnSave.textContent = '* Salvar Layout *';
        }
    },

    applyStyles(s) {
        const el = document.getElementById('conteudo-principal');
        if (!el) return;
        const bg = s.backgroundurl;
        
        document.body.style.backgroundColor = '';
        document.body.style.backgroundImage = '';
        document.body.style.backgroundRepeat = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundAttachment = '';
        
        const bgTarget = document.getElementById('retro-body-td') || el.closest('td') || el;
        
        Object.assign(bgTarget.style, {
            backgroundColor: s.backgroundcolor,
            backgroundImage: bg ? `url('${bg}')` : 'none',
            backgroundRepeat: s.backgroundfill === 'repeat' ? 'repeat' : 'no-repeat',
            backgroundSize: s.backgroundfill === 'repeat' ? 'auto' : 'cover',
            backgroundAttachment: 'fixed',
            color: s.fontcolor
        });
        
        Object.assign(el.style, {
            color: s.fontcolor
        });

        if (s.gridxsize) {
            document.getElementById('image-list')?.style.setProperty('--gallery-columns', s.gridxsize);
        }
        this.updateGridMetrics(s);
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

        if (clean.toLowerCase().includes('comic sans')) family = `'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', 'Comic Neue', cursive`;
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


    
    async handleUpload(e) { 
        e.preventDefault();
        const form = e.target;
        const typeEl = document.querySelector('input[name="item_type"]:checked');
        const type = typeEl ? typeEl.value : 'media';
        
        const btn = document.getElementById('btn-submit-upload');
        const prog = document.getElementById('upload-progress-wrapper');
        btn.disabled = true; prog.style.display = 'block';

        const cols = parseInt(this.data.gridxsize) || 12;
        const suggestedSize = (cols >= 9 ? 3 : (cols >= 6 ? 2 : 1));

        try {
            const fd = new FormData(form);
            fd.append('grid_w', suggestedSize);
            fd.append('grid_h', suggestedSize);

            let res;
            if (type === 'media') {
                const file = form.fileInput.files[0];
                if (!file) throw new Error('Selecione um arquivo.');
                fd.delete('fileInput');
                fd.append('media', file);
                res = await this.uploadFileXHR(file, fd);
            } else {
                if (type === 'text') {
                    const textContent = document.getElementById('upload-text-content').value.trim();
                    if (!textContent) throw new Error('O texto não pode estar vazio.');
                } else if (type === 'link') {
                    const linkUrl = document.getElementById('upload-link-url').value.trim();
                    if (!linkUrl) throw new Error('A URL do link não pode estar vazia.');
                }
                fd.delete('fileInput');
                res = await this.uploadFileXHR(null, fd);
            }

            if (res.success) {
                res.item.grid_w = res.item.grid_h = suggestedSize;
                this.data.items.push(res.item);
                this.ensureCoordinates();
                this.renderGrid();
                const form = document.getElementById('formUpload');
                if (form) form.reset();
                document.getElementById('modalUpload').style.display = 'none';
                document.getElementById('modalBackdrop').style.display = 'none';
                Utils.alert('Item adicionado com sucesso!');
            }
        } catch (err) { Utils.alert(err.message, 'Erro'); }
        finally { btn.disabled = false; prog.style.display = 'none'; this.resetProgress(); }
    },

    openUploadModal() {
        const form = document.getElementById('formUpload');
        if (form) form.reset();
        this.toggleUploadType();
        document.getElementById('upload-progress-wrapper').style.display = 'none';
        document.getElementById('modalUpload').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
    },

    toggleUploadType() {
        const typeEl = document.querySelector('input[name="item_type"]:checked');
        if (!typeEl) return;
        const type = typeEl.value;
        
        document.getElementById('upload-group-media').style.display = type === 'media' ? 'block' : 'none';
        document.getElementById('upload-group-text').style.display = type === 'text' ? 'block' : 'none';
        document.getElementById('upload-group-link').style.display = type === 'link' ? 'flex' : 'none';
        
        const fileInput = document.getElementById('upload-file-input');
        if (type === 'media') {
            fileInput.setAttribute('required', 'required');
        } else {
            fileInput.removeAttribute('required');
        }
    },

    uploadFileXHR(file, formDataOrForm) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const data = (formDataOrForm instanceof FormData) ? formDataOrForm : new FormData(formDataOrForm);
            // We shouldn't append 'media' twice if it's already in formDataOrForm.
            // addItem() already does fd.append('media', file)
            // But just in case formDataOrForm was an HTMLFormElement without 'media':
            if (file && !data.has('media')) {
                data.append('media', file);
            }
            data.delete('fileInput'); // Ensure fileInput is deleted
            
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

    openMedia(url, type, name, coverUrl = '', textBody = '') {
        const container = document.getElementById('media-container');
        document.getElementById('media-caption').textContent = name || '';
        let content;
        if (type === 'video') content = `<video src="${url}" controls autoplay class="img-fluid rounded shadow" style="max-height:80vh"></video>`;
        else if (type === 'audio') {
            if (coverUrl) {
                content = `
                <div class="p-3 bg-dark rounded shadow border text-center" style="max-width: 400px; margin: 0 auto;">
                    <img src="${coverUrl}" class="img-fluid rounded mb-3" style="max-height:300px; object-fit:contain;">
                    <audio controls autoplay class="w-100" oncanplay="this.volume=0.4"><source src="${url}"></audio>
                </div>`;
            } else {
                content = `<div class="p-5 bg-dark rounded border"><i class="bi bi-music-note-beamed display-1 text-info"></i><audio controls autoplay class="d-block mt-3" oncanplay="this.volume=0.4"><source src="${url}"></audio></div>`;
            }
        }
        else if (type === 'text') {
            content = `<div class="window-content" style="background: var(--gallery-card-bg, #ffffff); color: inherit; padding: 20px; font-size: 16px; border: 2px inset white; max-width: 600px; max-height: 80vh; overflow-y: auto; overflow-x: hidden; text-align: left; word-break: break-word; white-space: pre-wrap;">${Utils.escapeHtml(textBody)}</div>`;
        }
        else if (type === 'link') {
            content = `<div class="window-content" style="background: var(--retro-window-bg); padding: 20px; font-size: 16px; border: 2px inset white;"><a href="${url}" target="_blank">Acessar Link Externo</a></div>`;
        }
        else content = `<img src="${url}" class="img-fluid rounded shadow" style="max-height:80vh">`;

        container.innerHTML = `<div style="position:relative; display:inline-block;">${content}</div>`;
        document.getElementById('modalMedia').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
    },

    openConfigModal() {
        const principal = document.getElementById('conteudo-principal');
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
        document.getElementById('modalConfig').style.display = 'block';
        document.getElementById('modalBackdrop').style.display = 'block';
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
        const results = document.getElementById('search-results');
        if (!results) return;

        if (!q || q.trim().length < 2) {
            results.style.display = 'none';
            results.innerHTML = '';
            return;
        }

        try {
            const res = await fetch(`/api/users/buscar?limit=20&q=${encodeURIComponent(q)}`);
            const json = await res.json();
            const list = json.users || json.usuarios || [];
            if (list.length > 0) {
                results.innerHTML = list.map(u => `
                    <div style="padding: 5px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 11px;" 
                         onclick="GaleriaManager.addCollaborator('${u.publicid}', '${u.username}')">
                        <img src="${u.profileimage}" style="vertical-align: middle; width: 20px; height: 20px; margin-right: 5px; border: 1px solid #ccc; object-fit: cover;">
                        <b style="color: black;">${u.username}</b>
                    </div>
                `).join('');
            } else {
                results.innerHTML = '<div style="padding: 10px; font-size: 11px; color: #666;">Nenhum usuário...</div>';
            }
            results.style.display = 'block';
        } catch (err) { console.error(err); }
    },

    debouncedSearchUsers: Utils.debounce(function() {
        this.searchUsers();
    }, 300),

    addCollaborator(id, name) {
        if (!this.collaborators.find(c => c.publicid === id)) {
            this.collaborators.push({ publicid: id, username: name });
            this.renderCollaborators();
        }
        const input = document.getElementById('search-user-input');
        if (input) input.value = '';
        const results = document.getElementById('search-results');
        if (results) results.style.display = 'none';
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
                        const temp = { ...this.data };
                        for(let [k, v] of fd.entries()) {
                            if (k !== 'cover' && k !== 'background') temp[k] = v;
                        }
                        temp.ispublic = fd.has('ispublic');
                        this.applyStyles(temp);
                        Object.assign(this.data, json.gallery);
                        this.originalStyles = null;
                        document.getElementById('modalConfig').style.display = 'none';
                        document.getElementById('modalBackdrop').style.display = 'none';
                        this.render();
                        Utils.alert('Configurações salvas com sucesso!', 'Sucesso');
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
                    const el = document.getElementById('conteudo-principal');
                    if (el) el.setAttribute('style', this.originalStyles);
                    
                    const bgTarget = document.getElementById('retro-body-td') || (el ? el.closest('td') : null);
                    if (bgTarget && bgTarget !== el) {
                        bgTarget.style.backgroundImage = '';
                        bgTarget.style.backgroundColor = '';
                        bgTarget.style.backgroundRepeat = '';
                        bgTarget.style.backgroundSize = '';
                        bgTarget.style.backgroundAttachment = '';
                        bgTarget.style.color = '';
                    }

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
            
            if (finalW !== resizing.startW || finalH !== resizing.startH) {
                this.markLayoutChanged();
            }

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
                if (this.data.items[imgIndex].startpositionx !== targetCol || this.data.items[imgIndex].startpositiony !== targetRow) {
                    this.markLayoutChanged();
                }
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
            if (arg.type) return arg.type;
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