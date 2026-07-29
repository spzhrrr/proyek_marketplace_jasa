import gatewayTransactionModel from "../models/gatewayTransactionModel.js";
import gatewayService from "../services/gatewayService.js";
import { getErrorMessage } from "../services/errorMessage.js";

function getApiKey(req) {
  return req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
}

async function requireMerchant(req, res, next) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(401).json({ error: "API key wajib (header X-Api-Key)" });
  }
  const merchant = await gatewayTransactionModel.findMerchantByApiKey(apiKey);
  if (!merchant) {
    return res.status(403).json({ error: "API key tidak valid" });
  }
  req.merchant = merchant;
  next();
}

async function insertTransaction(req, res) {
  try {
    const { external_ref, amount, payment_method, customer_name, customer_email, description } =
      req.body;
    if (!external_ref || !amount) {
      return res.status(400).json({ error: "external_ref dan amount wajib" });
    }
    const tx = await gatewayService.insertTransaction(req.merchant, {
      external_ref: String(external_ref),
      amount: parseInt(amount, 10),
      payment_method,
      customer_name,
      customer_email,
      description,
    });
    res.status(201).json({ transaction: tx });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

async function checkTransaction(req, res) {
  try {
    const tx = await gatewayService.checkTransaction(req.params.code);
    if (!tx) return res.status(404).json({ error: "Transaksi tidak ditemukan" });
    res.json({ transaction: tx });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

async function payTransaction(req, res) {
  try {
    const result = await gatewayService.payTransaction(req.params.code);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

async function failTransaction(req, res) {
  try {
    const result = await gatewayService.failTransaction(req.params.code);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

async function listTransactions(req, res) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: "Silakan login dulu" });
    }
    const list = await gatewayService.listTransactions(req.user.email);
    res.json({ transactions: list });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}

export default {
  requireMerchant,
  insertTransaction,
  checkTransaction,
  payTransaction,
  failTransaction,
  listTransactions,
};
