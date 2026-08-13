import gatewayTransactionModel from "../../models/transaction/gatewayTransactionModel.js";
import { WEBHOOK_SECRET, MAIN_APP_URL } from "../../config/gateway.js";

async function callWebhook(transaction) {
  const url = `${MAIN_APP_URL}/api/webhooks/payment-gateway`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        transaction_code: transaction.transaction_code,
        external_ref: transaction.external_ref,
        status: transaction.status,
        amount: transaction.amount,
        paid_at: transaction.paid_at,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error("Webhook error:", error.message);
    return false;
  }
}

async function insertTransaction(merchant, payload) {
  return gatewayTransactionModel.create({
    merchant_id: merchant.id,
    external_ref: payload.external_ref,
    amount: payload.amount,
    payment_method: payload.payment_method,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    description: payload.description,
  });
}

async function checkTransaction(code) {
  return gatewayTransactionModel.findByCode(code);
}

async function payTransaction(code) {
  const tx = await gatewayTransactionModel.findByCode(code);
  if (!tx) return { error: "Transaksi tidak ditemukan" };
  if (tx.status === "PAID") return { transaction: tx, alreadyPaid: true };
  if (tx.status !== "PENDING") {
    return { error: "Transaksi tidak bisa dibayar (status: " + tx.status + ")" };
  }

  if (tx.expired_at && new Date(tx.expired_at) < new Date()) {
    await gatewayTransactionModel.updateStatus(code, "EXPIRED", "Transaksi expired");
    return { error: "Transaksi sudah expired" };
  }

  const updated = await gatewayTransactionModel.updateStatus(code, "PAID", "Pembayaran mock berhasil");
  await callWebhook(await gatewayTransactionModel.findByCode(code));
  return { transaction: updated };
}

async function failTransaction(code) {
  const tx = await gatewayTransactionModel.findByCode(code);
  if (!tx) return { error: "Transaksi tidak ditemukan" };
  if (tx.status !== "PENDING") return { error: "Transaksi sudah diproses" };

  const updated = await gatewayTransactionModel.updateStatus(code, "FAILED", "Pembayaran dibatalkan/gagal");
  await callWebhook(updated);
  return { transaction: updated };
}

export default {
  insertTransaction,
  checkTransaction,
  payTransaction,
  failTransaction,
  listTransactions: (email) =>
    email
      ? gatewayTransactionModel.findByCustomerEmail(email)
      : gatewayTransactionModel.findAll(0),
};
