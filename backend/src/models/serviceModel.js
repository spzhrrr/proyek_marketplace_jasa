import { pool } from "../config/db.js";

const listSelect = `
  SELECT s.*,
         c.name AS category_name,
         c.url_code AS category_code,
         c.type AS category_type,
         parent.name AS parent_category_name,
         parent.url_code AS parent_category_code,
         parent.type AS parent_type,
         CONCAT(u.first_name, ' ', u.last_name) AS seller_name
  FROM services s
  JOIN categories c ON s.category_id = c.id
  JOIN categories parent ON c.parent_id = parent.id
  JOIN users u ON s.seller_id = u.id
  WHERE s.is_active = 1
`;

function buildFilter(filters = {}) {
  const { tipe, sub, q } = filters;
  const conditions = [];
  const params = [];

  if (tipe && tipe !== "semua") {
    conditions.push("parent.url_code = ?");
    params.push(tipe);
  }
  if (sub && sub !== "semua") {
    conditions.push("c.url_code = ?");
    params.push(sub);
  }
  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    conditions.push(
      "(s.title LIKE ? OR s.description LIKE ? OR c.name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)",
    );
    params.push(term, term, term, term);
  }

  return { conditions, params };
}

async function findAll(filters = {}) {
  const { conditions, params } = buildFilter(filters);
  let sql = listSelect;
  if (conditions.length) sql += " AND " + conditions.join(" AND ");
  sql += " ORDER BY s.created_at DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(listSelect + " AND s.id = ?", [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO services
      (seller_id, category_id, title, description, price, delivery_days, cover_image_url, portfolio_file_url, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.seller_id,
      data.category_id,
      data.title,
      data.description,
      data.price,
      data.delivery_days,
      data.cover_image_url || "",
      data.portfolio_file_url || "",
    ],
  );
  return result.insertId;
}

async function countAll() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM services WHERE is_active = 1",
  );
  return rows[0].total;
}

async function findBySeller(sellerId) {
  const [rows] = await pool.query(
    listSelect + " AND s.seller_id = ? ORDER BY s.created_at DESC",
    [sellerId],
  );
  return rows;
}

async function findByIdAny(id) {
  const baseSelect = listSelect.replace("WHERE s.is_active = 1", "WHERE 1=1");
  const [rows] = await pool.query(baseSelect + " AND s.id = ?", [id]);
  return rows[0] || null;
}

async function update(id, data) {
  await pool.query(
    `UPDATE services SET
      category_id = ?, title = ?, description = ?, price = ?,
      delivery_days = ?, cover_image_url = COALESCE(?, cover_image_url),
      portfolio_file_url = COALESCE(?, portfolio_file_url),
      updated_at = NOW()
     WHERE id = ?`,
    [
      data.category_id,
      data.title,
      data.description,
      data.price,
      data.delivery_days,
      data.cover_image_url ?? null,
      data.portfolio_file_url ?? null,
      id,
    ],
  );
}

async function deactivate(id) {
  await pool.query("UPDATE services SET is_active = 0, updated_at = NOW() WHERE id = ?", [id]);
}

async function countActiveOrders(serviceId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders
     WHERE service_id = ? AND source = 'SERVICE'
       AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS')`,
    [serviceId],
  );
  return rows[0].total;
}

export default { findAll, findById, findByIdAny, create, update, deactivate, countActiveOrders, countAll, findBySeller };
