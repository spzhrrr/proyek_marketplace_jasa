export function rupiah(n) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

export function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "Baru saja";
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} menit lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatMemberSince(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDeadlineDate(value) {
  if (!value) return "Fleksibel";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fleksibel";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function todayInputDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Batas akhir lamaran (bukan estimasi kerja pelamar). */
export function applyWindowLabel(deadline, isUrgent) {
  if (isUrgent) return "Tutup hari ini";
  if (!deadline) return null;
  const ymd = String(deadline).slice(0, 10);
  const today = todayInputDate();
  if (ymd === today) return "Tutup hari ini";
  if (ymd < today) return "Lamaran ditutup";
  return `Lamar s.d. ${formatDeadlineDate(deadline)}`;
}

export function isJobUrgent(job) {
  return Boolean(job && (job.is_urgent === true || Number(job.is_urgent) === 1));
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
    DISPUTED: "Dalam sengketa",
  };
  return map[s] || s;
}

/** Label lamaran pekerjaan */
export function applicationStatusLabel(s, kind) {
  if (kind === "JOB_CLOSED") return "Lowongan ditutup";
  if (kind === "AUTO_FILLED") return "Tidak terpilih";
  if (kind === "AUTO_EXPIRED") return "Dibatalkan";
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

export function orderTotal(order) {
  return Number(order?.amount || 0) + Number(order?.platform_fee || 0);
}

const JASA_SKILL_SPLIT = /Keahlian\s*\/\s*Skill:\s*/i;

export function parseJasaSkills(description, extra) {
  const fromExtra = Array.isArray(extra)
    ? extra.map((s) => String(s).trim()).filter(Boolean)
    : typeof extra === "string"
      ? extra.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const text = String(description || "");
  const parts = text.split(JASA_SKILL_SPLIT);
  const fromDesc = parts.length > 1
    ? parts[1].split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([...fromExtra, ...fromDesc])];
}

export function stripJasaSkills(description) {
  return String(description || "").replace(/(?:\r?\n)+\s*Keahlian\s*\/\s*Skill:.*$/is, "").trim();
}

export function withJasaSkills(description, skills) {
  const clean = stripJasaSkills(description);
  if (!skills?.length) return clean;
  return `${clean}\n\nKeahlian / Skill: ${skills.join(", ")}`;
}

const JOB_SKILL_SPLIT = /Keahlian Dibutuhkan:\s*/i;

export function parseJobSkills(description, extra) {
  const fromExtra = Array.isArray(extra)
    ? extra.map((s) => String(s).trim()).filter(Boolean)
    : typeof extra === "string"
      ? extra.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const text = String(description || "");
  const parts = text.split(JOB_SKILL_SPLIT);
  const fromDesc = parts.length > 1
    ? parts[1].split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([...fromExtra, ...fromDesc])].slice(0, 5);
}

export function stripJobSkills(description) {
  return String(description || "").replace(/(?:\r?\n)+\s*Keahlian Dibutuhkan:.*$/is, "").trim();
}

export function portfolioDisplayName(url) {
  const raw = decodeURIComponent((url || "").split("/").pop() || "");
  if (!raw) return "Dokumen portofolio";
  const ext = (raw.split(".").pop() || "file").toLowerCase();
  if (/portfolio/i.test(raw)) return `Portofolio.${ext}`;
  return raw;
}
