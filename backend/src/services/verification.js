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
  return !!user?.bank_verified_at;
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
  isTransactionVerified,
  isSellerVerified,
  isAdmin,
};
