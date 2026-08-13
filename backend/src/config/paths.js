import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKEND_ROOT = path.join(__dirname, "../..");
export const FRONTEND_ROOT = path.join(BACKEND_ROOT, "..", "frontend");
export const STORAGE_ROOT = path.join(BACKEND_ROOT, "storage");
export const UPLOADS_ROOT = path.join(STORAGE_ROOT, "uploads");

export const uploadsKtpDir = path.join(UPLOADS_ROOT, "ktp");
export const uploadsJasaCoverDir = path.join(UPLOADS_ROOT, "jasa", "cover");
export const uploadsJasaPortfolioDir = path.join(UPLOADS_ROOT, "jasa", "portfolio");
export const uploadsApplicationPortfolioDir = path.join(UPLOADS_ROOT, "applications", "portfolio");
export const uploadsProfileDir = path.join(UPLOADS_ROOT, "profile");
export const uploadsWorkDir = path.join(UPLOADS_ROOT, "work");
