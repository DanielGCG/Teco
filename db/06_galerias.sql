USE botecochat;

CREATE TABLE br_galeria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    capa_url VARCHAR(255),
    user_id INT UNSIGNED NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    background_url VARCHAR(255),
    background_fill VARCHAR(10) DEFAULT 'cover',
    background_color VARCHAR(7) DEFAULT '#e2e1cf',
    font_color VARCHAR(7) DEFAULT '#3E3F29',
    card_color VARCHAR(7) DEFAULT '#ffffff',
    grid_columns INT DEFAULT 8,
    font_family VARCHAR(50) DEFAULT 'Inter',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE br_galeria_imagem (
    id INT AUTO_INCREMENT PRIMARY KEY,
    galeria_id INT NOT NULL,
    url VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) DEFAULT NULL,
    nome VARCHAR(100),
    grid_w INT DEFAULT 1,
    grid_h INT DEFAULT 1,
    col_start INT DEFAULT NULL,
    row_start INT DEFAULT NULL,
    user_id INT UNSIGNED NOT NULL,
    pos INT DEFAULT 0,
    show_title BOOLEAN DEFAULT TRUE,
    img_fit VARCHAR(10) DEFAULT 'cover',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (galeria_id) REFERENCES br_galeria(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE br_galeria_permissao (
    galeria_id INT NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (galeria_id, user_id),
    FOREIGN KEY (galeria_id) REFERENCES br_galeria(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);