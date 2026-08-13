import { MERCHANT_API_KEY, GATEWAY_FRONTEND_URL, MAIN_APP_URL } from "../../config/gateway.js";

const GATEWAY_API = `${MAIN_APP_URL}/gateway/api`;

async function insertTransaction(payload) {
  const res = await fetch(`${GATEWAY_API}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": MERCHANT_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Gagal buat transaksi gateway");
  return data.transaction;
}

async function checkTransaction(code) {
  const res = await fetch(`${GATEWAY_API}/transactions/${code}`);
  const data = await res.json();
  if (!res.ok) return null;
  return data.transaction;
}

async function failTransaction(code) {
  const res = await fetch(`${GATEWAY_API}/transactions/${code}/fail`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || "Gagal batalkan transaksi gateway" };
  return { ok: true, ...data };
}

function getPayUrl(transactionCode) {
  return `${GATEWAY_FRONTEND_URL}/gateway/pay/${transactionCode}`;
}

export default { insertTransaction, checkTransaction, failTransaction, getPayUrl };
