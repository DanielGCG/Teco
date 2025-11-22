// Sistema de Escrever Cartinhas
class EscreverCartinha {
    constructor() {
        this.usuarioAtual = null;
        this.destinatarioSelecionado = null;
        this.usuarios = [];
        this.rascunhoAutosave = null;
        
        this.init();
    }

    init() {
        this.carregarUsuarioAtual();
        this.configurarEventos();
        this.verificarParametrosURL();
        this.carregarRascunho();
        this.iniciarAutosave();
    }

    // ==================== Inicialização ====================
    async carregarUsuarioAtual() {
        try {
            const response = await fetch('/api/users/me', {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.usuarioAtual = await response.json();
                document.getElementById('nomeRemetente').textContent = this.usuarioAtual.username;
            }
            console.log (this.usuarioAtual);
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
            this.usuarioAtual = {
                id: null,
                username: 'Você',
                avatar: '/images/placeholder.png'
            };
        }
    }

    configurarEventos() {
        // Busca de usuários
        const inputDestinatario = document.getElementById('destinatario');
        const btnBuscar = document.getElementById('btnBuscarUsuarios');
        
        inputDestinatario.addEventListener('input', this.debounce(() => {
            this.buscarUsuarios(inputDestinatario.value);
        }, 300));
        
        inputDestinatario.addEventListener('focus', () => {
            if (inputDestinatario.value.length > 0) {
                this.buscarUsuarios(inputDestinatario.value);
            }
        });
        
        btnBuscar.addEventListener('click', () => {
            this.buscarUsuarios(inputDestinatario.value);
        });

        // Contadores de caracteres
        document.getElementById('titulo').addEventListener('input', (e) => {
            this.atualizarContador('titulo', e.target.value.length, 40);
        });

        document.getElementById('conteudo').addEventListener('input', (e) => {
            this.atualizarContador('conteudo', e.target.value.length, 560);
        });

        // Botões de ação
        document.getElementById('btnGerenciarRascunhos').addEventListener('click', () => {
            this.abrirModalRascunhos();
        });

        document.getElementById('btnSalvarRascunho').addEventListener('click', () => {
            this.abrirModalSalvarRascunho();
        });
        
        document.getElementById('btnConfirmarSalvarRascunho').addEventListener('click', () => {
            this.salvarRascunhoNomeado();
        });

        document.getElementById('btnLimparCartinha').addEventListener('click', () => {
            this.abrirModalLimparCartinha();
        });

        document.getElementById('btnConfirmarLimpar').addEventListener('click', () => {
            this.limparCartinha();
        });
        
        document.getElementById('btnEnviarCartinha').addEventListener('click', () => {
            this.validarEEnviar();
        });
        
        document.getElementById('btnConfirmarEnvio').addEventListener('click', () => {
            this.enviarCartinha();
        });

        // Teclas de atalho
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.abrirModalSalvarRascunho();
            }
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.validarEEnviar();
            }
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.abrirModalRascunhos();
            }
            if (e.ctrlKey && e.key === 'Delete') {
                e.preventDefault();
                this.abrirModalLimparCartinha();
            }
        });

        // Fechar sugestões ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.campo-destinatario')) {
                this.fecharSugestoes();
            }
        });
    }

    // ==================== Verificar Parâmetros da URL ====================
    verificarParametrosURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const paraUserId = urlParams.get('para');
        const paraUsername = urlParams.get('nome');
        
        if (paraUserId && paraUsername) {
            // Simular destinatário a partir dos parâmetros
            this.destinatarioSelecionado = {
                id: parseInt(paraUserId),
                username: decodeURIComponent(paraUsername),
                avatar: '/images/placeholder.png',
                status: 'online'
            };
            
            // Preencher campos
            document.getElementById('destinatario').value = this.destinatarioSelecionado.username;
            document.getElementById('destinatarioId').value = this.destinatarioSelecionado.id;
            
            // Adicionar classe de sucesso
            document.querySelector('.campo-destinatario').classList.add('campo-sucesso');
            
            // Focar no título
            document.getElementById('titulo').focus();
        }
    }

    // ==================== Busca de Usuários ====================
    async buscarUsuarios(termo) {

        try {
            const url = `/api/users/buscar?q=${encodeURIComponent(termo || '')}`;
            const response = await fetch(url, { credentials: 'include' });

            if (response.ok) {
                const data = await response.json();
                this.usuarios = Array.isArray(data.usuarios) ? data.usuarios : [];
            } else {
                this.usuarios = [];
            }

            this.renderizarSugestoes();

        } catch (error) {
            this.usuarios = [];
            this.fecharSugestoes();
        }
    }

    renderizarSugestoes() {
        const container = document.getElementById('sugestoesUsuarios');
        if (this.usuarios.length === 0) {
            container.innerHTML = `
                <div class="text-center p-3 text-muted">
                    🔍 Nenhum usuário encontrado
                </div>
            `;
            container.style.display = 'block';
            return;
        }

        // Adiciona o usuário atual flutuando no topo, se estiver na lista
        let usuariosFiltrados = this.usuarios.map(usuario => ({
            ...usuario,
            avatar: usuario.avatar ? usuario.avatar : '/images/placeholder.png'
        }));

        let usuarioAtual = this.usuarioAtual;
        let html = '';
        if (usuarioAtual) {
            // Se o usuário atual está na lista, destaque flutuante
            const existe = usuariosFiltrados.find(u => u.id === usuarioAtual.id);
            if (existe) {
                html += `
                <div class="sugestao-usuario sugestao-atual" data-usuario-id="${usuarioAtual.id}" style="position:sticky;top:0;z-index:2;background:#f8f9fa;border-bottom:1px solid #eee;">
                    <img src="${usuarioAtual.avatar ? usuarioAtual.avatar : '/images/placeholder.png'}" alt="${usuarioAtual.username}" class="avatar-sugestao">
                    <div class="info-usuario">
                        <div class="nome-usuario">${usuarioAtual.username} <span class="badge bg-primary ms-1">Você</span></div>
                        <div class="status-usuario">${this.formatarStatus(usuarioAtual.status || 'online')}</div>
                    </div>
                </div>
                `;
                // Remove o usuário atual da lista para não duplicar
                usuariosFiltrados = usuariosFiltrados.filter(u => u.id !== usuarioAtual.id);
            }
        }

        html += usuariosFiltrados.map(usuario => `
            <div class="sugestao-usuario" data-usuario-id="${usuario.id}">
                <img src="${usuario.avatar}" alt="${usuario.username}" class="avatar-sugestao">
                <div class="info-usuario">
                    <div class="nome-usuario">${usuario.username}</div>
                    <div class="status-usuario">${this.formatarStatus(usuario.status)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
        container.style.display = 'block';

        container.querySelectorAll('.sugestao-usuario').forEach(elemento => {
            elemento.addEventListener('click', () => {
                const usuarioId = parseInt(elemento.dataset.usuarioId);
                this.selecionarDestinatario(usuarioId);
            });
        });
    }

    selecionarDestinatario(usuarioId) {
        const usuario = this.usuarios.find(u => u.id === usuarioId);
        if (!usuario) return;

        this.destinatarioSelecionado = usuario;
        
        // Atualizar campos
        document.getElementById('destinatario').value = usuario.username;
        document.getElementById('destinatarioId').value = usuario.id;
        
        // Adicionar classe de sucesso
        document.querySelector('.campo-destinatario').classList.remove('campo-erro');
        document.querySelector('.campo-destinatario').classList.add('campo-sucesso');
        
        this.fecharSugestoes();
        
        // Focar no título
        document.getElementById('titulo').focus();
    }

    fecharSugestoes() {
        document.getElementById('sugestoesUsuarios').style.display = 'none';
    }

    formatarStatus(status) {
        const statusMap = {
            'online': '🟢 Online',
            'offline': '⚫ Offline',
            'ausente': '🟡 Ausente'
        };
        return statusMap[status] || '⚫ Offline';
    }

    // ==================== Contadores ====================
    atualizarContador(campo, atual, maximo) {
        const contador = document.querySelector(`.contador-${campo}`);
        contador.textContent = `${atual}/${maximo} caracteres`;

        if (atual > maximo * 0.9) {
            contador.style.color = '#ff6b6b';
        } else if (atual > maximo * 0.7) {
            contador.style.color = '#f39c12';
        } else {
            contador.style.color = '';
        }
    }

    // ==================== Rascunhos ====================
    carregarRascunho() {
        try {
            const rascunho = localStorage.getItem('cartinha_rascunho');
            if (rascunho) {
                const dados = JSON.parse(rascunho);
                
                if (dados.titulo) document.getElementById('titulo').value = dados.titulo;
                if (dados.conteudo) document.getElementById('conteudo').value = dados.conteudo;
                if (dados.destinatarioId) {
                    // Buscar destinatário salvo
                    this.buscarUsuarioPorId(dados.destinatarioId);
                }
                
                this.atualizarContadores();
            }
        } catch (error) {
            console.error('Erro ao carregar rascunho:', error);
        }
    }

    abrirModalSalvarRascunho() {
        const titulo = document.getElementById('titulo').value.trim();
        const conteudo = document.getElementById('conteudo').value.trim();
        const destinatario = this.destinatarioSelecionado?.username || 'Não definido';
        
        if (!titulo && !conteudo) {
            alert('⚠️ Escreva algo antes de salvar um rascunho!');
            return;
        }
        
        // Preencher modal
        document.getElementById('nomeRascunho').value = '';
        document.getElementById('resumoRascunhoDestinatario').textContent = destinatario;
        document.getElementById('resumoRascunhoTitulo').textContent = titulo || 'Sem título';
        document.getElementById('resumoRascunhoConteudo').textContent = conteudo.length;
        
        const modal = new bootstrap.Modal(document.getElementById('modalSalvarRascunho'));
        modal.show();
    }

    salvarRascunhoNomeado() {
        try {
            const nomePersonalizado = document.getElementById('nomeRascunho').value.trim();
            const titulo = document.getElementById('titulo').value.trim();
            const conteudo = document.getElementById('conteudo').value.trim();
            
            const nome = nomePersonalizado || titulo || 'Rascunho sem título';
            
            const rascunho = {
                id: Date.now(), // ID único baseado em timestamp
                nome: nome,
                titulo: titulo,
                conteudo: conteudo,
                destinatarioId: document.getElementById('destinatarioId').value,
                destinatarioNome: this.destinatarioSelecionado?.username || '',
                timestamp: Date.now(),
                dataFormatada: new Date().toLocaleString('pt-BR')
            };
            
            // Carregar rascunhos existentes
            const rascunhos = this.carregarTodosRascunhos();
            
            // Adicionar novo rascunho
            rascunhos.push(rascunho);
            
            // Salvar de volta
            localStorage.setItem('cartinhas_rascunhos', JSON.stringify(rascunhos));
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalSalvarRascunho'));
            modal.hide();
            
            // Feedback
            this.mostrarFeedbackSalvarRascunho();
            
        } catch (error) {
            console.error('Erro ao salvar rascunho:', error);
            alert('❌ Erro ao salvar rascunho. Tente novamente.');
        }
    }

    carregarTodosRascunhos() {
        try {
            const rascunhos = localStorage.getItem('cartinhas_rascunhos');
            return rascunhos ? JSON.parse(rascunhos) : [];
        } catch (error) {
            console.error('Erro ao carregar rascunhos:', error);
            return [];
        }
    }

    abrirModalRascunhos() {
        const rascunhos = this.carregarTodosRascunhos();
        this.renderizarListaRascunhos(rascunhos);
        
        const modal = new bootstrap.Modal(document.getElementById('modalRascunhos'));
        modal.show();
    }

    renderizarListaRascunhos(rascunhos) {
        const container = document.getElementById('listaRascunhos');
        const semRascunhos = document.getElementById('semRascunhos');
        
        if (rascunhos.length === 0) {
            container.style.display = 'none';
            semRascunhos.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        semRascunhos.style.display = 'none';
        
        // Ordenar por data (mais recente primeiro)
        rascunhos.sort((a, b) => b.timestamp - a.timestamp);
        
        const html = rascunhos.map(rascunho => `
            <div class="item-rascunho" data-rascunho-id="${rascunho.id}">
                <div class="rascunho-header">
                    <h6 class="rascunho-nome">${this.escapeHtml(rascunho.nome)}</h6>
                    <small class="rascunho-data">${rascunho.dataFormatada}</small>
                </div>
                
                <div class="rascunho-detalhes">
                    <div class="rascunho-para">
                        <strong>Para:</strong> ${this.escapeHtml(rascunho.destinatarioNome || 'Não definido')}
                    </div>
                    ${rascunho.titulo ? `
                        <div class="rascunho-titulo">
                            <strong>Título:</strong> ${this.escapeHtml(rascunho.titulo)}
                        </div>
                    ` : ''}
                    ${rascunho.conteudo ? `
                        <div class="rascunho-preview">${this.escapeHtml(rascunho.conteudo.substring(0, 150))}${rascunho.conteudo.length > 150 ? '...' : ''}</div>
                    ` : ''}
                </div>
                
                <div class="rascunho-acoes">
                    <button class="btn btn-success btn-sm" onclick="window.escreverCartinha.aplicarRascunho(${rascunho.id})">
                        ✏️ Aplicar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.escreverCartinha.excluirRascunho(${rascunho.id})">
                        🗑️ Excluir
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    aplicarRascunho(rascunhoId) {
        try {
            const rascunhos = this.carregarTodosRascunhos();
            const rascunho = rascunhos.find(r => r.id === rascunhoId);
            
            if (!rascunho) {
                alert('❌ Rascunho não encontrado!');
                return;
            }
            
            // Confirmar se há conteúdo atual
            const tituloAtual = document.getElementById('titulo').value.trim();
            const conteudoAtual = document.getElementById('conteudo').value.trim();
            
            if ((tituloAtual || conteudoAtual) && 
                !confirm('⚠️ Há conteúdo na cartinha atual. Deseja substituir pelo rascunho selecionado?')) {
                return;
            }
            
            // Aplicar rascunho
            document.getElementById('titulo').value = rascunho.titulo || '';
            document.getElementById('conteudo').value = rascunho.conteudo || '';
            
            if (rascunho.destinatarioId && rascunho.destinatarioNome) {
                document.getElementById('destinatario').value = rascunho.destinatarioNome;
                document.getElementById('destinatarioId').value = rascunho.destinatarioId;
                
                // Simular destinatário selecionado
                this.destinatarioSelecionado = {
                    id: parseInt(rascunho.destinatarioId),
                    username: rascunho.destinatarioNome
                };
                
                // Adicionar classe de sucesso
                document.querySelector('.campo').classList.remove('campo-erro');
                document.querySelector('.campo').classList.add('campo-sucesso');
            }
            
            this.atualizarContadores();
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalRascunhos'));
            modal.hide();
            
            // Feedback
            const feedback = document.createElement('div');
            feedback.className = 'alert alert-success alert-dismissible fade show position-fixed';
            feedback.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
            feedback.innerHTML = `
                ✅ Rascunho aplicado com sucesso!
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.body.appendChild(feedback);
            
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 3000);
            
        } catch (error) {
            console.error('Erro ao aplicar rascunho:', error);
            alert('❌ Erro ao aplicar rascunho. Tente novamente.');
        }
    }

    excluirRascunho(rascunhoId) {
        if (!confirm('🗑️ Tem certeza que deseja excluir este rascunho? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            let rascunhos = this.carregarTodosRascunhos();
            rascunhos = rascunhos.filter(r => r.id !== rascunhoId);
            
            localStorage.setItem('cartinhas_rascunhos', JSON.stringify(rascunhos));
            
            // Atualizar lista
            this.renderizarListaRascunhos(rascunhos);
            
        } catch (error) {
            console.error('Erro ao excluir rascunho:', error);
            alert('❌ Erro ao excluir rascunho. Tente novamente.');
        }
    }

    mostrarFeedbackSalvarRascunho() {
        const feedback = document.createElement('div');
        feedback.className = 'alert alert-success alert-dismissible fade show position-fixed';
        feedback.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
        feedback.innerHTML = `
            💾 Rascunho salvo com sucesso!
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 3000);
    }

    salvarRascunho() {
        // Método legado mantido para compatibilidade
        this.abrirModalSalvarRascunho();
    }

    // ==================== Limpar Cartinha ====================
    abrirModalLimparCartinha() {
        const titulo = document.getElementById('titulo').value.trim();
        const conteudo = document.getElementById('conteudo').value.trim();
        const destinatario = document.getElementById('destinatario').value.trim();
        
        // Se não há conteúdo, não precisa do modal
        if (!titulo && !conteudo && !destinatario) {
            this.mostrarFeedbackLimpeza('⚠️ A cartinha já está vazia!', 'info');
            return;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('modalLimparCartinha'));
        modal.show();
    }

    limparCartinha() {
        try {
            // Limpar todos os campos
            document.getElementById('destinatario').value = '';
            document.getElementById('destinatarioId').value = '';
            document.getElementById('titulo').value = '';
            document.getElementById('conteudo').value = '';
            
            // Resetar destinatário selecionado
            this.destinatarioSelecionado = null;
            
            // Remover classes de validação
            document.querySelectorAll('.campo-erro, .campo-sucesso').forEach(campo => {
                campo.classList.remove('campo-erro', 'campo-sucesso');
            });
            
            // Atualizar contadores
            this.atualizarContador('titulo', 0, 40);
            this.atualizarContador('conteudo', 0, 560);
            
            // Fechar sugestões se estiverem abertas
            this.fecharSugestoes();
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalLimparCartinha'));
            modal.hide();
            
            // Focar no primeiro campo
            setTimeout(() => {
                document.getElementById('destinatario').focus();
            }, 300);
            
            // Feedback de sucesso
            this.mostrarFeedbackLimpeza('🗑️ Cartinha limpa com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao limpar cartinha:', error);
            this.mostrarFeedbackLimpeza('❌ Erro ao limpar cartinha. Tente novamente.', 'error');
        }
    }

    mostrarFeedbackLimpeza(mensagem, tipo = 'success') {
        const alertClass = tipo === 'error' ? 'alert-danger' : 
                          tipo === 'info' ? 'alert-info' : 'alert-success';
        
        const feedback = document.createElement('div');
        feedback.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
        feedback.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
        feedback.innerHTML = `
            ${mensagem}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 3000);
    }

    iniciarAutosave() {
        this.rascunhoAutosave = setInterval(() => {
            const titulo = document.getElementById('titulo').value.trim();
            const conteudo = document.getElementById('conteudo').value.trim();
            
            if (titulo || conteudo) {
                this.salvarRascunhoSilencioso();
            }
        }, 60000); // Autosave a cada 1 minuto (aumentado para não sobrecarregar)
    }

    salvarRascunhoSilencioso() {
        try {
            // Manter sistema legado para autosave
            const dados = {
                titulo: document.getElementById('titulo').value,
                conteudo: document.getElementById('conteudo').value,
                destinatarioId: document.getElementById('destinatarioId').value,
                timestamp: Date.now()
            };
            
            localStorage.setItem('cartinha_rascunho', JSON.stringify(dados));
        } catch (error) {
            console.error('Erro no autosave:', error);
        }
    }

    // ==================== Validação e Envio ====================
    validarEEnviar() {
        this.limparErros();
        
        const titulo = document.getElementById('titulo').value.trim();
        const conteudo = document.getElementById('conteudo').value.trim();
        const destinatarioId = document.getElementById('destinatarioId').value;
        
        let temErros = false;

        // Validar destinatário
        if (!destinatarioId || !this.destinatarioSelecionado) {
            this.mostrarErro('destinatario', 'Selecione um destinatário para sua cartinha');
            temErros = true;
        }

        if (temErros) return;

        // Mostrar modal de confirmação
        this.mostrarConfirmacao(titulo, conteudo);
    }

    mostrarConfirmacao(titulo, conteudo) {
        document.getElementById('resumoDestinatario').textContent = this.destinatarioSelecionado.username;
        document.getElementById('resumoTitulo').textContent = titulo;
        document.getElementById('resumoConteudo').textContent = conteudo;
        
        const modal = new bootstrap.Modal(document.getElementById('modalConfirmacao'));
        modal.show();
    }

    async enviarCartinha() {
        const btnConfirmar = document.getElementById('btnConfirmarEnvio');
        const textoOriginal = btnConfirmar.innerHTML;
        
        try {
            // Estado de loading
            btnConfirmar.classList.add('btn-carregando');
            btnConfirmar.innerHTML = '<span>Enviando...</span>';
            btnConfirmar.disabled = true;

            const dados = {
                destinatario_username: this.destinatarioSelecionado?.username,
                titulo: document.getElementById('titulo').value.trim(),
                conteudo: document.getElementById('conteudo').value.trim()
            };

            const response = await fetch('/api/cartinhas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(dados)
            });

            if (response.ok) {
                // Fechar modal de confirmação
                const modalConfirmacao = bootstrap.Modal.getInstance(document.getElementById('modalConfirmacao'));
                modalConfirmacao.hide();
                
                // Limpar todos os campos
                document.getElementById('destinatario').value = '';
                document.getElementById('destinatarioId').value = '';
                document.getElementById('titulo').value = '';
                document.getElementById('conteudo').value = '';
                
                // Resetar destinatário selecionado
                this.destinatarioSelecionado = null;
                
                // Remover classes de validação
                document.querySelectorAll('.campo-erro, .campo-sucesso').forEach(campo => {
                    campo.classList.remove('campo-erro', 'campo-sucesso');
                });
                
                // Atualizar contadores
                this.atualizarContador('titulo', 0, 40);
                this.atualizarContador('conteudo', 0, 560);
                
                // Mostrar sucesso
                setTimeout(() => {
                    const modalSucesso = new bootstrap.Modal(document.getElementById('modalSucesso'));
                    modalSucesso.show();
                }, 500);
                
                // Limpar rascunho legado e oferece limpar rascunhos relacionados
                localStorage.removeItem('cartinha_rascunho');
                this.oferecerLimpezaRascunhos(dados.titulo, dados.conteudo);
                
                // Animação de envelope voando
                this.animarEnvio();
                
            } else {
                throw new Error('Erro ao enviar cartinha');
            }

        } catch (error) {
            console.error('Erro ao enviar cartinha:', error);
            alert('❌ Erro ao enviar cartinha. Tente novamente.');
            
        } finally {
            btnConfirmar.classList.remove('btn-carregando');
            btnConfirmar.innerHTML = textoOriginal;
            btnConfirmar.disabled = false;
        }
    }

    animarEnvio() {
        const header = document.querySelector('.header-cartinha');
        if (header) {
            header.style.transform = 'scale(0.98)';
            header.style.transition = 'transform 0.3s ease';
            
            setTimeout(() => {
                header.style.transform = 'scale(1)';
            }, 300);
        }
    }

oferecerLimpezaRascunhos(titulo, conteudo) {
    // Procurar rascunhos similares para oferecer limpeza
    const rascunhos = this.carregarTodosRascunhos();
    const rascunhosSimilares = rascunhos.filter(r => 
        r.titulo === titulo || 
        r.conteudo === conteudo ||
        (titulo && r.titulo.includes(titulo)) ||
        (conteudo && r.conteudo.includes(conteudo.substring(0, 50)))
    );
    
    if (rascunhosSimilares.length > 0) {
        setTimeout(() => {
            const confirmar = confirm(
                `🗑️ Encontramos ${rascunhosSimilares.length} rascunho(s) similar(es) à cartinha que você acabou de enviar.\n\n` +
                'Deseja excluí-los para manter sua lista organizada?'
            );
            
            if (confirmar) {
                const rascunhosRestantes = rascunhos.filter(r => !rascunhosSimilares.includes(r));
                localStorage.setItem('cartinhas_rascunhos', JSON.stringify(rascunhosRestantes));
            }
        }, 2000);
    }
}    // ==================== Utilitários ====================
    mostrarErro(campo, mensagem) {
        const container = document.querySelector(`.campo-${campo}`);
        if (!container) return;
        
        container.classList.add('campo-erro');
        container.classList.remove('campo-sucesso');
        
        // Remover mensagem anterior
        const erroAnterior = container.querySelector('.mensagem-erro');
        if (erroAnterior) erroAnterior.remove();
        
        // Adicionar nova mensagem
        const divErro = document.createElement('div');
        divErro.className = 'mensagem-erro';
        divErro.textContent = mensagem;
        container.appendChild(divErro);
    }

    limparErros() {
        document.querySelectorAll('.campo-erro').forEach(campo => {
            campo.classList.remove('campo-erro');
        });
        document.querySelectorAll('.campo-sucesso').forEach(campo => {
            campo.classList.remove('campo-sucesso');
        });
        document.querySelectorAll('.mensagem-erro').forEach(erro => {
            erro.remove();
        });
    }

    atualizarContadores() {
        const titulo = document.getElementById('titulo').value;
        const conteudo = document.getElementById('conteudo').value;
        
        this.atualizarContador('titulo', titulo.length, 40);
        this.atualizarContador('conteudo', conteudo.length, 560);
    }

    escapeHtml(texto) {
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async buscarUsuarioPorId(usuarioId) {
        try {
            const response = await fetch(`/api/users/${usuarioId}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const usuario = await response.json();
                this.destinatarioSelecionado = usuario;
                document.getElementById('destinatario').value = usuario.username;
            }
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
        }
    }

    // ==================== Destruição ====================
    destruir() {
        if (this.rascunhoAutosave) {
            clearInterval(this.rascunhoAutosave);
        }
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.escreverCartinha = new EscreverCartinha();
});

// Limpar ao sair da página
window.addEventListener('beforeunload', () => {
    if (window.escreverCartinha) {
        window.escreverCartinha.salvarRascunhoSilencioso();
        window.escreverCartinha.destruir();
    }
});