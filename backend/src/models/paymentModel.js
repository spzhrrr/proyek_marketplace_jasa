import { pool } from "../config/db.js";

async function create(data) {
  const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [result] = await pool.query(
    `INSERT INTO payments
      (order_id, buyer_id, amount, platform_fee, gateway, gateway_transaction_code,
       payment_method, status, expired_at)
     VALUES (?, ?, ?, ?, 'INTERNAL_PG', ?, ?, 'PENDING', ?)`,
    [
      data.order_id,
      data.buyer_id,
      data.amount,
      data.platform_fee,
      data.gateway_transaction_code || null,
      data.payment_method,
      expiredAt,
    ],
  );
  return result.insertId;
}

async function updateGatewayCode(id, code) {
  await pool.query(
    "UPDATE payments SET gateway_transaction_code = ?, updated_at = NOW() WHERE id = ?",
    [code, id],
  );
}

async function findById(id) {
  const [rows] = await pool.query(
    `SELECT p.*, o.order_number, o.title AS order_title
     FROM payments p
     JOIN orders o ON p.order_id = o.id
     WHERE p.id = ?`,
    [id],
  );
  return rows[0] || null;
}

async function findByGatewayCode(code) {
  const [rows] = await pool.query("SELECT * FROM payments WHERE gateway_transaction_code = ?", [
    code,
  ]);
  return rows[0] || null;
}

async function findByOrder(orderId) {
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC",
    [orderId],
  );
  return rows;
}

async function findPaidByOrder(orderId) {
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'PAID' LIMIT 1",
    [orderId],
  );
  return rows[0] || null;
}

async function findPendingByOrder(orderId) {
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1",
    [orderId],
  );
  return rows[0] || null;
}

async function markPaid(id, gatewayId) {
  await pool.query(
    "UPDATE payments SET status = 'PAID', gateway_id = ?, paid_at = NOW(), updated_at = NOW() WHERE id = ?",
    [gatewayId, id],
  );
}

async function markFailed(id) {
  await pool.query(
    "UPDATE payments SET status = 'FAILED', updated_at = NOW() WHERE id = ?",
    [id],
  );
}

async function markExpired(id) {
  await pool.query(
    "UPDATE payments SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?",
    [id],
  );
}

export default {
  create,
  updateGatewayCode,
  findById,
  findByGatewayCode,
  findByOrder,
  findPaidByOrder,
  findPendingByOrder,
  markPaid,
  markFailed,
  markExpired,
};
