function getErrorMessage(error) {
  if (error.code === "ECONNREFUSED") {
    return "MySQL belum nyala. Buka XAMPP, start MySQL.";
  }
  if (error.code === "ER_BAD_FIELD_ERROR") {
    return "Tabel users belum sesuai. Buat/update tabel users di phpMyAdmin (database: proyek_marketplace).";
  }
  return error.message || "Terjadi kesalahan";
}

export { getErrorMessage };
