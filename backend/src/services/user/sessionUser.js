import { fullName } from "../../utils/userDisplay.js";
import { isProfileComplete } from "./profile.js";

function buildSessionUser(user) {
  if (!user) return null;

  const session = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    name: fullName(user),
    displayName: fullName(user),
    role: user.role,
    ktp_status: user.ktp_status,
    email_verified_at: user.email_verified_at,
    phone_verified_at: user.phone_verified_at,
    phone: user.phone,
    ktp_rejected_reason: user.ktp_rejected_reason,
    bio: user.bio || "",
    city: user.city || "",
    province: user.province || "",
    profilepic_url: user.profilepic_url || "",
    bank_name: user.bank_name || "",
    bank_account_number: user.bank_account_number || "",
    bank_account_holder: user.bank_account_holder || "",
    bank_verified_at: user.bank_verified_at || null,
    bank_status: user.bank_status || (user.bank_verified_at ? "APPROVED" : "NOT_SUBMITTED"),
    bank_rejected_reason: user.bank_rejected_reason || null,
  };

  session.profile_complete = isProfileComplete(session);
  return session;
}

export { buildSessionUser };
