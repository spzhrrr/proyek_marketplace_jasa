import { pool } from "../config/db.js";

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
  const [rows] = await pool.query(
    `SELECT a.*,
            j.title AS job_title,
            j.budget AS job_budget,
            j.buyer_id,
            j.status AS job_status,
            CONCAT(applicant.first_name, ' ', applicant.last_name) AS applicant_name,
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
  const [rows] = await pool.query(
    `SELECT a.*,
            CONCAT(u.first_name, ' ', u.last_name) AS applicant_name
     FROM applications a
     JOIN users u ON a.seller_id = u.id
     WHERE a.job_id = ?
     ORDER BY a.created_at DESC`,
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
      portfolio_file_url = ?, status = 'PENDING', reviewed_at = NULL, created_at = NOW()
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

async function updateStatus(id, status) {
  await pool.query(
    "UPDATE applications SET status = ?, reviewed_at = NOW() WHERE id = ?",
    [status, id],
  );
}

async function rejectOthersForJob(jobId, exceptId) {
  await pool.query(
    `UPDATE applications SET status = 'REJECTED', reviewed_at = NOW()
     WHERE job_id = ? AND id != ? AND status = 'PENDING'`,
    [jobId, exceptId],
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
  findPendingOthers,
};
