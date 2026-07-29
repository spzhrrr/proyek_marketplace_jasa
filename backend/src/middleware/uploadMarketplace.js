import multer from "multer";
import path from "path";
import fs from "fs";
import {
  uploadsJasaCoverDir,
  uploadsJasaPortfolioDir,
  uploadsLowonganPortfolioDir,
} from "../config/paths.js";

const COVER_MIMES = ["image/jpeg", "image/jpg", "image/png"];
const PORTFOLIO_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const PORTFOLIO_EXT = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"];

function ensureDirs() {
  fs.mkdirSync(uploadsJasaCoverDir, { recursive: true });
  fs.mkdirSync(uploadsJasaPortfolioDir, { recursive: true });
  fs.mkdirSync(uploadsLowonganPortfolioDir, { recursive: true });
}

function makeStorage(destinationDir, prefix) {
  return multer.diskStorage({
    destination(req, file, cb) {
      cb(null, destinationDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = PORTFOLIO_EXT.includes(ext) ? ext : ".bin";
      const name = `${prefix}-user${req.user.id}-${file.fieldname}-${Date.now()}${safeExt}`;
      cb(null, name);
    },
  });
}

function coverFilter(req, file, cb) {
  if (COVER_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(new Error("Foto cover harus JPG atau PNG"));
}

function portfolioFilter(req, file, cb) {
  if (PORTFOLIO_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(new Error("Portfolio harus PDF, JPG, PNG, DOC, atau DOCX"));
}

ensureDirs();

const jasaUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      if (file.fieldname === "cover_image") {
        cb(null, uploadsJasaCoverDir);
      } else {
        cb(null, uploadsJasaPortfolioDir);
      }
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowed = file.fieldname === "cover_image" ? [".jpg", ".jpeg", ".png"] : PORTFOLIO_EXT;
      const safeExt = allowed.includes(ext) ? ext : file.fieldname === "cover_image" ? ".jpg" : ".bin";
      const name = `jasa-user${req.user.id}-${file.fieldname}-${Date.now()}${safeExt}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (file.fieldname === "cover_image") return coverFilter(req, file, cb);
    if (file.fieldname === "portfolio_file") return portfolioFilter(req, file, cb);
    cb(new Error("Field upload tidak dikenali"));
  },
});

const lowonganUpload = multer({
  storage: makeStorage(uploadsLowonganPortfolioDir, "lowongan"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: portfolioFilter,
});

function wrapUpload(uploadMiddleware, req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    let message = "Gagal upload file";
    if (err.code === "LIMIT_FILE_SIZE") message = "Ukuran file maksimal 5 MB";
    else if (err.message) message = err.message;
    req.uploadError = message;
    next();
  });
}

export function handleJasaPostUpload(req, res, next) {
  wrapUpload(
    jasaUpload.fields([
      { name: "cover_image", maxCount: 1 },
      { name: "portfolio_file", maxCount: 1 },
    ]),
    req,
    res,
    next,
  );
}

export function handleLowonganPostUpload(req, res, next) {
  wrapUpload(
    lowonganUpload.fields([{ name: "portfolio_file", maxCount: 1 }]),
    req,
    res,
    next,
  );
}
