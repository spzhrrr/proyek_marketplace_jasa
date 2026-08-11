-- Patch live DB: izinkan status payment REFUNDED (surplus / late payment)
USE proyek_marketplace;

-- Hapus check lama jika ada, lalu pasang ulang (MySQL 8.0.16+)
SET @chk := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND CONSTRAINT_TYPE = 'CHECK'
    AND CONSTRAINT_NAME = 'chk_payments_status'
  LIMIT 1
);
SET @sql := IF(@chk IS NOT NULL,
  'ALTER TABLE payments DROP CHECK chk_payments_status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE payments
  ADD CONSTRAINT chk_payments_status
  CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED'));
