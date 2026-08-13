import userModel from "../../models/user/userModel.js";
import categoryModel from "../../models/marketplace/categoryModel.js";
import workSubmissionModel from "../../models/transaction/workSubmissionModel.js";
import { setAuthCookie } from "../../utils/token.js";

function uid(v) {
  return Number(v);
}

function fail(res, status, message, errors) {
  return res.status(status).json({ ok: false, error: message, errors: errors || [] });
}

function isPlatformAdmin(user) {
  return String(user?.role || "").toUpperCase() === "ADMIN";
}

async function refreshUser(res, userId) {
  const user = await userModel.findById(userId);
  if (user) setAuthCookie(res, user);
  return user;
}

async function loadSubmissionFiles(submissions) {
  const result = [];
  for (const sub of submissions) {
    const files = await workSubmissionModel.findFiles(sub.id);
    result.push({ ...sub, files });
  }
  return result;
}

async function validateCategory(categoryId) {
  if (!categoryId) return "Sub kategori wajib dipilih";
  const isSub = await categoryModel.isSubcategory(categoryId);
  if (!isSub) return "Pilih jenis dulu, lalu pilih sub kategori";
  return null;
}

export { uid, fail, isPlatformAdmin, refreshUser, loadSubmissionFiles, validateCategory };
