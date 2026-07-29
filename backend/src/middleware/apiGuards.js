import { isAdmin, isContactVerified, isKtpApproved, isSellerVerified } from "../services/verification.js";

export function requireLoginApi(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Silakan login dulu" });
  }
  next();
}

export function requireAdminApi(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Silakan login dulu" });
  }
  if (!isAdmin(req.user)) {
    return res.status(403).json({ ok: false, error: "Hanya admin yang boleh akses" });
  }
  next();
}

export function requireContactVerifiedApi(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Silakan login dulu" });
  }
  if (!isContactVerified(req.user)) {
    return res.status(403).json({ ok: false, error: "Verifikasi email & HP dulu", need: "contact" });
  }
  next();
}

export function requireKtpApprovedApi(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Silakan login dulu" });
  }
  if (!isContactVerified(req.user)) {
    return res.status(403).json({ ok: false, error: "Verifikasi email & HP dulu", need: "contact" });
  }
  if (!isKtpApproved(req.user)) {
    return res.status(403).json({ ok: false, error: "Verifikasi KTP dulu", need: "ktp" });
  }
  next();
}

export function requireSellerVerifiedApi(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Silakan login dulu" });
  }
  if (!isSellerVerified(req.user)) {
    if (!isContactVerified(req.user)) {
      return res.status(403).json({ ok: false, error: "Verifikasi email & HP dulu", need: "contact" });
    }
    if (!isKtpApproved(req.user)) {
      return res.status(403).json({ ok: false, error: "Verifikasi KTP dulu", need: "ktp" });
    }
    return res.status(403).json({
      ok: false,
      error: "Lengkapi dan verifikasi rekening bank dulu untuk post jasa",
      need: "bank",
    });
  }
  next();
}
