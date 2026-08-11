import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { FRONTEND_ROOT } from "../src/config/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(FRONTEND_ROOT, "dist", "index.html");

if (fs.existsSync(indexPath)) {
  process.exit(0);
}

console.log("[setup] Frontend belum di-build. Menjalankan npm run build di frontend/ ...");

try {
  execSync("npm run build", {
    cwd: FRONTEND_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  console.log("[setup] Frontend build selesai.");
} catch {
  console.error("[setup] Gagal build frontend. Pastikan sudah npm install di folder frontend.");
  process.exit(1);
}
