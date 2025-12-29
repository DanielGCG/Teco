USE botecochat;

-- Tabela principal de Galerias
CREATE TABLE galleries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,          -- antes: nome
    description TEXT,                    -- antes: descricao
    cover_url VARCHAR(255),              -- antes: capa_url
    user_id INT UNSIGNED NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    background_url VARCHAR(255),
    background_fill VARCHAR(10) DEFAULT 'cover',
    background_color VARCHAR(7) DEFAULT '#e2e1cf',
    font_color VARCHAR(7) DEFAULT '#3E3F29',
    card_color VARCHAR(7) DEFAULT '#ffffff',
    grid_columns INT DEFAULT 12,
    font_family VARCHAR(50) DEFAULT 'Inter',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Itens da Galeria (Imagens/Vídeos/Áudio)
CREATE TABLE gallery_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gallery_id INT NOT NULL,             -- antes: galeria_id
    cover_url VARCHAR(255) DEFAULT NULL,
    content_url VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) DEFAULT NULL,
    name VARCHAR(100),                   -- antes: nome
    grid_w INT DEFAULT 1,
    grid_h INT DEFAULT 1,
    col_start INT DEFAULT NULL,
    row_start INT DEFAULT NULL,
    user_id INT UNSIGNED NOT NULL,
    z_index INT DEFAULT 0,
    show_title BOOLEAN DEFAULT TRUE,
    object_fit VARCHAR(10) DEFAULT 'cover', -- antes: img_fit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Permissões (Colaboradores)
CREATE TABLE gallery_permissions (
    gallery_id INT NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (gallery_id, user_id),
    FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);