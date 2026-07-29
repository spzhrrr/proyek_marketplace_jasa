import { needsVerification } from "./verification.js";

export function isProfileComplete(user) {
  if (!user || user.role === "ADMIN") return true;
  if (user.profile_complete === true) return true;
  return !!(
    user.profilepic_url &&
    String(user.bio || "").trim() &&
    String(user.city || "").trim() &&
    String(user.province || "").trim()
  );
}

export function postAuthPath(user) {
  if (!user) return "/login";
  if (user.role === "ADMIN") return "/admin";
  if (!isProfileComplete(user)) return "/lengkapi-profil";
  if (needsVerification(user)) return "/verify";
  return "/dashboard";
}
