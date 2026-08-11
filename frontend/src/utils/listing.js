/** Jasa uses is_active (0/1) in DB — not a status enum */
export function isJasaActive(item) {
  if (!item) return false;
  if (item.is_active === 1 || item.is_active === true) return true;
  if (item.status === "INACTIVE") return false;
  return item.is_active !== 0 && item.is_active !== false;
}

export function jasaStatusLabel(item) {
  return isJasaActive(item) ? "Aktif" : "Non-Aktif";
}

/** Lowongan uses status enum + is_active for catalog visibility */
export function isLowonganOpen(jobOrStatus) {
  if (jobOrStatus && typeof jobOrStatus === "object") {
    return jobOrStatus.status === "OPEN" && Number(jobOrStatus.is_active) !== 0;
  }
  return jobOrStatus === "OPEN";
}

export function isLowonganClosed(status) {
  return status === "CLOSED";
}

export function canEditLowongan(data) {
  return data?.status === "OPEN" && (data?.applicant_count || 0) === 0;
}
