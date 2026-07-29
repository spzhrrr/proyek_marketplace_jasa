import { pool } from "../config/db.js";

async function findByUser(userId) {
  const [rows] = await pool.query(
    "SELECT * FROM user_portfolios WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
  );
  return rows;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO user_portfolios (user_id, title, description, image_url, file_url)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.title,
      data.description || "",
      data.image_url || "",
      data.file_url || "",
    ],
  );
  return result.insertId;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM user_portfolios WHERE id = ?", [id]);
  return rows[0] || null;
}

async function remove(id, userId) {
  const [result] = await pool.query(
    "DELETE FROM user_portfolios WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  return result.affectedRows > 0;
}

export default { findByUser, create, findById, remove };
