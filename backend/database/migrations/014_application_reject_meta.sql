-- Alasan & jenis penolakan lamaran (manual vs otomatis karena lowongan terisi)
ALTER TABLE applications
  ADD COLUMN reject_reason VARCHAR(500) NOT NULL DEFAULT '' AFTER status,
  ADD COLUMN reject_kind VARCHAR(20) NOT NULL DEFAULT '' AFTER reject_reason;
