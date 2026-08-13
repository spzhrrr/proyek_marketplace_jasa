import notificationModel from "../../models/communication/notificationModel.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { fail } from "./_helpers.js";

async function notifikasiList(req, res) {
  try {
    const notifications = await notificationModel.findByUser(req.user.id);
    res.json({ ok: true, notifications });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function notifikasiBaca(req, res) {
  try {
    const notif = await notificationModel.findByIdForUser(req.params.id, req.user.id);
    if (!notif) return fail(res, 404, "Notifikasi tidak ditemukan");
    await notificationModel.markRead(req.params.id, req.user.id);
    res.json({ ok: true, link_url: notif.link_url });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function notifikasiBacaSemua(req, res) {
  try {
    await notificationModel.markAllRead(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  notifikasiList,
  notifikasiBaca,
  notifikasiBacaSemua,
};
