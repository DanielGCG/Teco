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
                titulo: ' Lendo Cartinha',
                cor: 'linear-gradient(135deg, #6c5ce7 0%, #5849c7 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>F</kbd> Favoritar | <kbd>R</kbd> Responder | <kbd>D</kbd> Excluir</small>'
            },
            enviadas: {
                titulo: '📤 Cartinha Enviada',
                cor: 'linear-gradient(135deg, #7D8D86 0%, #5a6d68 100%)',
                atalhos: '<small class="text-muted">Atalhos: <kbd>E</kbd> Editar | <kbd>D</kbd> Excluir</small>'
            },
            favoritas: {
                titulo: '⭐ Cartinha Favorita',
                cor: 'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)',
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

        // Definir cores baseadas no tipo
        const coresTipo = {
            recebidas: {
                badge: '#6c5ce7',
                linha: '#6c5ce7',
                assinatura: '#74b9ff'
            },
            enviadas: {
                badge: '#7D8D86',
                linha: '#7D8D86',
                assinatura: '#7D8D86'
            },
            favoritas: {
                badge: '#f1c40f',
                linha: '#f1c40f',
                assinatura: '#f39c12'
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
                        <div><small class="text-muted">📅 ${this.formatarData(cartinha.dataEnvio)}</small></div>
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

    /**
     * Formata data para exibição
     */
    formatarData(dataISO) {
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
}

// Instância global do modal
window.modalCartinha = new ModalCartinha();
