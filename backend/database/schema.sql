-- =============================================================================
-- MOCKUP PROYEK COURSENET — SCHEMA LENGKAP (normalisasi + payment gateway)
-- =============================================================================
-- Jalankan SELURUH file ini di phpMyAdmin (tab SQL → Go).
-- Database: proyek_coursenet
--
-- Arsitektur payment (sesuai diagram dosen):
--   Web App (marketplace) <--API--> Payment Gateway (pg_* tables)
--   Flow: Insert Transaksi → Bayar (kode) → Cek Transaksi → Webhook PAID
--
-- Admin seed: admin@mail.com / admin123
-- =============================================================================
-- PENTING phpMyAdmin:
--   Jangan copy SATU baris DROP saja — jalankan SELURUH file dari atas ke bawah!
--   Atau minimal blok RESET di bawah (baris SET FOREIGN_KEY_CHECKS sampai SET 1).
-- =============================================================================

CREATE DATABASE IF NOT EXISTS proyek_coursenet
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE proyek_coursenet;

SET NAMES utf8mb4;

-- ---------- RESET (wajib utuh, jangan potong) ----------
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS pg_transaction_logs;
DROP TABLE IF EXISTS pg_transactions;
DROP TABLE IF EXISTS pg_merchants;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS payouts;
DROP TABLE IF EXISTS work_submission_files;
DROP TABLE IF EXISTS work_submissions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_sows;
DROP TABLE IF EXISTS order_status_logs;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS lamaran_kerja;
DROP TABLE IF EXISTS sewa_jasa;
DROP TABLE IF EXISTS jasa_tersedia;
DROP TABLE IF EXISTS lowongan_tersedia;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;
-- ---------- END RESET ----------

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  last_name VARCHAR(60) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  bio TEXT,
  city VARCHAR(80),
  province VARCHAR(80),
  bank_name VARCHAR(80),
  bank_account_number VARCHAR(40),
  bank_account_holder VARCHAR(120),
  bank_verified_at DATETIME,
  profilepic_url VARCHAR(500),
  ktp_photo_url VARCHAR(500),
  ktp_selfie_url VARCHAR(500),
  ktp_number VARCHAR(20),
  ktp_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SUBMITTED',
  ktp_submitted_at DATETIME,
  ktp_verified_at DATETIME,
  ktp_rejected_reason TEXT,
  email_verified_at DATETIME,
  phone_verified_at DATETIME,
  email_otp_hash VARCHAR(255),
  email_otp_expires_at DATETIME,
  phone_otp_hash VARCHAR(255),
  phone_otp_expires_at DATETIME,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_ktp_status (ktp_status),
  CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN')),
  CONSTRAINT chk_users_ktp_status CHECK (ktp_status IN ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- CATEGORIES (2 level: parent → sub)
-- =============================================================================
CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  url_code VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'DIGITAL',
  description VARCHAR(255),
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_url_code (url_code),
  INDEX idx_categories_type (type),
  INDEX idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_categories_type CHECK (type IN ('DIGITAL', 'PHYSICAL'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SERVICES
-- =============================================================================
CREATE TABLE services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  price INT UNSIGNED NOT NULL,
  delivery_days INT UNSIGNED NOT NULL DEFAULT 3,
  revisions_included INT UNSIGNED NOT NULL DEFAULT 1,
  work_location VARCHAR(20) NOT NULL DEFAULT 'REMOTE',
  location_note VARCHAR(255),
  cover_image_url VARCHAR(500),
  portfolio_file_url VARCHAR(500),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_services_seller (seller_id),
  INDEX idx_services_category (category_id),
  INDEX idx_services_active (is_active),
  CONSTRAINT fk_services_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_services_price CHECK (price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- JOBS
-- =============================================================================
CREATE TABLE jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  buyer_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  budget INT UNSIGNED NOT NULL,
  deadline DATE,
  work_location VARCHAR(20) NOT NULL DEFAULT 'REMOTE',
  location_city VARCHAR(80),
  location_address VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  portfolio_file_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_jobs_buyer (buyer_id),
  INDEX idx_jobs_status (status),
  INDEX idx_jobs_category (category_id),
  CONSTRAINT fk_jobs_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_jobs_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_jobs_status CHECK (status IN ('OPEN', 'FILLED', 'CLOSED', 'CANCELLED')),
  CONSTRAINT chk_jobs_budget CHECK (budget > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- APPLICATIONS
-- =============================================================================
CREATE TABLE applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  cover_letter TEXT NOT NULL,
  proposed_price INT UNSIGNED NOT NULL,
  estimated_days INT UNSIGNED,
  portfolio_file_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_job_seller (job_id, seller_id),
  INDEX idx_applications_job (job_id),
  INDEX idx_applications_seller (seller_id),
  INDEX idx_applications_status (status),
  CONSTRAINT fk_applications_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_applications_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_applications_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  CONSTRAINT chk_applications_price CHECK (proposed_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- ORDERS
-- =============================================================================
CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED,
  job_id BIGINT UNSIGNED,
  application_id BIGINT UNSIGNED,
  title VARCHAR(200) NOT NULL,
  amount INT UNSIGNED NOT NULL,
  platform_fee INT UNSIGNED NOT NULL DEFAULT 0,
  seller_net_amount INT UNSIGNED NOT NULL DEFAULT 0,
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
  CONSTRAINT fk_orders_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
  CONSTRAINT chk_orders_source CHECK (source IN ('SERVICE', 'JOB')),
  CONSTRAINT chk_orders_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT chk_orders_escrow CHECK (escrow IN ('UNPAID', 'HELD', 'RELEASED', 'REFUNDED')),
  CONSTRAINT chk_orders_amount CHECK (amount > 0),
  CONSTRAINT chk_orders_service_xor_job CHECK (
    (source = 'SERVICE' AND service_id IS NOT NULL) OR
    (source = 'JOB' AND job_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PAYMENT GATEWAY (mock terpisah — sesuai diagram dosen)
-- =============================================================================
CREATE TABLE pg_merchants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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

CREATE TABLE pg_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(32) NOT NULL,
  merchant_id BIGINT UNSIGNED NOT NULL,
  external_ref VARCHAR(100) NOT NULL,
  amount INT UNSIGNED NOT NULL,
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
  CONSTRAINT fk_pg_tx_merchant FOREIGN KEY (merchant_id) REFERENCES pg_merchants(id) ON DELETE RESTRICT,
  CONSTRAINT chk_pg_tx_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
  CONSTRAINT chk_pg_tx_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pg_transaction_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id BIGINT UNSIGNED NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  note VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pg_logs_tx (transaction_id),
  CONSTRAINT fk_pg_logs_tx FOREIGN KEY (transaction_id) REFERENCES pg_transactions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PAYMENTS (marketplace — link ke pg_transactions)
-- =============================================================================
CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  buyer_id BIGINT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  platform_fee INT UNSIGNED NOT NULL DEFAULT 0,
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
  CONSTRAINT fk_payments_gw_code FOREIGN KEY (gateway_transaction_code) REFERENCES pg_transactions(transaction_code) ON DELETE SET NULL,
  CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- WORK SUBMISSIONS
-- =============================================================================
CREATE TABLE work_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  revision_number INT UNSIGNED NOT NULL DEFAULT 1,
  note TEXT,
  review_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  INDEX idx_submissions_order (order_id),
  INDEX idx_submissions_status (status),
  CONSTRAINT fk_submissions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_submissions_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_submissions_status CHECK (status IN ('SUBMITTED', 'APPROVED', 'REVISION_REQUESTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_submission_files (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submission_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_submission_files FOREIGN KEY (submission_id) REFERENCES work_submissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- PAYOUTS & REVIEWS
-- =============================================================================
CREATE TABLE payouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  amount INT UNSIGNED NOT NULL,
  gateway VARCHAR(50) NOT NULL DEFAULT 'MOCK_TRANSFER',
  gateway_id VARCHAR(100),
  bank_account_masked VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  paid_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payouts_order (order_id),
  CONSTRAINT fk_payouts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payouts_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_payouts_status CHECK (status IN ('PENDING', 'PAID', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  reviewee_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  seller_reply TEXT,
  seller_reply_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_reviewer (order_id, reviewer_id),
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- USER PORTFOLIO (manual portfolio items on profile)
-- =============================================================================
CREATE TABLE user_portfolios (
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

-- =============================================================================
-- NOTIFICATIONS & CHAT
-- =============================================================================
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  link_url VARCHAR(500),
  reference_type VARCHAR(30),
  reference_id BIGINT UNSIGNED,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_user_unread (user_id, is_read),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room VARCHAR(100) NOT NULL,
  sender_id BIGINT UNSIGNED,
  pesan TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_room (room),
  CONSTRAINT fk_chat_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SEED
-- =============================================================================
INSERT INTO users (
  email, password_hash, first_name, last_name, phone, role,
  city, province, ktp_number, ktp_status, ktp_verified_at,
  email_verified_at, phone_verified_at
) VALUES (
  'admin@mail.com',
  '$2a$10$CRp1YG6MNG.MZCuEKxz8HuoX3khu9EJbj1qzuaieTNOjul7LIMRTe',
  'Admin', 'Sistem', '081234567803', 'ADMIN',
  'Jakarta', 'DKI Jakarta', '3174030303900003', 'APPROVED', NOW(),
  NOW(), NOW()
);

INSERT INTO categories (id, parent_id, name, url_code, type, description, sort_order) VALUES
(1, NULL, 'Jasa Digital', 'digital', 'DIGITAL', 'Pekerjaan online', 1),
(2, NULL, 'Jasa Fisik', 'fisik', 'PHYSICAL', 'Pekerjaan di lokasi', 2),
(3, 1, 'Desain Grafis', 'desain-grafis', 'DIGITAL', 'Logo, banner', 1),
(4, 1, 'Penulisan & Konten', 'penulisan-konten', 'DIGITAL', 'Artikel, copywriting', 2),
(5, 1, 'Pemrograman Web', 'pemrograman-web', 'DIGITAL', 'Website, bug fix', 3),
(6, 2, 'Kebersihan', 'kebersihan', 'PHYSICAL', 'Bersih rumah/kantor', 1),
(7, 2, 'Renovasi Rumah', 'renovasi-rumah', 'PHYSICAL', 'Cat, perbaikan', 2),
(8, 2, 'Kurir & Angkut', 'kurir-angkut', 'PHYSICAL', 'Antar barang', 3);

INSERT INTO pg_merchants (code, name, api_key, webhook_url, webhook_secret) VALUES (
  'COURSENET',
  'Mockup Proyek CourseNet',
  'pg-key-coursenet-mock-2026',
  'http://localhost:3000/api/webhooks/payment-gateway',
  'pg-wh-secret-coursenet-mock'
);

SELECT 'Schema + seed selesai.' AS info;
