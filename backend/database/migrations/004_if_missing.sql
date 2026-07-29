-- Jalankan HANYA jika DB lama belum punya fitur bank / portfolio / gateway.
-- Cara paling aman: jalankan ulang backend/database/schema.sql (reset DB).
-- Atau jalankan backend/database/migrations/003_bank_verification.sql jika hanya bank yang kurang.

USE proyek_coursenet;

-- 1) Bank (skip jika kolom sudah ada)
-- ALTER TABLE users
--   ADD COLUMN bank_name VARCHAR(80) NULL AFTER province,
--   ADD COLUMN bank_account_number VARCHAR(40) NULL AFTER bank_name,
--   ADD COLUMN bank_account_holder VARCHAR(120) NULL AFTER bank_account_number,
--   ADD COLUMN bank_verified_at DATETIME NULL AFTER bank_account_holder;

-- 2) Portfolio
CREATE TABLE IF NOT EXISTS user_portfolios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  file_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_portfolio_user (user_id),
  CONSTRAINT fk_portfolio_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Merchant seed (skip jika pg_merchants sudah ada dari schema.sql)
INSERT IGNORE INTO pg_merchants (code, name, api_key, webhook_url, webhook_secret) VALUES (
  'COURSENET',
  'Mockup Proyek CourseNet',
  'pg-key-coursenet-mock-2026',
  'http://localhost:3000/api/webhooks/payment-gateway',
  'pg-wh-secret-coursenet-mock'
);

SELECT 'Patch portfolio + merchant seed selesai.' AS info;
