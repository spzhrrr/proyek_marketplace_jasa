import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { isBootstrapAdmin } from "../config/admin.js";

async function findByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

async function create(data) {
  const hash = await bcrypt.hash(data.password, 10);
  const role = isBootstrapAdmin(data.email) ? "ADMIN" : "USER";
  const [result] = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, ktp_status)
     VALUES (?, ?, ?, ?, ?, ?, 'NOT_SUBMITTED')`,
    [data.email, hash, data.first_name, data.last_name, data.phone, role]
  );
  return findById(result.insertId);
}

async function ensureBootstrapAdmin(email) {
  if (!isBootstrapAdmin(email)) return null;
  await pool.query("UPDATE users SET role = 'ADMIN' WHERE email = ?", [email.trim().toLowerCase()]);
  return findByEmail(email);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function saveEmailOtp(userId, otpHash, expiresAt) {
  await pool.query(
    "UPDATE users SET email_otp_hash = ?, email_otp_expires_at = ? WHERE id = ?",
    [otpHash, expiresAt, userId]
  );
}

async function verifyEmail(userId) {
  await pool.query(
    `UPDATE users SET email_verified_at = NOW(), email_otp_hash = NULL, email_otp_expires_at = NULL
     WHERE id = ?`,
    [userId]
  );
}

async function savePhoneOtp(userId, otpHash, expiresAt) {
  await pool.query(
    "UPDATE users SET phone_otp_hash = ?, phone_otp_expires_at = ? WHERE id = ?",
    [otpHash, expiresAt, userId]
  );
}

async function verifyPhone(userId) {
  await pool.query(
    `UPDATE users SET phone_verified_at = NOW(), phone_otp_hash = NULL, phone_otp_expires_at = NULL
     WHERE id = ?`,
    [userId]
  );
}

async function submitKtp(userId, data) {
  await pool.query(
    `UPDATE users SET
      ktp_number = ?,
      ktp_photo_url = ?,
      ktp_selfie_url = ?,
      ktp_status = 'PENDING',
      ktp_submitted_at = NOW(),
      ktp_verified_at = NULL,
      ktp_rejected_reason = NULL
     WHERE id = ?`,
    [data.ktp_number, data.ktp_photo_url, data.ktp_selfie_url, userId]
  );
}

async function findPendingKtp() {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, ktp_number, ktp_status,
            ktp_photo_url, ktp_selfie_url, ktp_submitted_at
     FROM users
     WHERE ktp_status = 'PENDING'
       AND ktp_photo_url IS NOT NULL
       AND ktp_selfie_url IS NOT NULL
     ORDER BY ktp_submitted_at DESC`
  );
  return rows;
}

async function approveKtp(userId) {
  await pool.query(
    `UPDATE users SET ktp_status = 'APPROVED', ktp_verified_at = NOW(), ktp_rejected_reason = NULL WHERE id = ?`,
    [userId]
  );
}

async function rejectKtp(userId, reason) {
  await pool.query(
    `UPDATE users SET ktp_status = 'REJECTED', ktp_rejected_reason = ? WHERE id = ?`,
    [reason, userId]
  );
}

async function countUsers() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'USER'");
  return rows[0].total;
}

async function countPendingKtp() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM users
     WHERE ktp_status = 'PENDING' AND ktp_photo_url IS NOT NULL AND ktp_selfie_url IS NOT NULL`,
  );
  return rows[0].total;
}

async function findAllForAdmin() {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, role,
            email_verified_at, phone_verified_at, ktp_status, ktp_submitted_at, created_at
     FROM users
     WHERE role = 'USER'
     ORDER BY created_at DESC
     LIMIT 200`,
  );
  return rows;
}

async function findKtpDetail(id) {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, ktp_number, ktp_status,
            ktp_photo_url, ktp_selfie_url, ktp_submitted_at, ktp_rejected_reason,
            email_verified_at, phone_verified_at
     FROM users
     WHERE id = ?
       AND ktp_status = 'PENDING'
       AND ktp_photo_url IS NOT NULL
       AND ktp_selfie_url IS NOT NULL`,
    [id],
  );
  return rows[0] || null;
}

async function findPublicProfile(id) {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, role, bio, city, province,
            profilepic_url, ktp_status, created_at
     FROM users WHERE id = ? AND is_active = 1`,
    [id],
  );
  return rows[0] || null;
}

async function updateProfile(userId, data) {
  await pool.query(
    `UPDATE users SET bio = ?, city = ?, province = ?, profilepic_url = COALESCE(?, profilepic_url)
     WHERE id = ?`,
    [data.bio || "", data.city || "", data.province || "", data.profilepic_url || null, userId],
  );
}

async function updateBank(userId, data) {
  await pool.query(
    `UPDATE users SET
      bank_name = ?,
      bank_account_number = ?,
      bank_account_holder = ?,
      bank_verified_at = NOW()
     WHERE id = ?`,
    [
      data.bank_name || "",
      data.bank_account_number || "",
      data.bank_account_holder || "",
      userId,
    ],
  );
}

export default {
  findByEmail,
  findById,
  create,
  ensureBootstrapAdmin,
  comparePassword,
  saveEmailOtp,
  verifyEmail,
  savePhoneOtp,
  verifyPhone,
  submitKtp,
  findPendingKtp,
  approveKtp,
  rejectKtp,
  countUsers,
  countPendingKtp,
  findAllForAdmin,
  findKtpDetail,
  findPublicProfile,
  updateProfile,
  updateBank,
};
