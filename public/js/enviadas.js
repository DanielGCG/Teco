let cartinhasData = [];

// ==================== Carregar cartinhas ====================
async function carregarCartinhas() {
    try {
        const response = await fetch('/api/cartinhas/enviadas', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Erro: ${response.status}`);
        }

        window.usuariosProcessados = await response.json();

        if (!Array.isArray(window.usuariosProcessados)) {
            console.error('Formato de resposta inesperado:', window.usuariosProcessados);
            window.usuariosProcessados = [];
        }

        renderizarCartinhas();
        
    } catch (error) {
        console.error('Erro ao carregar cartinhas:', error);
        window.usuariosProcessados = [];
        renderizarCartinhas();
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// ==================== Renderizar cartinhas ====================
function renderizarCartinhas() {
    const container = document.getElementById('cartinhas-container');
    const semCartinhas = document.getElementById('sem-cartinhas');    

    if (!window.usuariosProcessados || window.usuariosProcessados.length === 0) {
        container.style.display = 'none';
        semCartinhas.style.display = 'block';
        return;
    }

    const usuariosComCartinhas = window.usuariosProcessados;

    // Ordenar usuários por quantidade de cartas não lidas e depois pela carta mais recente
    usuariosComCartinhas.forEach(u => {
        u.naoLidas = u.cartinhas.filter(c => !c.lida).length;
    });

    usuariosComCartinhas.sort((a, b) => {
        if (a.naoLidas !== b.naoLidas) return b.naoLidas - a.naoLidas;
        const dataA = new Date(a.cartinhas[0]?.dataEnvio || 0);
        const dataB = new Date(b.cartinhas[0]?.dataEnvio || 0);
        return dataB - dataA;
    });

    const containerPilhas = container.querySelector('.container-pilhas');
    let html = '';

    usuariosComCartinhas.forEach((usuario, usuarioIndex) => {
        const cartasNaoLidas = usuario.naoLidas;

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
    container.style.display = 'block';
    semCartinhas.style.display = 'none';

    window.pilhaAtivaIndex = 0;
    window.totalPilhas = usuariosComCartinhas.length;

    renderizarPilhasVisiveis();
}

// ==================== Funções de controle das pilhas ====================
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
    
    pilhas.forEach(pilha => {
        pilha.classList.remove('ativa', 'segunda', 'terceira', 'quarta', 'fundo');
    });
    
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
    
    renderizarPilhasVisiveis();
    setTimeout(descarregarPilhasInvisiveis, 500);
}

function ciclarCartasPilhaAtiva() {
    const pilhaAtiva = document.querySelector('.pilha-cartas.ativa');
    if (!pilhaAtiva) return;

    const cartas = Array.from(pilhaAtiva.querySelectorAll('.carta-empilhada'));
    if (cartas.length <= 1) return;

    const usuarioIndex = parseInt(pilhaAtiva.dataset.usuarioIndex);
    const usuario = window.usuariosProcessados[usuarioIndex];
    if (!usuario) return;

    if (!usuario.indiceCiclo) usuario.indiceCiclo = 0;
    usuario.indiceCiclo = (usuario.indiceCiclo + 1) % usuario.cartinhas.length;

    usuario.cartinhas.push(usuario.cartinhas.shift());

    cartas.forEach(carta => carta.remove());

    for (let i = 0; i < Math.min(3, usuario.cartinhas.length); i++) {
        const cartinha = usuario.cartinhas[i];
        const dataFormatada = formatarData(cartinha.dataEnvio);
        const isLida = cartinha.lida;
        let posicaoClasse = '';
        if (i === 0) posicaoClasse = 'topo';
        else if (i === 1) posicaoClasse = 'meio';
        else posicaoClasse = 'fundo';

        const posicaoReal = (usuario.indiceCiclo + i) % usuario.cartinhas.length + 1;

        const cartaHtml = document.createElement('div');
        cartaHtml.className = `carta-empilhada carta-envelope ${posicaoClasse}`;
        cartaHtml.id = `carta-${cartinha.id}`;
        cartaHtml.dataset.cartinhaId = cartinha.id;
        cartaHtml.dataset.usuarioId = usuario.userId;
        cartaHtml.dataset.posicao = i;
        cartaHtml.style.zIndex = 10 - i;
        cartaHtml.innerHTML = `
            <div class="badge-enviada ${isLida ? 'lida' : ''}">
                Para: ${usuario.username}
            </div>
            <div class="envelope-flap"></div>
            <div class="selo ${!isLida ? 'nova' : ''}">${isLida ? 'LIDA' : 'ENVIADA'}</div>
            <div class="icone-enviada ${isLida ? 'lida' : ''}"></div>
            <div class="envelope-header">
                <div class="remetente-info">
                    <img src="${usuario.avatar}" alt="Avatar" class="avatar-carta">
                    <div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span class="contador-cartas">
                                Carta ${posicaoReal} de ${usuario.cartinhas.length}
                            </span>
                            <small style="color: #7D8D86; font-weight: 500;">${dataFormatada}</small>
                            ${isLida ? '<span class="indicador-lida">✓ Lida</span>' : '<span class="indicador-nao-lida">○ Não lida</span>'}
                        </div>
                    </div>
                </div>
            </div>
            <div class="cartinha-papel papel-linhas">
                <h3 class="titulo-carta">${cartinha.titulo || ''}</h3>
                <div class="conteudo-carta">${cortarTexto(cartinha.conteudo || '', 120)}</div>
                <div class="data-carta">Enviada em ${dataFormatada}</div>
            </div>
            ${i === 0 ? `
                <div class="acoes-carta">
                    <button class="btn-acao btn-ler" onclick="abrirCartinha(${cartinha.id})" title="Ver carta">👁️</button>
                </div>
            ` : ''}
        `;
        pilhaAtiva.appendChild(cartaHtml);
    }
}

function lerCartaAtiva() {
    const pilhaAtiva = document.querySelector('.pilha-cartas.ativa');
    if (!pilhaAtiva) return;
    
    const cartaTopo = pilhaAtiva.querySelector('.carta-empilhada.topo');
    if (cartaTopo) {
        const cartinhaId = parseInt(cartaTopo.dataset.cartinhaId);
        abrirCartinha(cartinhaId);
    }
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

// ==================== Abrir cartinha no modal ====================
function abrirCartinha(cartinhaId) {
    if (cartinhaId === null || cartinhaId === undefined || isNaN(cartinhaId)) {
        console.warn('abrirCartinha chamado com id inválido:', cartinhaId);
        return;
    }
    const cartinha = encontrarCartinha(cartinhaId);
    if (!cartinha) {
        console.warn('Cartinha não encontrada para id:', cartinhaId);
        return;
    }

    const usuario = encontrarUsuarioPorCartinha(cartinhaId);
    if (!usuario) {
        console.warn('Usuário não encontrado para cartinha id:', cartinhaId);
        return;
    }

    // Usar o modal compartilhado
    window.modalCartinha.abrir({
        tipo: 'enviadas',
        cartinha: cartinha,
        usuario: usuario,
        badges: [
            cartinha.lida ? 
                { icone: '✓', texto: 'Lida pelo destinatário', cor: '#27ae60', corTexto: 'white' } : 
                { icone: '○', texto: 'Ainda não lida', cor: '#f39c12', corTexto: '#2d3436' }
        ],
        acoes: [
            {
                id: 'excluir',
                icone: '🗑️',
                texto: 'Excluir',
                classe: 'btn-outline-danger',
                desabilitado: cartinha.lida,
                titulo: cartinha.lida ? "Não é possível excluir cartas que já foram lidas" : "Excluir esta cartinha",
                callback: (carta, user) => {
                    window.modalCartinha.fechar();
                    setTimeout(() => confirmarExclusao(carta.id), 300);
                }
            },
            {
                id: 'editar',
                icone: '✏️',
                texto: 'Editar',
                classe: 'btn-outline-primary',
                desabilitado: cartinha.lida,
                titulo: cartinha.lida ? "Não é possível editar cartas que já foram lidas" : "Editar esta cartinha",
                callback: (carta, user) => {
                    window.modalCartinha.fechar();
                    setTimeout(() => abrirModalEdicao(carta.id), 300);
                }
            }
        ],
        atalhosTeclado: {
            'e': {
                callback: (carta, user) => {
                    if (!carta.lida) {
                        window.modalCartinha.fechar();
                        setTimeout(() => abrirModalEdicao(carta.id), 300);
                    }
                }
            },
            'd': {
                callback: (carta, user) => {
                    if (!carta.lida) {
                        window.modalCartinha.fechar();
                        setTimeout(() => confirmarExclusao(carta.id), 300);
                    }
                }
            }
        }
    });
}

// ==================== Funções de edição ====================
function abrirModalEdicao(cartinhaId) {
    const cartinha = encontrarCartinha(cartinhaId);
    const usuario = encontrarUsuarioPorCartinha(cartinhaId);
    
    if (!cartinha || !usuario) return;
    
    // Fechar modal de visualização
    const cartinhaModal = bootstrap.Modal.getInstance(document.getElementById('cartinhaModal'));
    if (cartinhaModal) cartinhaModal.hide();
    
    // Preencher formulário
    document.getElementById('edit-cartinha-id').value = cartinhaId;
    document.getElementById('edit-destinatario-avatar').src = usuario.avatar;
    document.getElementById('edit-destinatario-nome').textContent = usuario.username;
    document.getElementById('edit-titulo').value = cartinha.titulo;
    document.getElementById('edit-conteudo').value = cartinha.conteudo;
    
    atualizarContadores();
    
    // Abrir modal de edição
    const editarModal = new bootstrap.Modal(document.getElementById('editarModal'));
    editarModal.show();
}

function atualizarContadores() {
    const titulo = document.getElementById('edit-titulo');
    const conteudo = document.getElementById('edit-conteudo');
    
    document.getElementById('edit-contador-titulo').textContent = `${titulo.value.length}/40`;
    document.getElementById('edit-contador-conteudo').textContent = `${conteudo.value.length}/560`;
}

async function salvarEdicao() {
    const cartinhaId = document.getElementById('edit-cartinha-id').value;
    const titulo = document.getElementById('edit-titulo').value.trim();
    const conteudo = document.getElementById('edit-conteudo').value.trim();
    
    if (!titulo || !conteudo) {
        mostrarMensagem('Título e conteúdo são obrigatórios', 'danger');
        return;
    }
    
    const salvarBtn = document.getElementById('salvar-edicao-btn');
    const originalText = salvarBtn.innerHTML;
    salvarBtn.disabled = true;
    salvarBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';
    
    try {
        const response = await fetch(`/api/cartinhas/${cartinhaId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ titulo, conteudo })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Atualizar dados locais
            const cartinha = encontrarCartinha(parseInt(cartinhaId));
            if (cartinha) {
                cartinha.titulo = titulo;
                cartinha.conteudo = conteudo;
            }
            
            // Atualizar UI
            const cartaElement = document.getElementById(`carta-${cartinhaId}`);
            if (cartaElement) {
                const tituloElement = cartaElement.querySelector('.titulo-carta');
                const conteudoElement = cartaElement.querySelector('.conteudo-carta');
                if (tituloElement) tituloElement.textContent = titulo;
                if (conteudoElement) conteudoElement.textContent = cortarTexto(conteudo, 120);
            }
            
            // Fechar modal
            const editarModal = bootstrap.Modal.getInstance(document.getElementById('editarModal'));
            editarModal.hide();
            
            mostrarFeedback(result.message, 'success');
        } else {
            mostrarMensagem(result.message, 'danger');
            salvarBtn.disabled = false;
            salvarBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Erro ao editar cartinha:', error);
        mostrarMensagem('Erro ao salvar alterações', 'danger');
        salvarBtn.disabled = false;
        salvarBtn.innerHTML = originalText;
    }
}

function mostrarMensagem(texto, tipo) {
    const mensagem = document.getElementById('edit-mensagem');
    mensagem.className = `alert alert-${tipo}`;
    mensagem.textContent = texto;
    mensagem.style.display = 'block';
    
    setTimeout(() => {
        mensagem.style.display = 'none';
    }, 5000);
}

// ==================== Funções auxiliares ====================
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

// ==================== Funções de carregamento sob demanda ====================
function renderizarPilhasVisiveis() {
    const pilhasVisiveis = document.querySelectorAll('.pilha-cartas.ativa, .pilha-cartas.segunda, .pilha-cartas.terceira');
    
    pilhasVisiveis.forEach(pilha => {
        const usuarioIndex = parseInt(pilha.dataset.usuarioIndex);
        const carregada = pilha.dataset.carregada === 'true';
        
        if (!carregada && window.usuariosProcessados && window.usuariosProcessados[usuarioIndex]) {
            carregarCartasParaPilha(pilha, usuarioIndex);
        }
    });
}

function carregarCartasParaPilha(pilhaElement, usuarioIndex) {
    const usuario = window.usuariosProcessados[usuarioIndex];
    if (!usuario) return;
    
    if (!usuario.indiceCiclo) usuario.indiceCiclo = 0;
    
    const cartasDoUsuario = usuario.cartinhas;
    const totalCartas = cartasDoUsuario.length;
    let html = '';
    
    const cartasParaRenderizar = cartasDoUsuario.slice(0, Math.min(3, totalCartas));
    
    cartasParaRenderizar.forEach((cartinha, index) => {
        const dataFormatada = formatarData(cartinha.dataEnvio);
        const isLida = cartinha.lida;
        
        let posicaoClasse = '';
        if (index === 0) posicaoClasse = 'topo';
        else if (index === 1) posicaoClasse = 'meio';
        else posicaoClasse = 'fundo';
        
        const posicaoReal = (usuario.indiceCiclo + index) % totalCartas + 1;
        
        html += `
            <div class="carta-empilhada carta-envelope ${posicaoClasse}" 
                id="carta-${cartinha.id}" 
                data-cartinha-id="${cartinha.id}"
                data-usuario-id="${usuario.userId}"
                data-posicao="${index}"
                style="z-index: ${10 - index}">
                
                <div class="badge-enviada ${isLida ? 'lida' : ''}">
                    Para: ${usuario.username}
                </div>
                
                <div class="envelope-flap"></div>
                
                <div class="selo ${!isLida ? 'nova' : ''}">
                    ${isLida ? 'LIDA' : 'ENVIADA'}
                </div>
                
                <div class="envelope-header">
                    <div class="remetente-info">
                        <img src="${usuario.avatar}" alt="Avatar" class="avatar-carta">
                        <div>
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <span class="contador-cartas">
                                    Carta ${posicaoReal} de ${totalCartas}
                                </span>
                                <small style="color: #7D8D86; font-weight: 500;">${dataFormatada}</small>
                                ${isLida ? '<span class="indicador-lida">✓ Lida</span>' : '<span class="indicador-nao-lida">○ Não lida</span>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="cartinha-papel papel-linhas">
                    <h3 class="titulo-carta">${cartinha.titulo || ''}</h3>
                    <div class="conteudo-carta">${cortarTexto(cartinha.conteudo || '', 120)}</div>
                    <div class="data-carta">Enviada em ${dataFormatada}</div>
                </div>

                ${usuarioIndex === window.pilhaAtivaIndex && index === 0 ? `
                    <div class="acoes-carta">
                        <button class="btn-acao btn-ler" onclick="abrirCartinha(${cartinha.id})" title="Ver carta">
                            👁️
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    pilhaElement.insertAdjacentHTML('beforeend', html);
    pilhaElement.dataset.carregada = 'true';
    
    const cartaTopo = pilhaElement.querySelector('.carta-empilhada.topo');
    if (cartaTopo) {
        cartaTopo.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-acao')) {
                const cartinhaId = parseInt(cartaTopo.dataset.cartinhaId);
                abrirCartinha(cartinhaId);
            }
        });
    }
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

// ==================== Função de exclusão ====================
function confirmarExclusao(cartinhaId) {
    const cartinhaModal = bootstrap.Modal.getInstance(document.getElementById('cartinhaModal'));
    if (cartinhaModal) cartinhaModal.hide();
    
    let confirmationModal = document.getElementById('confirmDeleteModal');
    
    if (!confirmationModal) {
        const modalHtml = `
            <div class="modal fade" id="confirmDeleteModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">⚠️ Confirmar exclusão</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
                        </div>
                        <div class="modal-body">
                            <p>Tem certeza que deseja <strong>excluir permanentemente</strong> esta cartinha?</p>
                            <div class="alert alert-warning" role="alert">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                Esta ação não pode ser desfeita!
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">
                                Excluir permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        confirmationModal = document.getElementById('confirmDeleteModal');
    }
    
    const confirmBtn = confirmationModal.querySelector('#confirmDeleteBtn');
    confirmBtn.onclick = () => excluirCartinha(cartinhaId);
    
    const modal = new bootstrap.Modal(confirmationModal);
    modal.show();
}

async function excluirCartinha(cartinhaId) {
    try {
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Excluindo...`;
        
        const response = await fetch(`/api/cartinhas/${cartinhaId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            const result = await response.json();
            
            const confirmationModal = bootstrap.Modal.getInstance(document.getElementById('confirmDeleteModal'));
            confirmationModal.hide();
            
            const cartinha = encontrarCartinha(cartinhaId);
            const usuario = encontrarUsuarioPorCartinha(cartinhaId);
            
            if (usuario && cartinha) {
                const index = usuario.cartinhas.findIndex(c => c.id === cartinhaId);
                if (index !== -1) {
                    usuario.cartinhas.splice(index, 1);
                }
                
                const cartaElement = document.getElementById(`carta-${cartinhaId}`);
                if (cartaElement) {
                    cartaElement.remove();
                }
                
                if (usuario.cartinhas.length === 0) {
                    const userIndex = window.usuariosProcessados.findIndex(u => u.userId === usuario.userId);
                    if (userIndex !== -1) {
                        window.usuariosProcessados.splice(userIndex, 1);
                    }
                    
                    const pilha = document.getElementById(`pilha-${usuario.userId}`);
                    if (pilha) {
                        pilha.remove();
                    }
                    
                    if (window.usuariosProcessados.length === 0) {
                        const container = document.getElementById('cartinhas-container');
                        const semCartinhas = document.getElementById('sem-cartinhas');
                        container.style.display = 'none';
                        semCartinhas.style.display = 'block';
                    }
                }
                
                mostrarFeedback(result.message || "Cartinha excluída com sucesso!", "success");
            }
        } else {
            const result = await response.json();
            mostrarFeedback(result.message || "Erro ao excluir cartinha", "danger");
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Erro ao excluir cartinha:', error);
        mostrarFeedback("Erro ao excluir cartinha. Por favor, tente novamente.", "danger");
        
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = "Excluir permanentemente";
        }
    }
}

// ==================== Feedback ====================
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

// ==================== Inicialização ====================
document.addEventListener('DOMContentLoaded', () => {
    carregarCartinhas();
    
    // Eventos de teclado para navegação
    document.addEventListener('keydown', (e) => {
        if (window.totalPilhas === undefined || window.totalPilhas === 0) return;
        
        const modalAberto = document.querySelector('.modal.show');
        if (modalAberto) {
            // Atalhos no modal de visualização
            if (modalAberto.id === 'cartinhaModal') {
                if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    const editarBtn = document.getElementById('editar-btn');
                    if (editarBtn && !editarBtn.disabled) editarBtn.click();
                }
                if (e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    const excluirBtn = document.getElementById('excluir-btn');
                    if (excluirBtn && !excluirBtn.disabled) excluirBtn.click();
                }
            }
            return;
        }
        
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
                ciclarCartasPilhaAtiva();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                lerCartaAtiva();
                break;
        }
    });
    
    // Eventos do modal de edição
    document.getElementById('edit-titulo').addEventListener('input', atualizarContadores);
    document.getElementById('edit-conteudo').addEventListener('input', atualizarContadores);
    document.getElementById('salvar-edicao-btn').addEventListener('click', salvarEdicao);
});
