-- Tambah kolom data KTP yang dipakai form /verify/ktp.
-- complete_override_schema lama tidak punya kolom ini → ER_BAD_FIELD_ERROR
-- saat submit KTP (pesan FE: "Struktur database belum di-update").
--
-- Aman dijalankan di DB yang sudah ada (tidak DROP). Jika kolom sudah ada, skip error.

ALTER TABLE users ADD COLUMN ktp_name VARCHAR(120) NULL AFTER ktp_number;
ALTER TABLE users ADD COLUMN ktp_birthplace VARCHAR(80) NULL AFTER ktp_name;
ALTER TABLE users ADD COLUMN ktp_birthdate DATE NULL AFTER ktp_birthplace;
ALTER TABLE users ADD COLUMN ktp_gender VARCHAR(20) NULL AFTER ktp_birthdate;
ALTER TABLE users ADD COLUMN ktp_address TEXT NULL AFTER ktp_gender;
