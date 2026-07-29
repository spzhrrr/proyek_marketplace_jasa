import { pool } from "../config/db.js";

const listSelect = `
  SELECT j.*,
         c.name AS category_name,
         c.url_code AS category_code,
         c.type AS category_type,
         parent.name AS parent_category_name,
         parent.url_code AS parent_category_code,
         parent.type AS parent_type,
         CONCAT(u.first_name, ' ', u.last_name) AS poster_name,
         CONCAT(u.first_name, ' ', u.last_name) AS buyer_name
  FROM jobs j
  JOIN categories c ON j.category_id = c.id
  JOIN categories parent ON c.parent_id = parent.id
  JOIN users u ON j.buyer_id = u.id
  WHERE j.status = 'OPEN'
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
      "(j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)",
    );
    params.push(term, term, term, term);
  }

  return { conditions, params };
}

async function findAll(filters = {}) {
  const { conditions, params } = buildFilter(filters);
  let sql = listSelect;
  if (conditions.length) sql += " AND " + conditions.join(" AND ");
  sql += " ORDER BY j.created_at DESC";
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT j.*,
            c.name AS category_name,
            c.url_code AS category_code,
            c.type AS category_type,
            parent.name AS parent_category_name,
            parent.url_code AS parent_category_code,
            parent.type AS parent_type,
            CONCAT(u.first_name, ' ', u.last_name) AS poster_name,
            CONCAT(u.first_name, ' ', u.last_name) AS buyer_name
     FROM jobs j
     JOIN categories c ON j.category_id = c.id
     JOIN categories parent ON c.parent_id = parent.id
     JOIN users u ON j.buyer_id = u.id
     WHERE j.id = ?`,
    [id],
  );
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO jobs
      (buyer_id, category_id, title, description, budget, deadline, status)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      data.buyer_id,
      data.category_id,
      data.title,
      data.description,
      data.budget,
      data.deadline || null,
    ],
  );
  return result.insertId;
}

async function countAll() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM jobs WHERE status = 'OPEN'",
  );
  return rows[0].total;
}

async function findByBuyer(userId) {
  const [rows] = await pool.query(
    `SELECT j.*,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'PENDING') AS pending_applications
     FROM jobs j
     WHERE j.buyer_id = ?
     ORDER BY j.created_at DESC`,
    [userId],
  );
  return rows;
}

async function updateStatus(id, status) {
  await pool.query("UPDATE jobs SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
}

async function update(id, data) {
  await pool.query(
    `UPDATE jobs SET
      category_id = ?, title = ?, description = ?, budget = ?,
      deadline = ?, updated_at = NOW()
     WHERE id = ?`,
    [data.category_id, data.title, data.description, data.budget, data.deadline || null, id],
  );
}

async function countBlockingApplications(jobId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM applications
     WHERE job_id = ? AND status = 'ACCEPTED'`,
    [jobId],
  );
  return rows[0].total;
}

async function countActiveJobOrders(jobId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders
     WHERE job_id = ? AND source = 'JOB'
       AND status IN ('ACCEPTED', 'IN_PROGRESS')`,
    [jobId],
  );
  return rows[0].total;
}

export default {
  findAll,
  findById,
  create,
  countAll,
  findByBuyer,
  updateStatus,
  update,
  countBlockingApplications,
  countActiveJobOrders,
};
