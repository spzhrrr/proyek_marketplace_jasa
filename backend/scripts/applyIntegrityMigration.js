/**
 * Apply 006_integrity_fixes.sql using the app DB pool.
 * Usage (from backend/): node scripts/applyIntegrityMigration.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "../database/migrations/006_integrity_fixes.sql");

const IGNORABLE = new Set([
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_FK_DUP_NAME",
  "ER_CANT_DROP_FIELD_OR_KEY",
]);

function splitStatements(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);
}

async function main() {
  const raw = fs.readFileSync(sqlPath, "utf8");
  const stmts = splitStatements(raw);
  const conn = await pool.getConnection();
  let ok = 0;
  let skipped = 0;
  try {
    for (const stmt of stmts) {
      try {
        await conn.query(stmt);
        ok += 1;
        console.log("OK:", stmt.slice(0, 90).replace(/\s+/g, " "));
      } catch (e) {
        if (IGNORABLE.has(e.code) || e.errno === 1060 || e.errno === 1061 || e.errno === 1050 || e.errno === 1826) {
          skipped += 1;
          console.log("SKIP:", e.code || e.errno, stmt.slice(0, 70).replace(/\s+/g, " "));
          continue;
        }
        console.error("FAIL:", stmt.slice(0, 140).replace(/\s+/g, " "));
        throw e;
      }
    }
    console.log(`Migration 006 done. ok=${ok} skipped=${skipped}`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
