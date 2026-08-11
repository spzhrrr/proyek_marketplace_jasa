import { pool } from "../config/db.js";
import { generateOrderNumber } from "../services/orderNumber.js";

const PLATFORM_FEE_RATE = 0.05;

const listSelect = `
  SELECT o.*,
         CONCAT(buyer.first_name, ' ', buyer.last_name) AS buyer_name,
         buyer.profilepic_url AS buyer_avatar,
         CONCAT(seller.first_name, ' ', seller.last_name) AS seller_name,
         seller.profilepic_url AS seller_avatar,
         seller.city AS seller_city,
         seller.province AS seller_province,
         seller.bio AS seller_bio,
         seller.ktp_status AS seller_ktp_status,
         buyer.city AS buyer_city,
         buyer.ktp_status AS buyer_ktp_status,
         sv.title AS service_title,
         sv.cover_image_url AS service_cover,
         sv.delivery_days AS service_delivery_days,
         sv.description AS service_description,
         cat.type AS service_parent_type,
         cat.name AS service_category_name,
         j.title AS job_title,
         j.description AS job_description,
         jcat.name AS job_category_name
  FROM orders o
  JOIN users buyer ON o.buyer_id = buyer.id
  JOIN users seller ON o.seller_id = seller.id
  LEFT JOIN services sv ON o.service_id = sv.id
  LEFT JOIN categories cat ON sv.category_id = cat.id
  LEFT JOIN jobs j ON o.job_id = j.id
  LEFT JOIN categories jcat ON j.category_id = jcat.id
`;

function getTotalAmount(order) {
  return Number(order.amount || 0) + Number(order.platform_fee || 0);
}

async function findById(id) {
  const [rows] = await pool.query(listSelect + " WHERE o.id = ?", [id]);
  return rows[0] || null;
}

async function findByBuyer(userId) {
  const [rows] = await pool.query(
    listSelect + " WHERE o.buyer_id = ? ORDER BY o.created_at DESC",
    [userId],
  );
  return rows;
}

async function findByServiceId(serviceId) {
  const [rows] = await pool.query(
    listSelect + " WHERE o.service_id = ? AND o.source = 'SERVICE' ORDER BY o.created_at DESC",
    [serviceId],
  );
  return rows;
}

async function findIncomingServiceRequests(sellerId) {
  const [rows] = await pool.query(
    listSelect + " WHERE o.seller_id = ? AND o.source = 'SERVICE' ORDER BY o.created_at DESC",
    [sellerId],
  );
  return rows;
}

async function findBySeller(sellerId) {
  const [rows] = await pool.query(
    listSelect + " WHERE o.seller_id = ? ORDER BY o.created_at DESC",
    [sellerId],
  );
  return rows;
}

/** Buat pesanan jasa — cegah duplikat aktif (race-safe) */
async function createServiceRequestSafe(data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [active] = await conn.query(
      `SELECT id FROM orders
       WHERE buyer_id = ? AND service_id = ? AND source = 'SERVICE'
         AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED')
       LIMIT 1 FOR UPDATE`,
      [data.buyer_id, data.service_id],
    );
    if (active.length) {
      await conn.rollback();
      return { ok: false, error: "Kamu masih punya pesanan aktif untuk jasa ini" };
    }

    const platformFee = Math.round(data.amount * PLATFORM_FEE_RATE);
    const [result] = await conn.query(
      `INSERT INTO orders
        (order_number, source, buyer_id, seller_id, service_id, title, amount,
         platform_fee, seller_net_amount, status, escrow, buyer_note)
       VALUES (?, 'SERVICE', ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'UNPAID', ?)`,
      [
        "TEMP",
        data.buyer_id,
        data.seller_id,
        data.service_id,
        data.title,
        data.amount,
        platformFee,
        data.amount,
        data.buyer_note || "",
      ],
    );

    const orderNumber = generateOrderNumber(result.insertId);
    await conn.query("UPDATE orders SET order_number = ? WHERE id = ?", [
      orderNumber,
      result.insertId,
    ]);

    await conn.commit();
    return { ok: true, orderId: result.insertId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function createServiceRequest(data) {
  const platformFee = Math.round(data.amount * PLATFORM_FEE_RATE);
  const [result] = await pool.query(
    `INSERT INTO orders
      (order_number, source, buyer_id, seller_id, service_id, title, amount,
       platform_fee, seller_net_amount, status, escrow, buyer_note)
     VALUES (?, 'SERVICE', ?, ?, ?, ?, ?, ?, ?, 'PENDING', 'UNPAID', ?)`,
    [
      "TEMP",
      data.buyer_id,
      data.seller_id,
      data.service_id,
      data.title,
      data.amount,
      platformFee,
      data.amount,
      data.buyer_note || "",
    ],
  );

  const orderNumber = generateOrderNumber(result.insertId);
  await pool.query("UPDATE orders SET order_number = ? WHERE id = ?", [
    orderNumber,
    result.insertId,
  ]);

  return result.insertId;
}

async function createFromApplication(data) {
  const platformFee = Math.round(data.amount * PLATFORM_FEE_RATE);
  const [result] = await pool.query(
    `INSERT INTO orders
      (order_number, source, buyer_id, seller_id, job_id, application_id, title, amount,
       platform_fee, seller_net_amount, status, escrow, buyer_note)
     VALUES (?, 'JOB', ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 'UNPAID', ?)`,
    [
      "TEMP",
      data.buyer_id,
      data.seller_id,
      data.job_id,
      data.application_id,
      data.title,
      data.amount,
      platformFee,
      data.amount,
      data.buyer_note || "",
    ],
  );

  const orderNumber = generateOrderNumber(result.insertId);
  await pool.query("UPDATE orders SET order_number = ? WHERE id = ?", [
    orderNumber,
    result.insertId,
  ]);

  return result.insertId;
}

async function updateStatus(id, status, extra = {}) {
  const fields = ["status = ?", "updated_at = NOW()"];
  const params = [status];
  if (extra.cancel_reason !== undefined) {
    fields.push("cancel_reason = ?");
    params.push(extra.cancel_reason);
  }
  if (extra.cancelled_at) {
    fields.push("cancelled_at = NOW()");
  }
  params.push(id);
  await pool.query(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`, params);
}

async function markInProgress(id) {
  await pool.query(
    "UPDATE orders SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ?",
    [id],
  );
}

/** Aktivasi pesanan setelah bayar — hanya jika ACCEPTED + UNPAID */
async function activateAfterPayment(id) {
  const [result] = await pool.query(
    `UPDATE orders SET status = 'IN_PROGRESS', escrow = 'HELD', updated_at = NOW()
     WHERE id = ? AND status = 'ACCEPTED' AND escrow = 'UNPAID'`,
    [id],
  );
  return result.affectedRows > 0;
}

async function updateStatusIf(id, fromStatus, toStatus, extra = {}) {
  const fields = ["status = ?", "updated_at = NOW()"];
  const params = [toStatus];
  if (extra.cancel_reason !== undefined) {
    fields.push("cancel_reason = ?");
    params.push(extra.cancel_reason);
  }
  if (extra.cancelled_at) fields.push("cancelled_at = NOW()");
  params.push(id, fromStatus);
  const [result] = await pool.query(
    `UPDATE orders SET ${fields.join(", ")} WHERE id = ? AND status = ?`,
    params,
  );
  return result.affectedRows > 0;
}

async function hasActiveJobOrder(jobId) {
  const [rows] = await pool.query(
    `SELECT id FROM orders
     WHERE job_id = ? AND source = 'JOB'
       AND status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED')
     LIMIT 1`,
    [jobId],
  );
  return rows.length > 0;
}

async function markCompleted(id) {
  await pool.query(
    "UPDATE orders SET status = 'COMPLETED', escrow = 'RELEASED', completed_at = NOW(), updated_at = NOW() WHERE id = ?",
    [id],
  );
}

async function updateEscrow(id, escrow) {
  await pool.query("UPDATE orders SET escrow = ?, updated_at = NOW() WHERE id = ?", [
    escrow,
    id,
  ]);
}

function canPay(order) {
  return order.status === "ACCEPTED" && order.escrow === "UNPAID";
}

function canBuyerCancel(order) {
  if (order.status === "PENDING") return true;
  if (order.status === "ACCEPTED" && order.escrow === "UNPAID") return true;
  return false;
}

/** Dispute hanya saat dana ditahan & sedang dikerjakan */
function canDispute(order) {
  return order.status === "IN_PROGRESS" && order.escrow === "HELD";
}

async function findActiveServiceRequest(buyerId, serviceId) {
  const [rows] = await pool.query(
    `SELECT id, status FROM orders
     WHERE buyer_id = ? AND service_id = ? AND source = 'SERVICE'
       AND status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED')
     ORDER BY created_at DESC
     LIMIT 1`,
    [buyerId, serviceId],
  );
  return rows[0] || null;
}

async function hasPendingServiceRequest(buyerId, serviceId) {
  return !!(await findActiveServiceRequest(buyerId, serviceId));
}

async function cancelByBuyer(id, reason) {
  await updateStatus(id, "CANCELLED", { cancel_reason: reason || "", cancelled_at: true });
}

async function countAll() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM orders");
  return rows[0].total;
}

async function findAllAdmin(limit = 100) {
  return findAllAdminWithFilter("all", limit);
}

async function findAllAdminWithFilter(status = "all", limit = 100) {
  let sql = listSelect;
  const params = [];
  if (status && status !== "all") {
    sql += " WHERE o.status = ?";
    params.push(status);
  }
  sql += " ORDER BY o.created_at DESC LIMIT ?";
  params.push(limit);
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function findByUserHistory(userId) {
  try {
    const [asBuyer] = await pool.query(listSelect + " WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 50", [userId]).catch(() => [[]]);
    const [asSeller] = await pool.query(listSelect + " WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 50", [userId]).catch(() => [[]]);
    return { asBuyer: asBuyer || [], asSeller: asSeller || [] };
  } catch (e) {
    return { asBuyer: [], asSeller: [] };
  }
}

async function findCompletedAsSeller(sellerId, limit = 20) {
  const [rows] = await pool.query(
    listSelect + " WHERE o.seller_id = ? AND o.status = 'COMPLETED' ORDER BY o.completed_at DESC LIMIT ?",
    [sellerId, limit],
  );
  return rows;
}

async function findCompletedAsBuyer(buyerId, limit = 20) {
  const [rows] = await pool.query(
    listSelect + " WHERE o.buyer_id = ? AND o.status = 'COMPLETED' ORDER BY o.completed_at DESC LIMIT ?",
    [buyerId, limit],
  );
  return rows;
}

export default {
  findById,
  findByBuyer,
  findByServiceId,
  findIncomingServiceRequests,
  findBySeller,
  createServiceRequest,
  createServiceRequestSafe,
  createFromApplication,
  updateStatus,
  markInProgress,
  activateAfterPayment,
  updateStatusIf,
  hasActiveJobOrder,
  markCompleted,
  updateEscrow,
  canPay,
  canBuyerCancel,
  canDispute,
  getTotalAmount,
  findActiveServiceRequest,
  hasPendingServiceRequest,
  cancelByBuyer,
  countAll,
  findAllAdmin,
  findAllAdminWithFilter,
  findByUserHistory,
  findCompletedAsSeller,
  findCompletedAsBuyer,
  PLATFORM_FEE_RATE,
};
