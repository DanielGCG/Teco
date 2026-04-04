/**
 * Sistema compartilhado de cartinhas
 * Funções e lógica reutilizável para recebidas, enviadas e favoritas
 */

/**
 * Sistema de Modal Compartilhado para Cartinhas
 */
class ModalCartinha {
    constructor() {
        this.ensureModalExists();
    }

    ensureModalExists() {
        let modal = document.getElementById('modalCartinhaGlobal');
        if (modal) return;
        
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="modalCartinhaGlobal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header border-0">
                            <h5 class="modal-title fw-bold" id="modal-cartinha-title">Cartinha</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                        </div>
                        <div class="modal-body p-4 pt-0" id="modal-cartinha-content"></div>
                        <div class="modal-footer border-0" id="modal-cartinha-footer"></div>
                    </div>
                </div>
            </div>
        `);
    }

    abrir({ cartinha, usuario, tipo, acoes = [] }) {
        const content = document.getElementById('modal-cartinha-content');
        const footer = document.getElementById('modal-cartinha-footer');
        
        // Limpar o footer para não duplicar botões
        footer.innerHTML = '';
        
        const labelNome = tipo === 'enviadas' ? 'Para: ' : 'De: ';
        const assinatura = tipo === 'enviadas' ? 'Você' : `<a href="/${usuario.username}" class="text-decoration-none fw-bold text-dark">${usuario.username}</a>`;

        // Se a cartinha não tiver body (veio da listagem que exclui esse campo), buscar os detalhes
        if (cartinha.body === undefined) {
            content.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="text-muted mt-2 small">Carregando conteúdo...</p>
                </div>
            `;
            
            fetch(`/api/cartinhas/${cartinha.publicid || cartinha.id}`, { credentials: 'include' })
                .then(res => res.json())
                .then(fullData => {
                    this.renderizarConteudoModal(fullData, usuario, labelNome, assinatura, acoes);
                })
                .catch(() => {
                    content.innerHTML = `<div class="alert alert-danger p-2 small m-3">Erro ao carregar o conteúdo da cartinha.</div>`;
                });
        } else {
            this.renderizarConteudoModal(cartinha, usuario, labelNome, assinatura, acoes);
        }

        new bootstrap.Modal(document.getElementById('modalCartinhaGlobal')).show();
    }

    renderizarConteudoModal(cartinha, usuario, labelNome, assinatura, acoes) {
        const content = document.getElementById('modal-cartinha-content');
        const footer = document.getElementById('modal-cartinha-footer');

        content.innerHTML = `
            <div class="d-flex align-items-center mb-4 py-3 border-bottom">
                <img src="${usuario.profileimage}" class="rounded me-3" style="width: 48px; height: 48px; object-fit: cover;">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between">
                        <div>
                            <span class="text-muted small">${labelNome}</span>
                            <div class="h6 mb-0"><a href="/${usuario.username}" class="text-decoration-none fw-bold text-dark">${usuario.username}</a></div>
                        </div>
                        <div class="text-end text-muted small">
                            ${UIUtils.formatarData(cartinha.createdat)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="px-2">
                <h4 class="fw-bold mb-3">${cartinha.title}</h4>
                <div class="py-2" style="font-size: 1rem; line-height: 1.6; white-space: pre-wrap; min-height: 100px;">${cartinha.body}</div>
                <div class="mt-4 pt-3 border-top text-end">
                    <p class="mb-1 text-muted small">Atenciosamente,</p>
                    <div class="h6 mb-0">${assinatura}</div>
                </div>
            </div>
        `;

        acoes.forEach(acao => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-sm ${acao.classe || 'btn-primary'}`;
            btn.textContent = acao.label;
            btn.onclick = () => {
                if (acao.callback) acao.callback(cartinha, usuario);
            };
            footer.appendChild(btn);
        });
    }

    fechar() {
        const mEl = document.getElementById('modalCartinhaGlobal');
        const mod = bootstrap.Modal.getInstance(mEl);
        if (mod) mod.hide();
        // Forçar remoção de backdrops órfãos e resetar body
        setTimeout(() => {
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style = '';
        }, 300);
    }
}

window.modalCartinha = new ModalCartinha();

/**
 * Funções de Grid
 */
function renderizarGridCartinhas(usuarios, containerSelector = '#cartas-grid', hooks = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    let cartinhas = [];
    usuarios.forEach(u => u.cartinhas.forEach(c => cartinhas.push({ ...c, usuario: u })));
    cartinhas.sort((a, b) => new Date(b.createdat) - new Date(a.createdat));

    if (cartinhas.length === 0) {
        document.getElementById('sem-cartinhas').style.display = 'block';
        document.getElementById('cartinhas-container').style.display = 'none';
        return;
    }

    container.innerHTML = `<div class="row g-3">
        ${cartinhas.map(c => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm carta-hover" onclick="window.cartinhasHooks?.abrirCartinha('${c.publicid || c.id}')" style="cursor: pointer;">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center mb-2">
                            <img src="${c.usuario.profileimage}" class="rounded me-2" style="width: 28px; height: 28px; object-fit: cover;">
                            <div class="flex-grow-1 overflow-hidden">
                                <div class="fw-bold text-truncate small">${c.usuario.username}</div>
                            </div>
                            ${c.isfavorited ? '<i class="bi bi-star-fill text-warning small"></i>' : ''}
                            ${!c.isread && window.tipoCartinhas === 'recebidas' ? '<span class="badge bg-primary ms-1" style="font-size: 0.5rem;">Novo</span>' : ''}
                        </div>
                        <h6 class="fw-bold mb-1 text-truncate">${c.title || 'Sem título'}</h6>
                        <div class="text-end mt-2"><small class="text-muted" style="font-size: 0.7rem;">${UIUtils.formatarData(c.createdat)}</small></div>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>`;

    window.cartinhasHooks = hooks;
    document.getElementById('cartinhas-container').style.display = 'block';
    document.getElementById('sem-cartinhas').style.display = 'none';
}

/**
 * Utilitários
 */
const encontrarCartinha = (id, usuarios) => {
    for (const u of usuarios) {
        const c = u.cartinhas.find(x => (x.publicid || x.id) == id);
        if (c) return c;
    }
    return null;
};

const encontrarUsuarioPorCartinha = (id, usuarios) => {
    for (const u of usuarios) {
        if (u.cartinhas.some(x => (x.publicid || x.id) == id)) return u;
    }
    return null;
};

async function toggleFavoritoCommon(id, usuarios = []) {
    try {
        const res = await fetch(`/api/cartinhas/${id}/toggle-favorito`, { method: 'POST', credentials: 'include' });
        const data = await res.json();
        const c = encontrarCartinha(id, usuarios);
        if (c) c.isfavorited = data.isfavorited;
        if (typeof carregarCartinhas === 'function') carregarCartinhas();
        mostrarFeedback(data.isfavorited ? 'Favoritada!' : 'Removido dos favoritos');
    } catch (e) { mostrarFeedback('Erro ao favoritar', 'danger'); }
}

function mostrarFeedback(msg, tipo = 'success') {
    let c = document.querySelector('.feedback-container');
    if (!c) {
        c = document.createElement('div');
        c.className = 'feedback-container';
        c.style.cssText = 'position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;';
        document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.className = `toast align-items-center text-white bg-${tipo} border-0 mb-2 show`;
    t.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}
