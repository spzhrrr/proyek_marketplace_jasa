function getErrorMessage(error) {
  if (error?.code === "ECONNREFUSED" || error?.message?.includes("ECONNREFUSED")) {
    return "Koneksi Database (MySQL) terputus atau belum dinyalakan. Silakan buka XAMPP / Laragon Anda dan klik tombol START pada MySQL.";
  }
  if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") {
    const detail = error.sqlMessage || error.message || "";
    return (
      "Kolom/tabel database belum lengkap" +
      (detail ? ` (${detail})` : "") +
      ". Jalankan backend/database/migrations/008_ktp_identity_fields.sql di phpMyAdmin (tanpa DROP), atau schema terbaru."
    );
  }
  return error?.message || "Terjadi kesalahan pada server";
}

export { getErrorMessage };
