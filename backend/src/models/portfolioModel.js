import { pool } from "../config/db.js";

let categoryColumnReady = false;

async function ensureCategoryColumn() {
  if (categoryColumnReady) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM user_portfolios LIKE 'category_id'");
  if (!cols.length) {
    await pool.query("ALTER TABLE user_portfolios ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER user_id");
  }
  try {
    await pool.query("ALTER TABLE user_portfolios DROP INDEX uq_user_portfolio_cat");
  } catch {
    /* missing or already dropped */
  }
  try {
    await pool.query(
      "ALTER TABLE user_portfolios ADD CONSTRAINT fk_portfolio_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL",
    );
  } catch {
    /* already exists */
  }
  categoryColumnReady = true;
}

async function findByUser(userId) {
  await ensureCategoryColumn();
  const [rows] = await pool.query(
    `SELECT p.*,
            c.name AS category_name,
            c.url_code AS category_code,
            parent.name AS parent_name,
            parent.type AS parent_type,
            parent.url_code AS parent_code
     FROM user_portfolios p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN categories parent ON c.parent_id = parent.id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return rows;
}

async function countByUser(userId) {
  await ensureCategoryColumn();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM user_portfolios WHERE user_id = ?",
    [userId],
  );
  return Number(rows[0]?.total) || 0;
}

async function hasCategory(userId, categoryId) {
  await ensureCategoryColumn();
  const [rows] = await pool.query(
    "SELECT id FROM user_portfolios WHERE user_id = ? AND category_id = ? LIMIT 1",
    [userId, categoryId],
  );
  return rows.length > 0;
}

async function create(data) {
  await ensureCategoryColumn();
  const [result] = await pool.query(
    `INSERT INTO user_portfolios (user_id, category_id, title, description, image_url, file_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.category_id || null,
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

export default { findByUser, countByUser, hasCategory, create, findById, remove };
