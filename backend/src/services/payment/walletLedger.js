import { pool } from "../../config/db.js";

/**
 * Kredit/debit wallet dengan ledger idempotent.
 * amount > 0 = kredit, amount < 0 = debit (harus cukup saldo ledger-aware).
 * Jika idempotency_key sudah ada → return { ok: true, already: true }.
 */
async function applyLedgerEntry(conn, {
  userId,
  idempotencyKey,
  entryType,
  amount,
  orderId = null,
  withdrawalId = null,
  note = null,
}) {
  const [existing] = await conn.query(
    "SELECT id FROM wallet_ledger WHERE idempotency_key = ? LIMIT 1",
    [idempotencyKey],
  );
  if (existing.length) {
    return { ok: true, already: true };
  }

  const [rows] = await conn.query(
    "SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE",
    [userId],
  );
  if (!rows.length) {
    return { ok: false, error: "User tidak ditemukan" };
  }

  const current = Number(rows[0].wallet_balance || 0);
  const next = current + Number(amount);
  if (next < 0) {
    return { ok: false, error: "Saldo tidak mencukupi" };
  }

  await conn.query("UPDATE users SET wallet_balance = ? WHERE id = ?", [next, userId]);
  await conn.query(
    `INSERT INTO wallet_ledger
      (user_id, idempotency_key, entry_type, amount, order_id, withdrawal_id, balance_after, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, idempotencyKey, entryType, amount, orderId, withdrawalId, next, note],
  );

  return { ok: true, already: false, balance: next };
}

/** Rincian kredit wallet per tipe (untuk label UI, bukan untuk withdraw). */
async function getCreditBreakdown(userId) {
  const [rows] = await pool.query(
    `SELECT entry_type, COALESCE(SUM(amount), 0) AS total
     FROM wallet_ledger
     WHERE user_id = ? AND amount > 0
     GROUP BY entry_type`,
    [userId],
  );
  let fromSellerPayouts = 0;
  let fromBuyerRefunds = 0;
  let fromOtherCredits = 0;
  for (const row of rows || []) {
    const amt = Number(row.total || 0);
    if (row.entry_type === "PAYOUT_RELEASE") fromSellerPayouts += amt;
    else if (row.entry_type === "ORDER_REFUND") fromBuyerRefunds += amt;
    else if (row.entry_type === "WITHDRAWAL_REJECT") fromOtherCredits += amt;
    else fromOtherCredits += amt;
  }
  return { fromSellerPayouts, fromBuyerRefunds, fromOtherCredits };
}

export default { applyLedgerEntry, getCreditBreakdown };
