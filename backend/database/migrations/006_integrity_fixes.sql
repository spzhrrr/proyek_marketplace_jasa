-- =============================================================================
-- 006_integrity_fixes.sql
-- Sinkronkan constraint keuangan, ban, dispute, dan laporan dengan logika app.
-- Jalankan via: node backend/scripts/applyIntegrityMigration.js
-- atau di phpMyAdmin (abaikan error "Duplicate column/key" jika sudah ada).
-- =============================================================================

-- users: ban flag
ALTER TABLE users
  ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

ALTER TABLE users
  ADD INDEX idx_users_banned (is_banned);

-- bersihkan payment PENDING duplikat sebelum unique
UPDATE payments p
JOIN (
  SELECT order_id, MAX(id) AS keep_id
  FROM payments
  WHERE status = 'PENDING'
  GROUP BY order_id
  HAVING COUNT(*) > 1
) d ON p.order_id = d.order_id AND p.status = 'PENDING' AND p.id <> d.keep_id
SET p.status = 'EXPIRED', p.updated_at = NOW();

-- payments: satu PAID / satu PENDING aktif per order
ALTER TABLE payments
  ADD COLUMN paid_unique_key BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status = 'PAID' THEN order_id ELSE NULL END) STORED;

ALTER TABLE payments
  ADD UNIQUE KEY uq_payments_order_paid (paid_unique_key);

ALTER TABLE payments
  ADD COLUMN pending_unique_key BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN order_id ELSE NULL END) STORED;

ALTER TABLE payments
  ADD UNIQUE KEY uq_payments_order_pending (pending_unique_key);

-- payouts: unique order
ALTER TABLE payouts
  ADD UNIQUE KEY uq_payouts_order (order_id);

-- user_reports
CREATE TABLE IF NOT EXISTS user_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reported_user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  action_taken VARCHAR(20) NOT NULL DEFAULT 'NONE',
  admin_note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reports_status (status),
  INDEX idx_reports_reported (reported_user_id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reports_reported FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- wallet ledger
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  entry_type VARCHAR(40) NOT NULL,
  amount INT NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  withdrawal_id BIGINT UNSIGNED NULL,
  balance_after INT UNSIGNED NOT NULL DEFAULT 0,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ledger_idempotency (idempotency_key),
  INDEX idx_ledger_user (user_id),
  INDEX idx_ledger_order (order_id),
  CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
