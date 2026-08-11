-- Verifikasi bank via admin (seperti KTP)
-- mysql -u root -p proyek_marketplace < backend/database/migrations/005_bank_admin_status.sql

USE proyek_marketplace;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SUBMITTED' AFTER bank_verified_at,
  ADD COLUMN IF NOT EXISTS bank_submitted_at DATETIME NULL AFTER bank_status,
  ADD COLUMN IF NOT EXISTS bank_rejected_reason TEXT NULL AFTER bank_submitted_at;

-- MariaDB < 10.0.2 tidak punya IF NOT EXISTS pada ADD COLUMN — jika error, jalankan tanpa IF NOT EXISTS:
-- ALTER TABLE users ADD COLUMN bank_status ...
-- ALTER TABLE users ADD COLUMN bank_submitted_at ...
-- ALTER TABLE users ADD COLUMN bank_rejected_reason ...

CREATE INDEX IF NOT EXISTS idx_users_bank_status ON users (bank_status);

-- Pengguna lama yang sudah auto-verified tetap APPROVED
UPDATE users
SET bank_status = 'APPROVED'
WHERE bank_verified_at IS NOT NULL AND (bank_status IS NULL OR bank_status = 'NOT_SUBMITTED');

SELECT 'Migration 005 bank admin status selesai.' AS info;
