-- Jalankan manual jika DB sudah ada:
-- mysql -u root -p proyek_marketplace < backend/database/migrations/003_bank_verification.sql

USE proyek_marketplace;

ALTER TABLE users
  ADD COLUMN bank_name VARCHAR(80) NULL AFTER province,
  ADD COLUMN bank_account_number VARCHAR(40) NULL AFTER bank_name,
  ADD COLUMN bank_account_holder VARCHAR(120) NULL AFTER bank_account_number,
  ADD COLUMN bank_verified_at DATETIME NULL AFTER bank_account_holder;
