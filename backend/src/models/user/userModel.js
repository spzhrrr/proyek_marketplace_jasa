import bcrypt from "bcryptjs";
import { pool } from "../../config/db.js";
import { isBootstrapAdmin } from "../../config/admin.js";

let bioColumnReady = false;

async function ensureBioLimit() {
  if (bioColumnReady) return;
  try {
    await pool.query("UPDATE users SET bio = LEFT(bio, 180) WHERE CHAR_LENGTH(COALESCE(bio, '')) > 180");
    await pool.query("ALTER TABLE users MODIFY bio VARCHAR(180) NULL");
  } catch {
    /* already applied or no privilege */
  }
  bioColumnReady = true;
}

async function findByEmail(email) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

async function findByPhone(phone) {
  const [rows] = await pool.query("SELECT * FROM users WHERE phone = ?", [phone]);
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
  const [result] = await pool.query(
    `UPDATE users SET
      ktp_name = COALESCE(?, CONCAT(first_name, ' ', last_name)),
      ktp_number = ?,
      ktp_birthplace = ?,
      ktp_birthdate = ?,
      ktp_gender = ?,
      ktp_address = ?,
      ktp_photo_url = ?,
      ktp_selfie_url = ?,
      ktp_status = 'PENDING',
      ktp_submitted_at = NOW(),
      ktp_verified_at = NULL,
      ktp_rejected_reason = NULL
     WHERE id = ? AND ktp_status IN ('NOT_SUBMITTED', 'REJECTED')`,
    [
      data.ktp_name || null,
      data.ktp_number,
      data.ktp_birthplace || null,
      data.ktp_birthdate || null,
      data.ktp_gender || "LAKI-LAKI",
      data.ktp_address || null,
      data.ktp_photo_url,
      data.ktp_selfie_url,
      userId,
    ]
  );
  return result.affectedRows > 0;
}

async function findPendingKtp() {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, ktp_name, ktp_number,
            ktp_birthplace, ktp_birthdate, ktp_gender, ktp_address, ktp_status,
            ktp_photo_url, ktp_selfie_url, ktp_submitted_at
     FROM users
     WHERE role = 'USER'
       AND ktp_status = 'PENDING'
       AND ktp_photo_url IS NOT NULL
       AND ktp_selfie_url IS NOT NULL
     ORDER BY ktp_submitted_at DESC`
  );
  return rows;
}

async function approveKtp(userId) {
  await pool.query(
    `UPDATE users SET ktp_status = 'APPROVED', ktp_verified_at = NOW(), ktp_rejected_reason = NULL
     WHERE id = ? AND role = 'USER'`,
    [userId]
  );
}

async function rejectKtp(userId, reason) {
  await pool.query(
    `UPDATE users SET ktp_status = 'REJECTED', ktp_rejected_reason = ? WHERE id = ? AND role = 'USER'`,
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
     WHERE role = 'USER'
       AND ktp_status = 'PENDING'
       AND ktp_photo_url IS NOT NULL
       AND ktp_selfie_url IS NOT NULL`,
  );
  return rows[0].total;
}

async function findAllForAdmin() {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, role, is_banned, is_active,
            email_verified_at, phone_verified_at, ktp_name, ktp_number, ktp_status, bank_status, ktp_submitted_at, created_at
     FROM users
     WHERE role = 'USER'
     ORDER BY created_at DESC
     LIMIT 500`,
  );
  return rows;
}

async function findAdminIds() {
  const [rows] = await pool.query(
    `SELECT id FROM users
     WHERE role = 'ADMIN' AND COALESCE(is_banned, 0) = 0`,
  );
  return rows.map((r) => r.id);
}

async function findAdminUserDetail(id) {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, role, bio, city, province,
              profilepic_url, wallet_balance, is_active, is_banned, created_at,
              email_verified_at, phone_verified_at,
              ktp_name, ktp_number, ktp_birthplace, ktp_birthdate, ktp_gender, ktp_address,
              ktp_status, ktp_photo_url, ktp_selfie_url, ktp_submitted_at, ktp_rejected_reason,
              bank_name, bank_account_number, bank_account_holder, bank_status,
              bank_submitted_at, bank_rejected_reason
       FROM users
       WHERE id = ? AND role = 'USER'`,
      [id],
    );
    return rows[0] || null;
  } catch (e) {
    console.error("findAdminUserDetail error:", e.message);
    return null;
  }
}

async function findKtpDetail(id) {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone, ktp_name, ktp_number,
            ktp_birthplace, ktp_birthdate, ktp_gender, ktp_address, ktp_status,
            ktp_photo_url, ktp_selfie_url, ktp_submitted_at, ktp_rejected_reason,
            email_verified_at, phone_verified_at
     FROM users
     WHERE id = ?
       AND role = 'USER'
       AND ktp_status = 'PENDING'
       AND ktp_photo_url IS NOT NULL
       AND ktp_selfie_url IS NOT NULL`,
    [id],
  );
  return rows[0] || null;
}

async function findPublicProfile(id) {
  await ensureBioLimit();
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, role, bio, city, province,
            profilepic_url, ktp_status, created_at
     FROM users
     WHERE id = ? AND role = 'USER' AND is_active = 1 AND COALESCE(is_banned, 0) = 0`,
    [id],
  );
  return rows[0] || null;
}

async function updateProfile(userId, data) {
  await ensureBioLimit();
  await pool.query(
    `UPDATE users SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      bio = ?,
      city = ?,
      province = ?,
      profilepic_url = CASE WHEN ? = 1 THEN NULL ELSE COALESCE(?, profilepic_url) END,
      updated_at = NOW()
     WHERE id = ?`,
    [
      data.first_name || null,
      data.last_name || null,
      data.bio || "",
      data.city || "",
      data.province || "",
      data.remove_photo ? 1 : 0,
      data.profilepic_url || null,
      userId,
    ],
  );
}

async function updateEmail(userId, email) {
  await pool.query(
    `UPDATE users SET email = ?, email_verified_at = NOW(),
      email_otp_hash = NULL, email_otp_expires_at = NULL, updated_at = NOW()
     WHERE id = ?`,
    [email, userId],
  );
}

async function updatePhone(userId, phone) {
  await pool.query(
    `UPDATE users SET phone = ?, phone_verified_at = NOW(),
      phone_otp_hash = NULL, phone_otp_expires_at = NULL, updated_at = NOW()
     WHERE id = ?`,
    [phone, userId],
  );
}

async function updatePassword(userId, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  await pool.query("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [hash, userId]);
}

async function updateBank(userId, data) {
  const [result] = await pool.query(
    `UPDATE users SET
      bank_name = ?,
      bank_account_number = ?,
      bank_account_holder = ?,
      bank_status = 'PENDING',
      bank_submitted_at = NOW(),
      bank_verified_at = NULL,
      bank_rejected_reason = NULL
     WHERE id = ? AND bank_status IN ('NOT_SUBMITTED', 'REJECTED')`,
    [
      data.bank_name || "",
      data.bank_account_number || "",
      data.bank_account_holder || "",
      userId,
    ],
  );
  return result.affectedRows > 0;
}

async function findPendingBank() {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone,
              bank_name, bank_account_number, bank_account_holder,
              bank_status, bank_submitted_at, ktp_name, ktp_status
       FROM users
       WHERE role = 'USER'
         AND bank_status = 'PENDING'
         AND bank_name IS NOT NULL AND bank_name != ''
       ORDER BY bank_submitted_at DESC`,
    );
    return rows;
  } catch (err) {
    console.error("findPendingBank error:", err.message);
    return [];
  }
}

async function findBankDetail(id) {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone,
              bank_name, bank_account_number, bank_account_holder,
              bank_status, bank_submitted_at, bank_rejected_reason,
              ktp_name, ktp_number, ktp_status, email_verified_at, phone_verified_at
       FROM users
       WHERE id = ? AND role = 'USER' AND bank_status = 'PENDING'`,
      [id],
    );
    return rows[0] || null;
  } catch (err) {
    console.error("findBankDetail error:", err.message);
    return null;
  }
}

async function approveBank(userId) {
  await pool.query(
    `UPDATE users SET
      bank_status = 'APPROVED',
      bank_verified_at = NOW(),
      bank_rejected_reason = NULL
     WHERE id = ? AND role = 'USER'`,
    [userId],
  );
}

async function rejectBank(userId, reason) {
  await pool.query(
    `UPDATE users SET
      bank_status = 'REJECTED',
      bank_verified_at = NULL,
      bank_rejected_reason = ?
     WHERE id = ? AND role = 'USER'`,
    [reason, userId],
  );
}

async function banUser(userId) {
  const [result] = await pool.query(
    "UPDATE users SET is_banned = 1, is_active = 0, updated_at = NOW() WHERE id = ? AND role = 'USER'",
    [userId],
  );
  return result.affectedRows > 0;
}

async function countPendingBank() {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE role = 'USER' AND bank_status = 'PENDING'`,
    );
    return rows[0]?.total || 0;
  } catch (err) {
    console.error("countPendingBank error:", err.message);
    return 0;
  }
}

export default {
  findByEmail,
  findByPhone,
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
  findAdminIds,
  findAdminUserDetail,
  findKtpDetail,
  findPublicProfile,
  updateProfile,
  updateEmail,
  updatePhone,
  updatePassword,
  updateBank,
  findPendingBank,
  findBankDetail,
  approveBank,
  rejectBank,
  countPendingBank,
  banUser,
};
