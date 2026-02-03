/**
 * Chat Utilities - Funções compartilhadas para renderização de mensagens
 * Reutilizável em DMs e Chats de Grupo
 */

const ChatUtils = (() => {
    // Formata tempo (HH:MM)
    function formatTime(dateStr) {
        const date = new Date(dateStr);
        return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    }

    // Renderiza uma única mensagem no container
    function renderMessage(message, container, options = {}) {
        const {
            isMine = false,
            showUsername = true,
            showTime = true,
            prepend = false
        } = options;

        // Evita duplicação
        if (message.id && container.querySelector(`[data-msg-id="${message.id}"]`)) return;

        const msgGroup = document.createElement('div');
        msgGroup.className = `msg-group ${isMine ? 'usuario' : 'outrousuario'}`;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `mensagem ${isMine ? 'usuario' : 'outrousuario'}`;
        if (message.id) msgDiv.dataset.msgId = message.id;

        // Nome do usuário
        if (showUsername && message.username) {
            const nomeLink = document.createElement('a');
            nomeLink.href = `/${message.username}`;
            nomeLink.style.cssText = 'text-decoration: none; color: inherit;';
            
            const nomeEl = document.createElement('div');
            nomeEl.style.cssText = 'font-size: 0.75rem; font-weight: bold; margin-bottom: 0.2rem;';
            nomeEl.textContent = message.username;
            
            nomeLink.appendChild(nomeEl);
            msgDiv.appendChild(nomeLink);
        }

        // Conteúdo
        const contentEl = document.createElement('span');
        contentEl.textContent = message.message;
        msgDiv.appendChild(contentEl);

        // Tempo e checks de visualização
        if (showTime && message.createdat) {
            const metaEl = document.createElement('div');
            metaEl.className = 'msg-meta';
            metaEl.textContent = formatTime(message.createdat);
            
            // Adiciona check de visualização para mensagens próprias em DMs
            if (isMine && message.isread !== undefined) {
                const checkEl = document.createElement('span');
                checkEl.className = `msg-check ${message.isread ? 'read' : ''}`;
                checkEl.textContent = message.isread ? '✓✓' : '✓';
                metaEl.appendChild(checkEl);
            }
            
            msgDiv.appendChild(metaEl);
        }

        msgGroup.appendChild(msgDiv);
        if (prepend) container.insertBefore(msgGroup, container.firstChild);
        else container.appendChild(msgGroup);
    }

    // Renderiza múltiplas mensagens
    function renderMessages(messages, container, options = {}) {
        const {
            clearContainer = false,
            scrollToBottom = true,
            showUsername = true,
            showTime = true
        } = options;

        if (clearContainer) container.innerHTML = '';

        messages.forEach(msg => {
            renderMessage(msg, container, {
                isMine: msg.isMine,
                showUsername,
                showTime
            });
        });

        if (scrollToBottom) container.scrollTop = container.scrollHeight;
    }

    // Atualiza checks de visualização das mensagens (apenas para DMs)
    function updateReadStatus(container, lastReadMessageId) {
        const messages = container.querySelectorAll('.mensagem.usuario[data-msg-id]');
        messages.forEach(msgEl => {
            const msgId = parseInt(msgEl.dataset.msgId);
            if (msgId <= lastReadMessageId) {
                const checkEl = msgEl.querySelector('.msg-check');
                if (checkEl) {
                    checkEl.textContent = '✓✓';
                    checkEl.classList.add('read');
                }
            }
        });
    }

    // Cria loading indicator
    function createLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'text-center my-2';
        
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm';
        
        const text = document.createElement('span');
        text.textContent = ' Carregando...';
        
        loadingDiv.appendChild(spinner);
        loadingDiv.appendChild(text);
        
        return loadingDiv;
    }

    // Cria mensagem de erro
    function createErrorMessage(errorText = 'Erro ao carregar mensagens') {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center text-danger my-3';
        errorDiv.textContent = errorText;
        return errorDiv;
    }

    // Cria mensagem de chat vazio
    function createEmptyMessage(text = 'Nenhuma mensagem ainda') {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'text-center text-muted my-5';
        
        const icon = document.createElement('i');
        icon.className = 'bi bi-chat-dots';
        icon.style.fontSize = '3rem';
        
        const textEl = document.createElement('p');
        textEl.className = 'mt-3';
        textEl.textContent = text;
        
        emptyDiv.appendChild(icon);
        emptyDiv.appendChild(textEl);
        
        return emptyDiv;
    }

    // Configura scroll infinito para carregar mensagens antigas
    function setupInfiniteScroll(container, onLoadMore) {
        let isLoading = false;
        let canLoadMore = true;

        container.addEventListener('scroll', async () => {
            if (container.scrollTop === 0 && canLoadMore && !isLoading) {
                isLoading = true;
                const hasMore = await onLoadMore();
                isLoading = false;
                
                if (!hasMore) {
                    canLoadMore = false;
                }
            }
        });

        return {
            reset: () => {
                canLoadMore = true;
                isLoading = false;
            },
            disable: () => {
                canLoadMore = false;
            }
        };
    }

    // Configura textarea com auto-resize e envio com Enter
    function setupMessageInput(textarea, sendButton, onSend) {
        // Auto-ajusta altura do textarea
        textarea.addEventListener('input', () => {
            textarea.style.height = '40px';
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = Math.min(scrollHeight, 170) + 'px';
        });

        // Enter para enviar, Shift+Enter para quebra de linha
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Função de envio
        function sendMessage() {
            const mensagem = textarea.value.trim();
            if (!mensagem) return;

            onSend(mensagem);
            textarea.value = '';
            textarea.style.height = '40px';
        }

        // Evento do botão
        sendButton.addEventListener('click', sendMessage);

        return { sendMessage };
    }

    // Carrega mensagens de uma API
    async function loadMessages(endpoint, options = {}) {
        const {
            page = 1,
            credentials = 'include'
        } = options;

        try {
            const url = endpoint.includes('?') 
                ? `${endpoint}&page=${page}` 
                : `${endpoint}?page=${page}`;
                
            const res = await fetch(url, { credentials });
            
            if (!res.ok) {
                throw new Error('Falha ao carregar mensagens');
            }
            
            const data = await res.json();
            return {
                success: true,
                messages: data.messages || [],
                hasMore: data.messages && data.messages.length >= 50
            };
        } catch (err) {
            console.error('[ChatUtils] Erro ao carregar mensagens:', err);
            return {
                success: false,
                error: err.message,
                messages: [],
                hasMore: false
            };
        }
    }

    // API pública
    return {
        formatTime,
        renderMessage,
        renderMessages,
        updateReadStatus,
        createLoadingIndicator,
        createErrorMessage,
        createEmptyMessage,
        setupInfiniteScroll,
        setupMessageInput,
        loadMessages
    };
})();

// Exporta para uso global
if (typeof window !== 'undefined') {
    window.ChatUtils = ChatUtils;
}
