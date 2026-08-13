import { pool } from "../../config/db.js";

let skillsColumnReady = false;

async function ensureSkillsColumn() {
  if (skillsColumnReady) return;
  const [cols] = await pool.query("SHOW COLUMNS FROM services LIKE 'skills'");
  if (!cols.length) {
    await pool.query("ALTER TABLE services ADD COLUMN skills VARCHAR(500) NOT NULL DEFAULT ''");
  }
  const [del] = await pool.query("SHOW COLUMNS FROM services LIKE 'deleted_at'");
  if (!del.length) {
    await pool.query("ALTER TABLE services ADD COLUMN deleted_at DATETIME NULL AFTER is_active");
  }
  skillsColumnReady = true;
}

export function parseStoredSkills(value, description = "") {
  const fromCol = String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromDesc = String(description || "")
    .split(/Keahlian\s*\/\s*Skill:\s*/i)[1];
  const fromText = fromDesc
    ? fromDesc.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([...fromCol, ...fromText])].slice(0, 5);
}

export function serializeSkills(input) {
  if (!input) return "";
  const arr = Array.isArray(input) ? input : String(input).split(",");
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))].slice(0, 5).join(", ");
}

const listSelect = `
  SELECT s.*,
         c.name AS category_name,
         c.url_code AS category_code,
         c.type AS category_type,
         parent.name AS parent_category_name,
         parent.url_code AS parent_category_code,
         parent.type AS parent_type,
         CONCAT(u.first_name, ' ', u.last_name) AS seller_name,
         u.profilepic_url AS seller_avatar,
         u.city AS seller_city,
         u.ktp_status AS seller_ktp_status,
         (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.reviewee_id = s.seller_id) AS seller_rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = s.seller_id) AS seller_review_count,
         (SELECT COUNT(*) FROM orders o WHERE o.service_id = s.id AND o.source = 'SERVICE' AND o.status = 'COMPLETED') AS completed_count
  FROM services s
  JOIN categories c ON s.category_id = c.id
  JOIN categories parent ON c.parent_id = parent.id
  JOIN users u ON s.seller_id = u.id
  WHERE s.is_active = 1 AND s.deleted_at IS NULL
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
    conditions.push("(u.city LIKE ? OR s.description LIKE ?)");
    params.push(`%${city}%`, `%${city}%`);
  }
  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    conditions.push(
      "(s.title LIKE ? OR s.description LIKE ? OR c.name LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.city LIKE ?)",
    );
    params.push(term, term, term, term, term);
  }
  if (filters.priceRange && filters.priceRange !== "semua") {
    if (filters.priceRange === "under_100k") conditions.push("s.price < 100000");
    else if (filters.priceRange === "100k_500k") conditions.push("s.price BETWEEN 100000 AND 500000");
    else if (filters.priceRange === "500k_1m") conditions.push("s.price BETWEEN 500000 AND 1000000");
    else if (filters.priceRange === "over_1m") conditions.push("s.price > 1000000");
  }

  return { conditions, params };
}

async function findAll(filters = {}) {
  await ensureSkillsColumn();
  const { conditions, params } = buildFilter(filters);
  let sql = listSelect;
  if (conditions.length) sql += " AND " + conditions.join(" AND ");

  if (filters.sort === "rating") {
    sql += " ORDER BY seller_rating DESC, s.created_at DESC";
  } else if (filters.sort === "termurah") {
    sql += " ORDER BY s.price ASC";
  } else if (filters.sort === "termahal") {
    sql += " ORDER BY s.price DESC";
  } else {
    sql += " ORDER BY s.created_at DESC";
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findById(id) {
  await ensureSkillsColumn();
  const [rows] = await pool.query(listSelect + " AND s.id = ?", [id]);
  return rows[0] || null;
}

async function create(data) {
  await ensureSkillsColumn();
  const [result] = await pool.query(
    `INSERT INTO services
      (seller_id, category_id, title, description, price, delivery_days, cover_image_url, portfolio_file_url, skills, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.seller_id,
      data.category_id,
      data.title,
      data.description,
      data.price,
      data.delivery_days,
      data.cover_image_url || "",
      data.portfolio_file_url || "",
      serializeSkills(data.skills),
    ],
  );
  return result.insertId;
}

async function countAll() {
  await ensureSkillsColumn();
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM services WHERE is_active = 1 AND deleted_at IS NULL",
  );
  return Number(rows[0]?.total || 0);
}

async function findBySeller(sellerId) {
  await ensureSkillsColumn();
  const baseSelect = listSelect.replace("WHERE s.is_active = 1 AND s.deleted_at IS NULL", "WHERE s.deleted_at IS NULL");
  const [rows] = await pool.query(
    baseSelect + " AND s.seller_id = ? ORDER BY s.is_active DESC, s.created_at DESC",
    [sellerId],
  );
  return rows;
}

async function findByIdAny(id) {
  await ensureSkillsColumn();
  const baseSelect = listSelect.replace("WHERE s.is_active = 1 AND s.deleted_at IS NULL", "WHERE 1=1");
  const [rows] = await pool.query(baseSelect + " AND s.id = ? AND s.deleted_at IS NULL", [id]);
  return rows[0] || null;
}

async function update(id, data) {
  await ensureSkillsColumn();
  await pool.query(
    `UPDATE services SET
      category_id = ?, title = ?, description = ?, price = ?,
      delivery_days = ?, cover_image_url = COALESCE(?, cover_image_url),
      portfolio_file_url = COALESCE(?, portfolio_file_url),
      skills = ?,
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
      serializeSkills(data.skills),
      id,
    ],
  );
}

async function archive(id) {
  await ensureSkillsColumn();
  await pool.query(
    "UPDATE services SET is_active = 0, deleted_at = NOW(), updated_at = NOW() WHERE id = ?",
    [id],
  );
}

async function remove(id) {
  await pool.query("DELETE FROM services WHERE id = ?", [id]);
}

async function toggleActive(id, isActive) {
  await pool.query("UPDATE services SET is_active = ?, updated_at = NOW() WHERE id = ?", [isActive ? 1 : 0, id]);
}

export default {
  findAll,
  findById,
  findByIdAny,
  create,
  update,
  archive,
  remove,
  toggleActive,
  countAll,
  findBySeller,
};
