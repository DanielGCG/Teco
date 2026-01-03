-- ==========================
-- TABELA DE SEGUIDORES (FOLLOWS)
-- ==========================

USE botecochat;

-- Remover tabela antiga se necessário (opcional, mas como estamos migrando...)
-- DROP TABLE IF EXISTS friendships;

CREATE TABLE IF NOT EXISTS follows (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    follower_id INT UNSIGNED NOT NULL COMMENT 'Quem segue',
    following_id INT UNSIGNED NOT NULL COMMENT 'Quem é seguido',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Um usuário não pode seguir a mesma pessoa mais de uma vez
    UNIQUE KEY unique_follow (follower_id, following_id),
    
    -- Índices para buscas eficientes
    INDEX idx_follower (follower_id),
    INDEX idx_following (following_id)
);

-- Trigger para prevenir usuário de seguir a si mesmo
DELIMITER //
DROP TRIGGER IF EXISTS prevent_self_follow;
CREATE TRIGGER prevent_self_follow
BEFORE INSERT ON follows
FOR EACH ROW
BEGIN
    IF NEW.follower_id = NEW.following_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Usuário não pode seguir a si mesmo';
    END IF;
END;
//
DELIMITER ;
