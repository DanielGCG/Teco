CREATE DATABASE IF NOT EXISTS site_do_boteco;
USE site_do_boteco;

CREATE TABLE wl_filme (
    id BIGINT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    overview TEXT,
    popularity FLOAT,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('movie','tv')),
    original_language VARCHAR(5) NOT NULL,
    poster_path VARCHAR(128),
    backdrop_path VARCHAR(128),
    release_date DATE,
    vote_average FLOAT,
    vote_count INT,
    INDEX (title),
    INDEX (release_date),
    INDEX (popularity)
);

-- Tabela de gêneros (fixa, com os IDs do TMDb)
CREATE TABLE wl_genero (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Tabela de relação N:N entre filmes e gêneros
CREATE TABLE wl_filme_genero (
    filme_id BIGINT,
    genero_id INT,
    PRIMARY KEY (filme_id, genero_id),
    FOREIGN KEY (filme_id) REFERENCES wl_filme(id) ON DELETE CASCADE,
    FOREIGN KEY (genero_id) REFERENCES wl_genero(id) ON DELETE CASCADE
);




-- Tabela de imagens do dia --




-- Cria a tabela
CREATE TABLE br_imagemdodia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(256) NOT NULL,
    border_url VARCHAR(256) NOT NULL,
    texto VARCHAR(32) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_at TIMESTAMP NULL
);

-- Trigger: ao inserir uma imagem
-- Se não existe nenhuma ativa, ativa esta imediatamente
-- Caso contrário, ela fica na fila (start_at = NULL)
DELIMITER $$
CREATE TRIGGER trg_imagemdodia_insert
BEFORE INSERT ON br_imagemdodia
FOR EACH ROW
BEGIN
    DECLARE qtd_ativas INT;

    SELECT COUNT(*) INTO qtd_ativas
    FROM br_imagemdodia
    WHERE start_at IS NOT NULL
    ORDER BY start_at DESC
    LIMIT 1;

    IF qtd_ativas = 0 THEN
        SET NEW.start_at = NOW();
    ELSE
        SET NEW.start_at = NULL;
    END IF;
END$$
DELIMITER ;

-- Ativa o scheduler (precisa estar ON globalmente)
SET GLOBAL event_scheduler = ON;

-- Evento: roda todo dia às 06:00
-- Se existir uma imagem na fila, ativa a próxima
DELIMITER $$
CREATE EVENT evt_troca_imagemdodia
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 6 HOUR)
DO
BEGIN
    DECLARE prox_id INT;

    -- Pega a próxima da fila
    SELECT id INTO prox_id
    FROM br_imagemdodia
    WHERE start_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Se existe próxima, ativa
    IF prox_id IS NOT NULL THEN
        UPDATE br_imagemdodia
        SET start_at = NOW()
        WHERE id = prox_id;
    END IF;
END$$
DELIMITER ;


CREATE TABLE br_imagemdodia_borders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(256) NOT NULL,
    nome VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);