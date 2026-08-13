import userModel from "../../models/user/userModel.js";
import serviceModel, { parseStoredSkills } from "../../models/marketplace/serviceModel.js";
import chatModel from "../../models/communication/chatModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import reviewModel from "../../models/marketplace/reviewModel.js";
import notify from "../../utils/notify.js";
import { jasaLocks } from "../../services/order/listingLifecycle.js";
import { fullName } from "../../utils/userDisplay.js";
import { parseMoneyInput } from "../../utils/money.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { isContactVerified, isKtpApproved } from "../../services/user/verification.js";
import { uid, fail, validateCategory } from "./_helpers.js";
import { mergeJasaChatPeers, ownerCanMessageJasaPeer } from "./_chat.helpers.js";

async function jasaList(req, res) {
  try {
    const tipe = req.query.tipe || "semua";
    const sub = req.query.sub || "semua";
    const q = req.query.q || "";
    const sort = req.query.sort || "terbaru";
    const city = req.query.city || "semua";
    const priceRange = req.query.priceRange || "semua";
    const data = await serviceModel.findAll({ tipe, sub, q, sort, city, priceRange });
    res.json({ ok: true, data, tipe, sub, q, sort, city, priceRange });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaShow(req, res) {
  try {
    let data = await serviceModel.findById(req.params.id);
    if (!data && req.user) {
      const any = await serviceModel.findByIdAny(req.params.id);
      if (any && uid(any.seller_id) === uid(req.user.id)) data = any;
    }
    if (!data) return fail(res, 404, "Jasa tidak ditemukan");

    const meta = { is_owner: false, can_rent: false, has_pending_request: false, has_active_request: false, active_order_id: null, pending_orders_count: 0, active_orders_count: 0 };
    if (req.user) {
      meta.is_owner = uid(data.seller_id) === uid(req.user.id);
      if (meta.is_owner) {
        const incoming = await orderModel.findByServiceId(data.id);
        meta.incoming_orders = incoming;
        meta.pending_orders_count = incoming.filter((o) => o.status === "PENDING").length;
        meta.active_orders_count = incoming.filter((o) =>
          ["PENDING", "ACCEPTED", "IN_PROGRESS", "DISPUTED"].includes(o.status),
        ).length;
        meta.requests_count = meta.pending_orders_count;
        meta.requests_total = incoming.length;
        const locks = await jasaLocks(data.id);
        meta.can_edit = locks.can_edit;
        meta.can_toggle = locks.can_toggle;
        meta.can_delete = locks.can_delete;
        meta.lock_reason = locks.lock_reason;
        const peers = (await mergeJasaChatPeers(data.id)).filter(
          (p) => Number(p.user_id) !== Number(req.user.id),
        );
        meta.chat_peers_count = peers.length;
      }
      const active = await orderModel.findActiveServiceRequest(req.user.id, data.id);
      if (active) {
        meta.has_active_request = true;
        meta.active_order_id = active.id;
      }
      meta.has_pending_request = await orderModel.hasPendingServiceRequest(req.user.id, data.id);
      meta.can_rent =
        !meta.is_owner &&
        !!data.is_active &&
        isContactVerified(req.user) &&
        isKtpApproved(req.user) &&
        !meta.has_active_request &&
        !meta.has_pending_request;
    }
    const reviews = await reviewModel.findByService(data.id);
    res.json({
      ok: true,
      data: {
        ...data,
        skills: parseStoredSkills(data.skills, data.description),
        status: data.is_active ? "ACTIVE" : "INACTIVE",
      },
      meta,
      reviews,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaCreate(req, res) {
  try {
    const { judul_jasa, deskripsi, category_id, harga, estimasi_hari } = req.body;
    const errors = [];
    if (req.uploadError) errors.push(req.uploadError);
    if (!judul_jasa || judul_jasa.trim().length < 5) errors.push("Judul jasa minimal 5 karakter");
    if (!deskripsi?.trim()) errors.push("Deskripsi jasa wajib diisi");
    const catErr = await validateCategory(category_id);
    if (catErr) errors.push(catErr);
    const hargaNum = parseMoneyInput(harga);
    if (hargaNum === null || hargaNum <= 0) errors.push("Harga wajib diisi");
    const deliveryDays = parseInt(estimasi_hari, 10);
    if (!deliveryDays || deliveryDays < 1) errors.push("Estimasi pengerjaan minimal 1 hari");
    
    const coverFiles = req.files?.cover_image || [];
    if (coverFiles.length === 0) errors.push("Foto cover jasa wajib diupload (minimal 1 foto)");
    if (coverFiles.length > 10) errors.push("Foto cover jasa maksimal 10 foto");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const coverUrls = coverFiles.map((f) => "/uploads/jasa/cover/" + f.filename);
    const coverImageUrlString = coverUrls.length === 1 ? coverUrls[0] : coverUrls.join("||");

    const id = await serviceModel.create({
      seller_id: req.user.id,
      category_id: parseInt(category_id, 10),
      title: judul_jasa.trim(),
      description: deskripsi.trim(),
      price: hargaNum,
      delivery_days: deliveryDays,
      cover_image_url: coverImageUrlString,
      portfolio_file_url: req.files?.portfolio_file?.[0]
        ? "/uploads/jasa/portfolio/" + req.files.portfolio_file[0].filename
        : "",
      skills: req.body.skills,
    });
    res.json({ ok: true, id });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaUpdate(req, res) {
  try {
    const service = await serviceModel.findByIdAny(req.params.id);
    if (!service) return fail(res, 404, "Jasa tidak ditemukan");
    if (uid(service.seller_id) !== uid(req.user.id)) return fail(res, 403, "Bukan jasa milik kamu");

    const locks = await jasaLocks(service.id);
    if (!locks.can_edit) {
      return fail(res, 400, locks.lock_reason || "Jasa tidak dapat di-edit saat ada permintaan atau pesanan yang belum selesai");
    }

    const { judul_jasa, deskripsi, category_id, harga, estimasi_hari } = req.body;
    const errors = [];
    if (req.uploadError) errors.push(req.uploadError);
    if (!judul_jasa || judul_jasa.trim().length < 5) errors.push("Judul jasa minimal 5 karakter");
    if (!deskripsi?.trim()) errors.push("Deskripsi jasa wajib diisi");
    const catErr = await validateCategory(category_id);
    if (catErr) errors.push(catErr);
    const hargaNum = parseMoneyInput(harga);
    if (hargaNum === null || hargaNum <= 0) errors.push("Harga wajib diisi");
    const deliveryDays = parseInt(estimasi_hari, 10);
    if (!deliveryDays || deliveryDays < 1) errors.push("Estimasi pengerjaan minimal 1 hari");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const coverFiles = req.files?.cover_image || [];
    const portfolioFile = req.files?.portfolio_file?.[0];

    let existingCovers = [];
    if (req.body.existing_cover_images) {
      if (Array.isArray(req.body.existing_cover_images)) {
        existingCovers = req.body.existing_cover_images;
      } else if (typeof req.body.existing_cover_images === "string") {
        existingCovers = [req.body.existing_cover_images];
      }
    }

    let coverImageUrlString = service.cover_image_url;

    if (coverFiles.length > 0 || existingCovers.length > 0) {
      const newUrls = coverFiles.map((f) => "/uploads/jasa/cover/" + f.filename);
      const allUrls = [...existingCovers, ...newUrls];
      if (allUrls.length > 0) {
        coverImageUrlString = allUrls.length === 1 ? allUrls[0] : allUrls.join("||");
      }
    }

    await serviceModel.update(service.id, {
      category_id: parseInt(category_id, 10),
      title: judul_jasa.trim(),
      description: deskripsi.trim(),
      price: hargaNum,
      delivery_days: deliveryDays,
      cover_image_url: coverImageUrlString,
      portfolio_file_url: portfolioFile
        ? "/uploads/jasa/portfolio/" + portfolioFile.filename
        : service.portfolio_file_url,
      skills: req.body.skills,
    });
    res.json({ ok: true, id: service.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaDelete(req, res) {
  try {
    const service = await serviceModel.findByIdAny(req.params.id);
    if (!service) return fail(res, 404, "Jasa tidak ditemukan");
    if (uid(service.seller_id) !== uid(req.user.id)) return fail(res, 403, "Bukan jasa milik kamu");

    const locks = await jasaLocks(service.id);
    if (!locks.can_delete) {
      return fail(res, 400, locks.lock_reason || "Jasa tidak dapat dihapus saat masih ada sewa yang berjalan.");
    }

    if (locks.delete_mode === "hard") {
      await serviceModel.remove(service.id);
    } else {
      await serviceModel.archive(service.id);
    }
    res.json({ ok: true, mode: locks.delete_mode });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaToggleActive(req, res) {
  try {
    const service = await serviceModel.findByIdAny(req.params.id);
    if (!service) return fail(res, 404, "Jasa tidak ditemukan");
    if (uid(service.seller_id) !== uid(req.user.id)) return fail(res, 403, "Bukan jasa milik kamu");

    const locks = await jasaLocks(service.id);
    if (!locks.can_toggle) {
      return fail(res, 400, locks.lock_reason || "Status jasa tidak bisa diubah saat masih ada sewa yang berjalan.");
    }

    const newStatus = service.is_active ? 0 : 1;
    await serviceModel.toggleActive(service.id, newStatus);
    res.json({ ok: true, is_active: newStatus, status: newStatus ? "ACTIVE" : "INACTIVE" });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaSewa(req, res) {
  try {
    const service = await serviceModel.findById(req.params.id);
    if (!service) return fail(res, 404, "Jasa tidak ditemukan");
    if (uid(service.seller_id) === uid(req.user.id)) return fail(res, 400, "Tidak bisa menyewa jasa sendiri");
    const created = await orderModel.createServiceRequestSafe({
      buyer_id: req.user.id,
      seller_id: service.seller_id,
      service_id: service.id,
      title: service.title,
      amount: service.price,
      buyer_note: req.body.catatan || "",
    });
    if (!created.ok) return fail(res, 400, created.error);
    const orderId = created.orderId;

    await notify({
      userId: service.seller_id,
      actorId: req.user.id,
      type: "SERVICE_RENT_REQUEST",
      title: "Permintaan sewa jasa baru",
      message: `${fullName(req.user)} ingin menyewa "${service.title}"`,
      linkUrl: "/jasa/" + service.id + "/requests",
      referenceType: "order",
      referenceId: orderId,
    });

    await notify({
      userId: req.user.id,
      actorId: req.user.id,
      type: "ORDER_CREATED",
      title: "Pesanan terkirim",
      message: `Permintaan sewa "${service.title}" menunggu konfirmasi penjual.`,
      linkUrl: "/orders/" + orderId,
      referenceType: "order",
      referenceId: orderId,
    });

    res.json({ ok: true, orderId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}


async function jasaChat(req, res) {
  try {
    const data = await serviceModel.findByIdAny(req.params.id);
    if (!data) return fail(res, 404, "Jasa tidak ditemukan");
    const isOwner = uid(data.seller_id) === uid(req.user.id);
    const peerUserId = req.query.with ? Number(req.query.with) : null;

    if (!isOwner) {
      const room = `jasa-${req.params.id}-u-${req.user.id}`;
      const messages = await chatModel.findAll(room);
      const lastId = messages.length ? messages[messages.length - 1].id : 0;
      await chatModel.markRead(req.user.id, room, lastId);
      return res.json({
        ok: true,
        data: { ...data, status: data.is_active ? "ACTIVE" : "INACTIVE" },
        messages,
        isOwner: false,
        peerUserId: null,
        peers: [],
        room,
      });
    }

    const peers = (await mergeJasaChatPeers(req.params.id)).filter(
      (p) => Number(p.user_id) !== Number(req.user.id),
    );

    if (!peerUserId) {
      return res.json({
        ok: true,
        data: { ...data, status: data.is_active ? "ACTIVE" : "INACTIVE" },
        messages: [],
        isOwner: true,
        peerUserId: null,
        peers,
        room: null,
      });
    }

    if (!(await ownerCanMessageJasaPeer(req.params.id, peerUserId))) {
      return fail(res, 403, "Tidak ada percakapan atau pesanan dengan pengguna ini");
    }

    const room = `jasa-${req.params.id}-u-${peerUserId}`;
    const messages = await chatModel.findAll(room);
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    await chatModel.markRead(req.user.id, room, lastId);
    res.json({
      ok: true,
      data: { ...data, status: data.is_active ? "ACTIVE" : "INACTIVE" },
      messages,
      isOwner: true,
      peerUserId,
      peers,
      room,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaChatSend(req, res) {
  try {
    const data = await serviceModel.findByIdAny(req.params.id);
    if (!data) return fail(res, 404, "Jasa tidak ditemukan");
    const pesan = (req.body.pesan || "").trim();
    if (!pesan) return fail(res, 400, "Pesan tidak boleh kosong");

    const isOwner = uid(data.seller_id) === uid(req.user.id);
    let room;
    let peerUserId = null;

    if (isOwner) {
      peerUserId = Number(req.body.target_user_id);
      if (!peerUserId) {
        return fail(res, 400, "Pilih lawan chat (target_user_id) sebelum membalas");
      }
      if (peerUserId === Number(req.user.id)) {
        return fail(res, 400, "Tidak bisa chat ke diri sendiri");
      }
      const peer = await userModel.findById(peerUserId);
      if (!peer) return fail(res, 404, "Pengguna tujuan tidak ditemukan");
      if (!(await ownerCanMessageJasaPeer(req.params.id, peerUserId))) {
        return fail(res, 403, "Tidak ada percakapan atau pesanan dengan pengguna ini");
      }
      room = `jasa-${req.params.id}-u-${peerUserId}`;
    } else {
      // Inquiry / buyer thread — only own pair room
      room = `jasa-${req.params.id}-u-${req.user.id}`;
    }

    await chatModel.create(room, pesan, req.user.id);
    const counterpartId = isOwner ? peerUserId : data.seller_id;
    if (counterpartId && Number(counterpartId) !== Number(req.user.id)) {
      await notify({
        userId: counterpartId,
        actorId: req.user.id,
        type: "CHAT_MESSAGE",
        title: `Pesan baru · ${data.title}`,
        message: pesan.slice(0, 120),
        linkUrl: `/chat?room=${encodeURIComponent(room)}`,
        referenceType: "chat",
        referenceId: data.id,
      }).catch(() => null);
    }
    const messages = await chatModel.findAll(room);
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    await chatModel.markRead(req.user.id, room, lastId);
    res.json({ ok: true, messages, peerUserId, room });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  jasaList,
  jasaShow,
  jasaCreate,
  jasaUpdate,
  jasaDelete,
  jasaToggleActive,
  jasaSewa,
  jasaChat,
  jasaChatSend,
};
