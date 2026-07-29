-- Tambah tabel yang belum ada di proyek_coursenet (tanpa DROP data lama).
-- Kolom FK memakai bigint(20) agar cocok dengan users/jobs/services yang sudah ada.
-- Jalankan SELURUH file di phpMyAdmin → database proyek_coursenet → tab SQL → Go.

USE proyek_coursenet;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  job_id BIGINT NOT NULL,
  seller_id BIGINT NOT NULL,
  cover_letter TEXT NOT NULL,
  proposed_price INT NOT NULL,
  estimated_days INT,
  portfolio_file_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_job_seller (job_id, seller_id),
  INDEX idx_applications_job (job_id),
  INDEX idx_applications_seller (seller_id),
  INDEX idx_applications_status (status),
  CONSTRAINT fk_applications_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_applications_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL,
  buyer_id BIGINT NOT NULL,
  seller_id BIGINT NOT NULL,
  service_id BIGINT,
  job_id BIGINT,
  application_id BIGINT,
  title VARCHAR(200) NOT NULL,
  amount INT NOT NULL,
  platform_fee INT NOT NULL DEFAULT 0,
  seller_net_amount INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  escrow VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
  buyer_note TEXT,
  completed_at DATETIME,
  cancelled_at DATETIME,
  cancel_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_number (order_number),
  UNIQUE KEY uq_orders_application (application_id),
  INDEX idx_orders_buyer (buyer_id),
  INDEX idx_orders_seller (seller_id),
  INDEX idx_orders_status (status),
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pg_merchants (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  api_key VARCHAR(64) NOT NULL,
  webhook_url VARCHAR(500) NOT NULL,
  webhook_secret VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pg_merchants_code (code),
  UNIQUE KEY uq_pg_merchants_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pg_transactions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(32) NOT NULL,
  merchant_id BIGINT NOT NULL,
  external_ref VARCHAR(100) NOT NULL,
  amount INT NOT NULL,
  payment_method VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  customer_name VARCHAR(120),
  customer_email VARCHAR(255),
  description VARCHAR(255),
  paid_at DATETIME,
  expired_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pg_tx_code (transaction_code),
  UNIQUE KEY uq_pg_merchant_external (merchant_id, external_ref),
  INDEX idx_pg_tx_status (status),
  INDEX idx_pg_tx_merchant (merchant_id),
  CONSTRAINT fk_pg_tx_merchant FOREIGN KEY (merchant_id) REFERENCES pg_merchants(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pg_transaction_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transaction_id BIGINT NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  note VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pg_logs_tx (transaction_id),
  CONSTRAINT fk_pg_logs_tx FOREIGN KEY (transaction_id) REFERENCES pg_transactions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  buyer_id BIGINT NOT NULL,
  amount INT NOT NULL,
  platform_fee INT NOT NULL DEFAULT 0,
  gateway VARCHAR(50) NOT NULL DEFAULT 'INTERNAL_PG',
  gateway_transaction_code VARCHAR(32),
  gateway_id VARCHAR(100),
  payment_method VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  paid_at DATETIME,
  expired_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_buyer (buyer_id),
  INDEX idx_payments_status (status),
  INDEX idx_payments_gw_code (gateway_transaction_code),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_gw_code FOREIGN KEY (gateway_transaction_code) REFERENCES pg_transactions(transaction_code) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_submissions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  seller_id BIGINT NOT NULL,
  revision_number INT NOT NULL DEFAULT 1,
  note TEXT,
  review_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  INDEX idx_submissions_order (order_id),
  INDEX idx_submissions_status (status),
  CONSTRAINT fk_submissions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_submissions_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_submission_files (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_submission_files FOREIGN KEY (submission_id) REFERENCES work_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  seller_id BIGINT NOT NULL,
  amount INT NOT NULL,
  gateway VARCHAR(50) NOT NULL DEFAULT 'MOCK_TRANSFER',
  gateway_id VARCHAR(100),
  bank_account_masked VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  paid_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payouts_order (order_id),
  CONSTRAINT fk_payouts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payouts_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  reviewer_id BIGINT NOT NULL,
  reviewee_id BIGINT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NOT NULL,
  seller_reply TEXT,
  seller_reply_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_reviewer (order_id, reviewer_id),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  actor_id BIGINT,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link_url VARCHAR(500),
  reference_type VARCHAR(30),
  reference_id BIGINT,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_user_unread (user_id, is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room VARCHAR(100) NOT NULL,
  sender_id BIGINT,
  pesan TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_room (room),
  CONSTRAINT fk_chat_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO pg_merchants (code, name, api_key, webhook_url, webhook_secret) VALUES (
  'COURSENET',
  'Mockup Proyek CourseNet',
  'pg-key-coursenet-mock-2026',
  'http://localhost:3000/api/webhooks/payment-gateway',
  'pg-wh-secret-coursenet-mock'
);

SELECT 'Migrasi tabel selesai.' AS info;
