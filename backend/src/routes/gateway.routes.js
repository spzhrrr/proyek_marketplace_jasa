import express from "express";
const router = express.Router();
import gatewayController from "../controllers/gateway.controller.js";

router.post(
  "/transactions",
  gatewayController.requireMerchant,
  gatewayController.insertTransaction,
);
router.get("/transactions", gatewayController.listTransactions);
router.get("/transactions/:code", gatewayController.checkTransaction);
router.post("/transactions/:code/pay", gatewayController.payTransaction);
router.post("/transactions/:code/fail", gatewayController.failTransaction);

export default router;
