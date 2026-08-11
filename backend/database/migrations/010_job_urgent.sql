-- Urgent same-day jobs + apply-by deadline index
ALTER TABLE jobs
  ADD COLUMN is_urgent TINYINT(1) NOT NULL DEFAULT 0 AFTER deadline;

ALTER TABLE jobs
  ADD INDEX idx_jobs_urgent_deadline (status, is_urgent, deadline);
