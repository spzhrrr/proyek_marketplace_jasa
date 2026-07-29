import paymentModel from "../models/paymentModel.js";
import orderModel from "../models/orderModel.js";
import notify from "./notify.js";

const TERMINAL_ORDER = new Set(["CANCELLED", "REJECTED", "COMPLETED"]);

/**
 * Terapkan pembayaran sukses hanya jika pesanan masih siap dibayar.
 * Idempotent jika sudah IN_PROGRESS + HELD.
 */
export async function applyPaymentSuccess(payment, gatewayTx, actorId) {
  if (!payment || payment.status === "PAID") {
    return { applied: false, reason: "already_paid" };
  }

  const order = await orderModel.findById(payment.order_id);
  if (!order) return { applied: false, reason: "order_not_found" };

  if (order.status === "IN_PROGRESS" && order.escrow === "HELD") {
    await paymentModel.markPaid(payment.id, gatewayTx?.transaction_code || payment.gateway_transaction_code);
    return { applied: false, reason: "order_already_active", order };
  }

  if (TERMINAL_ORDER.has(order.status)) {
    await paymentModel.markPaid(payment.id, gatewayTx?.transaction_code || payment.gateway_transaction_code);
    if (order.escrow !== "REFUNDED" && order.escrow !== "RELEASED") {
      await orderModel.updateEscrow(order.id, "REFUNDED");
    }
    return { applied: false, reason: "order_terminal", order };
  }

  if (!orderModel.canPay(order)) {
    return { applied: false, reason: "order_not_payable", order };
  }

  const expected = Number(payment.amount || 0);
  const received = Number(gatewayTx?.amount ?? payment.amount ?? 0);
  if (gatewayTx?.amount != null && received !== expected) {
    return { applied: false, reason: "amount_mismatch", order };
  }

  const activated = await orderModel.activateAfterPayment(order.id);
  if (!activated) {
    return { applied: false, reason: "activation_failed", order };
  }

  await paymentModel.markPaid(payment.id, gatewayTx?.transaction_code || payment.gateway_transaction_code);

  const fresh = await orderModel.findById(order.id);
  await notifyPaymentSuccess(fresh, actorId || order.buyer_id);
  return { applied: true, order: fresh };
}

async function notifyPaymentSuccess(order, actorId) {
  await notify.notify({
    userId: order.seller_id,
    actorId,
    type: "PAYMENT_SUCCESS",
    title: "Pembayaran diterima",
    message: `Pembayaran untuk "${order.title}" berhasil. Silakan mulai pengerjaan.`,
    linkUrl: "/orders/" + order.id,
    referenceType: "order",
    referenceId: order.id,
  });
  await notify.notify({
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
