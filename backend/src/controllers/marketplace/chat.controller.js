import userModel from "../../models/user/userModel.js";
import chatModel from "../../models/communication/chatModel.js";
import notify from "../../utils/notify.js";
import { fullName } from "../../utils/userDisplay.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { fail } from "./_helpers.js";
import { resolveChatAccess, ownerCanMessageJasaPeer, ownerCanMessageLowonganPeer } from "./_chat.helpers.js";

async function chatInbox(req, res) {
  try {
    const threads = await chatModel.findInboxForUser(req.user.id);
    res.json({ ok: true, threads });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function chatThread(req, res) {
  try {
    const room = String(req.query.room || "").trim();
    const ctx = await resolveChatAccess(req.user.id, room);
    if (!ctx) return fail(res, 404, "Percakapan tidak ditemukan");
    const messages = await chatModel.findAll(room);
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    await chatModel.markRead(req.user.id, room, lastId);
    const counterpart = await userModel.findById(ctx.counterpartId);
    const listingPath = ctx.info.listingKind === "jasa"
      ? `/jasa/${ctx.info.listingId}`
      : `/lowongan/${ctx.info.listingId}`;
    const rel = await chatModel.findRelationForRoom(ctx.info);
    res.json({
      ok: true,
      room,
      messages,
      isOwner: ctx.isOwner,
      listingKind: ctx.info.listingKind,
      listingType: ctx.info.listingType,
      listingId: ctx.info.listingId,
      listingTitle: ctx.listingTitle,
      listingPath,
      counterpartId: ctx.counterpartId,
      counterpartName: counterpart ? fullName(counterpart) : "Pengguna",
      counterpartAvatar: counterpart?.profilepic_url || null,
      relationKind: rel.kind,
      relationStatus: rel.status,
      relationLabel: rel.label,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function chatSend(req, res) {
  try {
    const room = String(req.body.room || "").trim();
    const pesan = (req.body.pesan || "").trim();
    if (!pesan) return fail(res, 400, "Pesan tidak boleh kosong");
    const ctx = await resolveChatAccess(req.user.id, room);
    if (!ctx) return fail(res, 404, "Percakapan tidak ditemukan");

    if (ctx.isOwner) {
      if (ctx.info.listingKind === "jasa") {
        if (!(await ownerCanMessageJasaPeer(ctx.info.listingId, ctx.info.peerId))) {
          return fail(res, 403, "Tidak ada percakapan atau pesanan dengan pengguna ini");
        }
      } else if (!(await ownerCanMessageLowonganPeer(ctx.info.listingId, ctx.info.peerId))) {
        return fail(res, 403, "Tidak ada percakapan, lamaran, atau pesanan dengan pengguna ini");
      }
    } else if (ctx.info.peerId !== Number(req.user.id)) {
      return fail(res, 403, "Thread chat ini bukan milik kamu");
    }

    await chatModel.create(room, pesan, req.user.id);
    if (ctx.counterpartId && Number(ctx.counterpartId) !== Number(req.user.id)) {
      await notify({
        userId: ctx.counterpartId,
        actorId: req.user.id,
        type: "CHAT_MESSAGE",
        title: `Pesan baru · ${ctx.listingTitle}`,
        message: pesan.slice(0, 120),
        linkUrl: `/chat?room=${encodeURIComponent(room)}`,
        referenceType: "chat",
        referenceId: ctx.info.listingId,
      }).catch(() => null);
    }
    const messages = await chatModel.findAll(room);
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    await chatModel.markRead(req.user.id, room, lastId);
    res.json({ ok: true, messages, room });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function chatRead(req, res) {
  try {
    const room = String(req.body.room || req.query.room || "").trim();
    const ctx = await resolveChatAccess(req.user.id, room);
    if (!ctx) return fail(res, 404, "Percakapan tidak ditemukan");
    const messages = await chatModel.findAll(room);
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    await chatModel.markRead(req.user.id, room, lastId);
    res.json({ ok: true, room, last_read_id: lastId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  chatInbox,
  chatThread,
  chatSend,
  chatRead,
};
