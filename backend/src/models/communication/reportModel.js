import { pool } from "../../config/db.js";

async function initTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_user_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        status ENUM('PENDING', 'RESOLVED', 'DISMISSED') DEFAULT 'PENDING',
        action_taken ENUM('NONE', 'WARNING', 'SUSPENDED', 'BANNED') DEFAULT 'NONE',
        admin_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    console.error("user_reports table init error:", e.message);
  }
}

initTable();

async function create(data) {
  await initTable();
  const [result] = await pool.query(
    `INSERT INTO user_reports (reporter_id, reported_user_id, reason, description)
     VALUES (?, ?, ?, ?)`,
    [data.reporter_id, data.reported_user_id, data.reason, data.description || ""]
  );
  return result.insertId;
}

async function findAllAdmin() {
  await initTable();
  try {
    const [rows] = await pool.query(
      `SELECT r.*,
              CONCAT(u1.first_name, ' ', u1.last_name) AS reporter_name, u1.email AS reporter_email,
              CONCAT(u2.first_name, ' ', u2.last_name) AS reported_name, u2.email AS reported_email, u2.is_banned AS reported_is_banned, u2.role AS reported_role
       FROM user_reports r
       JOIN users u1 ON r.reporter_id = u1.id
       JOIN users u2 ON r.reported_user_id = u2.id
       ORDER BY r.created_at DESC`
    );
    return rows;
  } catch (e) {
    return [];
  }
}

async function resolveReport(id, { action_taken, admin_note }) {
  await initTable();
  await pool.query(
    `UPDATE user_reports 
     SET status = 'RESOLVED', action_taken = ?, admin_note = ? 
     WHERE id = ?`,
    [action_taken, admin_note || "", id]
  );
}

async function dismissReport(id, { admin_note }) {
  await initTable();
  await pool.query(
    `UPDATE user_reports 
     SET status = 'DISMISSED', action_taken = 'NONE', admin_note = ? 
     WHERE id = ?`,
    [admin_note || "", id]
  );
}

export default {
  create,
  findAllAdmin,
  resolveReport,
  dismissReport,
};
