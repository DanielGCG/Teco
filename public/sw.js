// Listener para receber a notificação via Web Push
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: data.icon || '/images/icon.ico',
            badge: '/images/icon.ico',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Quando o usuário clicar na notificação, ele deve ser redirecionado e a notificação fecha
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    // Abre a aba ou foca caso já exista
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url.includes(event.notification.data.url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});