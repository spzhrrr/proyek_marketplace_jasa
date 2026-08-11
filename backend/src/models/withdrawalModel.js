import { pool } from "../config/db.js";

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO withdrawals (user_id, amount, bank_name, bank_account_number, bank_account_holder, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [
      data.user_id,
      data.amount,
      data.bank_name,
      data.bank_account_number,
      data.bank_account_holder,
    ]
  );
  return result.insertId;
}

async function findById(id) {
  const [rows] = await pool.query(`SELECT * FROM withdrawals WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function findByUser(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  } catch (e) {
    return [];
  }
}

async function findAllAdmin() {
  try {
    const [rows] = await pool.query(
      `SELECT w.*, CONCAT(u.first_name, ' ', u.last_name) AS user_name, u.email
       FROM withdrawals w
       JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC`
    );
    return rows;
  } catch (e) {
    return [];
  }
}

async function approveIfPending(id, note = "") {
  const [result] = await pool.query(
    `UPDATE withdrawals SET status = 'APPROVED', note = ?, processed_at = NOW()
     WHERE id = ? AND status = 'PENDING'`,
    [note, id]
  );
  return result.affectedRows > 0;
}

async function rejectIfPending(id, note = "") {
  const [result] = await pool.query(
    `UPDATE withdrawals SET status = 'REJECTED', note = ?, processed_at = NOW()
     WHERE id = ? AND status = 'PENDING'`,
    [note, id]
  );
  return result.affectedRows > 0;
}

async function approve(id, note = "") {
  return approveIfPending(id, note);
}

async function reject(id, note = "") {
  return rejectIfPending(id, note);
}

export default {
  create,
  findById,
  findByUser,
  findAllAdmin,
  approve,
  reject,
  approveIfPending,
  rejectIfPending,
};
