import { pool } from "../../config/db.js";

function generateCode(id) {
  const d = new Date();
  const ymd =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return `TXN-${ymd}-${String(id).padStart(6, "0")}`;
}

async function findMerchantByApiKey(apiKey) {
  const [rows] = await pool.query(
    "SELECT * FROM pg_merchants WHERE api_key = ? AND is_active = 1 LIMIT 1",
    [apiKey],
  );
  return rows[0] || null;
}

async function findByCode(code) {
  const [rows] = await pool.query(
    `SELECT t.*, m.name AS merchant_name, m.code AS merchant_code
     FROM pg_transactions t
     JOIN pg_merchants m ON t.merchant_id = m.id
     WHERE t.transaction_code = ?`,
    [code],
  );
  return rows[0] || null;
}

async function findByCustomerEmail(email, limit = 50) {
  const [rows] = await pool.query(
    `SELECT t.*, m.name AS merchant_name
     FROM pg_transactions t
     JOIN pg_merchants m ON t.merchant_id = m.id
     WHERE t.customer_email = ?
     ORDER BY t.created_at DESC
     LIMIT ?`,
    [email, limit],
  );
  return rows;
}

async function findAll(limit = 100) {
  const [rows] = await pool.query(
    `SELECT t.*, m.name AS merchant_name
     FROM pg_transactions t
     JOIN pg_merchants m ON t.merchant_id = m.id
     ORDER BY t.created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows;
}

async function insertLog(transactionId, oldStatus, newStatus, note) {
  await pool.query(
    `INSERT INTO pg_transaction_logs (transaction_id, old_status, new_status, note)
     VALUES (?, ?, ?, ?)`,
    [transactionId, oldStatus, newStatus, note],
  );
}

async function create(data) {
  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [result] = await pool.query(
    `INSERT INTO pg_transactions
      (transaction_code, merchant_id, external_ref, amount, payment_method, status,
       customer_name, customer_email, description, expired_at)
     VALUES ('TEMP', ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
    [
      data.merchant_id,
      data.external_ref,
      data.amount,
      data.payment_method || null,
      data.customer_name || null,
      data.customer_email || null,
      data.description || null,
      expiredAt,
    ],
  );

  const code = generateCode(result.insertId);
  await pool.query("UPDATE pg_transactions SET transaction_code = ? WHERE id = ?", [
    code,
    result.insertId,
  ]);
  await insertLog(result.insertId, null, "PENDING", "Transaksi dibuat");

  return findByCode(code);
}

async function updateStatus(code, newStatus, note) {
  const tx = await findByCode(code);
  if (!tx) return null;

  const paidAt = newStatus === "PAID" ? new Date() : null;
  await pool.query(
    `UPDATE pg_transactions SET status = ?, paid_at = COALESCE(?, paid_at), updated_at = NOW()
     WHERE transaction_code = ?`,
    [newStatus, paidAt, code],
  );
  await insertLog(tx.id, tx.status, newStatus, note);
  return findByCode(code);
}

export default {
  findMerchantByApiKey,
  findByCode,
  findByCustomerEmail,
  findAll,
  create,
  updateStatus,
};
