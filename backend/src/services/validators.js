function validateEmail(email) {
  const errors = [];
  if (!email || typeof email !== "string") {
    errors.push("Email wajib diisi");
    return errors;
  }

  const value = email.trim().toLowerCase();

  if (value.length === 0) errors.push("Email wajib diisi");
  if (value.indexOf(" ") !== -1) errors.push("Email tidak boleh mengandung spasi");

  const atPos = value.indexOf("@");
  if (atPos <= 0) errors.push("Email harus memiliki teks sebelum @");
  if (atPos === value.length - 1) errors.push("Email harus memiliki domain setelah @");

  const domain = atPos > 0 ? value.slice(atPos + 1) : "";
  if (domain.indexOf(".") <= 0) errors.push("Domain email harus memiliki titik (contoh: mail.com)");
  if (domain.startsWith(".") || domain.endsWith(".")) errors.push("Format domain email tidak valid");

  const local = atPos > 0 ? value.slice(0, atPos) : "";
  if (local.length > 64) errors.push("Bagian sebelum @ maksimal 64 karakter");
  if (value.length > 255) errors.push("Email maksimal 255 karakter");

  return errors;
}

function validatePassword(password) {
  const errors = [];
  if (!password || typeof password !== "string") {
    errors.push("Password wajib diisi");
    return errors;
  }

  if (password.length < 8) errors.push("Password minimal 8 karakter");
  if (password.length > 72) errors.push("Password maksimal 72 karakter");

  let hasUpper = false;
  let hasLower = false;
  let hasNumber = false;
  let hasSymbol = false;

  for (let i = 0; i < password.length; i++) {
    const ch = password[i];
    const code = ch.charCodeAt(0);

    if (code >= 65 && code <= 90) hasUpper = true;
    else if (code >= 97 && code <= 122) hasLower = true;
    else if (code >= 48 && code <= 57) hasNumber = true;
    else hasSymbol = true;
  }

  if (!hasUpper) errors.push("Password harus ada huruf besar (A-Z)");
  if (!hasLower) errors.push("Password harus ada huruf kecil (a-z)");
  if (!hasNumber) errors.push("Password harus ada angka (0-9)");
  if (!hasSymbol) errors.push("Password harus ada simbol (!@#$ dll)");

  return errors;
}

function validateName(value, label) {
  const errors = [];
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    errors.push(label + " wajib diisi");
    return errors;
  }

  const trimmed = value.trim();
  if (trimmed.length < 2) errors.push(label + " minimal 2 karakter");
  if (trimmed.length > 60) errors.push(label + " maksimal 60 karakter");

  return errors;
}

function validatePhone(phone) {
  const errors = [];
  if (!phone || typeof phone !== "string") {
    errors.push("Nomor HP wajib diisi");
    return errors;
  }

  let digits = "";
  const raw = phone.trim();

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "+" && digits.length === 0) continue;
    if (ch === " " || ch === "-") continue;
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) digits += ch;
    else errors.push("Nomor HP hanya boleh angka, spasi, strip, dan + di awal");
  }

  if (digits.length < 10) errors.push("Nomor HP minimal 10 digit");
  if (digits.length > 15) errors.push("Nomor HP maksimal 15 digit");

  return errors;
}

function normalizePhone(phone) {
  let digits = "";
  const raw = phone.trim();
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "+" && digits.length === 0) {
      digits += ch;
      continue;
    }
    if (ch === " " || ch === "-") continue;
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) digits += ch;
  }
  if (digits.startsWith("0")) digits = "+62" + digits.slice(1);
  if (!digits.startsWith("+")) digits = "+62" + digits;
  return digits;
}

function validateKtpNumber(ktpNumber) {
  const errors = [];
  if (!ktpNumber || typeof ktpNumber !== "string") {
    errors.push("Nomor KTP wajib diisi");
    return errors;
  }

  let digits = "";
  for (let i = 0; i < ktpNumber.trim().length; i++) {
    const ch = ktpNumber.trim()[i];
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) digits += ch;
    else errors.push("Nomor KTP hanya boleh angka");
  }

  if (digits.length !== 16) errors.push("Nomor KTP harus 16 digit");

  return errors;
}

export {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  normalizePhone,
  validateKtpNumber,
};
