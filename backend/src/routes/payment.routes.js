import express from "express";
const router = express.Router();
import paymentModel from "../models/paymentModel.js";
import gatewayClient from "../services/gatewayClient.js";
import { MAIN_APP_URL } from "../config/gateway.js";

router.get("/payments/lookup/:code", async (req, res) => {
  try {
    const payment = await paymentModel.findByGatewayCode(req.params.code);
    if (!payment) {
      return res.status(404).json({ error: "Payment tidak ditemukan" });
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

router.get("/payments/sync/:code", async (req, res) => {
  try {
    const payment = await paymentModel.findByGatewayCode(req.params.code);
    if (!payment) return res.status(404).json({ error: "Not found" });
    const tx = await gatewayClient.checkTransaction(req.params.code);
    res.json({ payment, gateway: tx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
