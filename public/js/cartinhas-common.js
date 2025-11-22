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

    /**
     * Abre o modal com a configuração especificada
     * @param {Object} config - Configuração do modal
     * @param {Object} config.cartinha - Dados da cartinha
     * @param {Object} config.usuario - Dados do usuário (remetente ou destinatário)
     * @param {string} config.tipo - Tipo de página: 'recebidas', 'enviadas', 'favoritas'
     * @param {Object} config.acoes - Ações disponíveis no modal
     * @param {Object} config.estilos - Estilos personalizados (cores, etc)
     */
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
                cor: 'linear-gradient(135deg, #BCA88D 0%, #A39178 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>F</kbd> Favoritar | <kbd>R</kbd> Responder | <kbd>D</kbd> Excluir</small>'
            },
            enviadas: {
                titulo: '📤 Cartinha Enviada',
                cor: 'linear-gradient(135deg, #BCA88D 0%, #A39178 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>E</kbd> Editar | <kbd>D</kbd> Excluir</small>'
            },
            favoritas: {
                titulo: '⭐ Cartinha Favorita',
                cor: 'linear-gradient(135deg, #BCA88D 0%, #A39178 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>D</kbd> Desfavoritar | <kbd>R</kbd> Responder | <kbd>X</kbd> Excluir</small>'
            }
        };

        const headerConfig = configs[config.tipo] || configs.recebidas;
        
        title.textContent = config.titulo || headerConfig.titulo;
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
                badge: '#BCA88D',
                linha: '#BCA88D',
                assinatura: '#7D8D86'
            },
            enviadas: {
                badge: '#BCA88D',
                linha: '#BCA88D',
                assinatura: '#7D8D86'
            },
            favoritas: {
                badge: '#BCA88D',
                linha: '#BCA88D',
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
        let nomeExibido = usuario.username;
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
            assinatura = usuario.username;
        }

        content.innerHTML = `
            <div class="mb-3">
                <!-- Cabeçalho da carta -->
                <div class="d-flex align-items-center mb-3 p-2" style="background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${cores.badge};">
                    <img src="${usuario.avatar}" alt="Avatar" class="avatar-carta me-2" style="width: 35px; height: 35px;">
                    <div>
                        <strong style="font-size: 1rem; color: #2d3436;">${labelNome}${nomeExibido}</strong>
                        <div><small class="text-muted">📅 ${formatarData(cartinha.dataEnvio)}</small></div>
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
                    ${cartinha.titulo}
                </h3>
                
                <!-- Conteúdo da carta -->
                <div style="font-family: 'Montserrat', sans-serif; font-size: 0.95rem; line-height: 1.6; color: #636e72; padding-left: 1rem; white-space: pre-wrap;">
                    ${cartinha.conteudo}
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
            const title = acao.titulo || '';
            const classe = acao.classe || 'btn-primary';
            
            botoesHTML += `
                <button type="button" 
                        class="btn ${classe}" 
                        id="modal-btn-${acao.id}"
                        ${disabled}
                        title="${title}">
                    ${acao.icone} ${acao.texto}
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
            const btn = document.getElementById(`modal-btn-${acao.id}`);
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

// Instância global do modal
window.modalCartinha = new ModalCartinha();

// ==================== FUNÇÕES DE RENDERIZAÇÃO DE PILHAS ====================
function renderizarPilhasCartinhas(usuariosProcessados, containerSelector = '.container-pilhas') {
    const containerPilhas = document.querySelector(containerSelector);
    if (!containerPilhas) return;

    let html = '';

    usuariosProcessados.forEach((usuario, usuarioIndex) => {
        const cartasNaoLidas = usuario.cartinhas.filter(c => !c.lida).length;

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
    
    // Definir pilha ativa global
    window.pilhaAtivaIndex = 0;
    window.totalPilhas = usuariosProcessados.length;
    
    // Renderizar apenas as pilhas visíveis inicialmente
    renderizarPilhasVisiveis();
}

// ==================== Controle de pilhas ====================
function trocarPilhaAnterior() {
    if (window.totalPilhas <= 1) return;
    
    const novoIndex = window.pilhaAtivaIndex > 0 ? window.pilhaAtivaIndex - 1 : window.totalPilhas - 1;
    trocarPilhaAtiva(novoIndex);
}

function trocarProximaPilha() {
    if (window.totalPilhas <= 1) return;
    
    const novoIndex = window.pilhaAtivaIndex < window.totalPilhas - 1 ? window.pilhaAtivaIndex + 1 : 0;
    trocarPilhaAtiva(novoIndex);
}

function trocarPilhaAtiva(novoIndex) {
    if (novoIndex === window.pilhaAtivaIndex) return;
    
    const pilhas = Array.from(document.querySelectorAll('.pilha-cartas'));
    
    // Remover classes antigas
    pilhas.forEach(pilha => {
        pilha.classList.remove('ativa', 'segunda', 'terceira', 'quarta', 'fundo');
    });
    
    // Aplicar novas posições
    pilhas.forEach((pilha, index) => {
        const posicaoRelativa = (index - novoIndex + window.totalPilhas) % window.totalPilhas;
        
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
    
    window.pilhaAtivaIndex = novoIndex;
    
    // Renderizar pilhas visíveis após a troca
    renderizarPilhasVisiveis();
    
    // Descarregar pilhas que não estão mais visíveis para economizar memória
    setTimeout(descarregarPilhasInvisiveis, 500);
}

function lerCartaAtiva() {
    const pilhaAtiva = document.querySelector('.pilha-cartas.ativa');
    if (!pilhaAtiva) return;
    
    const cartaTopo = pilhaAtiva.querySelector('.carta-empilhada.topo');
    if (cartaTopo) {
        const cartinhaId = parseInt(cartaTopo.dataset.cartinhaId);
        // Chamar função global definida pela página
        if (typeof window.abrirCartinhaCallback === 'function') {
            window.abrirCartinhaCallback(cartinhaId);
        }
    }
}

// ==================== Carregamento sob demanda ====================
function renderizarPilhasVisiveis() {
    const pilhasVisiveis = document.querySelectorAll('.pilha-cartas.ativa, .pilha-cartas.segunda, .pilha-cartas.terceira');
    
    pilhasVisiveis.forEach(pilha => {
        const usuarioIndex = parseInt(pilha.dataset.usuarioIndex);
        const carregada = pilha.dataset.carregada === 'true';
        
        if (!carregada && window.usuariosProcessados && window.usuariosProcessados[usuarioIndex]) {
            // Chamar função de carregamento específica da página
            if (typeof window.carregarCartasCallback === 'function') {
                window.carregarCartasCallback(pilha, usuarioIndex);
            }
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
function formatarData(dataISO) {
    const data = new Date(dataISO);
    const agora = new Date();
    const diffMs = agora - data;
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) {
        return `Hoje às ${data.getHours().toString().padStart(2, '0')}:${data.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDias === 1) {
        return `Ontem às ${data.getHours().toString().padStart(2, '0')}:${data.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDias < 7) {
        return `${diffDias} dias atrás`;
    } else {
        return data.toLocaleDateString('pt-BR');
    }
}

function cortarTexto(texto, limite) {
    if (texto.length <= limite) return texto;
    return texto.substring(0, limite) + '...';
}

function encontrarCartinha(cartinhaId) {
    if (!window.usuariosProcessados) return null;
    for (const usuario of window.usuariosProcessados) {
        const cartinha = usuario.cartinhas.find(c => c.id === cartinhaId);
        if (cartinha) return cartinha;
    }
    return null;
}

function encontrarUsuarioPorCartinha(cartinhaId) {
    if (!window.usuariosProcessados) return null;
    return window.usuariosProcessados.find(usuario => 
        usuario.cartinhas.some(c => c.id === cartinhaId)
    );
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
    document.addEventListener('keydown', (e) => {
        if (window.totalPilhas === undefined || window.totalPilhas === 0) return;
        
        const modalAberto = document.querySelector('.modal.show');
        if (modalAberto) {
            // Atalhos específicos da página no modal
            if (atalhosPagina.modal && typeof atalhosPagina.modal === 'function') {
                atalhosPagina.modal(e, modalAberto);
            }
            return;
        }
        
        // Navegação global nas pilhas
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                trocarPilhaAnterior();
                break;
            case 'ArrowDown':
                e.preventDefault();
                trocarProximaPilha();
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
                e.preventDefault();
                // Chamar callback de ciclar específico da página
                if (typeof window.ciclarCartasCallback === 'function') {
                    window.ciclarCartasCallback();
                }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                lerCartaAtiva();
                break;
        }
    });
}

// ==================== Construtor de HTML de cartinha ====================
function construirHtmlCartinha(cartinha, usuario, posicao, total, tipoConfig) {
    const dataFormatada = formatarData(cartinha.dataEnvio);
    const posicaoReal = posicao + 1;
    const posicaoClasse = posicao === 0 ? 'topo' : posicao === 1 ? 'meio' : 'fundo';
    
    // Configurações por tipo de página
    const configs = {
        recebidas: {
            badgeTexto: `De: ${usuario.username}`,
            badgeClass: '',
            seloTexto: cartinha.lida ? 'LIDA' : 'NOVA',
            seloClass: !cartinha.lida ? 'nova' : '',
            indicadorHTML: cartinha.lida ? 
                '<span class="indicador-lida">✓ Lida</span>' : 
                '<span class="indicador-nao-lida">○ Não lida</span>',
            dataLabel: 'Recebida em'
        },
        enviadas: {
            badgeTexto: `Para: ${usuario.username}`,
            badgeClass: cartinha.lida ? 'lida' : '',
            seloTexto: cartinha.lida ? 'LIDA' : 'ENVIADA',
            seloClass: !cartinha.lida ? 'nova' : '',
            indicadorHTML: '',
            dataLabel: 'Enviada em'
        },
        favoritas: {
            badgeTexto: `De: ${usuario.username}`,
            badgeClass: '',
            seloTexto: '⭐ FAVORITA',
            seloClass: 'favorita',
            indicadorHTML: '',
            dataLabel: 'Favoritada em'
        }
    };
    
    const config = configs[tipoConfig] || configs.recebidas;
    
    return `
        <div class="carta-empilhada carta-envelope ${posicaoClasse}" 
            id="carta-${cartinha.id}" 
            data-cartinha-id="${cartinha.id}"
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
                    <img src="${usuario.avatar}" alt="Avatar" class="avatar-carta">
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
                <h3 class="titulo-carta">${cartinha.titulo || ''}</h3>
                <div class="conteudo-carta">${cortarTexto(cartinha.conteudo || '', 120)}</div>
                <div class="data-carta">${config.dataLabel} ${dataFormatada}</div>
            </div>

            ${posicao === 0 ? `
                <div class="acoes-carta">
                    <button class="btn-acao btn-ler" onclick="window.abrirCartinhaCallback(${cartinha.id})" title="Ver carta">
                        👁️
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}
