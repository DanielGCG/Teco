// Substituir todos os alert() nativos por mostrarAviso()
// Este script deve ser carregado após o Bootstrap

// Salva a função alert original
window.alertOriginal = window.alert;

// Sobrescreve a função alert global
window.alert = function(mensagem) {
    if (typeof mostrarAviso === 'function') {
        mostrarAviso(mensagem);
    } else {
        // Fallback para alert nativo caso o modal não esteja disponível
        window.alertOriginal(mensagem);
    }
};
