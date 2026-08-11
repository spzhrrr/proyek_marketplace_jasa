-- =============================================================================
-- PATCH SAJA — tidak menghapus data
-- Lifecycle listing (jasa deleted_at + kolom pendukung lowongan/lamaran)
-- =============================================================================
-- JANGAN jalankan phpmyadmin_full_override.sql / schema.sql jika data
-- sudah di-insert lewat frontend. File itu DROP TABLE.
--
-- CARA PAKAI (phpMyAdmin):
-- 1. Pilih database proyek_marketplace
-- 2. Tab SQL → paste SELURUH isi file ini → Go
-- 3. Aman dijalankan ulang (kolom/index yang sudah ada dilewati)
-- =============================================================================

USE proyek_marketplace;

-- services.deleted_at (soft-delete jasa yang sudah punya riwayat pesanan)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'deleted_at') = 0,
  'ALTER TABLE services ADD COLUMN deleted_at DATETIME NULL AFTER is_active',
  'SELECT ''services.deleted_at sudah ada'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- jobs.is_active (tayang/sembunyi di Cari Kerja)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND COLUMN_NAME = 'is_active') = 0,
  'ALTER TABLE jobs ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER status',
  'SELECT ''jobs.is_active sudah ada'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- applications.reject_reason (alasan tolak, termasuk saat Tutup lowongan)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'reject_reason') = 0,
  'ALTER TABLE applications ADD COLUMN reject_reason VARCHAR(500) NOT NULL DEFAULT '''' AFTER status',
  'SELECT ''applications.reject_reason sudah ada'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- applications.reject_kind (MANUAL / AUTO_FILLED / AUTO_EXPIRED / JOB_CLOSED)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'reject_kind') = 0,
  'ALTER TABLE applications ADD COLUMN reject_kind VARCHAR(20) NOT NULL DEFAULT '''' AFTER reject_reason',
  'SELECT ''applications.reject_kind sudah ada'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index katalog jasa
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND INDEX_NAME = 'idx_services_deleted') = 0,
  'ALTER TABLE services ADD INDEX idx_services_deleted (deleted_at, is_active)',
  'SELECT ''idx_services_deleted sudah ada'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index katalog lowongan
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'jobs' AND INDEX_NAME = 'idx_jobs_listed') = 0,
  'ALTER TABLE jobs ADD INDEX idx_jobs_listed (status, is_active)',
  'SELECT ''idx_jobs_listed sudah ada'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tidak ada INSERT/UPDATE/DELETE baris. Data frontend tetap utuh.
SELECT
  'Patch listing lifecycle selesai. Data lama tidak dihapus.' AS info,
  (SELECT COUNT(*) FROM services) AS jumlah_jasa,
  (SELECT COUNT(*) FROM jobs) AS jumlah_lowongan,
  (SELECT COUNT(*) FROM orders) AS jumlah_pesanan,
  (SELECT COUNT(*) FROM applications) AS jumlah_lamaran;
