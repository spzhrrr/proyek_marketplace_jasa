import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadsApplicationPortfolioDir } from "../config/paths.js";

const PORTFOLIO_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const PORTFOLIO_EXT = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"];

fs.mkdirSync(uploadsApplicationPortfolioDir, { recursive: true });

const applicationUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadsApplicationPortfolioDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = PORTFOLIO_EXT.includes(ext) ? ext : ".bin";
      cb(null, `lamaran-user${req.user.id}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (PORTFOLIO_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Portfolio harus PDF, JPG, PNG, DOC, atau DOCX"));
  },
});

export function handleApplicationUpload(req, res, next) {
  applicationUpload.fields([{ name: "portfolio_file", maxCount: 1 }])(req, res, (err) => {
    if (!err) return next();
    let message = "Gagal upload file";
    if (err.code === "LIMIT_FILE_SIZE") message = "Ukuran file maksimal 5 MB";
    else if (err.message) message = err.message;
    req.uploadError = message;
    next();
  });
}
