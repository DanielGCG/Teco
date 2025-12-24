// Substituir todos os alert() e confirm() nativos por modais personalizados
// Este script deve ser carregado após o Bootstrap

// Salva as funções originais
window.alertOriginal = window.alert;
window.confirmOriginal = window.confirm;

// Sobrescreve a função alert global
window.alert = function(mensagem) {
    if (typeof mostrarAviso === 'function') {
        mostrarAviso(mensagem);
    } else {
        // Fallback para alert nativo caso o modal não esteja disponível
        window.alertOriginal(mensagem);
    }
};

// Sobrescreve a função confirm global
window.confirm = function(mensagem) {
    if (typeof mostrarConfirmacao === 'function') {
        // Retorna uma Promise, então código existente precisa usar await
        return mostrarConfirmacao(mensagem);
    } else {
        // Fallback para confirm nativo caso o modal não esteja disponível
        return window.confirmOriginal(mensagem);
    }
};
