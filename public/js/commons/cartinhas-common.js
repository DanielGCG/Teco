/**
 * Sistema compartilhado de cartinhas
 * Funções e lógica reutilizável para recebidas, enviadas e favoritas
 * Inclui modal unificado para exibição de cartinhas
 */

// ==================== CLASSE MODAL DE CARTINHA ====================

/**
 * Sistema de Modal Compartilhado para Cartinhas
 * Permite exibir cartinhas com diferentes configurações por página
 */
class ModalCartinha {
    constructor() {
        this.modalElement = null;
        this.currentConfig = null;
        this.currentCartinha = null;
        this.currentUsuario = null;
        this.ensureModalExists();
    }

    /**
     * Garante que o modal existe no DOM
     */
    ensureModalExists() {
        let modal = document.getElementById('modalCartinhaGlobal');
        
        if (!modal) {
            const modalHTML = `
                <div class="modal fade modal-carta" id="modalCartinhaGlobal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header" id="modal-cartinha-header">
                                <h5 class="modal-title" id="modal-cartinha-title">📄 Cartinha</h5>
                                <div class="ms-auto me-2" id="modal-cartinha-atalhos">
                                    <!-- Atalhos serão inseridos aqui -->
                                </div>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
                            </div>
                            <div class="modal-body">
                                <div id="modal-cartinha-content">
                                    <!-- Conteúdo da cartinha será inserido aqui -->
                                </div>
                            </div>
                            <div class="modal-footer" id="modal-cartinha-footer">
                                <!-- Botões serão inseridos aqui -->
                            </div>
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

        // Configurar header
        this.configurarHeader(config);
        
        // Renderizar conteúdo
        this.renderizarConteudo(config);
        
        // Configurar footer com botões
        this.configurarFooter(config);
        
        // Adicionar event listeners de teclado
        this.adicionarEventListeners(config);
        
        // Abrir modal
        const modal = new bootstrap.Modal(this.modalElement);
        modal.show();
        
        // Cleanup quando fechar
        this.modalElement.addEventListener('hidden.bs.modal', () => {
            this.limparEventListeners();
        }, { once: true });
    }

    /**
     * Configura o header do modal
     */
    configurarHeader(config) {
        const header = document.getElementById('modal-cartinha-header');
        const title = document.getElementById('modal-cartinha-title');
        const atalhos = document.getElementById('modal-cartinha-atalhos');
        
        // Definir título e cor do header baseado no tipo
        const configs = {
            recebidas: {
                titulo: '📬 Lendo Cartinha',
                cor: 'linear-gradient(135deg, var(--marrom) 0%, #A39178 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>F</kbd> Favoritar | <kbd>R</kbd> Responder | <kbd>D</kbd> Excluir</small>'
            },
            enviadas: {
                titulo: '📤 Cartinha Enviada',
                cor: 'linear-gradient(135deg, var(--marrom) 0%, #A39178 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>E</kbd> Editar | <kbd>D</kbd> Excluir</small>'
            },
            favoritas: {
                titulo: '⭐ Cartinha Favorita',
                cor: 'linear-gradient(135deg, var(--marrom) 0%, #A39178 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>D</kbd> Desfavoritar | <kbd>R</kbd> Responder | <kbd>X</kbd> Excluir</small>'
            }
        };

        const headerConfig = configs[config.tipo] || configs.recebidas;
        
        title.textContent = config.title || headerConfig.title;
        header.style.background = config.corHeader || headerConfig.cor;
        atalhos.innerHTML = config.atalhos || headerConfig.atalhos;
    }

    /**
     * Renderiza o conteúdo da cartinha
     */
    renderizarConteudo(config) {
        const content = document.getElementById('modal-cartinha-content');
        const { cartinha, usuario, tipo } = config;

        // Definir cores baseadas no tipo - todas usam paleta bege/marrom
        const coresTipo = {
            recebidas: {
                badge: 'var(--marrom)',
                linha: 'var(--marrom)',
                assinatura: '#7D8D86'
            },
            enviadas: {
                badge: 'var(--marrom)',
                linha: 'var(--marrom)',
                assinatura: '#7D8D86'
            },
            favoritas: {
                badge: 'var(--marrom)',
                linha: 'var(--marrom)',
                assinatura: '#7D8D86'
            }
        };

        const cores = coresTipo[tipo] || coresTipo.recebidas;

        // Construir badges de status
        let badgesHTML = '';
        if (config.badges && Array.isArray(config.badges)) {
            badgesHTML = config.badges.map(badge => 
                `<span class="badge" style="background: ${badge.cor || cores.badge}; color: ${badge.corTexto || 'white'}; font-size: 0.75rem; margin-left: 0.5rem;">${badge.icone} ${badge.texto}</span>`
            ).join('');
        }

        // Determinar nome do remetente/destinatário
        let nomeExibido = `<a href="/${usuario.username}" class="text-decoration-none" style="color: inherit;">${usuario.username}</a>`;
        let labelNome = '';
        
        if (tipo === 'enviadas') {
            labelNome = 'Para: ';
        } else {
            labelNome = ''; // Para recebidas e favoritas, apenas o nome
        }

        // Determinar assinatura
        let assinatura = '';
        if (tipo === 'enviadas') {
            assinatura = 'Você';
        } else {
            assinatura = `<a href="/${usuario.username}" class="text-decoration-none" style="color: inherit;">${usuario.username}</a>`;
        }

        content.innerHTML = `
            <div class="mb-3">
                <!-- Cabeçalho da carta -->
                <div class="d-flex align-items-center mb-3 p-2" style="background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${cores.badge};">
                    <img src="${usuario.profileimage}" alt="Avatar" class="avatar-carta me-2" style="width: 35px; height: 35px;">
                    <div>
                        <strong style="font-size: 1rem; color: #2d3436;">${labelNome}${nomeExibido}</strong>
                        <div><small class="text-muted">📅 ${UIUtils.formatarData(cartinha.createdat)}</small></div>
                    </div>
                    <div class="ms-auto">
                        ${badgesHTML}
                    </div>
                </div>
            </div>
            
            <!-- Papel da carta com linhas -->
            <div style="background: #fefefe; padding: 1.5rem; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05); position: relative; background-image: repeating-linear-gradient(transparent, transparent 1.4rem, rgba(0,0,0,0.03) 1.4rem, rgba(0,0,0,0.03) 1.5rem);">
                <!-- Linha lateral do papel -->
                <div style="position: absolute; left: 1.5rem; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, #e9ecef 0%, ${cores.linha} 50%, #e9ecef 100%);"></div>
                
                <!-- Título da carta -->
                <h3 style="font-family: 'Montserrat', sans-serif; color: #2d3436; margin-bottom: 1rem; padding-left: 1rem; font-weight: 600; font-size: 1.1rem;">
                    ${cartinha.title}
                </h3>
                
                <!-- Conteúdo da carta -->
                <div style="font-family: 'Montserrat', sans-serif; font-size: 0.95rem; line-height: 1.6; color: #636e72; padding-left: 1rem; white-space: pre-wrap;">
                    ${cartinha.body}
                </div>
                
                <!-- Assinatura -->
                <div style="text-align: right; margin-top: 1.5rem; padding-right: 1rem; font-style: italic; color: ${cores.assinatura}; font-size: 0.9rem;">
                    Com carinho,<br>
                    <strong>${assinatura}</strong>
                </div>
            </div>
        `;
    }

    /**
     * Configura o footer com botões de ação
     */
    configurarFooter(config) {
        const footer = document.getElementById('modal-cartinha-footer');
        const { acoes } = config;

        if (!acoes || acoes.length === 0) {
            footer.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">📪 Fechar</button>';
            return;
        }

        let botoesHTML = '';
        acoes.forEach(acao => {
            const disabled = acao.desabilitado ? 'disabled' : '';
            const classe = acao.classe || 'btn-primary';
            const texto = acao.label || acao.texto || '';
            const icone = acao.icone || '';

            const btnTitle = acao.title || acao.label || acao.texto || '';
            botoesHTML += `
                <button type="button" 
                        class="btn ${classe}" 
                        id="acao-${acao.id}"
                        data-acao-id="${acao.id}"
                        ${disabled}
                        title="${btnTitle}">
                    ${icone} ${texto}
                </button>
            `;
        });

        // Adicionar botão fechar sempre
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">📪 Fechar</button>
            ${botoesHTML}
        `;

        // Adicionar event listeners nos botões
        acoes.forEach(acao => {
            const btn = document.getElementById(`acao-${acao.id}`);
            if (btn && acao.callback) {
                btn.addEventListener('click', () => {
                    acao.callback(this.currentCartinha, this.currentUsuario);
                });
            }
        });
    }

    /**
     * Adiciona event listeners de teclado
     */
    adicionarEventListeners(config) {
        this.keydownHandler = (e) => {
            const modalAberto = document.querySelector('.modal.show');
            if (!modalAberto || modalAberto.id !== 'modalCartinhaGlobal') return;

            const { atalhosTeclado } = config;
            if (!atalhosTeclado) return;

            const tecla = e.key.toLowerCase();
            const atalho = atalhosTeclado[tecla];
            
            if (atalho && atalho.callback) {
                e.preventDefault();
                atalho.callback(this.currentCartinha, this.currentUsuario);
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
    }

    /**
     * Remove event listeners
     */
    limparEventListeners() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    /**
     * Fecha o modal
     */
    fechar() {
        const modal = bootstrap.Modal.getInstance(this.modalElement);
        if (modal) {
            modal.hide();
        }

        // Limpeza forçada de backdrop
        setTimeout(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());
            
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }, 300);
    }
}

// Instância global do modal (mantemos no window para compatibilidade modal)
window.modalCartinha = new ModalCartinha();

// Hooks e estado do módulo (evita uso de múltiplos globals na página)
let cartinhasHooks = {};
let pilhaAtivaIndex = 0;
let totalPilhas = 0;

// ==================== FUNÇÕES DE RENDERIZAÇÃO DE PILHAS ====================
function renderizarPilhasCartinhas(usuariosProcessados, containerSelector = '.container-pilhas', hooks = {}) {
    const containerPilhas = document.querySelector(containerSelector);
    if (!containerPilhas) return;

    let html = '';

    usuariosProcessados.forEach((usuario, usuarioIndex) => {
        const cartasNaoLidas = usuario.cartinhas.filter(c => !c.isread).length;

        let classPosicao = '';
        if (usuarioIndex === 0) classPosicao = 'ativa';
        else if (usuarioIndex === 1) classPosicao = 'segunda';
        else if (usuarioIndex === 2) classPosicao = 'terceira';
        else if (usuarioIndex === 3) classPosicao = 'quarta';
        else classPosicao = 'fundo';

        html += `
            <div class="pilha-cartas ${classPosicao}" id="pilha-${usuario.userId}" data-usuario-index="${usuarioIndex}" data-carregada="false">
                ${usuarioIndex === 0 ? `
                    <div class="instrucoes-pilha">
                        🎯 Pilha ativa • ←→: ciclar cartas • Enter: ver carta
                    </div>
                ` : ''}
                ${cartasNaoLidas > 0 ? `<div class="contador-pilha">${cartasNaoLidas}</div>` : ''}
            </div>
        `;
    });

    containerPilhas.innerHTML = html;
    
    // salvar hooks e estado local
    cartinhasHooks = hooks || {};
    pilhaAtivaIndex = 0;
    totalPilhas = usuariosProcessados.length;

    // Renderizar apenas as pilhas visíveis inicialmente
    renderizarPilhasVisiveis(usuariosProcessados);
}

// ==================== Controle de pilhas ====================
function trocarPilhaAnterior(usuarios) {
    if (totalPilhas <= 1) return;

    const novoIndex = pilhaAtivaIndex > 0 ? pilhaAtivaIndex - 1 : totalPilhas - 1;
    trocarPilhaAtiva(novoIndex, usuarios);
}

function trocarProximaPilha(usuarios) {
    if (totalPilhas <= 1) return;

    const novoIndex = pilhaAtivaIndex < totalPilhas - 1 ? pilhaAtivaIndex + 1 : 0;
    trocarPilhaAtiva(novoIndex, usuarios);
}

function trocarPilhaAtiva(novoIndex, usuarios) {
    if (novoIndex === pilhaAtivaIndex) return;
    
    const pilhas = Array.from(document.querySelectorAll('.pilha-cartas'));
    
    // Remover classes antigas
    pilhas.forEach(pilha => {
        pilha.classList.remove('ativa', 'segunda', 'terceira', 'quarta', 'fundo');
    });
    
    // Aplicar novas posições
    pilhas.forEach((pilha, index) => {
        const posicaoRelativa = (index - novoIndex + totalPilhas) % totalPilhas;
        
        if (posicaoRelativa === 0) {
            pilha.classList.add('ativa');
            const instrucoes = pilha.querySelector('.instrucoes-pilha');
            if (!instrucoes) {
                pilha.insertAdjacentHTML('afterbegin', `
                    <div class="instrucoes-pilha">
                        🎯 Pilha ativa • ←→: ciclar cartas • Enter: ver carta
                    </div>
                `);
            }
        } else if (posicaoRelativa === 1) {
            pilha.classList.add('segunda');
        } else if (posicaoRelativa === 2) {
            pilha.classList.add('terceira');
        } else if (posicaoRelativa === 3) {
            pilha.classList.add('quarta');
        } else {
            pilha.classList.add('fundo');
        }
        
        if (posicaoRelativa !== 0) {
            const instrucoes = pilha.querySelector('.instrucoes-pilha');
            if (instrucoes) instrucoes.remove();
        }
    });
    
    pilhaAtivaIndex = novoIndex;

    // Renderizar pilhas visíveis após a troca
    renderizarPilhasVisiveis(usuarios);

    // Descarregar pilhas que não estão mais visíveis para economizar memória
    setTimeout(descarregarPilhasInvisiveis, 500);
}

function lerCartaAtiva(usuarios) {
    const pilhaAtiva = document.querySelector('.pilha-cartas.ativa');
    if (!pilhaAtiva) return;

    const cartaTopo = pilhaAtiva.querySelector('.carta-empilhada.topo');
    if (cartaTopo) {
        const cartinhaId = cartaTopo.dataset.cartinhaId;
        if (cartinhasHooks && typeof cartinhasHooks.abrirCartinha === 'function') {
            cartinhasHooks.abrirCartinha(cartinhaId, usuarios);
            return;
        }

        // fallback: abrir modal básico
        const cartinha = encontrarCartinha(cartinhaId, usuarios);
        const usuario = encontrarUsuarioPorCartinha(cartinhaId, usuarios);
        if (cartinha && usuario) {
            window.modalCartinha.abrir({ cartinha, usuario, tipo: window.tipoCartinhas || 'recebidas' });
        } else {
            console.warn('lerCartaAtiva: sem hook e não foi possível localizar cartinha/usuario');
        }
    }
}

// ==================== CICLO DE CARTAS (GENÉRICO) ====================
// Navega cartas dentro da pilha ativa: dir = +1 (próxima) ou -1 (anterior)
function navegarCarta(dir, usuarios) {
    const pilhaAtiva = document.querySelector('.pilha-cartas.ativa');
    if (!pilhaAtiva) return;
    const usuarioIndex = parseInt(pilhaAtiva.dataset.usuarioIndex, 10);
    const usuario = Array.isArray(usuarios) ? usuarios[usuarioIndex] : null;
    if (!usuario || !Array.isArray(usuario.cartinhas) || usuario.cartinhas.length <= 1) return;

    const total = usuario.cartinhas.length;
    if (!Number.isInteger(usuario.indiceCiclo)) usuario.indiceCiclo = 0;

    usuario.indiceCiclo = (usuario.indiceCiclo + dir + total) % total;

    // Re-render da pilha ativa
    pilhaAtiva.querySelectorAll('.carta-empilhada').forEach(n => n.remove());
    carregarCartas(pilhaAtiva, usuarioIndex, usuarios);
}

// ==================== CARREGAR CARTAS (GENÉRICO) ====================
function carregarCartas(pilhaElement, usuarioIndex, usuarios) {
    const usuario = Array.isArray(usuarios) ? usuarios[usuarioIndex] : null;
    if (!usuario) return;

    const cartasDoUsuario = usuario.cartinhas || [];
    const totalCartas = cartasDoUsuario.length;
    if (totalCartas === 0) return;

    if (!Number.isInteger(usuario.indiceCiclo)) usuario.indiceCiclo = 0;

    const tipoConfig = window.tipoCartinhas || 'recebidas';
    const renderCount = Math.min(3, totalCartas);

    let html = '';
    for (let i = 0; i < renderCount; i++) {
        const realIndex = (usuario.indiceCiclo + i) % totalCartas;
        const cartinha = cartasDoUsuario[realIndex];
        html += construirHtmlCartinha(cartinha, usuario, i, totalCartas, tipoConfig, realIndex);
    }

    pilhaElement.insertAdjacentHTML('beforeend', html);
    pilhaElement.dataset.carregada = 'true';

    // conectar handlers: abrir ao clicar na carta topo ou no botão específico
    const cartaTopo = pilhaElement.querySelector('.carta-empilhada.topo');
    if (cartaTopo) {
        const id = cartaTopo.dataset.cartinhaId;
        cartaTopo.addEventListener('click', (e) => {
            if (e.target.closest('.btn-acao')) return; // ignore clicks on action buttons
            if (cartinhasHooks && typeof cartinhasHooks.abrirCartinha === 'function') {
                cartinhasHooks.abrirCartinha(id, usuarios);
                return;
            }

            // fallback: abrir modal básico
            const cartinha = encontrarCartinha(id, usuarios);
            const usuarioLocal = encontrarUsuarioPorCartinha(id, usuarios);
            if (cartinha && usuarioLocal) window.modalCartinha.abrir({ cartinha, usuario: usuarioLocal, tipo: tipoConfig });
        });

        const abrirBtn = cartaTopo.querySelector('[data-action="abrir"]');
        if (abrirBtn) abrirBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (cartinhasHooks && typeof cartinhasHooks.abrirCartinha === 'function') {
                cartinhasHooks.abrirCartinha(id, usuarios);
                return;
            }
            const cartinha = encontrarCartinha(id, usuarios);
            const usuarioLocal = encontrarUsuarioPorCartinha(id, usuarios);
            if (cartinha && usuarioLocal) window.modalCartinha.abrir({ cartinha, usuario: usuarioLocal, tipo: tipoConfig });
        });
    }
}

// ==================== RENDERIZAR CARTINHAS (GENÉRICO) ====================
function renderizarCartinhas(usuariosProcessados, hooks = {}) {
    const container = document.getElementById('cartinhas-container');
    const semCartinhas = document.getElementById('sem-cartinhas');

    if (!usuariosProcessados || usuariosProcessados.length === 0) {
        if (container) container.style.display = 'none';
        if (semCartinhas) semCartinhas.style.display = 'block';
        return;
    }

    usuariosProcessados.forEach(u => {
        u.naoLidas = u.cartinhas.filter(c => !c.isread).length;
    });

    usuariosProcessados.sort((a, b) => {
        if (a.naoLidas !== b.naoLidas) return b.naoLidas - a.naoLidas;
        const dataA = new Date(a.cartinhas[0]?.createdat || 0);
        const dataB = new Date(b.cartinhas[0]?.createdat || 0);
        return dataB - dataA;
    });

    const containerPilhas = container.querySelector('.container-pilhas');
    let html = '';

    usuariosProcessados.forEach((usuario, usuarioIndex) => {
        const cartasNaoLidas = usuario.naoLidas;
        let classPosicao = '';
        
        if (usuarioIndex === 0) classPosicao = 'ativa';
        else if (usuarioIndex === 1) classPosicao = 'segunda';
        else if (usuarioIndex === 2) classPosicao = 'terceira';
        else if (usuarioIndex === 3) classPosicao = 'quarta';
        else classPosicao = 'fundo';

        html += `
            <div class="pilha-cartas ${classPosicao}" 
                 id="pilha-${usuario.userId}" 
                 data-usuario-index="${usuarioIndex}" 
                 data-carregada="false">
                ${usuarioIndex === 0 ? `
                    <div class="instrucoes-pilha">
                        🎯 Pilha ativa • ←→ ciclar • Enter: ver
                    </div>
                ` : ''}
                ${cartasNaoLidas > 0 ? `<div class="contador-pilha">${cartasNaoLidas}</div>` : ''}
            </div>
        `;
    });

    containerPilhas.innerHTML = html;
    if (container) container.style.display = 'block';
    if (semCartinhas) semCartinhas.style.display = 'none';

    // salvar hooks e estado local
    cartinhasHooks = hooks || {};
    pilhaAtivaIndex = 0;
    totalPilhas = usuariosProcessados.length;
    renderizarPilhasVisiveis(usuariosProcessados);
}

// ==================== INICIALIZAÇÃO DE NAVEGAÇÃO ====================
function inicializarNavegacaoCartinhas(usuarios, hooks = {}) {
    if (!Array.isArray(usuarios) || usuarios.length === 0) return;
    cartinhasHooks = hooks || {};

    document.addEventListener('keydown', (e) => {
        const modalAberto = document.querySelector('.modal.show');
        if (modalAberto) return;

        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                // esquerda: carta anterior
                navegarCarta(-1, usuarios);
                break;
            case 'ArrowRight':
                e.preventDefault();
                // direita: próxima carta
                navegarCarta(1, usuarios);
                break;
            case 'ArrowUp':
                e.preventDefault();
                // cima: trocar usuário (pilha anterior)
                trocarPilhaAnterior(usuarios);
                break;
            case 'ArrowDown':
                e.preventDefault();
                // baixo: trocar usuário (próxima pilha)
                trocarProximaPilha(usuarios);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                lerCartaAtiva(usuarios);
                break;
        }
    });
}

// ==================== Carregamento sob demanda ====================
function renderizarPilhasVisiveis(usuarios) {
    const pilhasVisiveis = document.querySelectorAll('.pilha-cartas.ativa, .pilha-cartas.segunda, .pilha-cartas.terceira');
    
    pilhasVisiveis.forEach(pilha => {
        const usuarioIndex = parseInt(pilha.dataset.usuarioIndex);
        const carregada = pilha.dataset.carregada === 'true';
        
        if (!carregada && Array.isArray(usuarios) && usuarios[usuarioIndex]) {
            carregarCartas(pilha, usuarioIndex, usuarios);
        }
    });
}

function descarregarPilhasInvisiveis() {
    const pilhasNaoVisiveis = document.querySelectorAll('.pilha-cartas:not(.ativa):not(.segunda):not(.terceira):not(.quarta)');
    
    pilhasNaoVisiveis.forEach(pilha => {
        if (pilha.dataset.carregada === 'true') {
            const cartasParaRemover = pilha.querySelectorAll('.carta-empilhada');
            cartasParaRemover.forEach(carta => carta.remove());
            pilha.dataset.carregada = 'false';
        }
    });
}

// ==================== Utilitários ====================
function cortarTexto(texto, limite) {
    if (texto.length <= limite) return texto;
    return texto.substring(0, limite) + '...';
}

function encontrarCartinha(cartinhaId, usuarios) {
    if (!Array.isArray(usuarios)) return null;
    for (const usuario of usuarios) {
        const cartinha = usuario.cartinhas.find(c => c.publicid == cartinhaId);
        if (cartinha) return cartinha;
    }
    return null;
}

function encontrarUsuarioPorCartinha(cartinhaId, usuarios) {
    if (!Array.isArray(usuarios)) return null;
    return usuarios.find(usuario => 
        Array.isArray(usuario.cartinhas) && usuario.cartinhas.some(c => c.publicid == cartinhaId)
    );
}

// ==================== Ações comuns: Favoritar ====================
async function toggleFavoritoCommon(cartinhaId, usuarios = []) {
    try {
        const response = await fetch(`/api/cartinhas/${cartinhaId}/toggle-favorito`, {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) throw new Error('Erro ao favoritar');

        const result = await response.json();

        // atualizar dados locais se fornecidos
        const cartinha = encontrarCartinha(cartinhaId, usuarios);
        if (cartinha) cartinha.isfavorited = result.isfavorited;

        // atualizar botão no modal se presente
        const favoritarBtn = document.getElementById('acao-favoritar');
        if (favoritarBtn) {
            favoritarBtn.textContent = result.isfavorited ? '⭐ Favoritada' : '⭐ Favoritar';
            favoritarBtn.className = result.isfavorited ? 'btn btn-warning' : 'btn btn-outline-warning';
        }

        // atualizar selo/estado visual na carta se existe no DOM
        const cartaEl = document.getElementById(`carta-${cartinhaId}`);
        if (cartaEl) {
            const selo = cartaEl.querySelector('.selo');
            if (selo) {
                if (result.isfavorited) selo.classList.add('favorita'); else selo.classList.remove('favorita');
            }
        }

        mostrarFeedback(result.isfavorited ? '⭐ Cartinha favoritada!' : '👀 Cartinha desfavoritada', 'success');
        return result;
    } catch (error) {
        console.error('Erro ao alterar status de favorito (common):', error);
        mostrarFeedback('Não foi possível alterar o status de favorito.', 'danger');
        throw error;
    }
}

// ==================== Feedback visual ====================
function mostrarFeedback(mensagem, tipo = 'success') {
    let container = document.querySelector('.feedback-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'feedback-container';
        container.style.cssText = 'position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${tipo} border-0 mb-2`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${mensagem}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
        </div>
    `;
    
    container.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// ==================== Navegação por teclado ====================
function inicializarNavegacaoTeclado(atalhosPagina = {}) {
    // Apenas trata atalhos quando modal estiver aberto; navegação entre pilhas
    // é feita por `inicializarNavegacaoCartinhas(usuarios, hooks)`.
    document.addEventListener('keydown', (e) => {
        const modalAberto = document.querySelector('.modal.show');
        if (modalAberto) {
            if (atalhosPagina.modal && typeof atalhosPagina.modal === 'function') {
                atalhosPagina.modal(e, modalAberto);
            }
        }
    });
}

// ==================== Construtor de HTML de cartinha ====================
function construirHtmlCartinha(cartinha, usuario, posicao, total, tipoConfig, realIndex) {
    const dataFormatada = UIUtils.formatarData(cartinha.createdat);
    if (!Number.isInteger(realIndex)) realIndex = posicao;
    const posicaoReal = realIndex + 1;
    const posicaoClasse = posicao === 0 ? 'topo' : posicao === 1 ? 'meio' : 'fundo';
    
    // Configurações por tipo de página
    const configs = {
        recebidas: {
            badgeTexto: `De: ${usuario.username}`,
            badgeClass: '',
            seloTexto: cartinha.isread ? 'LIDA' : 'NOVA',
            seloClass: !cartinha.isread ? 'nova' : '',
            indicadorHTML: '',
            dataLabel: 'Recebida em'
        },
        enviadas: {
            badgeTexto: `Para: ${usuario.username}`,
            badgeClass: cartinha.isread ? 'lida' : '',
            seloTexto: cartinha.isread ? 'LIDA' : 'ENVIADA',
            seloClass: !cartinha.isread ? 'nova' : '',
            indicadorHTML: '',
            dataLabel: 'Enviada em'
        },
        favoritas: {
            badgeTexto: `De: ${usuario.username}`,
            badgeClass: '',
            seloTexto: '⭐',
            seloClass: 'favorita',
            indicadorHTML: '',
            dataLabel: 'Favoritada em'
        }
    };
    
    const config = configs[tipoConfig] || configs.recebidas;
    
    return `
        <div class="carta-empilhada carta-envelope ${posicaoClasse}" 
            id="carta-${cartinha.publicid}" 
            data-cartinha-id="${cartinha.publicid}"
            data-usuario-id="${usuario.userId}"
            data-posicao="${posicao}"
            style="z-index: ${10 - posicao}">
            
            <div class="badge-${tipoConfig} ${config.badgeClass}">
                ${config.badgeTexto}
            </div>
            
            <div class="envelope-flap"></div>
            
            <div class="selo ${config.seloClass}">
                ${config.seloTexto}
            </div>
            
            ${config.iconeHTML || ''}
            
            <div class="envelope-header">
                <div class="remetente-info">
                    <img src="${usuario.profileimage}" alt="Avatar" class="avatar-carta">
                    <div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span class="contador-cartas">
                                Carta ${posicaoReal} de ${total}
                            </span>
                            <small style="color: #7D8D86; font-weight: 500;">${dataFormatada}</small>
                            ${config.indicadorHTML}
                        </div>
                    </div>
                </div>
            </div>

            <div class="cartinha-papel papel-linhas">
                <h3 class="titulo-carta">${cartinha.title || ''}</h3>
                <div class="conteudo-carta">${cortarTexto(cartinha.body || '', 120)}</div>
                <div class="data-carta">${config.dataLabel} ${dataFormatada}</div>
            </div>

            ${posicao === 0 ? `
                <div class="acoes-carta">
                    <button class="btn-acao btn-ler" data-action="abrir" title="Ver carta">
                        👁️
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}
