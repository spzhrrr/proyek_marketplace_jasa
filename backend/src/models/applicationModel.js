import { pool } from "../config/db.js";

const AUTO_FILLED_REASON = "Tidak terpilih karena klien sudah merekrut pelamar lain.";
const AUTO_EXPIRED_REASON = "Rekrutmen dibatalkan karena pembayaran tidak diselesaikan.";
const JOB_CLOSED_REASON = "Lowongan ditutup oleh klien. Lamaran tidak diproses lebih lanjut.";

let rejectColsReady = false;

async function ensureRejectColumns() {
  if (rejectColsReady) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM applications LIKE 'reject_reason'");
  if (!cols.length) {
    await pool.query(
      "ALTER TABLE applications ADD COLUMN reject_reason VARCHAR(500) NOT NULL DEFAULT '' AFTER status",
    );
  }
  const [kinds] = await pool.query("SHOW COLUMNS FROM applications LIKE 'reject_kind'");
  if (!kinds.length) {
    await pool.query(
      "ALTER TABLE applications ADD COLUMN reject_kind VARCHAR(20) NOT NULL DEFAULT '' AFTER reject_reason",
    );
  }
  rejectColsReady = true;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO applications (job_id, seller_id, cover_letter, proposed_price, estimated_days, portfolio_file_url, status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      data.jobId,
      data.sellerId,
      data.cover_letter || "",
      data.proposed_price || 0,
      data.estimated_days || null,
      data.portfolio_file_url || "",
    ],
  );
  return result.insertId;
}

async function findById(id) {
  await ensureRejectColumns();
  const [rows] = await pool.query(
    `SELECT a.*,
            j.title AS job_title,
            j.budget AS job_budget,
            j.buyer_id,
            j.status AS job_status,
            CONCAT(applicant.first_name, ' ', applicant.last_name) AS applicant_name,
            applicant.profilepic_url AS applicant_avatar,
            applicant.city AS applicant_city,
            applicant.province AS applicant_province,
            applicant.bio AS applicant_bio,
            applicant.ktp_status AS applicant_ktp_status,
            CONCAT(poster.first_name, ' ', poster.last_name) AS poster_name
     FROM applications a
     JOIN jobs j ON a.job_id = j.id
     JOIN users applicant ON a.seller_id = applicant.id
     JOIN users poster ON j.buyer_id = poster.id
     WHERE a.id = ?`,
    [id],
  );
  return rows[0] || null;
}

async function findByJob(jobId) {
  await ensureRejectColumns();
  const [rows] = await pool.query(
    `SELECT a.*,
            CONCAT(u.first_name, ' ', u.last_name) AS applicant_name,
            u.profilepic_url AS applicant_avatar,
            u.city AS applicant_city,
            u.province AS applicant_province,
            u.bio AS applicant_bio,
            u.ktp_status AS applicant_ktp_status,
            o.id AS order_id,
            (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.reviewee_id = u.id) AS applicant_rating,
            (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = u.id) AS applicant_review_count,
            (SELECT COUNT(*) FROM orders ord WHERE ord.seller_id = u.id AND ord.status = 'COMPLETED') AS applicant_completed
     FROM applications a
     JOIN users u ON a.seller_id = u.id
     LEFT JOIN orders o ON o.application_id = a.id
     WHERE a.job_id = ?
     ORDER BY FIELD(a.status, 'ACCEPTED', 'PENDING', 'REJECTED'), a.created_at DESC`,
    [jobId],
  );
  return rows;
}

async function findByApplicant(userId) {
  const [rows] = await pool.query(
    `SELECT a.*,
            j.title AS job_title,
            j.budget AS job_budget,
            j.status AS job_status,
            CONCAT(poster.first_name, ' ', poster.last_name) AS poster_name,
            o.id AS order_id
     FROM applications a
     JOIN jobs j ON a.job_id = j.id
     JOIN users poster ON j.buyer_id = poster.id
     LEFT JOIN orders o ON o.application_id = a.id
     WHERE a.seller_id = ?
     ORDER BY a.created_at DESC`,
    [userId],
  );
  return rows;
}

async function findIncomingForPoster(userId) {
  const [rows] = await pool.query(
    `SELECT a.*,
            j.title AS job_title,
            j.id AS job_id,
            CONCAT(u.first_name, ' ', u.last_name) AS applicant_name
     FROM applications a
     JOIN jobs j ON a.job_id = j.id
     JOIN users u ON a.seller_id = u.id
     WHERE j.buyer_id = ?
     ORDER BY a.created_at DESC`,
    [userId],
  );
  return rows;
}

async function hasApplied(jobId, sellerId) {
  const [rows] = await pool.query(
    "SELECT id FROM applications WHERE job_id = ? AND seller_id = ? AND status IN ('PENDING', 'ACCEPTED') LIMIT 1",
    [jobId, sellerId],
  );
  return rows.length > 0;
}

async function findRejected(jobId, sellerId) {
  const [rows] = await pool.query(
    "SELECT id FROM applications WHERE job_id = ? AND seller_id = ? AND status = 'REJECTED' LIMIT 1",
    [jobId, sellerId],
  );
  return rows[0] || null;
}

async function reapply(id, data) {
  await pool.query(
    `UPDATE applications SET cover_letter = ?, proposed_price = ?, estimated_days = ?,
      portfolio_file_url = ?, status = 'PENDING', reviewed_at = NULL, created_at = NOW(),
      reject_reason = '', reject_kind = ''
     WHERE id = ? AND status = 'REJECTED'`,
    [
      data.cover_letter || "",
      data.proposed_price || 0,
      data.estimated_days || null,
      data.portfolio_file_url || "",
      id,
    ],
  );
}

async function updateStatus(id, status, extra = {}) {
  await ensureRejectColumns();
  await pool.query(
    `UPDATE applications SET status = ?, reviewed_at = NOW(),
      reject_reason = COALESCE(?, reject_reason),
      reject_kind = COALESCE(?, reject_kind)
     WHERE id = ?`,
    [status, extra.reject_reason ?? null, extra.reject_kind ?? null, id],
  );
}

async function rejectPendingForClosedJob(jobId) {
  await ensureRejectColumns();
  const [rows] = await pool.query(
    "SELECT id, seller_id FROM applications WHERE job_id = ? AND status = 'PENDING'",
    [jobId],
  );
  if (!rows.length) return [];
  await pool.query(
    `UPDATE applications SET status = 'REJECTED', reviewed_at = NOW(),
      reject_reason = ?, reject_kind = 'JOB_CLOSED'
     WHERE job_id = ? AND status = 'PENDING'`,
    [JOB_CLOSED_REASON, jobId],
  );
  return rows;
}

async function rejectOthersForJob(jobId, exceptId) {
  await ensureRejectColumns();
  await pool.query(
    `UPDATE applications SET status = 'REJECTED', reviewed_at = NOW(),
      reject_reason = ?, reject_kind = 'AUTO_FILLED'
     WHERE job_id = ? AND id != ? AND status = 'PENDING'`,
    [AUTO_FILLED_REASON, jobId, exceptId],
  );
}

async function healFilledJob(jobId) {
  await ensureRejectColumns();
  const [accepted] = await pool.query(
    "SELECT id FROM applications WHERE job_id = ? AND status = 'ACCEPTED' LIMIT 1",
    [jobId],
  );
  if (!accepted.length) return;
  await pool.query(
    `UPDATE applications SET status = 'REJECTED', reviewed_at = COALESCE(reviewed_at, NOW()),
      reject_reason = CASE WHEN reject_reason = '' THEN ? ELSE reject_reason END,
      reject_kind = CASE WHEN reject_kind = '' THEN 'AUTO_FILLED' ELSE reject_kind END
     WHERE job_id = ? AND status = 'PENDING'`,
    [AUTO_FILLED_REASON, jobId],
  );
}

async function findPendingOthers(jobId, exceptId) {
  const [rows] = await pool.query(
    `SELECT a.*, j.title AS job_title
     FROM applications a
     JOIN jobs j ON a.job_id = j.id
     WHERE a.job_id = ? AND a.id != ? AND a.status = 'PENDING'`,
    [jobId, exceptId],
  );
  return rows;
}

export default {
  ensureRejectColumns,
  create,
  findById,
  findByJob,
  findByApplicant,
  findIncomingForPoster,
  hasApplied,
  findRejected,
  reapply,
  updateStatus,
  rejectOthersForJob,
  rejectPendingForClosedJob,
  healFilledJob,
  findPendingOthers,
  AUTO_FILLED_REASON,
  AUTO_EXPIRED_REASON,
  JOB_CLOSED_REASON,
};
