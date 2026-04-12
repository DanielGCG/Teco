// Substituir todos os alert() e confirm() nativos por modais personalizados retrô
// Este script deve ser carregado após os modais utilitários

// Salva as funções originais se ainda não foram salvas
if (!window.alertOriginal) window.alertOriginal = window.alert;
if (!window.confirmOriginal) window.confirmOriginal = window.confirm;

// Sobrescreve alert global integrando erro inteligente
window.alert = function(mensagem, isErrorParam = false) {
    let isError = isErrorParam === true;
    
    if (mensagem instanceof Error) {
        mensagem = mensagem.message;
        isError = true;
    } else if (mensagem !== null && typeof mensagem === 'object') {
        // Auto detecta se é objeto de erro do axios/fetch
        mensagem = mensagem.message || JSON.stringify(mensagem);
        isError = true;
    }

    if (!isError && typeof mensagem === 'string' && mensagem.toLowerCase().includes('erro')) {
        isError = true;
    }

    if (typeof mostrarAviso === 'function') {
        const titulo = isError ? 'Erro' : 'Aviso';
        return mostrarAviso(String(mensagem), titulo);
    } else {
        return window.alertOriginal(String(mensagem));
    }
};

// Sobrescreve a função confirm global para só confirmar no SIM
window.confirm = function(mensagem) {
    if (typeof confirmRetro === 'function') {
        return confirmRetro(mensagem);
    } else if (typeof mostrarConfirmacao === 'function') {
        return mostrarConfirmacao(mensagem);
    } else {
        return window.confirmOriginal(mensagem);
    }
};
