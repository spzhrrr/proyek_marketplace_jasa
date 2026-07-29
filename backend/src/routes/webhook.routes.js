import express from "express";
const router = express.Router();
import webhookController from "../controllers/webhook.controller.js";

router.post("/payment-gateway", webhookController.paymentGatewayWebhook);

export default router;
