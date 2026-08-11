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
const apiKey = process.env.MERCHANT_API_KEY;
const webhookSecret = process.env.WEBHOOK_SECRET;

const [result] = await pool.query(
  `UPDATE pg_merchants
   SET code = 'TOLONGIN',
       name = 'Tolongin Payment',
       api_key = ?,
       webhook_secret = ?,
       webhook_url = 'http://localhost:3000/api/webhooks/payment-gateway'
   WHERE code IN ('COURSENET', 'TOLONGIN')
      OR api_key IN ('pg-key-coursenet-mock-2026', ?)`,
  [apiKey, webhookSecret, apiKey],
);
console.log("pg_merchants updated rows:", result.affectedRows);
await pool.end();
