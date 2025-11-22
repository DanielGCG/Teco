// Script para gerenciar notificações do Electron
(function() {
    'use strict';

    // Verificar se estamos no ambiente Electron
    if (typeof window.electronAPI === 'undefined') {
        console.warn('electronAPI não disponível. Notificações desabilitadas.');
        return;
    }

    // Escutar notificações do servidor via Socket.io
    window.electronAPI.onNotification((data) => {
        console.log('Notificação recebida no frontend:', data);
        
        // Você pode processar a notificação aqui
        // Por exemplo, atualizar a UI, tocar um som, etc.
        
        // Opcional: piscar a janela para chamar atenção
        if (data.urgent) {
            window.electronAPI.flashWindow(true);
            setTimeout(() => {
                window.electronAPI.flashWindow(false);
            }, 2000);
        }
    });

    // Função auxiliar para enviar notificação manual
    window.sendNotification = async function(title, body, options = {}) {
        try {
            await window.electronAPI.showNotification({
                title: title,
                body: body,
                silent: options.silent || false,
                icon: options.icon
            });
        } catch (error) {
            console.error('Erro ao enviar notificação:', error);
        }
    };

    console.log('Sistema de notificações carregado.');
})();
