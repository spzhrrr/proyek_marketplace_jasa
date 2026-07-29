import { pool } from "../config/db.js";

const MAX_REVISIONS = 3;

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO work_submissions (order_id, seller_id, revision_number, note, status)
     VALUES (?, ?, ?, ?, 'SUBMITTED')`,
    [data.order_id, data.seller_id, data.revision_number, data.note || ""],
  );
  return result.insertId;
}

async function addFile(data) {
  await pool.query(
    `INSERT INTO work_submission_files
      (submission_id, file_name, file_path, file_type, file_size)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.submission_id,
      data.file_name,
      data.file_path,
      data.file_type,
      data.file_size,
    ],
  );
}

async function findByOrder(orderId) {
  const [rows] = await pool.query(
    `SELECT ws.*,
            (SELECT COUNT(*) FROM work_submission_files f WHERE f.submission_id = ws.id) AS file_count
     FROM work_submissions ws
     WHERE ws.order_id = ?
     ORDER BY ws.revision_number DESC, ws.submitted_at DESC`,
    [orderId],
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM work_submissions WHERE id = ?", [id]);
  return rows[0] || null;
}

async function findFiles(submissionId) {
  const [rows] = await pool.query(
    "SELECT * FROM work_submission_files WHERE submission_id = ? ORDER BY id",
    [submissionId],
  );
  return rows;
}

async function findLatestSubmitted(orderId) {
  const [rows] = await pool.query(
    `SELECT * FROM work_submissions
     WHERE order_id = ? AND status = 'SUBMITTED'
     ORDER BY revision_number DESC LIMIT 1`,
    [orderId],
  );
  return rows[0] || null;
}

async function findLatestRevisionRequested(orderId) {
  const [rows] = await pool.query(
    `SELECT * FROM work_submissions
     WHERE order_id = ? AND status = 'REVISION_REQUESTED'
     ORDER BY revision_number DESC LIMIT 1`,
    [orderId],
  );
  return rows[0] || null;
}

async function countByOrder(orderId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM work_submissions WHERE order_id = ?",
    [orderId],
  );
  return rows[0].total;
}

async function getNextRevisionNumber(orderId) {
  const [rows] = await pool.query(
    "SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_num FROM work_submissions WHERE order_id = ?",
    [orderId],
  );
  return rows[0].next_num;
}

async function updateStatus(id, status, reviewNote) {
  await pool.query(
    `UPDATE work_submissions
     SET status = ?, review_note = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [status, reviewNote || null, id],
  );
}

async function sellerCanSubmit(orderId) {
  const pending = await findLatestSubmitted(orderId);
  if (pending) return false;
  return true;
}

export default {
  MAX_REVISIONS,
  create,
  addFile,
  findByOrder,
  findById,
  findFiles,
  findLatestSubmitted,
  findLatestRevisionRequested,
  getNextRevisionNumber,
  countByOrder,
  updateStatus,
  sellerCanSubmit,
};
