import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadsWorkDir } from "../config/paths.js";

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx", ".zip"];

fs.mkdirSync(uploadsWorkDir, { recursive: true });

const workUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadsWorkDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".bin";
      cb(null, `work-order${req.params.id}-user${req.user.id}-${Date.now()}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter(req, file, cb) {
    if (ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error("File bukti harus JPG, PNG, PDF, DOC, DOCX, atau ZIP"));
  },
});

function handleWorkUpload(req, res, next) {
  workUpload.array("proof_files", 5)(req, res, (err) => {
    if (!err) return next();
    let message = "Gagal upload bukti";
    if (err.code === "LIMIT_FILE_SIZE") message = "Ukuran file maksimal 10 MB";
    else if (err.message) message = err.message;
    req.uploadError = message;
    next();
  });
}

export { handleWorkUpload };
