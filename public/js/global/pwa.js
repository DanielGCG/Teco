// ==========================================
// PWA Push Notifications Setup
// ==========================================

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
};

const isStandalone = () => {
    return ('standalone' in window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
};

let swRegistration = null;

if ('serviceWorker' in navigator && 'PushManager' in window) {
    window.addEventListener('load', async () => {
        try {
            // Registrando o SW para Push API
            swRegistration = await navigator.serviceWorker.register('/sw.js');

            if (Notification.permission === 'granted') {
                subscribeUserToPush(swRegistration);
            } else {
                checkAndNagNotification();
            }
        } catch (error) {
            console.error('Erro ao preparar as notificações no seu aparelho.', error);
        }
    });
} else {
    window.addEventListener('load', () => {
        checkAndNagNotification();
    });
}

async function subscribeUserToPush(registration) {
    try {
        // Recupera a chave pública do backend
        const response = await fetch('/api/push/vapidPublicKey', { credentials: 'same-origin' });
        if (!response.ok) {
            console.error('Erro ao conectar com o sistema de notificações.');
            return;
        }

        const data = await response.json();
        const convertedVapidKey = urlBase64ToUint8Array(data.publicKey);

        let subscription;
        try {
            // Subscreve com PushManager
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        } catch (subError) {
            console.warn('Erro ao subscrever. Tentando remover subscrição antiga...', subError);
            // Se falhar (ex: VAPID key mudou), tenta remover a subscrição antiga
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
                console.log('Subscrição antiga removida. Tentando novamente...');
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });
            } else {
                throw subError;
            }
        }

        // Envia os detalhes da inscrição pro backend
        const resPush = await fetch('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin'
        });

        if (!resPush.ok) {
            console.error('Não foi possível salvar este aparelho para receber avisos.');
            document.getElementById('enablePushBtn')?.style.setProperty('display', 'inline');
        } else {
            console.log('Notificações ativadas com sucesso!');
            document.getElementById('enablePushBtn')?.style.setProperty('display', 'none');
        }
    } catch (error) {
        console.error('Falha ao ativar as notificações no seu navegador.', error);
        document.getElementById('enablePushBtn')?.style.setProperty('display', 'inline');
    }
}

window.requestPushNotification = async function () {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (isIos() && !isStandalone()) {
            mostrarModalAviso('Para receber notificações no iPhone, você precisa primeiro adicionar este site à sua Tela de Início. Toque no botão de compartilhar e depois em "Adicionar à Tela de Início".');
        } else {
            mostrarModalAviso('Seu navegador não suporta notificações Push.');
        }
        return;
    }

    if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        await subscribeUserToPush(swRegistration);
        mostrarModalAviso('Notificações ativadas com sucesso!');
    } else {
        mostrarModalAviso('Você negou a permissão. Para ativar, você precisa ir nas configurações do seu navegador ou aparelho e permitir notificações para este site.');
    }
};

function checkAndNagNotification() {
    document.getElementById('enablePushBtn')?.style.setProperty('display', 'inline');

    if (!('Notification' in window)) {
        if (isIos() && !isStandalone()) {
            setTimeout(() => {
                mostrarModalAviso('Ei! Você está no iPhone. Para receber notificações, adicione o Site do Boteco à sua Tela de Início (botão compartilhar -> Adicionar à Tela de Início).');
            }, 2000);
        }
        return;
    }

    if (Notification.permission !== 'granted') {
        setTimeout(() => {
            mostrarModalAviso('Ei! Você ainda não ativou as notificações. Ativa ai bbzinho. <br><br> <button onclick="requestPushNotification(); fecharModalAviso();" style="margin-top:10px; padding: 5px 10px; cursor: pointer;">Ativar Notificações Agora</button>');
        }, 2000);
    }
}
