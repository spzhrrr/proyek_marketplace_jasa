import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadsProfileDir } from "../config/paths.js";

const IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png"];
const PORTFOLIO_MIMES = [
  ...IMAGE_MIMES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

fs.mkdirSync(uploadsProfileDir, { recursive: true });

const profileUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadsProfileDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `profile-user${req.user.id}-${file.fieldname}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed =
      file.fieldname === "profilepic" ? IMAGE_MIMES : PORTFOLIO_MIMES;
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Format file tidak didukung"));
  },
});

export function handleProfilePortfolioUpload(req, res, next) {
  profileUpload.fields([
    { name: "portfolio_image", maxCount: 1 },
    { name: "portfolio_file", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) return next();
    req.uploadError = err.message || "Gagal upload";
    next();
  });
}

export function handleProfilePicUpload(req, res, next) {
  profileUpload.single("profilepic")(req, res, (err) => {
    if (!err) return next();
    req.uploadError = err.message || "Gagal upload foto profil";
    next();
  });
}
