export const BOOTSTRAP_ADMIN_EMAILS = ["admin@mail.com"];

export function isBootstrapAdmin(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BOOTSTRAP_ADMIN_EMAILS.includes(normalized);
}
