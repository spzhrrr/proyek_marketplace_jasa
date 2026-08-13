import paymentModel from "../../models/transaction/paymentModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import notify from "../../utils/notify.js";
import { pool } from "../../config/db.js";
import walletLedger from "./walletLedger.js";

const TRUE_TERMINAL = new Set(["CANCELLED", "REJECTED", "COMPLETED"]);

async function creditBuyerRefund(conn, userId, paymentId, orderId, amount, note) {
  return walletLedger.applyLedgerEntry(conn, {
    userId,
    idempotencyKey: `PAYMENT_REFUND:payment:${paymentId}`,
    entryType: "PAYMENT_REFUND",
    amount: Number(amount || 0),
    orderId,
    note,
  });
}

/**
 * Terapkan pembayaran sukses.
 * - Hanya payment PENDING
 * - Aktivasi order + markPaid atomic
 * - Duplikat charge → kredit wallet (status REFUNDED), tanpa mengubah escrow order aktif/sengketa
 */
export async function applyPaymentSuccess(payment, gatewayTx, actorId) {
  if (!payment) return { applied: false, reason: "missing_payment" };
  if (payment.status === "PAID" || payment.status === "REFUNDED") {
    return { applied: false, reason: "already_processed" };
  }
  if (payment.status !== "PENDING") {
    return { applied: false, reason: "payment_not_pending" };
  }

  const payCode = gatewayTx?.transaction_code || payment.gateway_transaction_code;
  const payAmount = Number(payment.amount || 0);
  const expected = Number(payment.amount || 0);
  const received = Number(gatewayTx?.amount ?? payment.amount ?? 0);
  if (gatewayTx?.amount != null && received !== expected) {
    return { applied: false, reason: "amount_mismatch" };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [payRows] = await conn.query(
      "SELECT * FROM payments WHERE id = ? FOR UPDATE",
      [payment.id],
    );
    const lockedPay = payRows[0];
    if (!lockedPay || lockedPay.status !== "PENDING") {
      await conn.rollback();
      return { applied: false, reason: "payment_not_pending" };
    }

    const [orderRows] = await conn.query(
      "SELECT * FROM orders WHERE id = ? FOR UPDATE",
      [lockedPay.order_id],
    );
    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      return { applied: false, reason: "order_not_found" };
    }

    const [paidRows] = await conn.query(
      "SELECT id FROM payments WHERE order_id = ? AND status = 'PAID' AND id <> ? LIMIT 1",
      [order.id, lockedPay.id],
    );
    const hasOtherPaid = paidRows.length > 0;

    // Order sudah aktif / sengketa / selesai dengan escrow HELD/RELEASED
    // → payment ini surplus: kredit wallet, status REFUNDED (bukan PAID kedua)
    if (
      (order.status === "IN_PROGRESS" && order.escrow === "HELD") ||
      order.status === "DISPUTED" ||
      (hasOtherPaid && order.escrow !== "UNPAID")
    ) {
      if (hasOtherPaid || (order.status === "IN_PROGRESS" && order.escrow === "HELD") || order.status === "DISPUTED") {
        // Hanya refund jika sudah ada payment PAID lain, ATAU order sudah HELD (aktivasi sudah pakai payment lain)
        // Jika order HELD tapi belum ada PAID lain → ini payment aktivasi yang tertunda: mark PAID saja
        if (!hasOtherPaid && order.status === "IN_PROGRESS" && order.escrow === "HELD") {
          await conn.query(
            `UPDATE payments SET status = 'PAID', gateway_id = ?, paid_at = NOW(), updated_at = NOW()
             WHERE id = ? AND status = 'PENDING'`,
            [payCode, lockedPay.id],
          );
          await conn.commit();
          return { applied: false, reason: "order_already_active_marked_paid", order };
        }

        await conn.query(
          `UPDATE payments SET status = 'REFUNDED', gateway_id = ?, paid_at = NOW(), updated_at = NOW()
           WHERE id = ? AND status = 'PENDING'`,
          [payCode, lockedPay.id],
        );
        if (payAmount > 0) {
          await creditBuyerRefund(
            conn,
            order.buyer_id,
            lockedPay.id,
            order.id,
            payAmount,
            `Pembayaran surplus dikembalikan (order ${order.status})`,
          );
        }
        await conn.commit();

        await notify({
          userId: order.buyer_id,
          actorId: actorId || order.buyer_id,
          type: "PAYMENT_REFUNDED",
          title: "Pembayaran dikembalikan ke saldo",
          message: `Pembayaran ekstra untuk "${order.title}" masuk ke saldo wallet kamu.`,
          linkUrl: "/orders/" + order.id,
          referenceType: "order",
          referenceId: order.id,
        });
        return { applied: false, reason: "surplus_refunded", order };
      }
    }

    // Order terminal tanpa escrow HELD — late pay → refund wallet, jangan sentuh RELEASED
    if (TRUE_TERMINAL.has(order.status)) {
      await conn.query(
        `UPDATE payments SET status = 'REFUNDED', gateway_id = ?, paid_at = NOW(), updated_at = NOW()
         WHERE id = ? AND status = 'PENDING'`,
        [payCode, lockedPay.id],
      );
      if (payAmount > 0) {
        await creditBuyerRefund(
          conn,
          order.buyer_id,
          lockedPay.id,
          order.id,
          payAmount,
          `Pembayaran pada order ${order.status} dikembalikan`,
        );
      }
      if (order.escrow === "UNPAID") {
        await conn.query(
          "UPDATE orders SET escrow = 'REFUNDED', updated_at = NOW() WHERE id = ? AND escrow = 'UNPAID'",
          [order.id],
        );
      }
      await conn.commit();

      await notify({
        userId: order.buyer_id,
        actorId: actorId || order.buyer_id,
        type: "PAYMENT_REFUNDED",
        title: "Pembayaran dikembalikan ke saldo",
        message: `Pembayaran untuk "${order.title}" tidak bisa diterapkan (${order.status}). Dana masuk ke saldo wallet.`,
        linkUrl: "/orders/" + order.id,
        referenceType: "order",
        referenceId: order.id,
      });
      return { applied: false, reason: "order_terminal", order };
    }

    // Normal path: ACCEPTED + UNPAID
    if (!(order.status === "ACCEPTED" && order.escrow === "UNPAID")) {
      await conn.rollback();
      return { applied: false, reason: "order_not_payable", order };
    }

    const [act] = await conn.query(
      `UPDATE orders SET status = 'IN_PROGRESS', escrow = 'HELD', updated_at = NOW()
       WHERE id = ? AND status = 'ACCEPTED' AND escrow = 'UNPAID'`,
      [order.id],
    );
    if (!act.affectedRows) {
      await conn.rollback();
      return { applied: false, reason: "activation_failed", order };
    }

    await conn.query(
      `UPDATE payments SET status = 'PAID', gateway_id = ?, paid_at = NOW(), updated_at = NOW()
       WHERE id = ? AND status = 'PENDING'`,
      [payCode, lockedPay.id],
    );

    await conn.commit();

    const fresh = await orderModel.findById(order.id);
    await notifyPaymentSuccess(fresh, actorId || order.buyer_id);
    return { applied: true, order: fresh };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function notifyPaymentSuccess(order, actorId) {
  await notify({
    userId: order.seller_id,
    actorId,
    type: "PAYMENT_SUCCESS",
    title: "Pembayaran diterima",
    message: `Pembayaran untuk "${order.title}" berhasil. Silakan mulai pengerjaan.`,
    linkUrl: "/orders/" + order.id,
    referenceType: "order",
    referenceId: order.id,
  });
  await notify({
    userId: order.buyer_id,
    actorId,
    type: "PAYMENT_CONFIRMED",
    title: "Pembayaran berhasil",
    message: `Dana untuk "${order.title}" aman ditahan. Penyedia akan mulai mengerjakan.`,
    linkUrl: "/orders/" + order.id,
    referenceType: "order",
    referenceId: order.id,
  });
}

export default { applyPaymentSuccess };
