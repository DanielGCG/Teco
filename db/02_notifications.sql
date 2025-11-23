-- ==========================
-- TABELA DE NOTIFICAÇÕES PERSISTENTES
-- ==========================

USE botecochat;

CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL COMMENT 'Destinatário da notificação',
    type ENUM('FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_DM', 'NEW_CARTINHA', 'MENTION', 'SYSTEM') NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    link VARCHAR(512) NULL COMMENT 'Link de destino ao clicar',
    data JSON NULL COMMENT 'Dados adicionais da notificação',
    read_at TIMESTAMP NULL COMMENT 'Quando foi marcada como lida',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL COMMENT 'Quando a notificação expira (opcional)',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Índices para performance
    INDEX idx_user_unread (user_id, read_at),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
);

-- Habilita o event scheduler
SET GLOBAL event_scheduler = ON;

-- Trigger para limpeza automática de notificações antigas (opcional)
-- Remove notificações lidas com mais de 30 dias
DROP EVENT IF EXISTS cleanup_old_notifications;
CREATE EVENT cleanup_old_notifications
ON SCHEDULE EVERY 1 DAY
DO
  DELETE FROM notifications 
  WHERE read_at IS NOT NULL 
  AND read_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- Remove notificações não lidas com mais de 90 dias
DROP EVENT IF EXISTS cleanup_expired_notifications;
CREATE EVENT cleanup_expired_notifications  
ON SCHEDULE EVERY 1 DAY
DO
  DELETE FROM notifications 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);