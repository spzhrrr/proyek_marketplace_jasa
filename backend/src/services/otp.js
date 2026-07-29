import bcrypt from "bcryptjs";

const mockOtpStore = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, hash) {
  if (!hash) return false;
  return bcrypt.compare(otp, hash);
}

function getExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function isExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

function saveMockOtp(userId, type, otp) {
  mockOtpStore.set(`${userId}:${type}`, otp);
}

function getMockOtp(userId, type) {
  return mockOtpStore.get(`${userId}:${type}`) || null;
}

function clearMockOtp(userId, type) {
  mockOtpStore.delete(`${userId}:${type}`);
}

export {
  generateOtp,
  hashOtp,
  compareOtp,
  getExpiry,
  isExpired,
  saveMockOtp,
  getMockOtp,
  clearMockOtp,
};
