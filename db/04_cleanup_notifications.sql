-- ==================== Limpeza Automática de Notificações ====================
-- Este script cria um evento que limpa notificações antigas periodicamente
-- Mantém apenas: notificações não lidas + últimas 5 lidas de cada usuário

-- Habilita o event scheduler se não estiver ativo
SET GLOBAL event_scheduler = ON;

-- Remove evento antigo se existir
DROP EVENT IF EXISTS cleanup_old_notifications;

-- Remove procedimento antigo se existir
DROP PROCEDURE IF EXISTS cleanup_notifications_for_user;
DROP PROCEDURE IF EXISTS manual_cleanup_notifications;

-- Cria procedimento otimizado para limpar notificações de um usuário específico
DELIMITER $$

CREATE PROCEDURE cleanup_notifications_for_user(IN target_user_id INT)
BEGIN
    DELETE FROM notifications
    WHERE user_id = target_user_id
    AND read_at IS NOT NULL
    AND id NOT IN (
        SELECT id FROM (
            SELECT id
            FROM notifications
            WHERE user_id = target_user_id
            AND read_at IS NOT NULL
            ORDER BY read_at DESC
            LIMIT 5
        ) AS keep_ids
    );
END$$

DELIMITER ;

-- Cria procedimento para limpeza manual de todos os usuários
DELIMITER $$

CREATE PROCEDURE manual_cleanup_notifications()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE user_id_var INT;
    DECLARE total_deleted INT DEFAULT 0;
    DECLARE user_cursor CURSOR FOR 
        SELECT DISTINCT user_id FROM notifications WHERE read_at IS NOT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN user_cursor;
    
    read_loop: LOOP
        FETCH user_cursor INTO user_id_var;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        CALL cleanup_notifications_for_user(user_id_var);
        SET total_deleted = total_deleted + ROW_COUNT();
    END LOOP;
    
    CLOSE user_cursor;
    
    SELECT CONCAT('Limpeza manual concluída: ', total_deleted, ' notificações removidas') AS resultado;
END$$

DELIMITER ;

-- Cria evento que roda diariamente às 3h da manhã
DELIMITER $$

CREATE EVENT cleanup_old_notifications
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY + INTERVAL 3 HOUR)
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Limpa notificações antigas mantendo não lidas + últimas 5 lidas'
DO
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE user_id_var INT;
    DECLARE user_cursor CURSOR FOR 
        SELECT DISTINCT user_id FROM notifications WHERE read_at IS NOT NULL;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN user_cursor;
    
    read_loop: LOOP
        FETCH user_cursor INTO user_id_var;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        CALL cleanup_notifications_for_user(user_id_var);
    END LOOP;
    
    CLOSE user_cursor;
END$$

DELIMITER ;

-- ==================== Instruções de Uso ====================

-- Para executar a limpeza IMEDIATAMENTE (manualmente):
-- CALL manual_cleanup_notifications();

-- Para limpar notificações de um usuário específico:
-- CALL cleanup_notifications_for_user(1);  -- substitua 1 pelo ID do usuário

-- Para verificar o status do evento:
-- SHOW EVENTS WHERE Name = 'cleanup_old_notifications';

-- Para verificar se o event scheduler está ativo:
-- SHOW VARIABLES LIKE 'event_scheduler';

-- Para desabilitar o evento:
-- ALTER EVENT cleanup_old_notifications DISABLE;

-- Para habilitar o evento:
-- ALTER EVENT cleanup_old_notifications ENABLE;

-- Para executar o evento imediatamente (sem esperar a programação):
-- SET GLOBAL event_scheduler = ON;
-- ALTER EVENT cleanup_old_notifications ON SCHEDULE EVERY 1 DAY STARTS NOW();

-- Para ver quantas notificações cada usuário tem:
-- SELECT user_id, 
--        COUNT(*) as total,
--        SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as nao_lidas,
--        SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) as lidas
-- FROM notifications
-- GROUP BY user_id;

