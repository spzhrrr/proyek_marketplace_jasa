import { pool } from "../../config/db.js";

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

/**
 * Buat / reuse payment PENDING untuk order — lock order row + unique pending.
 * Return { paymentId, reused, pending }.
 */
async function createOrReusePending(data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("SELECT id FROM orders WHERE id = ? FOR UPDATE", [data.order_id]);

    const [pendingRows] = await conn.query(
      `SELECT * FROM payments
       WHERE order_id = ? AND status = 'PENDING'
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [data.order_id],
    );
    const pending = pendingRows[0] || null;

    if (pending?.gateway_transaction_code) {
      await conn.commit();
      return { paymentId: pending.id, reused: true, pending };
    }

    if (pending) {
      await conn.query(
        `UPDATE payments SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?`,
        [pending.id],
      );
    }

    const [paidRows] = await conn.query(
      `SELECT id FROM payments WHERE order_id = ? AND status = 'PAID' LIMIT 1`,
      [data.order_id],
    );
    if (paidRows.length) {
      await conn.rollback();
      return { error: "Pesanan sudah dibayar", status: 400 };
    }

    const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [result] = await conn.query(
      `INSERT INTO payments
        (order_id, buyer_id, amount, platform_fee, gateway, gateway_transaction_code,
         payment_method, status, expired_at)
       VALUES (?, ?, ?, ?, 'INTERNAL_PG', NULL, ?, 'PENDING', ?)`,
      [
        data.order_id,
        data.buyer_id,
        data.amount,
        data.platform_fee,
        data.payment_method,
        expiredAt,
      ],
    );

    await conn.commit();
    return { paymentId: result.insertId, reused: false, pending: null };
  } catch (e) {
    await conn.rollback();
    if (e.code === "ER_DUP_ENTRY") {
      const existing = await findPendingByOrder(data.order_id);
      if (existing) {
        return { paymentId: existing.id, reused: true, pending: existing };
      }
    }
    throw e;
  } finally {
    conn.release();
  }
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
  createOrReusePending,
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
