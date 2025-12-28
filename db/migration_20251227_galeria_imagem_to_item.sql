-- Migration: Rename/transform br_galeria_imagem -> br_galeria_item
-- Date: 2025-12-27
-- This script creates the new table `br_galeria_item`, backs up the old
-- `br_galeria_imagem` into `br_galeria_imagem_backup` and copies data
-- mapping `url` -> `content_url`, `pos` -> `z_index`.
-- Run on a safe maintenance window. Test on a staging DB first.

START TRANSACTION;

-- 1) Create new table if it does not exist
CREATE TABLE IF NOT EXISTS br_galeria_item (
    id INT AUTO_INCREMENT PRIMARY KEY,
    galeria_id INT NOT NULL,
    cover_url VARCHAR(255) DEFAULT NULL,
    content_url VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) DEFAULT NULL,
    nome VARCHAR(100),
    grid_w INT DEFAULT 1,
    grid_h INT DEFAULT 1,
    col_start INT DEFAULT NULL,
    row_start INT DEFAULT NULL,
    user_id INT UNSIGNED NOT NULL,
    z_index INT DEFAULT 0,
    show_title BOOLEAN DEFAULT TRUE,
    img_fit VARCHAR(10) DEFAULT 'cover',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_galeria_item_galeria FOREIGN KEY (galeria_id) REFERENCES br_galeria(id) ON DELETE CASCADE,
    CONSTRAINT fk_galeria_item_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Backup original table (structure + data)
CREATE TABLE IF NOT EXISTS br_galeria_imagem_backup LIKE br_galeria_imagem;
INSERT INTO br_galeria_imagem_backup SELECT * FROM br_galeria_imagem;

-- 3) Copy data from old table into new table
--    Mapping rules:
--      - url -> content_url
--      - cover_url (new) will be NULL for migrated rows (you can populate later)
--      - pos -> z_index
INSERT INTO br_galeria_item (
    galeria_id, cover_url, content_url, mimetype, nome,
    grid_w, grid_h, col_start, row_start, user_id,
    z_index, show_title, img_fit, created_at
)
SELECT
    galeria_id,
    NULL AS cover_url,
    url AS content_url,
    mimetype,
    nome,
    grid_w,
    grid_h,
    col_start,
    row_start,
    user_id,
    pos AS z_index,
    show_title,
    img_fit,
    created_at
FROM br_galeria_imagem;

COMMIT;

-- NOTES:
-- - After verifying the data in `br_galeria_item`, you may choose to
--   DROP the original `br_galeria_imagem` table or keep it as an archive.
-- - If you want to remove the old table after verification, run:
--     DROP TABLE br_galeria_imagem;
--   or to keep a short alias, you can rename it:
--     RENAME TABLE br_galeria_imagem TO br_galeria_imagem_old;
-- - If your production environment enforces strict foreign-key naming,
--   ensure there are no other DB-level constraints pointing to
--   `br_galeria_imagem` before dropping/renaming.

-- End of migration
