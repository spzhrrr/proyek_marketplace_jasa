import { pool } from "../config/db.js";

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO payouts
      (order_id, seller_id, amount, gateway, gateway_id, bank_account_masked, status, paid_at)
     VALUES (?, ?, ?, 'MOCK_TRANSFER', ?, ?, 'PAID', NOW())`,
    [
      data.order_id,
      data.seller_id,
      data.amount,
      data.gateway_id || `PAYOUT-${data.order_id}`,
      data.bank_account_masked || "****1234",
    ],
  );
  return result.insertId;
}

async function findByOrder(orderId) {
  const [rows] = await pool.query("SELECT * FROM payouts WHERE order_id = ?", [orderId]);
  return rows[0] || null;
}

async function findRecentBySeller(sellerId, limit = 20) {
  const [rows] = await pool.query(
    `SELECT p.*, o.order_number, o.title, o.source
     FROM payouts p
     JOIN orders o ON p.order_id = o.id
     WHERE p.seller_id = ?
     ORDER BY p.paid_at DESC
     LIMIT ?`,
    [sellerId, limit],
  );
  return rows;
}

async function getSummaryForSeller(sellerId) {
  const [[receivedRow]] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM payouts WHERE seller_id = ? AND status = 'PAID'`,
    [sellerId],
  );

  const [[heldRow]] = await pool.query(
    `SELECT COALESCE(SUM(seller_net_amount), 0) AS total, COUNT(*) AS count
     FROM orders
     WHERE seller_id = ? AND escrow = 'HELD'
       AND status IN ('IN_PROGRESS', 'ACCEPTED', 'DISPUTED')`,
    [sellerId],
  );

  const [[awaitingRow]] = await pool.query(
    `SELECT COALESCE(SUM(seller_net_amount), 0) AS total, COUNT(*) AS count
     FROM orders
     WHERE seller_id = ? AND status = 'ACCEPTED' AND escrow = 'UNPAID'`,
    [sellerId],
  );

  return {
    totalReceived: Number(receivedRow.total || 0),
    payoutCount: Number(receivedRow.count || 0),
    pendingHeld: Number(heldRow.total || 0),
    pendingHeldCount: Number(heldRow.count || 0),
    awaitingPayment: Number(awaitingRow.total || 0),
    awaitingPaymentCount: Number(awaitingRow.count || 0),
  };
}

export default { create, findByOrder, findRecentBySeller, getSummaryForSeller };
