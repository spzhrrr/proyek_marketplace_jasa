export function rupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

/** Label status pesanan (order) */
export function orderStatusLabel(s) {
  const map = {
    PENDING: "Menunggu konfirmasi penjual",
    ACCEPTED: "Disetujui — siap dibayar",
    REJECTED: "Ditolak penjual",
    IN_PROGRESS: "Sedang dikerjakan",
    COMPLETED: "Selesai",
    CANCELLED: "Dibatalkan",
  };
  return map[s] || s;
}

/** Label lamaran pekerjaan */
export function applicationStatusLabel(s) {
  const map = {
    PENDING: "Menunggu tinjauan pemberi kerja",
    ACCEPTED: "Diterima — menunggu pembayaran",
    REJECTED: "Ditolak",
  };
  return map[s] || s;
}

/** Label lowongan kerja */
export function jobStatusLabel(s) {
  const map = {
    OPEN: "Masih menerima pelamar",
    FILLED: "Sudah dapat pekerja",
    CLOSED: "Ditutup",
    CANCELLED: "Dibatalkan",
  };
  return map[s] || s;
}

/** Label bukti pengerjaan */
export function submissionStatusLabel(s) {
  const map = {
    SUBMITTED: "Menunggu persetujuan pembeli",
    APPROVED: "Disetujui pembeli",
    REVISION_REQUESTED: "Perlu diperbaiki penjual",
  };
  return map[s] || s;
}

/** Label pembayaran */
export function paymentStatusLabel(s) {
  const map = {
    PENDING: "Menunggu pembayaran",
    PAID: "Sudah dibayar",
    FAILED: "Gagal",
    EXPIRED: "Kedaluwarsa",
  };
  return map[s] || s;
}

/** @deprecated — gunakan orderStatusLabel / applicationStatusLabel */
export function statusLabel(s) {
  return orderStatusLabel(s);
}

/** Status dana — bahasa sederhana, tanpa istilah teknis */
export function escrowLabel(s) {
  const map = {
    UNPAID: "Belum dibayar",
    HELD: "Uang aman ditahan sistem",
    RELEASED: "Uang sudah cair ke penjual",
    REFUNDED: "Uang dikembalikan ke pembeli",
  };
  return map[s] || s;
}

export function orderStatusClass(s) {
  if (s === "COMPLETED" || s === "PAID") return "ok";
  if (s === "PENDING" || s === "SUBMITTED" || s === "ACCEPTED" || s === "IN_PROGRESS") return "wait";
  if (s === "REJECTED" || s === "CANCELLED" || s === "FAILED") return "bad";
  return "";
}

export function orderTotal(order) {
  return Number(order?.amount || 0) + Number(order?.platform_fee || 0);
}
