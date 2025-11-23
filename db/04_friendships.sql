-- ==========================
-- TABELA DE AMIZADES
-- ==========================

USE botecochat;

CREATE TABLE IF NOT EXISTS friendships (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    requester_id INT UNSIGNED NOT NULL COMMENT 'Quem enviou o pedido',
    addressee_id INT UNSIGNED NOT NULL COMMENT 'Quem recebeu o pedido',
    status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Um usuário não pode enviar múltiplos pedidos para o mesmo usuário
    UNIQUE KEY unique_friendship (requester_id, addressee_id),
    
    -- Índices para buscas eficientes
    INDEX idx_requester (requester_id, status),
    INDEX idx_addressee (addressee_id, status)
);

-- Trigger para prevenir usuário de enviar pedido para si mesmo
DELIMITER //
CREATE TRIGGER prevent_self_friendship
BEFORE INSERT ON friendships
FOR EACH ROW
BEGIN
    IF NEW.requester_id = NEW.addressee_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Usuário não pode adicionar a si mesmo como amigo';
    END IF;
END;
//
DELIMITER ;
