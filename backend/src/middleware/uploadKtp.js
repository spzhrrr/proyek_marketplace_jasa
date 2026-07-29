import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadsKtpDir } from "../config/paths.js";

const uploadDir = uploadsKtpDir;
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png"].includes(ext) ? ext : ".jpg";
    const name = `user-${req.user.id}-${file.fieldname}-${Date.now()}${safeExt}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/jpg", "image/png"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error("File harus berformat JPG atau PNG"));
}

const uploadKtp = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export function handleKtpUpload(req, res, next) {
  uploadKtp.fields([
    { name: "ktp_photo", maxCount: 1 },
    { name: "ktp_selfie", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) return next();

    let message = "Gagal upload file";
    if (err.code === "LIMIT_FILE_SIZE") message = "Ukuran file maksimal 2 MB";
    else if (err.message) message = err.message;

    req.ktpUploadError = message;
    next();
  });
}

export { uploadKtp, uploadDir };
