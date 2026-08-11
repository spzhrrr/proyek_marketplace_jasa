import jwt from "jsonwebtoken";
import { secret, expiresIn } from "../config/jwt.js";
import { fullName } from "./userDisplay.js";

export function signToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    name: fullName(user),
    role: user.role,
    ktp_status: user.ktp_status,
    email_verified_at: user.email_verified_at,
    phone_verified_at: user.phone_verified_at,
    phone: user.phone,
    ktp_rejected_reason: user.ktp_rejected_reason,
  };

  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, secret);
}

export function setAuthCookie(res, user) {
  const token = signToken(user);
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProd,
    sameSite: "lax",
  });
  return token;
}

export function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("token", { secure: isProd, sameSite: "lax" });
}
