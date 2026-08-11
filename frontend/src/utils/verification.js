export function isEmailVerified(user) {
  return !!user?.email_verified_at;
}

export function isPhoneVerified(user) {
  return !!user?.phone_verified_at;
}

export function isContactVerified(user) {
  return isEmailVerified(user) && isPhoneVerified(user);
}

export function isKtpApproved(user) {
  return user?.ktp_status === "APPROVED";
}

export function isBankVerified(user) {
  if (user?.bank_status === "APPROVED") return true;
  return !!user?.bank_verified_at;
}

export function bankStatusLabel(status) {
  const map = {
    NOT_SUBMITTED: "Belum diajukan",
    PENDING: "Menunggu review admin",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  };
  return map[status] || status;
}

export function needsVerification(user) {
  if (!user || user.role === "ADMIN") return false;
  return !isContactVerified(user) || !isKtpApproved(user);
}

export function needsSellerVerification(user) {
  if (!user || user.role === "ADMIN") return false;
  return needsVerification(user) || !isBankVerified(user);
}

export function ktpStatusLabel(status) {
  const map = {
    NOT_SUBMITTED: "Belum diunggah",
    PENDING: "Menunggu review admin",
    APPROVED: "Disetujui",
    REJECTED: "Ditolak",
  };
  return map[status] || status;
}
