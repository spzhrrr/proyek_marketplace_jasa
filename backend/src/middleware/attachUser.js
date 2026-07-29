import { verifyToken, setAuthCookie } from "../services/token.js";
import userModel from "../models/userModel.js";
import { buildSessionUser } from "../services/sessionUser.js";
import { isBootstrapAdmin } from "../config/admin.js";

async function attachUser(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = verifyToken(token);
    let user = await userModel.findById(payload.id);

    if (!user || !user.is_active) {
      req.user = null;
      return next();
    }

    if (isBootstrapAdmin(user.email) && user.role !== "ADMIN") {
      user = await userModel.ensureBootstrapAdmin(user.email);
    }

    req.user = buildSessionUser(user);

    const roleChanged = payload.role !== user.role;
    const ktpChanged = payload.ktp_status !== user.ktp_status;
    if (roleChanged || ktpChanged) {
      setAuthCookie(res, user);
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

export default attachUser;
