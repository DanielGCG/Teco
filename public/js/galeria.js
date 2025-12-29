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
    galleryId: null, // Unified: galleryId
    collaborators: [], // Unified: collaborators
    originalStyles: null,
    previewBgUrl: null,
    editMode: false,
    lastAppliedFont: null,
    resizeObserver: null,
    draggedItemDims: null,

    async init() {
        const mainEl = document.getElementById('main-content'); // Changed ID to English in HTML
        if (!mainEl) return;
        
        let id = mainEl.dataset.galleryId;
        if (!id || id === 'undefined') {
            const parts = window.location.pathname.split('/').filter(p => p);
            const last = parts.pop();
            if (last && !['galeria', 'galerias'].includes(last.toLowerCase())) id = last;
        }

        if (!id) return Utils.alert('Gallery ID not found.', 'Critical Error');
        
        this.galleryId = id;
        
        this.resizeObserver = new ResizeObserver(Utils.debounce(() => this.updateGridMetrics(), 50));
        const grid = document.getElementById('image-list'); // Changed ID to English in HTML
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
            current.innerHTML = `<div class="small text-danger">Cover marked for removal</div>`;
            current.style.display = '';
        }
    },

    async loadData() {
        try {
            const res = await fetch(`/api/galeria/${this.galleryId}`);
            const json = await res.json();
            if (!json.success) throw new Error(json.message);
            
            this.data = {
                ...json.gallery,
                // Fallbacks only for defaults, not name mapping
                background_fill: json.gallery.background_fill || 'cover',
                font_color: json.gallery.font_color || '#3E3F29'
            };
            this.collaborators = (this.data.collaborators || []).map(c => ({ id: c.id, username: c.username }));
            this.render();
        } catch (err) { console.error(err); Utils.alert('Error loading data.', 'Error'); }
    },

    updateGridMetrics() {
        const grid = document.getElementById('image-list');
        if (!grid || !this.data) return;

        const cols = parseInt(this.data.grid_columns || 12);
        const gap = 15;
        const containerWidth = grid.getBoundingClientRect().width;

        if (containerWidth > 0) {
            const cellWidth = (containerWidth - ((cols - 1) * gap)) / cols;
            grid.style.setProperty('--cell-size', `${cellWidth}px`);
            grid.style.setProperty('--row-height', `${Math.floor(cellWidth)}px`);
        }
    },

    ensureCoordinates() {
        if (!this.data.items) return; // Changed from imagens to items
        
        const cols = parseInt(this.data.grid_columns || 12);
        const map = {}; 
        const isOccupied = (x, y, w, h) => {
            for(let i=0; i<w; i++) for(let j=0; j<h; j++) if(map[`${x+i},${y+j}`]) return true;
            return false;
        };
        const markOccupied = (x, y, w, h) => {
            for(let i=0; i<w; i++) for(let j=0; j<h; j++) map[`${x+i},${y+j}`] = true;
        };

        this.data.items.forEach(item => {
            if(item.col_start && item.row_start) markOccupied(item.col_start, item.row_start, item.grid_w || 1, item.grid_h || 1);
        });

        let currentY = 1, currentX = 1;
        this.data.items.forEach(item => {
            const w = item.grid_w || 1, h = item.grid_h || 1;
            if(!item.col_start || !item.row_start) {
                while(true) {
                    if (currentX + w - 1 > cols) { currentX = 1; currentY++; }
                    if (!isOccupied(currentX, currentY, w, h)) {
                        item.col_start = currentX; item.row_start = currentY;
                        markOccupied(currentX, currentY, w, h); break; 
                    }
                    currentX++;
                }
            }
        });
    },

    render() {
        if (!this.data) return;
        const title = document.getElementById('gallery-title');
        if (title) title.textContent = this.data.name;
        
        const desc = document.getElementById('gallery-description');
        if (desc) desc.textContent = this.data.description || '';
        
        const author = document.getElementById('gallery-author');
        if (author) author.textContent = this.data.owner?.username || 'Unknown';
        
        this.applyStyles(this.data);
        this.renderActionButtons();
        this.renderGrid();
    },

    renderActionButtons() {
        const container = document.getElementById('gallery-actions');
        if (!container) return;
        const editClass = this.editMode ? 'btn-warning' : 'btn-outline-secondary';
        const label = this.editMode ? 'Exit' : 'Edit';
        
        container.innerHTML = `
            <button class="btn btn-primary shadow-sm" onclick="GaleriaManager.openUploadModal()">
                <i class="bi bi-plus-lg"></i> <span class="d-none d-sm-inline">Add Media</span>
            </button>
            <button class="btn ${editClass} ms-2" onclick="GaleriaManager.toggleEditMode()" title="Toggle Edit Mode">
                <i class="bi bi-grid-3x3-gap-fill"></i> <span class="d-none d-sm-inline">${label}</span>
            </button>
            ${this.editMode ? `<button class="btn btn-success ms-2" onclick="GaleriaManager.saveLayout()" title="Save layout changes"><i class="bi bi-save"></i> Save</button>` : ''}
            <button class="btn btn-light border shadow-sm" onclick="GaleriaManager.openConfigModal()" title="Gallery Settings"><i class="bi bi-gear-fill"></i></button>
        `;
    },

    renderGrid() {
        const grid = document.getElementById('image-list');
        if (!grid) return;
        
        if (this.editMode) grid.parentElement.classList.add('edit-mode');
        else grid.parentElement.classList.remove('edit-mode');

        if (!this.data.items?.length) {
            grid.innerHTML = '<div class="col-12 text-center text-muted py-5 grid-full-width">Gallery is empty. Add content!</div>';
            return;
        }

        this.ensureCoordinates();
        this.updateGridMetrics();

        const cols = this.data.grid_columns || 12;
        grid.style.setProperty('--gallery-columns', cols);

        const itemsHtml = this.data.items.map(item => {
            const safeName = Utils.escapeHtml(item.name || 'Untitled');
            const safeUrl = (item.content_url || '').replace(/'/g, "\\'");
            const type = this.getMediaType(item);
            
            const w = item.grid_w || 1;
            const h = item.grid_h || 1;
            const x = item.col_start || 1;
            const y = item.row_start || 1;
            
            const showTitle = (item.show_title !== false);
            // Standardized: object_fit
            const fit = item.object_fit || 'cover'; 
            const previewSrc = item.cover_url || (type === 'image' ? item.content_url : '');
            
            let content;
            if (type === 'video') {
                content = item.cover_url ? `<img src="${item.cover_url}" class="media-preview-box fit-${fit}" loading="lazy">` : `<video src="${item.content_url}" class="media-preview-box fit-${fit}" controls preload="metadata" playsinline muted></video>`;
            } else if (type === 'audio') {
                content = previewSrc ? `<img src="${previewSrc}" class="media-preview-box fit-${fit}" loading="lazy">` : `<div class="media-preview-box placeholder-audio d-flex align-items-center justify-content-center"><div class="audio-cover"><i class="bi bi-volume-up-fill audio-icon"></i></div></div>`;
            } else {
                content = `<img src="${previewSrc || item.content_url || ''}" class="media-preview-box fit-${fit}" loading="lazy">`;
            }

            const editControls = this.editMode ? `
                <div class="edit-overlay">
                    <button class="btn btn-xs btn-light border" title="Edit" onclick="event.stopPropagation(); GaleriaManager.openEditItem(${item.id})">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </div>
                <button class="btn-delete" onclick="event.stopPropagation(); GaleriaManager.deleteItem(${item.id})" title="Delete"><i class="bi bi-trash"></i></button>
                <div class="resize-handle" data-id="${item.id}" title="Resize"><i class="bi bi-arrows-angle-expand"></i></div>
            ` : '';

            return `
            <div class="grid-item" data-id="${item.id}" data-w="${w}" data-h="${h}" ${this.editMode ? 'draggable="true"' : ''} style="grid-column: ${x} / span ${w}; grid-row: ${y} / span ${h}; z-index: ${item.z_index || 0};">
                <div class="image-card ${showTitle ? 'has-title' : 'no-title'}" onclick="GaleriaManager.openMedia('${safeUrl}', '${type}', '${safeName}')">
                    ${content}
                    ${showTitle ? `<div class="card-body"><small class="text-truncate fw-bold w-100">${safeName}</small></div>` : ''}
                </div>
                ${editControls}
            </div>`;
        }).join('');

        grid.innerHTML = itemsHtml + `<div id="drag-highlight" class="grid-highlight"></div>`;
    },

    openEditItem(id) {
        const item = this.data.items.find(i => i.id === id);
        if (!item) return Utils.alert('Item not found.');
        const form = document.getElementById('formEditItem');
        if (!form) return Utils.alert('Edit form not found.');

        document.getElementById('edit-item-id').value = item.id;
        document.getElementById('edit-item-name').value = item.name || '';
        document.getElementById('edit-item-showtitle').checked = item.show_title !== false;
        document.getElementById('edit-item-fit').value = item.object_fit || 'cover'; // object_fit
        const zinput = document.getElementById('edit-item-zindex');
        if (zinput) zinput.value = item.z_index || 0;

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
                if (item.cover_url) {
                    current.style.display = '';
                    current.innerHTML = `
                        <div class="d-flex align-items-center gap-2">
                            <img src="${item.cover_url}" style="max-height:80px; max-width:120px; object-fit:cover; border-radius:8px;"/>
                            <div>
                                <div class="small text-muted">Current Cover</div>
                                <div class="mt-2"><button type="button" class="btn btn-sm btn-outline-danger" onclick="GaleriaManager.markRemoveCover(${item.id})">Remove Cover</button></div>
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
        if (!id) return Utils.alert('Item ID missing.');

        const fd = new FormData(form);
        fd.set('show_title', document.getElementById('edit-item-showtitle').checked);
        const zEl = document.getElementById('edit-item-zindex');
        if (zEl) fd.set('z_index', parseInt(zEl.value) || 0);

        try {
            // URL endpoint changed to English: /item/
            const res = await fetch(`/api/galeria/${this.galleryId}/item/${id}`, { method: 'PATCH', body: fd });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || 'Error updating item');

            const idx = this.data.items.findIndex(i => i.id === parseInt(id));
            if (idx > -1) this.data.items[idx] = { ...this.data.items[idx], ...json.item };

            bootstrap.Modal.getInstance(document.getElementById('modalEditItem')).hide();
            this.renderGrid();
            Utils.alert('Item updated successfully!', 'Success');
        } catch (err) { console.error(err); Utils.alert(err.message, 'Error'); }
    },

    toggleEditMode() {
        this.editMode = !this.editMode;
        this.renderActionButtons();
        this.renderGrid();
    },

    async saveLayout() {
        // Standardized Keys for Layout
        const layout = this.data.items.map((it) => ({ 
            id: it.id, 
            grid_w: it.grid_w || 1, 
            grid_h: it.grid_h || 1, 
            col_start: it.col_start || 1, 
            row_start: it.row_start || 1,
            z_index: it.z_index || 0, 
            show_title: it.show_title, 
            object_fit: it.object_fit 
        }));
        
        const formData = new FormData();
        formData.set('layout', JSON.stringify(layout));
        try {
            const res = await fetch(`/api/galeria/${this.galleryId}`, { method: 'PATCH', body: formData });
            const json = await res.json();
            if (json.success) {
                this.editMode = false;
                this.renderActionButtons();
                this.renderGrid();
                Utils.alert('Layout saved successfully!', 'Success');
            } else throw new Error(json.message);
        } catch (err) { Utils.alert('Error saving layout', 'Error'); }
    },

    applyStyles(s) {
        const el = document.getElementById('main-content');
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
            document.getElementById('image-list')?.style.setProperty('--gallery-columns', s.grid_columns);
            this.updateGridMetrics();
        }
        const cardColor = s.card_color || '#ffffff';
        el.style.setProperty('--gallery-card-bg', cardColor);
        document.querySelectorAll('.image-card .card-body').forEach(cb => cb.style.backgroundColor = cardColor);
        if (s.font_color) el.querySelectorAll('h2, p, small').forEach(t => t.style.color = s.font_color);
        this.manageFont(s.font_family); // font_family
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
        document.getElementById('main-content').style.fontFamily = family;
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

        try {
            const res = await this.uploadFileXHR(file, form);
            if (res.success) {
                const cols = parseInt(this.data.grid_columns) || 4;
                // Default new items to reasonable size based on cols
                res.item.grid_w = res.item.grid_h = (cols >= 9 ? 3 : (cols >= 6 ? 2 : 1));
                this.data.items.push(res.item);
                this.ensureCoordinates(); 
                this.renderGrid();
                bootstrap.Modal.getInstance(document.getElementById('modalUpload')).hide();
                form.reset();
                Utils.alert('Upload completed!');
            }
        } catch (err) { Utils.alert(err.message, 'Error'); }
        finally { btn.disabled = false; prog.style.display = 'none'; this.resetProgress(); }
    },

    uploadFileXHR(file, form) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const data = new FormData(form);
            data.delete('fileInput'); 
            // Key change: 'media'
            data.append('media', file);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100) + '%';
                    document.getElementById('upload-progress-bar').style.width = pct;
                    document.getElementById('upload-percent-text').textContent = pct;
                    document.getElementById('upload-size-text').textContent = `${Utils.formatSize(e.loaded)} / ${Utils.formatSize(e.total)}`;
                }
            };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(JSON.parse(xhr.responseText)) : reject(new Error('Upload failed'));
            xhr.onerror = () => reject(new Error('Network error'));
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
        const principal = document.getElementById('main-content');
        if (principal) this.originalStyles = principal.getAttribute('style');
        
        const f = document.getElementById('formConfig'); 
        if (f) f.reset();
        
        const d = this.data;
        const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
        const setCheck = (id, v) => { const el = document.getElementById(id); if(el) el.checked = v; };

        setVal('config-name', d.name);
        setVal('config-description', d.description || '');
        setCheck('config-is-public', d.is_public);
        setVal('config-bg-color', d.background_color);
        setVal('config-bg-fill', d.background_fill);
        setVal('config-card-color', d.card_color || '#ffffff');
        setVal('config-grid-columns', d.grid_columns || 12);
        setVal('config-font-color', d.font_color);
        setVal('config-font-family', d.font_family || ''); // font_family
        
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
                        <strong>Current:</strong> ${url.split('/').pop()}
                    </div>
                `;
                parent.appendChild(div);
            }
        };

        showCurrent('input-bg', d.background_url);
        showCurrent('input-cover', d.cover_url);
        
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
        const hasBg = !!this.data.background_url || (bgInput && bgInput.files && bgInput.files.length > 0);
        document.getElementById('group-bg-fill').style.display = hasBg ? '' : 'none';

        const getVal = (id) => document.getElementById(id)?.value || '';
        const flagBg = document.getElementById('flag-remove-bg');
        const removeBg = flagBg ? flagBg.value === 'true' : false;

        const s = {
            background_color: getVal('config-bg-color'),
            background_fill: getVal('config-bg-fill'),
            font_family: getVal('config-font-family'), // font_family
            font_color: getVal('config-font-color'),
            card_color: getVal('config-card-color'),
            grid_columns: getVal('config-grid-columns'),
            background_url: removeBg ? null : (this.previewBgUrl || this.data.background_url)
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
                // Assuming json.usuarios is legacy or needs change? keeping logic generic
                const list = json.users || json.usuarios || [];
                results.innerHTML = list.map(u => `<button type="button" class="list-group-item list-group-item-action" onclick="GaleriaManager.addCollaborator(${u.id}, '${u.username}')">${u.username}</button>`).join('');
            }
        } catch (e) { console.error(e); }
    },

    addCollaborator(id, username) {
        if (!this.collaborators.find(c => c.id === id)) this.collaborators.push({ id, username });
        this.renderCollaborators();
        document.getElementById('search-results').innerHTML = '';
    },
    removeCollaborator(id) { this.collaborators = this.collaborators.filter(c => c.id !== id); this.renderCollaborators(); },
    renderCollaborators() {
        const container = document.getElementById('collaborators-list'); // Changed ID
        if (container) container.innerHTML = this.collaborators.map(c => `<span class="badge bg-primary p-2">${c.username} <i class="bi bi-x-circle cursor-pointer ms-1" onclick="GaleriaManager.removeCollaborator(${c.id})"></i></span>`).join('');
    },
    togglePublicSection() {
        const section = document.getElementById('collaborators-section'); // Changed ID
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
                // Unified: collaborators
                fd.append('collaborators', JSON.stringify(this.collaborators.map(c => c.id)));
                if (document.getElementById('config-is-public')) fd.set('is_public', document.getElementById('config-is-public').checked);
                try {
                    const res = await fetch(`/api/galeria/${this.galleryId}`, { method: 'PATCH', body: fd });
                    const json = await res.json();
                    if (json.success) {
                        Object.assign(this.data, json.gallery);
                        this.originalStyles = null;
                        bootstrap.Modal.getInstance(document.getElementById('modalConfig')).hide();
                        this.render();
                        Utils.alert('Saved successfully!');
                    }
                } catch (err) { Utils.alert('Error saving.'); }
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
                    const el = document.getElementById('main-content');
                    if (el) el.setAttribute('style', this.originalStyles);
                    if (document.getElementById('image-list')) document.getElementById('image-list').style.setProperty('--gallery-columns', this.data.grid_columns || 12);
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
            const id = parseInt(handle.dataset.id);
            const itemEl = gridContainer.querySelector(`.grid-item[data-id="${id}"]`);
            if (!itemEl) return;
            const idx = this.data.items.findIndex(i => i.id === id);
            if (idx === -1) return;

            const item = this.data.items[idx];
            resizing = { id, itemEl, idx, colStart: item.col_start || 1, rowStart: item.row_start || 1, startW: item.grid_w || 1, startH: item.grid_h || 1 };
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
                draggedId = parseInt(item.dataset.id);
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
            const cols = parseInt(this.data.grid_columns || 12);
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

            const imgIndex = this.data.items.findIndex(i => i.id === draggedId);
            if (imgIndex > -1) {
                this.data.items[imgIndex].col_start = targetCol;
                this.data.items[imgIndex].row_start = targetRow;
                this.renderGrid();
            }
        });
    },
    
    deleteItem: async (id) => {
        if (!(await Utils.confirm('Delete this media?'))) return;
        await GaleriaManager.apiDelete(`/api/galeria/${GaleriaManager.galleryId}/item/${id}`, id);
        try {
            const modalEl = document.getElementById('modalEditItem');
            const currentId = document.getElementById('edit-item-id')?.value;
            if (modalEl && currentId && parseInt(currentId) === parseInt(id)) { bootstrap.Modal.getInstance(modalEl)?.hide(); }
        } catch (e) {}
    },
    deleteGallery: async () => { if (await Utils.confirm('Delete ENTIRE gallery?')) GaleriaManager.apiDelete(`/api/galeria/${GaleriaManager.galleryId}`, null, '/galerias'); },
    
    async apiDelete(url, itemId, redirect) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if ((await res.json()).success) {
                if (redirect) window.location.href = redirect;
                else { this.data.items = this.data.items.filter(i => i.id !== itemId); this.renderGrid(); }
            }
        } catch(e) { Utils.alert('Delete failed'); }
    },
    
    getMediaType: (arg) => {
        if (!arg) return 'image';
        if (typeof arg === 'object') {
            const mt = (arg.mimetype || '').toLowerCase();
            if (mt.startsWith('video/')) return 'video';
            if (mt.startsWith('audio/')) return 'audio';
            arg = arg.content_url || arg.cover_url || '';
        }
        const u = (arg || '').toLowerCase();
        if (/\.(mp4|mov|webm|m4v|mkv|avi)(?:\?|$)/.test(u)) return 'video';
        if (/\.(mp3|wav|ogg|flac|m4a)(?:\?|$)/.test(u)) return 'audio';
        return 'image';
    }
};

document.addEventListener('DOMContentLoaded', () => GaleriaManager.init());