-- File override lama (DROP TABLE — menghapus semua data).
--
-- Database masih kosong / boleh di-reset:
--   backend/database/phpmyadmin_full_override.sql
--
-- Data sudah ada (insert lewat frontend) — JANGAN DROP:
--   backend/database/phpmyadmin_patch_listing_lifecycle.sql

SELECT 'Data sudah ada? Pakai phpmyadmin_patch_listing_lifecycle.sql. Reset total? phpmyadmin_full_override.sql.' AS info;
