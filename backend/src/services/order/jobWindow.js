export function toYmd(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isTruthyFlag(v) {
  return v === true || v === 1 || v === "1" || v === "true" || v === "on";
}

export function isApplyWindowOpen(job) {
  if (!job || String(job.status) !== "OPEN") return false;
  const d = toYmd(job.deadline);
  if (!d) return true;
  return d >= todayYmd();
}

/** Batas lamaran diisi pemberi kerja. Urgent = butuh dikerjakan hari ini, jendela tutup malam ini. */
export function normalizeJobWindow({ batas_waktu, deadline, is_urgent }) {
  const urgent = isTruthyFlag(is_urgent);
  const today = todayYmd();
  let date = toYmd(batas_waktu || deadline);
  if (urgent) date = today;
  if (date && date < today) {
    return { error: "Batas akhir lamaran tidak boleh di masa lalu" };
  }
  return { is_urgent: urgent ? 1 : 0, deadline: date || null };
}
