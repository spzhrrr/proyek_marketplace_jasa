import { pool } from "../config/db.js";
import applicationModel from "../models/applicationModel.js";
import jobModel from "../models/jobModel.js";
import orderModel from "../models/orderModel.js";
import { generateOrderNumber } from "../services/orderNumber.js";

const PLATFORM_FEE_RATE = 0.05;

/**
 * Terima lamaran secara atomik: cek job OPEN, tolak yang lain, buat order, isi job.
 */
export async function acceptApplication(appId, buyerId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [appRows] = await conn.query(
      `SELECT a.*, j.title AS job_title, j.buyer_id, j.status AS job_status
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ? FOR UPDATE`,
      [appId],
    );
    const app = appRows[0];
    if (!app) {
      await conn.rollback();
      return { ok: false, status: 404, error: "Lamaran tidak ditemukan" };
    }
    if (uid(app.buyer_id) !== uid(buyerId)) {
      await conn.rollback();
      return { ok: false, status: 403, error: "Tidak boleh akses" };
    }
    if (app.status !== "PENDING") {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lamaran sudah diproses" };
    }
    if (app.job_status !== "OPEN") {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lowongan sudah tidak menerima pelamar" };
    }

    const [existingOrder] = await conn.query(
      `SELECT id FROM orders WHERE job_id = ? AND source = 'JOB'
       AND status IN ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED') LIMIT 1`,
      [app.job_id],
    );
    if (existingOrder.length) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lowongan ini sudah punya pekerja terpilih" };
    }

    const [others] = await conn.query(
      `SELECT a.id, a.seller_id, j.title AS job_title
       FROM applications a JOIN jobs j ON a.job_id = j.id
       WHERE a.job_id = ? AND a.id != ? AND a.status = 'PENDING'`,
      [app.job_id, app.id],
    );

    await conn.query(
      "UPDATE applications SET status = 'ACCEPTED', reviewed_at = NOW() WHERE id = ?",
      [app.id],
    );
    await conn.query(
      `UPDATE applications SET status = 'REJECTED', reviewed_at = NOW()
       WHERE job_id = ? AND id != ? AND status = 'PENDING'`,
      [app.job_id, app.id],
    );

    const [jobUpdate] = await conn.query(
      "UPDATE jobs SET status = 'FILLED', updated_at = NOW() WHERE id = ? AND status = 'OPEN'",
      [app.job_id],
    );
    if (!jobUpdate.affectedRows) {
      await conn.rollback();
      return { ok: false, status: 400, error: "Lowongan sudah tidak tersedia" };
    }

    const amount = app.proposed_price;
    const platformFee = Math.round(amount * PLATFORM_FEE_RATE);
    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (order_number, source, buyer_id, seller_id, job_id, application_id, title, amount,
         platform_fee, seller_net_amount, status, escrow, buyer_note)
       VALUES ('TEMP', 'JOB', ?, ?, ?, ?, ?, ?, ?, ?, 'ACCEPTED', 'UNPAID', ?)`,
      [
        app.buyer_id,
        app.seller_id,
        app.job_id,
        app.id,
        app.job_title,
        amount,
        platformFee,
        amount,
        app.cover_letter || "",
      ],
    );
    const orderId = orderResult.insertId;
    const orderNumber = generateOrderNumber(orderId);
    await conn.query("UPDATE orders SET order_number = ? WHERE id = ?", [orderNumber, orderId]);

    await conn.commit();
    return { ok: true, orderId, app, rejectedOthers: others };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

function uid(v) {
  return Number(v);
}

export default { acceptApplication };
