import { pool } from "../config/db.js";
import gatewayClient from "./gatewayClient.js";
import notify from "./notify.js";

/** SERVICE PENDING tanpa respons seller */
export const PENDING_ACCEPT_HOURS = 72;
/** ACCEPTED + UNPAID tanpa bayar */
export const UNPAID_PAY_HOURS = 48;

/**
 * Batalkan order unpaid (PENDING/ACCEPTED) dalam transaksi yang sudah dibuka.
 * Juga reopen JOB + expire payment PENDING.
 */
export async function cancelUnpaidOrderInTx(conn, order, reason) {
  const [paidRows] = await conn.query(
    "SELECT id FROM payments WHERE order_id = ? AND status = 'PAID' LIMIT 1",
    [order.id],
  );
  if (paidRows.length) {
    return { ok: false, error: "Pesanan sudah dibayar" };
  }

  const [cancelResult] = await conn.query(
    `UPDATE orders SET status = 'CANCELLED', cancel_reason = ?, cancelled_at = NOW(), updated_at = NOW()
     WHERE id = ? AND status IN ('PENDING', 'ACCEPTED') AND escrow = 'UNPAID'`,
    [reason, order.id],
  );
  if (!cancelResult.affectedRows) {
    return { ok: false, error: "Status pesanan sudah berubah" };
  }

  if (order.source === "JOB" && order.job_id) {
    await conn.query(
      `UPDATE jobs SET status = 'OPEN', updated_at = NOW()
       WHERE id = ? AND status IN ('FILLED', 'CLOSED', 'OPEN')`,
      [order.job_id],
    );
    if (order.application_id) {
      await conn.query(
        `UPDATE applications SET status = 'REJECTED', reviewed_at = NOW(),
           reject_reason = 'Rekrutmen dibatalkan karena pembayaran tidak diselesaikan.',
           reject_kind = 'AUTO_EXPIRED'
         WHERE id = ? AND status = 'ACCEPTED'`,
        [order.application_id],
      );
    }
  }

  const [pendingRows] = await conn.query(
    "SELECT * FROM payments WHERE order_id = ? AND status = 'PENDING'",
    [order.id],
  );
  for (const pending of pendingRows) {
    await conn.query(
      "UPDATE payments SET status = 'EXPIRED', updated_at = NOW() WHERE id = ?",
      [pending.id],
    );
  }

  return { ok: true, pendingPayments: pendingRows };
}

async function failGatewayPayments(pendingPayments) {
  for (const pending of pendingPayments || []) {
    if (pending.gateway_transaction_code) {
      await gatewayClient.failTransaction(pending.gateway_transaction_code).catch(() => null);
    }
  }
}

/**
 * Lazy expiry: batalkan order yang melewati batas waktu.
 * Dipanggil dari dashboard / orderShow / payment — tanpa cron.
 */
export async function expireStaleOrders({ limit = 40 } = {}) {
  const [pendingStale] = await pool.query(
    `SELECT * FROM orders
     WHERE status = 'PENDING' AND escrow = 'UNPAID'
       AND created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY created_at ASC
     LIMIT ?`,
    [PENDING_ACCEPT_HOURS, limit],
  );

  const [acceptedStale] = await pool.query(
    `SELECT * FROM orders
     WHERE status = 'ACCEPTED' AND escrow = 'UNPAID'
       AND updated_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY updated_at ASC
     LIMIT ?`,
    [UNPAID_PAY_HOURS, limit],
  );

  let expired = 0;

  for (const candidate of [...pendingStale, ...acceptedStale]) {
    const reason =
      candidate.status === "PENDING"
        ? `Otomatis dibatalkan: penjual tidak merespons dalam ${PENDING_ACCEPT_HOURS} jam`
        : `Otomatis dibatalkan: pembayaran tidak diselesaikan dalam ${UNPAID_PAY_HOURS} jam`;

    const conn = await pool.getConnection();
    let pendingPayments = [];
    let locked = null;
    try {
      await conn.beginTransaction();
      const [lockedRows] = await conn.query(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [candidate.id],
      );
      locked = lockedRows[0];
      if (
        !locked ||
        locked.escrow !== "UNPAID" ||
        !["PENDING", "ACCEPTED"].includes(locked.status)
      ) {
        await conn.rollback();
        continue;
      }

      const result = await cancelUnpaidOrderInTx(conn, locked, reason);
      if (!result.ok) {
        await conn.rollback();
        continue;
      }
      pendingPayments = result.pendingPayments || [];
      await conn.commit();
      expired += 1;
    } catch {
      await conn.rollback();
      continue;
    } finally {
      conn.release();
    }

    await failGatewayPayments(pendingPayments);

    if (locked) {
      await notify.notify({
        userId: locked.buyer_id,
        actorId: null,
        type: "ORDER_CANCELLED",
        title: "Pesanan dibatalkan otomatis",
        message: reason,
        linkUrl: "/orders/" + locked.id,
        referenceType: "order",
        referenceId: locked.id,
      });
      await notify.notify({
        userId: locked.seller_id,
        actorId: null,
        type: "ORDER_CANCELLED",
        title: "Pesanan dibatalkan otomatis",
        message: reason,
        linkUrl: "/orders/" + locked.id,
        referenceType: "order",
        referenceId: locked.id,
      });
    }
  }

  return { expired };
}

export default {
  PENDING_ACCEPT_HOURS,
  UNPAID_PAY_HOURS,
  cancelUnpaidOrderInTx,
  expireStaleOrders,
};
