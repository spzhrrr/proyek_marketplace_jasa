import express from "express";
import paymentModel from "../models/transaction/paymentModel.js";
import gatewayClient from "../services/payment/gatewayClient.js";
import { MAIN_APP_URL } from "../config/gateway.js";
import { requireLoginApi } from "../middleware/apiGuards.js";

const router = express.Router();

router.get("/payments/lookup/:code", requireLoginApi, async (req, res) => {
  try {
    const payment = await paymentModel.findByGatewayCode(req.params.code);
    if (!payment) {
      return res.status(404).json({ error: "Payment tidak ditemukan" });
    }
    if (Number(payment.buyer_id) !== Number(req.user.id) && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak boleh akses" });
    }
    res.json({
      order_id: payment.order_id,
      payment_status: payment.status,
      return_url: `${MAIN_APP_URL}/orders/${payment.order_id}?ok=Pembayaran+berhasil`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/payments/sync/:code", requireLoginApi, async (req, res) => {
  try {
    const payment = await paymentModel.findByGatewayCode(req.params.code);
    if (!payment) return res.status(404).json({ error: "Not found" });
    if (Number(payment.buyer_id) !== Number(req.user.id) && req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak boleh akses" });
    }
    const tx = await gatewayClient.checkTransaction(req.params.code);
    res.json({
      payment: {
        id: payment.id,
        order_id: payment.order_id,
        status: payment.status,
        amount: payment.amount,
      },
      gateway: tx,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
