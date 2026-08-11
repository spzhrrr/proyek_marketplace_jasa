/**
 * Tambah kolom KTP yang kurang tanpa DROP database.
 * Usage (from backend/): node scripts/applyKtpColumns.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const { pool } = await import("../src/config/db.js");

const COLUMNS = [
  ["ktp_name", "VARCHAR(120) NULL"],
  ["ktp_birthplace", "VARCHAR(80) NULL"],
  ["ktp_birthdate", "DATE NULL"],
  ["ktp_gender", "VARCHAR(20) NULL"],
  ["ktp_address", "TEXT NULL"],
];

async function main() {
  const db = process.env.DB_NAME || "proyek_marketplace";
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
      [db],
    );
    const have = new Set(rows.map((r) => r.COLUMN_NAME));
    for (const [name, def] of COLUMNS) {
      if (have.has(name)) {
        console.log(`skip ${name} (sudah ada)`);
        continue;
      }
      await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
      console.log(`added ${name}`);
    }
    console.log("KTP columns OK");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.code || "", e.sqlMessage || e.message);
  process.exit(1);
});
