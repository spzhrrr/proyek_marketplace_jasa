import { pool } from "../config/db.js";
import walletLedger from "./walletLedger.js";
import notify from "./notify.js";

/**
 * Cairkan escrow ke seller (approve work / admin RELEASE).
 * Atomic + idempotent via payout unique + ledger key.
 */
export async function releaseEscrowToSeller({
  orderId,
  actorId,
  note = "",
  notifyBuyer = false,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      "SELECT * FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      return { ok: false, error: "Pesanan tidak ditemukan", status: 404 };
    }

    if (order.status === "COMPLETED" && order.escrow === "RELEASED") {
      const [payoutRows] = await conn.query(
        "SELECT id FROM payouts WHERE order_id = ? LIMIT 1",
        [orderId],
      );
      if (payoutRows.length) {
        await conn.commit();
        return { ok: true, already: true, order };
      }
    }

    if (!["IN_PROGRESS", "DISPUTED"].includes(order.status) || order.escrow !== "HELD") {
      await conn.rollback();
      return { ok: false, error: "Status pesanan tidak valid untuk pencairan", status: 400 };
    }

    const amount = Number(order.seller_net_amount || order.amount || 0);
    const ledgerKey = `PAYOUT_RELEASE:order:${orderId}`;

    const [sellerRows] = await conn.query(
      "SELECT bank_account_number FROM users WHERE id = ?",
      [order.seller_id],
    );
    const bankMasked = sellerRows[0]?.bank_account_number
      ? `****${String(sellerRows[0].bank_account_number).slice(-4)}`
      : undefined;

    try {
      await conn.query(
        `INSERT INTO payouts
          (order_id, seller_id, amount, gateway, gateway_id, bank_account_masked, status, paid_at)
         VALUES (?, ?, ?, 'MOCK_TRANSFER', ?, ?, 'PAID', NOW())`,
        [
          order.id,
          order.seller_id,
          amount,
          `PAYOUT-${order.id}`,
          bankMasked || "****0000",
        ],
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") {
        await conn.rollback();
        return { ok: true, already: true, order };
      }
      throw e;
    }

    await conn.query(
      `UPDATE orders SET status = 'COMPLETED', escrow = 'RELEASED',
       completed_at = COALESCE(completed_at, NOW()), updated_at = NOW(),
       cancel_reason = CASE WHEN ? <> '' THEN ? ELSE cancel_reason END
       WHERE id = ?`,
      [note, note, order.id],
    );

    const credited = await walletLedger.applyLedgerEntry(conn, {
      userId: order.seller_id,
      idempotencyKey: ledgerKey,
      entryType: "PAYOUT_RELEASE",
      amount,
      orderId: order.id,
      note: note || "Pencairan escrow ke seller",
    });
    if (!credited.ok) {
      await conn.rollback();
      return { ok: false, error: credited.error || "Gagal kredit wallet", status: 500 };
    }

    await conn.commit();

    const amountLabel = "Rp " + amount.toLocaleString("id-ID");
    await notify.notify({
      userId: order.seller_id,
      actorId,
      type: "ORDER_COMPLETED",
      title: "Pesanan selesai — dana masuk",
      message: `${amountLabel} sudah masuk ke saldo kamu.`,
      linkUrl: "/dashboard#pendapatan",
      referenceType: "order",
      referenceId: order.id,
    });

    if (notifyBuyer) {
      await notify.notify({
        userId: order.buyer_id,
        actorId,
        type: "DISPUTE_RESOLVED",
        title: "Komplain selesai — dana dicairkan ke penjual",
        message: `Admin meninjau sengketa pesanan ${order.order_number} dan mencairkan dana ke penjual.`,
        linkUrl: "/orders/" + order.id,
      });
    }

    return { ok: true, already: !!credited.already, order };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Refund escrow ke wallet buyer (admin REFUND / late payment terminal).
 * Idempotent via ledger key ORDER_REFUND:order:{id}.
 */
export async function refundEscrowToBuyer({
  orderId,
  actorId,
  reason = "",
  paymentAmount = null,
  requireDisputed = false,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      "SELECT * FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    const order = orderRows[0];
    if (!order) {
      await conn.rollback();
      return { ok: false, error: "Pesanan tidak ditemukan", status: 404 };
    }

    if (requireDisputed && order.status !== "DISPUTED") {
      await conn.rollback();
      return { ok: false, error: "Pesanan bukan dalam status sengketa", status: 400 };
    }

    if (order.escrow === "REFUNDED") {
      await conn.commit();
      return { ok: true, already: true, order };
    }

    if (order.escrow === "RELEASED") {
      await conn.rollback();
      return { ok: false, error: "Dana sudah dicairkan ke penjual, tidak bisa refund", status: 400 };
    }

    // Total yang dibayar buyer = amount + platform_fee (atau override dari payment)
    let refundAmount = paymentAmount != null
      ? Number(paymentAmount)
      : Number(order.amount || 0) + Number(order.platform_fee || 0);

    if (order.escrow === "UNPAID" && paymentAmount == null) {
      // Belum bayar — hanya ubah status, tanpa kredit wallet
      refundAmount = 0;
    }

    if (order.escrow === "HELD" || paymentAmount != null) {
      if (refundAmount > 0) {
        const credited = await walletLedger.applyLedgerEntry(conn, {
          userId: order.buyer_id,
          idempotencyKey: `ORDER_REFUND:order:${order.id}`,
          entryType: "ORDER_REFUND",
          amount: refundAmount,
          orderId: order.id,
          note: reason || "Refund ke buyer",
        });
        if (!credited.ok && !credited.already) {
          await conn.rollback();
          return { ok: false, error: credited.error || "Gagal refund wallet", status: 500 };
        }
      }
    }

    await conn.query(
      `UPDATE orders SET status = 'CANCELLED', escrow = 'REFUNDED',
       cancelled_at = COALESCE(cancelled_at, NOW()), updated_at = NOW(),
       cancel_reason = ?
       WHERE id = ?`,
      [reason || "Refund", order.id],
    );

    // Mirror unpaid cancel: dispute REFUND on JOB must reopen listing + free ACCEPTED app
    if (order.source === "JOB" && order.job_id) {
      await conn.query(
        `UPDATE jobs SET status = 'OPEN', updated_at = NOW()
         WHERE id = ? AND status IN ('FILLED', 'CLOSED', 'OPEN')`,
        [order.job_id],
      );
      if (order.application_id) {
        await conn.query(
          `UPDATE applications SET status = 'REJECTED', reviewed_at = NOW()
           WHERE id = ? AND status = 'ACCEPTED'`,
          [order.application_id],
        );
      }
    }

    await conn.commit();

    if (refundAmount > 0) {
      const amountLabel = "Rp " + refundAmount.toLocaleString("id-ID");
      await notify.notify({
        userId: order.buyer_id,
        actorId,
        type: "DISPUTE_RESOLVED",
        title: "Dana dikembalikan ke saldo",
        message: `${amountLabel} untuk pesanan ${order.order_number} sudah masuk ke saldo wallet kamu.`,
        linkUrl: "/orders/" + order.id,
      });
      await notify.notify({
        userId: order.seller_id,
        actorId,
        type: "DISPUTE_RESOLVED",
        title: "Sengketa: dana dikembalikan ke pembeli",
        message: `Admin merefund pesanan ${order.order_number}. Escrow tidak dicairkan ke kamu.`,
        linkUrl: "/orders/" + order.id,
      });
    }

    return { ok: true, order, refundAmount };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export default { releaseEscrowToSeller, refundEscrowToBuyer };
