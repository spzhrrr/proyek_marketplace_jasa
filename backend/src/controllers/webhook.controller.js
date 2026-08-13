import paymentModel from "../models/transaction/paymentModel.js";
import { applyPaymentSuccess } from "../services/payment/paymentFlow.js";
import { WEBHOOK_SECRET } from "../config/gateway.js";
import { getErrorMessage } from "../utils/errorMessage.js";

async function paymentGatewayWebhook(req, res) {
  try {
    const secret = req.headers["x-webhook-secret"];
    if (secret !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: "Webhook secret invalid" });
    }

    const { transaction_code, external_ref, status, amount } = req.body;
    if (!external_ref || !status) {
      return res.status(400).json({ error: "Payload tidak lengkap" });
    }

    const payment = await paymentModel.findById(parseInt(external_ref, 10));
    if (!payment) {
      return res.status(404).json({ error: "Payment tidak ditemukan" });
    }

    if (status === "PAID") {
      await applyPaymentSuccess(payment, { transaction_code, amount }, null);
    }

    if (status === "FAILED" && payment.status === "PENDING") {
      await paymentModel.markFailed(payment.id);
    }

    if (status === "EXPIRED" && payment.status === "PENDING") {
      await paymentModel.markExpired(payment.id);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

export default { paymentGatewayWebhook };
