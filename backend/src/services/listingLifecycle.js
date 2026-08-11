import { pool } from "../config/db.js";

const LIVE = "('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DISPUTED')";

function n(v) {
  return Number(v || 0);
}

export async function jasaLocks(serviceId) {
  const [[row]] = await pool.query(
    `SELECT
        SUM(status IN ${LIVE}) AS live_orders,
        COUNT(*) AS order_history
     FROM orders
     WHERE service_id = ?`,
    [serviceId],
  );
  const live = n(row?.live_orders);
  const history = n(row?.order_history);
  return {
    live_orders: live,
    order_history: history,
    can_edit: live === 0,
    can_toggle: live === 0,
    can_delete: live === 0,
    delete_mode: live > 0 ? "blocked" : history > 0 ? "archive" : "hard",
    lock_reason: live > 0
      ? "Masih ada permintaan sewa atau pesanan yang belum selesai. Proses dulu di Permintaan / Pesanan."
      : "",
  };
}

export async function jobLocks(jobId, job = {}) {
  const [[apps]] = await pool.query(
    `SELECT
        SUM(status = 'PENDING') AS pending,
        SUM(status = 'ACCEPTED') AS accepted,
        COUNT(*) AS total
     FROM applications
     WHERE job_id = ?`,
    [jobId],
  );
  const [[orders]] = await pool.query(
    `SELECT COUNT(*) AS live_orders
     FROM orders
     WHERE job_id = ? AND status IN ${LIVE}`,
    [jobId],
  );
  const pending = n(apps?.pending);
  const accepted = n(apps?.accepted);
  const totalApps = n(apps?.total);
  const live = n(orders?.live_orders);
  const filled = job.status === "FILLED";
  const cancelled = job.status === "CANCELLED";

  let lock_reason = "";
  if (cancelled) {
    lock_reason = "Lowongan sudah ditutup.";
  } else if (filled || live > 0 || accepted > 0) {
    lock_reason = "Pelamar sudah diterima atau proyek masih berjalan. Selesaikan pesanan dulu.";
  } else if (pending > 0) {
    lock_reason = "Masih ada lamaran menunggu. Terima, tolak, atau tutup lowongan (semua pelamar ditolak).";
  } else if (totalApps > 0) {
    lock_reason = "Lowongan sudah punya riwayat pelamar, jadi tidak bisa dihapus. Sembunyikan dari katalog jika perlu.";
  }

  return {
    pending_applications: pending,
    accepted_applications: accepted,
    live_orders: live,
    can_edit: job.status === "OPEN" && totalApps === 0 && live === 0,
    can_toggle: !filled && !cancelled && live === 0 && accepted === 0 && pending === 0,
    can_delete: totalApps === 0 && live === 0 && !filled && !cancelled,
    can_close: pending > 0 && accepted === 0 && live === 0 && !filled && !cancelled,
    lock_reason,
  };
}
