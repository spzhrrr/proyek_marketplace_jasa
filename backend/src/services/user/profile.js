export function isProfileComplete(user) {
  if (!user || user.role === "ADMIN") return true;
  return !!(
    user.profilepic_url &&
    String(user.bio || "").trim() &&
    String(user.city || "").trim() &&
    String(user.province || "").trim()
  );
}
