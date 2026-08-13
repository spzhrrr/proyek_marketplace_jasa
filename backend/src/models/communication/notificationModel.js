import { pool } from "../../config/db.js";

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO notifications
      (user_id, actor_id, type, title, message, link_url, reference_type, reference_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.actor_id,
      data.type,
      data.title,
      data.message,
      data.link_url,
      data.reference_type,
      data.reference_id,
    ],
  );
  return result.insertId;
}

async function findByUser(userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT n.*,
            CONCAT(u.first_name, ' ', u.last_name) AS actor_name
     FROM notifications n
     LEFT JOIN users u ON n.actor_id = u.id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

async function countUnread(userId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0",
    [userId],
  );
  return rows[0].total;
}

async function markRead(id, userId) {
  await pool.query(
    "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?",
    [id, userId],
  );
}

async function findByIdForUser(id, userId) {
  const [rows] = await pool.query(
    "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  return rows[0] || null;
}

async function markAllRead(userId) {
  await pool.query(
    "UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0",
    [userId],
  );
}

export default { create, findByUser, countUnread, markRead, markAllRead, findByIdForUser };
