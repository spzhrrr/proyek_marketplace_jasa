-- Visibility toggle for jobs (independent from OPEN/CLOSED apply-window)
ALTER TABLE jobs
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER status;

ALTER TABLE jobs
  ADD INDEX idx_jobs_listed (status, is_active);
