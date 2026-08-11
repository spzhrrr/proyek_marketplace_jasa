function isEmailVerified(user) {
  return !!user?.email_verified_at;
}

function isPhoneVerified(user) {
  return !!user?.phone_verified_at;
}

function isContactVerified(user) {
  return isEmailVerified(user) && isPhoneVerified(user);
}

function isKtpApproved(user) {
  return user?.ktp_status === "APPROVED";
}

function isBankVerified(user) {
  if (!user) return false;
  if (user.bank_status === "APPROVED") return true;
  return !!user.bank_verified_at;
}

function bankStatusOf(user) {
  if (!user) return "NOT_SUBMITTED";
  if (user.bank_status) return user.bank_status;
  return user.bank_verified_at ? "APPROVED" : "NOT_SUBMITTED";
}

function isTransactionVerified(user) {
  return isContactVerified(user) && isKtpApproved(user);
}

function isSellerVerified(user) {
  return isTransactionVerified(user) && isBankVerified(user);
}

function isAdmin(user) {
  return user?.role === "ADMIN";
}

export {
  isEmailVerified,
  isPhoneVerified,
  isContactVerified,
  isKtpApproved,
  isBankVerified,
  bankStatusOf,
  isTransactionVerified,
  isSellerVerified,
  isAdmin,
};
