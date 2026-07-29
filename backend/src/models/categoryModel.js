import { pool } from "../config/db.js";

async function findRoots() {
  const [rows] = await pool.query(
    `SELECT id, name, url_code, type, description, sort_order
     FROM categories
     WHERE parent_id IS NULL AND is_active = 1
     ORDER BY sort_order, name`,
  );
  return rows;
}

async function findSubcategories(parentId) {
  const [rows] = await pool.query(
    `SELECT id, name, url_code, type, parent_id, description, sort_order
     FROM categories
     WHERE parent_id = ? AND is_active = 1
     ORDER BY sort_order, name`,
    [parentId],
  );
  return rows;
}

async function findAllSubcategories() {
  const [rows] = await pool.query(
    `SELECT id, name, url_code, type, parent_id, description, sort_order
     FROM categories
     WHERE parent_id IS NOT NULL AND is_active = 1
     ORDER BY sort_order, name`,
  );
  return rows;
}

async function getCategoryTree() {
  const roots = await findRoots();
  const subs = await findAllSubcategories();
  const tree = {};

  for (const root of roots) {
    tree[root.url_code] = subs
      .filter((s) => s.parent_id === root.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        url_code: s.url_code,
      }));
  }

  return { roots, tree };
}

async function findByUrlCode(urlCode) {
  const [rows] = await pool.query(
    "SELECT * FROM categories WHERE url_code = ? AND is_active = 1",
    [urlCode],
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [id]);
  return rows[0] || null;
}

async function isSubcategory(id) {
  const cat = await findById(id);
  return !!(cat && cat.parent_id);
}

export default {
  findRoots,
  findSubcategories,
  findAllSubcategories,
  getCategoryTree,
  findByUrlCode,
  findById,
  isSubcategory,
};
