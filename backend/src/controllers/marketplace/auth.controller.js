import userModel from "../../models/user/userModel.js";
import serviceModel from "../../models/marketplace/serviceModel.js";
import jobModel from "../../models/marketplace/jobModel.js";
import chatModel from "../../models/communication/chatModel.js";
import notificationModel from "../../models/communication/notificationModel.js";
import { setAuthCookie, clearAuthCookie } from "../../utils/token.js";
import { isBootstrapAdmin } from "../../config/admin.js";
import { validateEmail, validatePassword, validateName, validatePhone, normalizePhone } from "../../utils/validators.js";
import { capitalizeName } from "../../utils/userDisplay.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { fail } from "./_helpers.js";

async function home(req, res) {
  try {
    const [totalJasa, totalLowongan] = await Promise.all([
      serviceModel.countAll().catch(() => 0),
      jobModel.countAll().catch(() => 0),
    ]);
    res.json({ ok: true, totalJasa, totalLowongan });
  } catch (error) {
    res.json({ ok: true, totalJasa: 0, totalLowongan: 0 });
  }
}

async function me(req, res) {
  try {
    let unreadNotifCount = 0;
    let unreadChatCount = 0;
    if (req.user) {
      unreadNotifCount = await notificationModel.countUnread(req.user.id).catch(() => 0);
      unreadChatCount = await chatModel.countUnread(req.user.id).catch(() => 0);
    }
    res.json({ ok: true, user: req.user || null, unreadNotifCount, unreadChatCount });
  } catch (error) {
    res.json({ ok: true, user: null, unreadNotifCount: 0 });
  }
}

async function register(req, res) {
  try {
    const { first_name, last_name, email, phone, password, password_confirm } = req.body;
    const errors = [];
    errors.push(...validateName(first_name, "First name"));
    errors.push(...validateName(last_name, "Last name"));
    errors.push(...validateEmail(email));
    errors.push(...validatePhone(phone));
    errors.push(...validatePassword(password));
    if (password !== password_confirm) errors.push("Konfirmasi password tidak sama");

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const cleanPhone = phone ? normalizePhone(phone) : "";
    if (errors.length === 0 && (await userModel.findByEmail(cleanEmail))) {
      errors.push("Email sudah terdaftar");
    }
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const user = await userModel.create({
      first_name: capitalizeName(first_name),
      last_name: capitalizeName(last_name),
      email: cleanEmail,
      phone: cleanPhone,
      password,
    });
    const token = setAuthCookie(res, user);
    res.json({ ok: true, user: { id: user.id, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    let user = await userModel.findByEmail(cleanEmail);

    if (user && user.is_banned) {
      return fail(res, 403, "Akun kamu telah DIBANNED PERMANEN karena terbukti menggunakan KTP palsu / terindikasi manipulasi identitas.");
    }

    if (!user || !user.is_active || !(await userModel.comparePassword(password, user.password_hash))) {
      return fail(res, 401, "Email atau password salah");
    }

    if (isBootstrapAdmin(cleanEmail) && user.role !== "ADMIN") {
      user = await userModel.ensureBootstrapAdmin(cleanEmail);
    }

    const token = setAuthCookie(res, user);
    res.json({ ok: true, user: { id: user.id, role: user.role }, token });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

export default {
  home,
  me,
  register,
  login,
  logout,
};
