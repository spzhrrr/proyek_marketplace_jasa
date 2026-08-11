import { pool } from "../config/db.js";

let skillsColumnReady = false;
let urgentColumnReady = false;
let listedColumnReady = false;

async function ensureSkillsColumn() {
  if (skillsColumnReady) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM jobs LIKE 'skills'");
  if (!cols.length) {
    await pool.query("ALTER TABLE jobs ADD COLUMN skills VARCHAR(500) NOT NULL DEFAULT ''");
  }
  skillsColumnReady = true;
}

async function ensureUrgentColumn() {
  if (urgentColumnReady) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM jobs LIKE 'is_urgent'");
  if (!cols.length) {
    await pool.query("ALTER TABLE jobs ADD COLUMN is_urgent TINYINT(1) NOT NULL DEFAULT 0");
  }
  urgentColumnReady = true;
}

async function ensureListedColumn() {
  if (listedColumnReady) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM jobs LIKE 'is_active'");
  if (!cols.length) {
    await pool.query("ALTER TABLE jobs ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER status");
  }
  listedColumnReady = true;
}

async function ensureJobColumns() {
  await ensureSkillsColumn();
  await ensureUrgentColumn();
  await ensureListedColumn();
}

export function parseJobSkills(value, description = "") {
  const fromCol = String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromDesc = String(description || "").split(/Keahlian Dibutuhkan:\s*/i)[1];
  const fromText = fromDesc
    ? fromDesc.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([...fromCol, ...fromText])].slice(0, 5);
}

export function serializeJobSkills(input) {
  if (!input) return "";
  const arr = Array.isArray(input) ? input : String(input).split(",");
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))].slice(0, 5).join(", ");
}

export function stripJobSkills(description) {
  return String(description || "").replace(/(?:\r?\n)+\s*Keahlian Dibutuhkan:.*$/is, "").trim();
}

export function withJobSkills(description, skills) {
  const clean = stripJobSkills(description);
  const list = Array.isArray(skills) ? skills.filter(Boolean) : [];
  if (!list.length) return clean;
  return `${clean}\n\nKeahlian Dibutuhkan: ${list.join(", ")}`;
}

const listSelect = `
  SELECT j.*,
         c.name AS category_name,
         c.url_code AS category_code,
         c.type AS category_type,
         parent.name AS parent_category_name,
         parent.url_code AS parent_category_code,
         parent.type AS parent_type,
         CONCAT(u.first_name, ' ', u.last_name) AS poster_name,
         CONCAT(u.first_name, ' ', u.last_name) AS buyer_name,
         u.profilepic_url AS poster_avatar,
         u.profilepic_url AS buyer_avatar,
         u.profilepic_url AS avatar_url,
         u.city AS city,
         u.city AS buyer_city,
         u.city AS poster_city,
         u.ktp_status AS poster_ktp_status,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count
  FROM jobs j
  JOIN categories c ON j.category_id = c.id
  JOIN categories parent ON c.parent_id = parent.id
  JOIN users u ON j.buyer_id = u.id
  WHERE j.status = 'OPEN' AND COALESCE(j.is_active, 1) = 1
`;

function buildFilter(filters = {}) {
  const { tipe, sub, q, city } = filters;
  const conditions = [];
  const params = [];

  if (tipe && tipe !== "semua") {
    conditions.push("(parent.url_code = ? OR parent.type = ? OR (LOWER(?) = 'physical' AND (parent.url_code = 'fisik' OR parent.type = 'PHYSICAL')) OR (LOWER(?) = 'digital' AND (parent.url_code = 'digital' OR parent.type = 'DIGITAL')))");
    params.push(tipe, tipe, tipe, tipe);
  }
  if (sub && sub !== "semua") {
    conditions.push("c.url_code = ?");
    params.push(sub);
  }
  if (city && city !== "semua") {
    conditions.push("(u.city LIKE ? OR j.description LIKE ?)");
    params.push(`%${city}%`, `%${city}%`);
  }
  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    conditions.push(
      "(j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.city LIKE ?)",
    );
    params.push(term, term, term, term, term);
  }
  if (filters.priceRange && filters.priceRange !== "semua") {
    if (filters.priceRange === "under_100k") conditions.push("j.budget < 100000");
    else if (filters.priceRange === "100k_500k") conditions.push("j.budget BETWEEN 100000 AND 500000");
    else if (filters.priceRange === "500k_1m") conditions.push("j.budget BETWEEN 500000 AND 1000000");
    else if (filters.priceRange === "over_1m") conditions.push("j.budget > 1000000");
  }

  return { conditions, params };
}

async function findAll(filters = {}) {
  await ensureJobColumns();
  const { conditions, params } = buildFilter(filters);
  let sql = listSelect;
  sql += " AND (j.deadline IS NULL OR j.deadline >= CURDATE())";
  if (conditions.length) sql += " AND " + conditions.join(" AND ");

  if (filters.sort === "budget_tinggi") {
    sql += " ORDER BY j.is_urgent DESC, j.budget DESC";
  } else if (filters.sort === "budget_rendah") {
    sql += " ORDER BY j.is_urgent DESC, j.budget ASC";
  } else {
    sql += " ORDER BY j.is_urgent DESC, j.created_at DESC";
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findById(id) {
  await ensureJobColumns();
  const baseSelect = listSelect.replace("WHERE j.status = 'OPEN' AND COALESCE(j.is_active, 1) = 1", "WHERE 1=1");
  const [rows] = await pool.query(
    baseSelect + " AND j.id = ?",
    [id],
  );
  return rows[0] || null;
}

async function create(data) {
  await ensureJobColumns();
  const [result] = await pool.query(
    `INSERT INTO jobs
      (buyer_id, category_id, title, description, budget, deadline, is_urgent, skills, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      data.buyer_id,
      data.category_id,
      data.title,
      data.description,
      data.budget,
      data.deadline || null,
      data.is_urgent ? 1 : 0,
      serializeJobSkills(data.skills),
    ],
  );
  return result.insertId;
}

async function countAll() {
  await ensureJobColumns();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM jobs WHERE status = 'OPEN' AND COALESCE(is_active, 1) = 1",
  );
  return rows[0].total;
}

async function findByBuyer(userId) {
  await ensureJobColumns();
  const [rows] = await pool.query(
    `SELECT j.*,
            c.name AS category_name,
            parent.type AS parent_type,
            CONCAT(u.first_name, ' ', u.last_name) AS poster_name,
            CONCAT(u.first_name, ' ', u.last_name) AS buyer_name,
            u.profilepic_url AS poster_avatar,
            u.profilepic_url AS buyer_avatar,
            u.city AS city,
            u.city AS buyer_city,
            u.ktp_status AS poster_ktp_status,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'PENDING') AS pending_applications,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'ACCEPTED') AS accepted_applications,
            (SELECT COUNT(*) FROM orders o
              WHERE o.job_id = j.id
                AND o.status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED')) AS active_orders
     FROM jobs j
     JOIN categories c ON j.category_id = c.id
     JOIN categories parent ON c.parent_id = parent.id
     JOIN users u ON j.buyer_id = u.id
     WHERE j.buyer_id = ?
     ORDER BY FIELD(j.status, 'OPEN', 'FILLED', 'CLOSED', 'CANCELLED'), j.created_at DESC`,
    [userId],
  );
  return rows;
}

async function updateStatus(id, status) {
  await pool.query("UPDATE jobs SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
}

async function setListed(id, listed) {
  await ensureJobColumns();
  await pool.query(
    "UPDATE jobs SET is_active = ?, updated_at = NOW() WHERE id = ?",
    [listed ? 1 : 0, id],
  );
}

async function update(id, data) {
  await ensureJobColumns();
  await pool.query(
    `UPDATE jobs SET
      category_id = ?, title = ?, description = ?, budget = ?,
      deadline = ?, is_urgent = ?, skills = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      data.category_id,
      data.title,
      data.description,
      data.budget,
      data.deadline || null,
      data.is_urgent ? 1 : 0,
      serializeJobSkills(data.skills),
      id,
    ],
  );
}

async function closeExpiredOpenJobs() {
  await ensureJobColumns();
  const [result] = await pool.query(
    `UPDATE jobs SET status = 'CLOSED', updated_at = NOW()
     WHERE status = 'OPEN' AND deadline IS NOT NULL AND deadline < CURDATE()`,
  );
  return result.affectedRows || 0;
}

async function countBlockingApplications(jobId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM applications
     WHERE job_id = ? AND status IN ('PENDING', 'ACCEPTED')`,
    [jobId],
  );
  return Number(rows[0]?.total || 0);
}

async function countActiveJobOrders(jobId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders
     WHERE job_id = ?
       AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED')`,
    [jobId],
  );
  return Number(rows[0]?.total || 0);
}

export default {
  findAll,
  findById,
  create,
  countAll,
  findByBuyer,
  updateStatus,
  setListed,
  update,
  closeExpiredOpenJobs,
  countBlockingApplications,
  countActiveJobOrders,
};
