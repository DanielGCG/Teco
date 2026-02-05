/**
 * Sistema compartilhado de cartinhas
 * Funções e lógica reutilizável para recebidas, enviadas e favoritas
 */

/**
 * Sistema de Modal Compartilhado para Cartinhas
 */
class ModalCartinha {
    constructor() {
        this.modalElement = null;
        this.currentConfig = null;
        this.currentCartinha = null;
        this.currentUsuario = null;
        this.ensureModalExists();
    }

    ensureModalExists() {
        let modal = document.getElementById('modalCartinhaGlobal');
        if (!modal) {
            const modalHTML = `
                <div class="modal fade modal-carta" id="modalCartinhaGlobal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" id="modal-cartinha-header">
                                <h5 class="modal-title" id="modal-cartinha-title">Cartinha</h5>
                                <div class="ms-auto me-2" id="modal-cartinha-atalhos"></div>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <div id="modal-cartinha-content"></div>
                            </div>
                            <div class="modal-footer" id="modal-cartinha-footer"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modal = document.getElementById('modalCartinhaGlobal');
        }
        this.modalElement = modal;
    }

    abrir(config) {
        this.currentConfig = config;
        this.currentCartinha = config.cartinha;
        this.currentUsuario = config.usuario;

        this.configurarHeader(config);
        this.renderizarConteudo(config);
        this.configurarFooter(config);
        this.adicionarEventListeners(config);
        
        const modal = new bootstrap.Modal(this.modalElement);
        modal.show();
        
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.limparEventListeners();
        }, { once: true });
    }

    configurarHeader(config) {
        const header = document.getElementById('modal-cartinha-header');
        const title = document.getElementById('modal-cartinha-title');
        const atalhos = document.getElementById('modal-cartinha-atalhos');
        
        const configs = {
            recebidas: { titulo: 'Lendo Cartinha', cor: 'var(--marrom)', atalhos: '<small class="text-muted">F: Favoritar | R: Responder | D: Excluir</small>' },
            enviadas: { titulo: 'Cartinha Enviada', cor: 'var(--marrom)', atalhos: '<small class="text-muted">E: Editar | D: Excluir</small>' },
            favoritas: { titulo: 'Cartinha Favorita', cor: 'var(--marrom)', atalhos: '<small class="text-muted">D: Desfavoritar | R: Responder | X: Excluir</small>' }
        };

        const headerConfig = configs[config.tipo] || configs.recebidas;
        title.textContent = config.titulo || headerConfig.titulo;
        header.style.backgroundColor = headerConfig.cor;
        header.style.background = headerConfig.cor; 
        atalhos.innerHTML = config.atalhos || headerConfig.atalhos;
    }

    renderizarConteudo(config) {
        const content = document.getElementById('modal-cartinha-content');
        const { cartinha, usuario, tipo } = config;

        let badgesHTML = '';
        if (config.badges && Array.isArray(config.badges)) {
            badgesHTML = config.badges.map(badge => 
                `<span class="badge" style="background: ${badge.cor || 'var(--marrom)'}; color: ${badge.corTexto || 'white'}; font-size: 0.75rem; margin-left: 0.5rem;">${badge.texto}</span>`
            ).join('');
        }

        const labelNome = tipo === 'enviadas' ? 'Para: ' : 'De: ';
        const assinatura = tipo === 'enviadas' ? 'Você' : `<a href="/${usuario.username}" class="text-decoration-none fw-bold" style="color: inherit;">${usuario.username}</a>`;

        content.innerHTML = `
            <div class="mb-4">
                <div class="d-flex align-items-center mb-4 p-3 border-bottom">
                    <img src="${usuario.profileimage}" alt="Avatar" class="rounded-circle me-3" style="width: 48px; height: 48px; object-fit: cover;">
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="text-muted small">${labelNome}</span>
                                <div class="h6 mb-0"><a href="/${usuario.username}" class="text-decoration-none fw-bold" style="color: inherit;">${usuario.username}</a></div>
                            </div>
                            <div class="text-end">
                                <small class="text-muted d-block">${UIUtils.formatarData(cartinha.createdat)}</small>
                                ${badgesHTML}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="px-2">
                <h4 class="fw-bold mb-3">${cartinha.title}</h4>
                <div class="py-2" style="font-size: 1rem; line-height: 1.6; white-space: pre-wrap; min-height: 150px;">
                    ${cartinha.body}
                </div>
                <div class="mt-5 pt-3 border-top text-end">
                    <p class="mb-1 text-muted small">Atenciosamente,</p>
                    <div class="h6 mb-0">${assinatura}</div>
                </div>
            </div>
        `;
    }

    configurarFooter(config) {
        const footer = document.getElementById('modal-cartinha-footer');
        const { acoes } = config;

        if (!acoes || acoes.length === 0) {
            footer.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>';
            return;
        }

        let botoesHTML = acoes.map(acao => {
            const disabled = acao.desabilitado ? 'disabled' : '';
            return `<button type="button" class="btn ${acao.classe || 'btn-primary'}" id="acao-${acao.id}" ${disabled}>${acao.label || acao.texto}</button>`;
        }).join('');

        footer.innerHTML = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>${botoesHTML}`;

        acoes.forEach(acao => {
            const btn = document.getElementById(`acao-${acao.id}`);
            if (btn && acao.callback) {
                btn.addEventListener('click', () => acao.callback(this.currentCartinha, this.currentUsuario));
            }
        });
    }

    adicionarEventListeners(config) {
        this.keydownHandler = (e) => {
            if (document.querySelector('.modal.show')?.id !== 'modalCartinhaGlobal') return;
            const atalho = config.atalhosTeclado?.[e.key.toLowerCase()];
            if (atalho?.callback) {
                e.preventDefault();
                atalho.callback(this.currentCartinha, this.currentUsuario);
            }
        };
        document.addEventListener('keydown', this.keydownHandler);
    }

    limparEventListeners() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    fechar() {
        bootstrap.Modal.getInstance(this.modalElement)?.hide();
        setTimeout(() => {
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
            document.body.classList.remove('modal-open');
            document.body.style = '';
        }, 300);
    }
}

window.modalCartinha = new ModalCartinha();
let cartinhasHooks = {};

/**
 * Funções de Grid
 */
function renderizarGridCartinhas(usuariosProcessados, containerSelector = '#cartas-grid', hooks = {}) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    cartinhasHooks = hooks || {};
    
    let cartinhasFlat = [];
    usuariosProcessados.forEach(u => {
        u.cartinhas.forEach(c => {
            cartinhasFlat.push({
                ...c,
                usuarioInfo: { userId: u.userId, username: u.username, profileimage: u.profileimage }
            });
        });
    });

    cartinhasFlat.sort((a, b) => new Date(b.createdat) - new Date(a.createdat));

    if (cartinhasFlat.length === 0) {
        document.getElementById('sem-cartinhas').style.display = 'block';
        document.getElementById('cartinhas-container').style.display = 'none';
        return;
    }

    container.innerHTML = `<div class="row g-3">
        ${cartinhasFlat.map(item => `
            <div class="col-md-6 col-lg-4">
                <div class="card h-100 border-0 shadow-sm" onclick="abrirCartinhaPeloId('${item.publicid || item.id}')" style="cursor: pointer; transition: transform 0.2s;">
                    <div class="card-body p-3">
                        <div class="d-flex align-items-center mb-3">
                            <img src="${item.usuarioInfo.profileimage}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
                            <div class="flex-grow-1 overflow-hidden">
                                <div class="fw-bold text-truncate small">${item.usuarioInfo.username}</div>
                                <div class="text-muted small">${UIUtils.formatarData(item.createdat)}</div>
                            </div>
                            ${item.isfavorited ? '<i class="bi bi-star-fill text-warning small"></i>' : ''}
                            ${!item.isread && window.tipoCartinhas === 'recebidas' ? '<span class="badge bg-primary rounded-pill ms-1" style="font-size: 0.5rem;">Novo</span>' : ''}
                        </div>
                        <h6 class="card-title fw-bold text-truncate mb-1">${item.title}</h6>
                        <p class="card-text text-muted small text-truncate-2 mb-0">${item.body}</p>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>`;

    document.getElementById('cartinhas-container').style.display = 'block';
    document.getElementById('sem-cartinhas').style.display = 'none';
}

window.abrirCartinhaPeloId = (id) => cartinhasHooks.abrirCartinha?.(id);

/**
 * Utilitários
 */
function encontrarCartinha(id, usuarios) {
    for (const u of usuarios) {
        const c = u.cartinhas.find(c => (c.publicid || c.id) == id);
        if (c) return c;
    }
    return null;
}

function encontrarUsuarioPorCartinha(id, usuarios) {
    for (const u of usuarios) {
        if (u.cartinhas.some(c => (c.publicid || c.id) == id)) {
            return { userId: u.userId, username: u.username, profileimage: u.profileimage };
        }
    }
    return null;
}

function cortarTexto(texto, limite) {
    return texto.length <= limite ? texto : texto.substring(0, limite) + '...';
}

async function toggleFavoritoCommon(cartinhaId, usuarios = []) {
    try {
        const response = await fetch(`/api/cartinhas/${cartinhaId}/toggle-favorito`, { method: 'POST', credentials: 'include' });
        const result = await response.json();
        
        const cartinha = encontrarCartinha(cartinhaId, usuarios);
        if (cartinha) cartinha.isfavorited = result.isfavorited;

        const favoritarBtn = document.getElementById('acao-favoritar');
        if (favoritarBtn) {
            favoritarBtn.textContent = result.isfavorited ? 'Remover Favorito' : 'Favoritar';
            favoritarBtn.className = result.isfavorited ? 'btn btn-warning' : 'btn btn-outline-warning';
        }

        if (typeof window.carregarCartinhas === 'function') window.carregarCartinhas();
        mostrarFeedback(result.isfavorited ? 'Cartinha favoritada!' : 'Cartinha desfavoritada', 'success');
        return result;
    } catch (error) {
        mostrarFeedback('Erro ao alterar favorito.', 'danger');
        throw error;
    }
}

function mostrarFeedback(mensagem, tipo = 'success') {
    let container = document.querySelector('.feedback-container') || (() => {
        const c = document.createElement('div');
        c.className = 'feedback-container';
        c.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;';
        document.body.appendChild(c);
        return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${tipo} border-0 mb-2`;
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${mensagem}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    container.appendChild(toast);
    
    new bootstrap.Toast(toast, { autohide: true, delay: 3000 }).show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}
