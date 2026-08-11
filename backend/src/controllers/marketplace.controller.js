import { pool } from "../config/db.js";
import userModel from "../models/userModel.js";
import serviceModel, { parseStoredSkills } from "../models/serviceModel.js";
import jobModel, { parseJobSkills, stripJobSkills, withJobSkills } from "../models/jobModel.js";
import categoryModel from "../models/categoryModel.js";
import chatModel from "../models/chatModel.js";
import orderModel from "../models/orderModel.js";
import paymentModel from "../models/paymentModel.js";
import workSubmissionModel from "../models/workSubmissionModel.js";
import payoutModel from "../models/payoutModel.js";
import reviewModel from "../models/reviewModel.js";
import applicationModel from "../models/applicationModel.js";
import notificationModel from "../models/notificationModel.js";
import withdrawalModel from "../models/withdrawalModel.js";
import notify from "../services/notify.js";
import { setAuthCookie, clearAuthCookie } from "../services/token.js";
import { isBootstrapAdmin } from "../config/admin.js";
import { jasaLocks, jobLocks } from "../services/listingLifecycle.js";
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  normalizePhone,
  validateKtpNumber,
  validateBio,
} from "../services/validators.js";
import { capitalizeName } from "../services/formatName.js";
import { fullName } from "../services/userDisplay.js";
import { buildSessionUser } from "../services/sessionUser.js";
import { parseMoneyInput } from "../services/money.js";
import { getErrorMessage } from "../services/errorMessage.js";
import {
  generateOtp,
  hashOtp,
  compareOtp,
  getExpiry,
  isExpired,
  saveMockOtp,
  getMockOtp,
  clearMockOtp,
  setPendingChange,
  getPendingChange,
  clearPendingChange,
} from "../services/otp.js";
import {
  isEmailVerified,
  isPhoneVerified,
  isContactVerified,
  isKtpApproved,
  isBankVerified,
  bankStatusOf,
} from "../services/verification.js";
import gatewayClient from "../services/gatewayClient.js";
import { applyPaymentSuccess } from "../services/paymentFlow.js";
import { acceptApplication } from "../services/applicationFlow.js";
import { PAYMENT_METHODS } from "../services/paymentMethods.js";
import { GATEWAY_FRONTEND_URL } from "../config/gateway.js";
import portfolioModel from "../models/portfolioModel.js";
import reportModel from "../models/reportModel.js";
import { releaseEscrowToSeller, refundEscrowToBuyer } from "../services/escrowFlow.js";
import walletLedger from "../services/walletLedger.js";
import {
  expireStaleOrders,
  cancelUnpaidOrderInTx,
  PENDING_ACCEPT_HOURS,
  UNPAID_PAY_HOURS,
} from "../services/orderExpiry.js";
import { normalizeJobWindow, isApplyWindowOpen } from "../services/jobWindow.js";

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

// --- Home & Auth ---

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
    setAuthCookie(res, user);
    res.json({ ok: true, user: { id: user.id, role: user.role } });
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

    setAuthCookie(res, user);
    res.json({ ok: true, user: { id: user.id, role: user.role } });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}

// --- Categories ---

async function categories(req, res) {
  try {
    const data = await categoryModel.getCategoryTree();
    res.json({ ok: true, roots: data.roots, tree: data.tree });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Jasa ---

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

    await notify.notify({
      userId: service.seller_id,
      actorId: req.user.id,
      type: "SERVICE_RENT_REQUEST",
      title: "Permintaan sewa jasa baru",
      message: `${fullName(req.user)} ingin menyewa "${service.title}"`,
      linkUrl: "/jasa/" + service.id + "/requests",
      referenceType: "order",
      referenceId: orderId,
    });

    await notify.notify({
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

async function mergeJasaChatPeers(serviceId) {
  const fromChat = await chatModel.findPeersByRoomPrefix(`jasa-${serviceId}-u-`);
  const map = new Map(fromChat.map((p) => [Number(p.user_id), p]));
  const [orderPeers] = await pool.query(
    `SELECT DISTINCT o.buyer_id AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name
     FROM orders o
     JOIN users u ON u.id = o.buyer_id
     WHERE o.service_id = ? AND o.source = 'SERVICE'`,
    [serviceId],
  );
  for (const p of orderPeers) {
    const id = Number(p.user_id);
    if (!map.has(id)) map.set(id, { user_id: id, name: p.name, last_at: null });
  }
  return [...map.values()];
}

async function ownerCanMessageJasaPeer(serviceId, peerUserId) {
  const room = `jasa-${serviceId}-u-${peerUserId}`;
  if (await chatModel.roomHasMessages(room)) return true;
  const [rows] = await pool.query(
    `SELECT id FROM orders
     WHERE service_id = ? AND buyer_id = ? AND source = 'SERVICE' LIMIT 1`,
    [serviceId, peerUserId],
  );
  return rows.length > 0;
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
      await notify.notify({
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

// --- Lowongan ---

async function lowonganList(req, res) {
  try {
    await jobModel.closeExpiredOpenJobs().catch(() => 0);
    const tipe = req.query.tipe || "semua";
    const sub = req.query.sub || "semua";
    const q = req.query.q || "";
    const sort = req.query.sort || "terbaru";
    const city = req.query.city || "semua";
    const priceRange = req.query.priceRange || "semua";
    const data = await jobModel.findAll({ tipe, sub, q, sort, city, priceRange });
    res.json({ ok: true, data, tipe, sub, q, sort, city, priceRange });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganShow(req, res) {
  try {
    await jobModel.closeExpiredOpenJobs().catch(() => 0);
    const data = await jobModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Lowongan tidak ditemukan");

    const meta = { is_owner: false, can_apply: false, has_applied: false, chat_peers_count: 0, apply_open: false };
    const skills = parseJobSkills(data.skills, data.description);
    const payload = {
      ...data,
      description: stripJobSkills(data.description),
      skills,
      poster_city: data.poster_city || data.city || data.buyer_city || null,
      is_urgent: Number(data.is_urgent) === 1,
      is_active: Number(data.is_active) !== 0,
    };
    meta.apply_open = isApplyWindowOpen(payload) && Number(payload.is_active) !== 0;
    if (req.user) {
      meta.is_owner = uid(data.buyer_id) === uid(req.user.id);
      meta.has_applied = await applicationModel.hasApplied(data.id, req.user.id);
      meta.apply_open = isApplyWindowOpen(data) && Number(data.is_active) !== 0;
      meta.can_apply =
        !meta.is_owner &&
        meta.apply_open &&
        isContactVerified(req.user) &&
        isKtpApproved(req.user) &&
        !meta.has_applied;
      if (meta.is_owner) {
        const peers = (await mergeLowonganChatPeers(data.id)).filter(
          (p) => Number(p.user_id) !== Number(req.user.id),
        );
        meta.chat_peers_count = peers.length;
        const locks = await jobLocks(data.id, data);
        meta.can_edit = locks.can_edit;
        meta.can_delete = locks.can_delete;
        meta.can_toggle = locks.can_toggle;
        meta.can_close = locks.can_close;
        meta.lock_reason = locks.lock_reason;
      }
    }

    res.json({ ok: true, data: payload, meta });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganCreate(req, res) {
  try {
    const { judul_lowongan, deskripsi, category_id, gaji, batas_waktu, skills, is_urgent } = req.body;
    const errors = [];
    if (!judul_lowongan || judul_lowongan.trim().length < 5) errors.push("Judul lowongan minimal 5 karakter");
    if (!deskripsi?.trim()) errors.push("Deskripsi pekerjaan wajib diisi");
    const catErr = await validateCategory(category_id);
    if (catErr) errors.push(catErr);
    const budgetNum = parseMoneyInput(gaji);
    if (budgetNum === null || budgetNum <= 0) errors.push("Anggaran wajib diisi");
    const window = normalizeJobWindow({ batas_waktu, is_urgent });
    if (window.error) errors.push(window.error);
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const skillList = Array.isArray(skills) ? skills.slice(0, 5) : [];
    const id = await jobModel.create({
      buyer_id: req.user.id,
      category_id: parseInt(category_id, 10),
      title: judul_lowongan.trim(),
      description: withJobSkills(deskripsi.trim(), skillList),
      budget: budgetNum,
      deadline: window.deadline,
      is_urgent: window.is_urgent,
      skills: skillList,
    });
    res.json({ ok: true, id });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganUpdate(req, res) {
  try {
    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Bukan lowongan milik kamu");
    if (job.status !== "OPEN") return fail(res, 400, "Lowongan yang sudah ditutup tidak bisa diedit");

    const apps = await applicationModel.findByJob(job.id);
    if (apps.length > 0) {
      return fail(res, 400, "Lowongan yang sudah memiliki pelamar tidak dapat di-edit demi keadilan penawaran");
    }

    const { judul_lowongan, deskripsi, category_id, gaji, batas_waktu, skills, is_urgent } = req.body;
    const errors = [];
    if (!judul_lowongan || judul_lowongan.trim().length < 5) errors.push("Judul lowongan minimal 5 karakter");
    if (!deskripsi?.trim()) errors.push("Deskripsi pekerjaan wajib diisi");
    const catErr = await validateCategory(category_id);
    if (catErr) errors.push(catErr);
    const budgetNum = parseMoneyInput(gaji);
    if (budgetNum === null || budgetNum <= 0) errors.push("Anggaran wajib diisi");
    const window = normalizeJobWindow({ batas_waktu, is_urgent });
    if (window.error) errors.push(window.error);
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const skillList = Array.isArray(skills) ? skills.slice(0, 5) : [];
    await jobModel.update(job.id, {
      category_id: parseInt(category_id, 10),
      title: judul_lowongan.trim(),
      description: withJobSkills(deskripsi.trim(), skillList),
      budget: budgetNum,
      deadline: window.deadline,
      is_urgent: window.is_urgent,
      skills: skillList,
    });
    res.json({ ok: true, id: job.id });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganDelete(req, res) {
  try {
    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Bukan lowongan milik kamu");

    const locks = await jobLocks(job.id, job);
    if (!locks.can_delete) {
      return fail(res, 400, locks.lock_reason || "Lowongan tidak bisa dihapus.");
    }

    await jobModel.updateStatus(job.id, "CANCELLED");
    await jobModel.setListed(job.id, false);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganClose(req, res) {
  try {
    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Bukan lowongan milik kamu");

    const locks = await jobLocks(job.id, job);
    if (!locks.can_close) {
      return fail(res, 400, locks.lock_reason || "Lowongan tidak bisa ditutup.");
    }

    const pending = await applicationModel.rejectPendingForClosedJob(job.id);
    await jobModel.updateStatus(job.id, "CANCELLED");
    await jobModel.setListed(job.id, false);

    for (const app of pending) {
      await notify.notify({
        userId: app.seller_id,
        actorId: req.user.id,
        type: "APPLICATION_REJECTED",
        title: "Lowongan ditutup",
        message: applicationModel.JOB_CLOSED_REASON,
        linkUrl: `/lowongan/${job.id}`,
        referenceType: "job",
        referenceId: job.id,
      }).catch(() => {});
    }

    res.json({ ok: true, rejected: pending.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganToggleActive(req, res) {
  try {
    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Bukan lowongan milik kamu");

    const locks = await jobLocks(job.id, job);
    if (!locks.can_toggle) {
      return fail(res, 400, locks.lock_reason || "Status lowongan tidak bisa diubah.");
    }
    if (job.status === "CANCELLED") {
      return fail(res, 400, "Lowongan yang ditutup tidak bisa ditayangkan lagi");
    }

    const currentlyListed = Number(job.is_active) !== 0 && job.status === "OPEN";
    if (currentlyListed) {
      await jobModel.setListed(job.id, false);
      return res.json({ ok: true, status: "OPEN", is_active: 0 });
    }

    if (job.status === "CLOSED") {
      const windowOpen = isApplyWindowOpen({ ...job, status: "OPEN" });
      if (!windowOpen) {
        return fail(res, 400, "Batas lamaran sudah lewat. Perbarui deadline dulu agar lowongan bisa tayang di Cari Kerja.");
      }
      await jobModel.updateStatus(job.id, "OPEN");
    }
    await jobModel.setListed(job.id, true);
    res.json({ ok: true, status: "OPEN", is_active: 1 });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganLamar(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);

    const proposedPrice = parseMoneyInput(req.body.proposed_price);
    if (proposedPrice === null || proposedPrice <= 0) {
      return fail(res, 400, "Penawaran harga wajib diisi");
    }

    const coverLetter = (req.body.catatan || "").trim();
    if (coverLetter.length < 20) {
      return fail(res, 400, "Cover letter minimal 20 karakter");
    }

    let estimatedDays = parseInt(req.body.estimated_days, 10);
    if (Number.isNaN(estimatedDays)) estimatedDays = 0;
    if (estimatedDays && (estimatedDays < 1 || estimatedDays > 30)) {
      return fail(res, 400, "Estimasi pengerjaan harus 1–30 hari");
    }

    await jobModel.closeExpiredOpenJobs().catch(() => 0);
    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) === uid(req.user.id)) return fail(res, 400, "Tidak bisa melamar lowongan sendiri");
    if (job.status !== "OPEN" || Number(job.is_active) === 0 || !isApplyWindowOpen(job)) {
      return fail(res, 400, "Batas lamaran sudah lewat atau lowongan ditutup");
    }

    const already = await applicationModel.hasApplied(req.params.id, req.user.id);
    if (already) {
      return fail(res, 400, "Kamu sudah mengajukan lamaran untuk lowongan ini");
    }

    if (Number(job.is_urgent) === 1) {
      if (!estimatedDays) estimatedDays = 1;
      if (estimatedDays !== 1) {
        return fail(res, 400, "Lowongan urgent hanya menerima estimasi 1 hari — pekerjaan dibutuhkan hari ini");
      }
    }

    const minPrice = Math.round(job.budget * 0.5);
    const maxPrice = Math.round(job.budget * 1.5);
    if (proposedPrice < minPrice || proposedPrice > maxPrice) {
      return fail(res, 400, `Penawaran harus antara Rp ${minPrice.toLocaleString("id-ID")} dan Rp ${maxPrice.toLocaleString("id-ID")} (50%–150% budget)`);
    }

    const portfolioFile = req.files?.portfolio_file?.[0];

    const rejected = await applicationModel.findRejected(req.params.id, req.user.id);
    const portfolioUrl = portfolioFile
      ? "/uploads/applications/portfolio/" + portfolioFile.filename
      : "";

    let applicationId;
    if (rejected) {
      await applicationModel.reapply(rejected.id, {
        cover_letter: coverLetter,
        proposed_price: proposedPrice,
        estimated_days: estimatedDays || null,
        portfolio_file_url: portfolioUrl,
      });
      applicationId = rejected.id;
    } else {
      applicationId = await applicationModel.create({
        jobId: req.params.id,
        sellerId: req.user.id,
        cover_letter: coverLetter,
        proposed_price: proposedPrice,
        estimated_days: estimatedDays || null,
        portfolio_file_url: portfolioUrl,
      });
    }

    await notify.notify({
      userId: job.buyer_id,
      actorId: req.user.id,
      type: "JOB_APPLICATION",
      title: "📩 Lamaran Kerja Baru Masuk",
      message: `${fullName(req.user)} telah melamar lowongan "${job.title}". Klik untuk meninjau penawaran.`,
      linkUrl: `/lowongan/${job.id}/lamaran`,
      referenceType: "application",
      referenceId: applicationId,
    });

    await notify.notify({
      userId: req.user.id,
      actorId: req.user.id,
      type: "APPLICATION_SENT",
      title: "✅ Lamaran Berhasil Terkirim",
      message: `Lamaran Anda untuk "${job.title}" telah berhasil dikirim ke pemberi kerja.`,
      linkUrl: "/dashboard#lamaran",
      referenceType: "application",
      referenceId: applicationId,
    });

    res.json({ ok: true, applicationId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function mergeLowonganChatPeers(jobId) {
  const fromChat = await chatModel.findPeersByRoomPrefix(`lowongan-${jobId}-u-`);
  const map = new Map(fromChat.map((p) => [Number(p.user_id), p]));
  const [appPeers] = await pool.query(
    `SELECT DISTINCT a.seller_id AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name
     FROM applications a
     JOIN users u ON u.id = a.seller_id
     WHERE a.job_id = ?`,
    [jobId],
  );
  for (const p of appPeers) {
    const id = Number(p.user_id);
    if (!map.has(id)) map.set(id, { user_id: id, name: p.name, last_at: null });
  }
  const [orderPeers] = await pool.query(
    `SELECT DISTINCT o.seller_id AS user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name
     FROM orders o
     JOIN users u ON u.id = o.seller_id
     WHERE o.job_id = ? AND o.source = 'JOB'`,
    [jobId],
  );
  for (const p of orderPeers) {
    const id = Number(p.user_id);
    if (!map.has(id)) map.set(id, { user_id: id, name: p.name, last_at: null });
  }
  return [...map.values()];
}

async function ownerCanMessageLowonganPeer(jobId, peerUserId) {
  const room = `lowongan-${jobId}-u-${peerUserId}`;
  if (await chatModel.roomHasMessages(room)) return true;
  const [apps] = await pool.query(
    `SELECT id FROM applications WHERE job_id = ? AND seller_id = ? LIMIT 1`,
    [jobId, peerUserId],
  );
  if (apps.length) return true;
  const [orders] = await pool.query(
    `SELECT id FROM orders
     WHERE job_id = ? AND seller_id = ? AND source = 'JOB' LIMIT 1`,
    [jobId, peerUserId],
  );
  return orders.length > 0;
}

async function lowonganChat(req, res) {
  try {
    const data = await jobModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Lowongan tidak ditemukan");
    const isOwner = uid(data.buyer_id) === uid(req.user.id);
    const peerUserId = req.query.with ? Number(req.query.with) : null;

    if (!isOwner) {
      const room = `lowongan-${req.params.id}-u-${req.user.id}`;
      const messages = await chatModel.findAll(room);
      const lastId = messages.length ? messages[messages.length - 1].id : 0;
      await chatModel.markRead(req.user.id, room, lastId);
      return res.json({
        ok: true,
        data,
        messages,
        isOwner: false,
        peerUserId: null,
        peers: [],
        room,
      });
    }

    const peers = (await mergeLowonganChatPeers(req.params.id)).filter(
      (p) => Number(p.user_id) !== Number(req.user.id),
    );

    if (!peerUserId) {
      return res.json({
        ok: true,
        data,
        messages: [],
        isOwner: true,
        peerUserId: null,
        peers,
        room: null,
      });
    }

    if (!(await ownerCanMessageLowonganPeer(req.params.id, peerUserId))) {
      return fail(res, 403, "Tidak ada percakapan, lamaran, atau pesanan dengan pengguna ini");
    }

    const room = `lowongan-${req.params.id}-u-${peerUserId}`;
    const messages = await chatModel.findAll(room);
    const lastId = messages.length ? messages[messages.length - 1].id : 0;
    await chatModel.markRead(req.user.id, room, lastId);
    res.json({
      ok: true,
      data,
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

async function lowonganChatSend(req, res) {
  try {
    const data = await jobModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Lowongan tidak ditemukan");
    const pesan = (req.body.pesan || "").trim();
    if (!pesan) return fail(res, 400, "Pesan tidak boleh kosong");

    const isOwner = uid(data.buyer_id) === uid(req.user.id);
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
      if (!(await ownerCanMessageLowonganPeer(req.params.id, peerUserId))) {
        return fail(res, 403, "Tidak ada percakapan, lamaran, atau pesanan dengan pengguna ini");
      }
      room = `lowongan-${req.params.id}-u-${peerUserId}`;
    } else {
      room = `lowongan-${req.params.id}-u-${req.user.id}`;
    }

    await chatModel.create(room, pesan, req.user.id);
    const counterpartId = isOwner ? peerUserId : data.buyer_id;
    if (counterpartId && Number(counterpartId) !== Number(req.user.id)) {
      await notify.notify({
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

async function resolveChatAccess(userId, room) {
  const info = chatModel.parseRoom(room);
  if (!info) return null;
  const uidNum = Number(userId);

  if (info.listingKind === "jasa") {
    const listing = await serviceModel.findByIdAny(info.listingId);
    if (!listing) return null;
    const ownerId = Number(listing.seller_id);
    const isOwner = ownerId === uidNum;
    const isPeer = info.peerId === uidNum;
    if (!isOwner && !isPeer) return null;
    if (isOwner && !(await ownerCanMessageJasaPeer(info.listingId, info.peerId))) return null;
    return {
      info,
      listing,
      listingTitle: listing.title,
      ownerId,
      isOwner,
      counterpartId: isOwner ? info.peerId : ownerId,
    };
  }

  const listing = await jobModel.findById(info.listingId);
  if (!listing) return null;
  const ownerId = Number(listing.buyer_id);
  const isOwner = ownerId === uidNum;
  const isPeer = info.peerId === uidNum;
  if (!isOwner && !isPeer) return null;
  if (isOwner && !(await ownerCanMessageLowonganPeer(info.listingId, info.peerId))) return null;
  return {
    info,
    listing,
    listingTitle: listing.title,
    ownerId,
    isOwner,
    counterpartId: isOwner ? info.peerId : ownerId,
  };
}

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
      await notify.notify({
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

// --- Dashboard & Notifications ---

async function dashboard(req, res) {
  try {
    await expireStaleOrders().catch(() => null);

    const userId = req.user.id;
    const freshUser = await userModel.findById(userId).catch(() => null);

    const [
      ordersAsBuyer = [],
      ordersAsSeller = [],
      applicationsSent = [],
      applicationsIncoming = [],
      myJobs = [],
      myServices = [],
      earnings = {},
      recentPayouts = [],
      withdrawals = [],
      walletCredits = {},
    ] = await Promise.all([
      orderModel.findByBuyer(userId).catch(() => []),
      orderModel.findBySeller(userId).catch(() => []),
      applicationModel.findByApplicant(userId).catch(() => []),
      applicationModel.findIncomingForPoster(userId).catch(() => []),
      jobModel.findByBuyer(userId).catch(() => []),
      serviceModel.findBySeller(userId).catch(() => []),
      payoutModel.getSummaryForSeller(userId).catch(() => ({})),
      payoutModel.findRecentBySeller(userId).catch(() => []),
      withdrawalModel.findByUser(userId).catch(() => []),
      walletLedger.getCreditBreakdown(userId).catch(() => ({})),
    ]);

    const totalEarningsFromOrders = (ordersAsSeller || [])
      .filter((o) => o.status === "COMPLETED" || o.escrow === "RELEASED")
      .reduce((sum, o) => sum + Number(o.seller_net_amount || o.amount || 0), 0);

    const totalWithdrawnOrPending = (withdrawals || [])
      .filter((w) => w.status === "APPROVED" || w.status === "PENDING")
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    // Wallet balance = source of truth (payout seller + refund buyer − penarikan)
    const realWalletBalance = Math.max(0, Number(freshUser?.wallet_balance || 0));
    const sellerNetAvailable = Math.max(0, totalEarningsFromOrders - totalWithdrawnOrPending);

    const paidEscrow = new Set(["HELD", "RELEASED"]);
    const totalSpent = (ordersAsBuyer || [])
      .filter((o) => {
        if (o.status === "CANCELLED" || o.status === "REJECTED") return false;
        return paidEscrow.has(o.escrow) || o.status === "COMPLETED";
      })
      .reduce((sum, o) => sum + orderModel.getTotalAmount(o), 0);

    const pendingWithdrawalTotal = (withdrawals || [])
      .filter((w) => w.status === "PENDING")
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    const bankMasked = freshUser?.bank_account_number
      ? `****${String(freshUser.bank_account_number).slice(-4)}`
      : null;

    const pendingByService = {};
    const activeByService = {};
    for (const o of ordersAsSeller || []) {
      if (!o.service_id) continue;
      const sid = Number(o.service_id);
      if (o.status === "PENDING") pendingByService[sid] = (pendingByService[sid] || 0) + 1;
      if (["PENDING", "ACCEPTED", "IN_PROGRESS", "DISPUTED"].includes(o.status)) {
        activeByService[sid] = (activeByService[sid] || 0) + 1;
      }
    }

    const chatByListing = { jasa: {}, lowongan: {} };
    try {
      const [chatRows] = await pool.query(
        `SELECT
            IF(c.room LIKE 'jasa-%', 'jasa', 'lowongan') AS kind,
            CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(c.room, '-u-', 1), '-', -1) AS UNSIGNED) AS listing_id,
            COUNT(DISTINCT CAST(SUBSTRING_INDEX(c.room, '-u-', -1) AS UNSIGNED)) AS peers
         FROM chat_messages c
         WHERE c.room LIKE 'jasa-%-u-%' OR c.room LIKE 'lowongan-%-u-%'
         GROUP BY kind, listing_id`,
      );
      for (const row of chatRows) {
        chatByListing[row.kind][Number(row.listing_id)] = Number(row.peers) || 0;
      }
    } catch {
      /* chat_messages may be empty */
    }

    const servicesWithCounts = (myServices || []).map((s) => {
      const pending = pendingByService[Number(s.id)] || 0;
      const active = activeByService[Number(s.id)] || 0;
      const busy = pending > 0 || active > 0;
      return {
        ...s,
        pending_requests_count: pending,
        active_orders_count: active,
        chat_peers_count: chatByListing.jasa[Number(s.id)] || 0,
        can_edit: !busy,
        can_toggle: !busy,
        can_delete: !busy,
        lock_reason: busy
          ? "Masih ada permintaan sewa atau pesanan yang belum selesai."
          : "",
      };
    });

    const jobsWithCounts = (myJobs || []).map((j) => {
      const applicants = Number(j.applicant_count || 0);
      const pending = Number(j.pending_applications || 0);
      const accepted = Number(j.accepted_applications || 0);
      const active = Number(j.active_orders || 0);
      const filled = j.status === "FILLED";
      const cancelled = j.status === "CANCELLED";
      const busyHire = accepted > 0 || active > 0 || filled;
      const busyPending = pending > 0;
      return {
        ...j,
        chat_peers_count: chatByListing.lowongan[Number(j.id)] || 0,
        can_edit: j.status === "OPEN" && applicants === 0,
        can_toggle: !filled && !cancelled && !busyHire && !busyPending,
        can_delete: !filled && !cancelled && !busyHire && applicants === 0,
        can_close: busyPending && !busyHire && !cancelled,
        lock_reason: cancelled
          ? "Lowongan sudah ditutup."
          : busyHire
            ? "Pelamar sudah diterima atau proyek masih berjalan."
            : busyPending
              ? "Masih ada lamaran menunggu."
              : applicants > 0
                ? "Lowongan sudah punya riwayat pelamar, jadi tidak bisa dihapus."
                : "",
      };
    });

    res.json({
      ok: true,
      ordersAsBuyer,
      ordersAsSeller,
      applicationsSent,
      applicationsIncoming,
      myJobs: jobsWithCounts,
      myServices: servicesWithCounts,
      earnings: {
        totalReceived: earnings.totalReceived || 0,
        payoutCount: earnings.payoutCount || 0,
        pendingHeld: earnings.pendingHeld || 0,
        pendingHeldCount: earnings.pendingHeldCount || 0,
        awaitingPayment: earnings.awaitingPayment || 0,
        awaitingPaymentCount: earnings.awaitingPaymentCount || 0,
        availableBalance: realWalletBalance,
        sellerEarningsAvailable: sellerNetAvailable,
        fromSellerPayouts: Number(walletCredits.fromSellerPayouts || 0),
        fromBuyerRefunds: Number(walletCredits.fromBuyerRefunds || 0),
        totalSpent,
        pendingWithdrawalTotal,
        bankMasked,
      },
      orderTimeouts: {
        pendingAcceptHours: PENDING_ACCEPT_HOURS,
        unpaidPayHours: UNPAID_PAY_HOURS,
      },
      recentPayouts,
      withdrawals,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

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

// --- Orders ---

async function orderShow(req, res) {
  try {
    await expireStaleOrders().catch(() => null);

    const order = await orderModel.findById(req.params.id);
    if (!order) return fail(res, 404, "Pesanan tidak ditemukan");

    const isBuyer = uid(order.buyer_id) === uid(req.user.id);
    const isSeller = uid(order.seller_id) === uid(req.user.id);
    const isAdmin = req.user.role === "ADMIN";
    if (!isBuyer && !isSeller && !isAdmin) return fail(res, 403, "Tidak boleh akses pesanan ini");

    const [payments, submissions, payout, reviews, sellerStats, sellerPortfolios, application] = await Promise.all([
      paymentModel.findByOrder(order.id),
      workSubmissionModel.findByOrder(order.id),
      payoutModel.findByOrder(order.id),
      reviewModel.findByOrder(order.id),
      reviewModel.getStatsForUser(order.seller_id),
      portfolioModel.findByUser(order.seller_id),
      order.application_id ? applicationModel.findById(order.application_id) : Promise.resolve(null),
    ]);

    const submissionsWithFiles = await loadSubmissionFiles(submissions);
    const pendingSubmission = await workSubmissionModel.findLatestSubmitted(order.id);
    if (pendingSubmission) {
      pendingSubmission.files = await workSubmissionModel.findFiles(pendingSubmission.id);
    }
    const canSubmitWork =
      isSeller &&
      order.status === "IN_PROGRESS" &&
      order.escrow === "HELD" &&
      (await workSubmissionModel.sellerCanSubmit(order.id));
    const canPay = isBuyer && orderModel.canPay(order);
    const canCancel = isBuyer && orderModel.canBuyerCancel(order);
    const canDispute = (isBuyer || isSeller) && orderModel.canDispute(order);
    const revisionCount = await workSubmissionModel.countByOrder(order.id);
    const revisionsExhausted =
      isBuyer &&
      order.status === "IN_PROGRESS" &&
      order.escrow === "HELD" &&
      revisionCount >= workSubmissionModel.MAX_REVISIONS;
    const hasReviewed = await reviewModel.hasReviewed(order.id, req.user.id);
    const totalAmount = orderModel.getTotalAmount(order);
    const hired = {
      id: order.seller_id,
      name: order.seller_name,
      avatar: order.seller_avatar || "",
      city: order.seller_city || "",
      province: order.seller_province || "",
      bio: order.seller_bio || "",
      verified: order.seller_ktp_status === "APPROVED",
      rating: sellerStats.avg_rating || 0,
      review_count: sellerStats.total || 0,
      cover_letter: application?.cover_letter || "",
      proposed_price: application?.proposed_price ?? null,
      estimated_days: application?.estimated_days ?? null,
      portfolio_file_url: application?.portfolio_file_url || "",
      applied_at: application?.created_at || null,
      portfolios: (sellerPortfolios || []).slice(0, 6).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description || "",
        category_name: p.category_name || "",
        image_url: p.image_url || "",
        file_url: p.file_url || "",
      })),
    };

    res.json({
      ok: true,
      order: { ...order, total_amount: totalAmount, notes: order.buyer_note },
      hired,
      isBuyer,
      isSeller,
      payments,
      submissions: submissionsWithFiles,
      pendingSubmission,
      payout,
      reviews,
      canSubmitWork,
      canPay,
      canCancel,
      canDispute,
      revisionsExhausted,
      maxRevisions: workSubmissionModel.MAX_REVISIONS,
      revisionCount,
      hasReviewed,
      totalAmount,
      paymentMethods: PAYMENT_METHODS,
      gatewayFrontendUrl: GATEWAY_FRONTEND_URL,
      orderTimeouts: {
        pendingAcceptHours: PENDING_ACCEPT_HOURS,
        unpaidPayHours: UNPAID_PAY_HOURS,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function orderAccept(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.seller_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "PENDING") return fail(res, 400, "Status sudah diproses");

    if (order.service_id) {
      const service = await serviceModel.findByIdAny(order.service_id);
      if (!service || !service.is_active) {
        return fail(res, 400, "Jasa sudah tidak aktif");
      }
    }

    const updated = await orderModel.updateStatusIf(order.id, "PENDING", "ACCEPTED");
    if (!updated) return fail(res, 400, "Status sudah diproses");

    await notify.notify({
      userId: order.buyer_id,
      actorId: req.user.id,
      type: "ORDER_ACCEPTED",
      title: "Permintaan sewa diterima",
      message: `${fullName(req.user)} menerima permintaan. Silakan lakukan pembayaran.`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });
    await notify.notify({
      userId: req.user.id,
      actorId: req.user.id,
      type: "ORDER_ACCEPTED_SELLER",
      title: "Pesanan diterima",
      message: `Menunggu pembayaran dari ${order.buyer_name || "pembeli"}.`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function orderReject(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.seller_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "PENDING") return fail(res, 400, "Status sudah diproses");

    const reason = (req.body.reason || "").trim();
    if (reason.length < 5) return fail(res, 400, "Alasan penolakan minimal 5 karakter");

    const updated = await orderModel.updateStatusIf(order.id, "PENDING", "REJECTED", { cancel_reason: reason });
    if (!updated) return fail(res, 400, "Status sudah diproses");
    await notify.notify({
      userId: order.buyer_id,
      actorId: req.user.id,
      type: "ORDER_REJECTED",
      title: "Permintaan sewa ditolak",
      message: `${fullName(req.user)} menolak permintaan "${order.title}": ${reason}`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function orderCancel(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (!orderModel.canBuyerCancel(order)) {
      return fail(res, 400, "Pesanan tidak bisa dibatalkan pada status ini");
    }

    const conn = await pool.getConnection();
    let pendingPayments = [];
    try {
      await conn.beginTransaction();
      const [lockedRows] = await conn.query(
        "SELECT * FROM orders WHERE id = ? FOR UPDATE",
        [order.id],
      );
      const locked = lockedRows[0];
      if (!locked || !orderModel.canBuyerCancel(locked)) {
        await conn.rollback();
        return fail(res, 400, "Pesanan tidak bisa dibatalkan pada status ini");
      }

      const reason = (req.body.reason || "").trim() || "Dibatalkan pembeli";
      const result = await cancelUnpaidOrderInTx(conn, locked, reason);
      if (!result.ok) {
        await conn.rollback();
        return fail(res, 400, result.error || "Pesanan tidak bisa dibatalkan pada status ini");
      }
      pendingPayments = result.pendingPayments || [];
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    for (const pending of pendingPayments) {
      if (pending.gateway_transaction_code) {
        await gatewayClient.failTransaction(pending.gateway_transaction_code).catch(() => null);
      }
    }

    await notify.notify({
      userId: order.seller_id,
      actorId: req.user.id,
      type: "ORDER_CANCELLED",
      title: "Pesanan dibatalkan",
      message: `${fullName(req.user)} membatalkan pesanan "${order.title}".`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function paymentInfo(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (!orderModel.canPay(order)) return fail(res, 400, "Pesanan tidak siap dibayar");

    const pending = await paymentModel.findPendingByOrder(order.id);
    if (pending?.gateway_transaction_code) {
      return res.json({
        ok: true,
        redirectUrl: gatewayClient.getPayUrl(pending.gateway_transaction_code),
      });
    }

    res.json({ ok: true, order: { ...order, total_amount: orderModel.getTotalAmount(order) }, methods: PAYMENT_METHODS });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function paymentProcess(req, res) {
  try {
    await expireStaleOrders().catch(() => null);

    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (!orderModel.canPay(order)) return fail(res, 400, "Pesanan tidak siap dibayar");

    const method = req.body.payment_method;
    if (!PAYMENT_METHODS[method]) return fail(res, 400, "Pilih metode pembayaran yang valid");

    const totalAmount = orderModel.getTotalAmount(order);

    const created = await paymentModel.createOrReusePending({
      order_id: order.id,
      buyer_id: order.buyer_id,
      amount: totalAmount,
      platform_fee: order.platform_fee,
      payment_method: method,
    });
    if (created.error) return fail(res, created.status || 400, created.error);

    if (created.reused && created.pending?.gateway_transaction_code) {
      return res.json({
        ok: true,
        redirectUrl: gatewayClient.getPayUrl(created.pending.gateway_transaction_code),
      });
    }

    const paymentId = created.paymentId;
    const pending = await paymentModel.findById(paymentId);
    if (pending?.gateway_transaction_code) {
      return res.json({
        ok: true,
        redirectUrl: gatewayClient.getPayUrl(pending.gateway_transaction_code),
      });
    }

    const tx = await gatewayClient.insertTransaction({
      external_ref: String(paymentId),
      amount: totalAmount,
      payment_method: method,
      customer_name: order.buyer_name,
      customer_email: req.user.email,
      description: `Bayar pesanan ${order.order_number} — ${order.title}`,
    });

    await paymentModel.updateGatewayCode(paymentId, tx.transaction_code);
    res.json({ ok: true, redirectUrl: gatewayClient.getPayUrl(tx.transaction_code) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function paymentCheck(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");

    const pending = await paymentModel.findPendingByOrder(order.id);
    if (pending?.gateway_transaction_code) {
      const tx = await gatewayClient.checkTransaction(pending.gateway_transaction_code);
      if (tx?.status === "PAID" && pending.status !== "PAID") {
        const result = await applyPaymentSuccess(pending, tx, req.user.id);
        return res.json({ ok: true, paid: result.applied, reason: result.reason });
      }
      if (tx?.status === "FAILED") await paymentModel.markFailed(pending.id);
      if (tx?.status === "EXPIRED") await paymentModel.markExpired(pending.id);
    }
    const paidOrder = await paymentModel.findPaidByOrder(order.id);
    res.json({ ok: true, paid: !!paidOrder });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitWork(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.seller_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "IN_PROGRESS" || order.escrow !== "HELD") {
      return fail(res, 400, "Pesanan belum siap untuk pengiriman bukti");
    }
    if (!(await workSubmissionModel.sellerCanSubmit(order.id))) {
      return fail(res, 400, "Menunggu review pembeli atas bukti sebelumnya");
    }
    if (req.uploadError) return fail(res, 400, req.uploadError);

    const files = req.files || [];
    if (!req.body.note?.trim() && files.length === 0) {
      return fail(res, 400, "Isi catatan atau upload minimal 1 file bukti");
    }

    const revisionNumber = await workSubmissionModel.getNextRevisionNumber(order.id);
    if (revisionNumber > workSubmissionModel.MAX_REVISIONS) {
      return fail(res, 400, `Maksimal ${workSubmissionModel.MAX_REVISIONS} kali pengiriman bukti`);
    }
    const submissionId = await workSubmissionModel.create({
      order_id: order.id,
      seller_id: req.user.id,
      revision_number: revisionNumber,
      note: req.body.note?.trim() || "",
    });

    for (const file of files) {
      await workSubmissionModel.addFile({
        submission_id: submissionId,
        file_name: file.originalname,
        file_path: "/uploads/work/" + file.filename,
        file_type: file.mimetype,
        file_size: file.size,
      });
    }

    await notify.notify({
      userId: order.buyer_id,
      actorId: req.user.id,
      type: "WORK_SUBMITTED",
      title: "Bukti pengerjaan dikirim",
      message: `${fullName(req.user)} mengirim bukti untuk "${order.title}". Periksa dan setujui atau minta revisi.`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function approveWork(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");

    if (order.status === "COMPLETED" && order.escrow === "RELEASED") {
      return res.json({ ok: true, already: true });
    }
    if (order.status !== "IN_PROGRESS" || order.escrow !== "HELD") {
      return fail(res, 400, "Status pesanan tidak valid");
    }

    const submission = await workSubmissionModel.findLatestSubmitted(order.id);
    if (!submission) return fail(res, 400, "Belum ada bukti yang perlu disetujui");

    const result = await releaseEscrowToSeller({
      orderId: order.id,
      actorId: req.user.id,
      note: `${fullName(req.user)} menyetujui bukti pengerjaan`,
    });
    if (!result.ok) return fail(res, result.status || 400, result.error);

    await workSubmissionModel.updateStatus(submission.id, "APPROVED", req.body.review_note || "");

    res.json({ ok: true, already: !!result.already });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function requestRevision(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || uid(order.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "IN_PROGRESS" || order.escrow !== "HELD") {
      return fail(res, 400, "Status pesanan tidak valid");
    }

    const submission = await workSubmissionModel.findLatestSubmitted(order.id);
    if (!submission) return fail(res, 400, "Belum ada bukti yang perlu direvisi");

    const revisionCount = await workSubmissionModel.countByOrder(order.id);
    if (revisionCount >= workSubmissionModel.MAX_REVISIONS) {
      return fail(
        res,
        400,
        `Batas revisi (${workSubmissionModel.MAX_REVISIONS}x) sudah tercapai. Setujui hasil kerja atau ajukan sengketa.`,
      );
    }

    const feedback = req.body.review_note?.trim() || "Perlu perbaikan";
    await workSubmissionModel.updateStatus(submission.id, "REVISION_REQUESTED", feedback);

    await notify.notify({
      userId: order.seller_id,
      actorId: req.user.id,
      type: "REVISION_REQUESTED",
      title: "Permintaan revisi",
      message: `${fullName(req.user)} meminta revisi: ${feedback}`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitReview(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) return fail(res, 404, "Pesanan tidak ditemukan");
    if (order.status !== "COMPLETED") return fail(res, 400, "Pesanan belum selesai");

    const isBuyer = uid(order.buyer_id) === uid(req.user.id);
    const isSeller = uid(order.seller_id) === uid(req.user.id);
    if (!isBuyer && !isSeller) return fail(res, 403, "Tidak boleh akses");

    const rating = parseInt(req.body.rating, 10);
    const comment = req.body.comment?.trim() || "";
    if (!rating || rating < 1 || rating > 5) return fail(res, 400, "Rating harus 1-5");
    if (!comment) return fail(res, 400, "Komentar review wajib diisi");
    if (await reviewModel.hasReviewed(order.id, req.user.id)) {
      return fail(res, 400, "Kamu sudah memberi review");
    }

    await reviewModel.create({
      order_id: order.id,
      reviewer_id: req.user.id,
      reviewee_id: isBuyer ? order.seller_id : order.buyer_id,
      rating,
      comment,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Applications ---

async function applicationAccept(req, res) {
  try {
    const result = await acceptApplication(req.params.id, req.user.id);
    if (!result.ok) {
      return fail(res, result.status || 400, result.error);
    }

    const { app, orderId, rejectedOthers } = result;

    await notify.notify({
      userId: app.seller_id,
      actorId: req.user.id,
      type: "APPLICATION_ACCEPTED",
      title: "Lamaran diterima",
      message: `${fullName(req.user)} menerima lamaran kamu untuk "${app.job_title}"`,
      linkUrl: "/orders/" + orderId,
      referenceType: "order",
      referenceId: orderId,
    });

    await notify.notify({
      userId: app.buyer_id,
      actorId: req.user.id,
      type: "APPLICATION_ACCEPTED_BUYER",
      title: "Lamaran diterima — lanjut bayar",
      message: `Lamaran untuk "${app.job_title}" diterima. Silakan bayar di halaman pesanan.`,
      linkUrl: "/orders/" + orderId,
      referenceType: "order",
      referenceId: orderId,
    });

    for (const other of rejectedOthers || []) {
      await notify.notify({
        userId: other.seller_id,
        actorId: req.user.id,
        type: "APPLICATION_REJECTED",
        title: "Lamaran ditolak",
        message: `Lowongan "${other.job_title}" sudah terisi pekerja lain.`,
        linkUrl: "/dashboard#lamaran",
        referenceType: "application",
        referenceId: other.id,
      });
    }

    res.json({ ok: true, orderId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function applicationReject(req, res) {
  try {
    const app = await applicationModel.findById(req.params.id);
    if (!app || uid(app.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Tidak boleh akses");
    if (app.status !== "PENDING") return fail(res, 400, "Lamaran sudah diproses");

    const reason = (req.body.reason || "").trim();
    if (reason.length < 5) return fail(res, 400, "Alasan penolakan minimal 5 karakter");
    await applicationModel.updateStatus(app.id, "REJECTED", {
      reject_reason: reason,
      reject_kind: "MANUAL",
    });
    await notify.notify({
      userId: app.seller_id,
      actorId: req.user.id,
      type: "APPLICATION_REJECTED",
      title: "Lamaran ditolak",
      message: `${fullName(req.user)} menolak lamaran untuk "${app.job_title}"${reason ? `: ${reason}` : ""}`,
      linkUrl: "/dashboard#lamaran",
      referenceType: "application",
      referenceId: app.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function getJobApplications(req, res) {
  try {
    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) !== uid(req.user.id)) return fail(res, 403, "Hanya pemilik lowongan yang bisa melihat lamaran");

    await applicationModel.healFilledJob(job.id);
    const applications = await applicationModel.findByJob(job.id);
    const data = await Promise.all(
      applications.map(async (a) => {
        const portfolios = await portfolioModel.findByUser(a.seller_id);
        return {
          ...a,
          applicant_verified: a.applicant_ktp_status === "APPROVED",
          applicant_rating: Number(a.applicant_rating) || 0,
          applicant_review_count: Number(a.applicant_review_count) || 0,
          applicant_completed: Number(a.applicant_completed) || 0,
          reject_kind: a.reject_kind || (a.status === "REJECTED" && job.status === "FILLED" ? "AUTO_FILLED" : a.reject_kind || ""),
          portfolios: portfolios.slice(0, 6).map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description || "",
            category_name: p.category_name || "",
            image_url: p.image_url || "",
            file_url: p.file_url || "",
          })),
        };
      }),
    );
    res.json({
      ok: true,
      data,
      summary: {
        total: data.length,
        pending: data.filter((a) => a.status === "PENDING").length,
        accepted: data.filter((a) => a.status === "ACCEPTED").length,
        rejected: data.filter((a) => a.status === "REJECTED").length,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function getServiceRequests(req, res) {
  try {
    const service = await serviceModel.findByIdAny(req.params.id);
    if (!service) return fail(res, 404, "Jasa tidak ditemukan");
    if (uid(service.seller_id) !== uid(req.user.id)) return fail(res, 403, "Hanya pemilik jasa yang bisa melihat permintaan sewa");

    const requests = await orderModel.findByServiceId(service.id);
    const counts = {
      pending: requests.filter((r) => r.status === "PENDING").length,
      process: requests.filter((r) =>
        ["ACCEPTED", "IN_PROGRESS", "DISPUTED", "COMPLETED"].includes(r.status),
      ).length,
      rejected: requests.filter((r) => r.status === "REJECTED" || r.status === "CANCELLED").length,
      all: requests.length,
    };
    res.json({
      ok: true,
      service: {
        id: service.id,
        title: service.title,
        price: service.price,
        is_active: !!service.is_active,
        status: service.is_active ? "ACTIVE" : "INACTIVE",
      },
      data: requests,
      counts,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Verification ---

async function verifyHub(req, res) {
  try {
    const user = await refreshUser(res, req.user.id);
    const emailDone = isEmailVerified(user);
    const phoneDone = isPhoneVerified(user);
    const ktpStatus = user.ktp_status || "NOT_SUBMITTED";

    let nextStep = "done";
    if (!emailDone) nextStep = "email";
    else if (!phoneDone) nextStep = "phone";
    else if (ktpStatus !== "APPROVED") nextStep = "ktp";
    else if (!isBankVerified(user)) nextStep = "bank";

    const bankStatus = bankStatusOf(user);

    res.json({
      ok: true,
      user,
      steps: {
        email: { done: emailDone, status: emailDone ? "VERIFIED" : "PENDING" },
        phone: {
          done: phoneDone,
          status: phoneDone ? "VERIFIED" : emailDone ? "PENDING" : "LOCKED",
        },
        ktp: {
          status: ktpStatus,
          done: ktpStatus === "APPROVED",
          rejectedReason: user.ktp_rejected_reason || null,
          canSubmit:
            emailDone &&
            phoneDone &&
            (ktpStatus === "NOT_SUBMITTED" || ktpStatus === "REJECTED"),
          pending: ktpStatus === "PENDING",
        },
        bank: {
          done: isBankVerified(user),
          status: bankStatus,
          bank_name: user.bank_name || "",
          bank_account_number: user.bank_account_number || "",
          bank_account_holder: user.bank_account_holder || "",
          rejectedReason: user.bank_rejected_reason || null,
          canSubmit:
            emailDone &&
            phoneDone &&
            ktpStatus === "APPROVED" &&
            (bankStatus === "NOT_SUBMITTED" || bankStatus === "REJECTED"),
          pending: bankStatus === "PENDING",
        },
      },
      level1: isContactVerified(user),
      level2: isKtpApproved(user),
      level3: isBankVerified(user),
      nextStep,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function verifyEmailStatus(req, res) {
  try {
    res.json({
      ok: true,
      verified: isEmailVerified(req.user),
      email: req.user.email,
      mockOtp: getMockOtp(req.user.id, "email"),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function sendEmailOtp(req, res) {
  try {
    if (isEmailVerified(req.user)) return res.json({ ok: true, already: true });
    const otp = generateOtp();
    await userModel.saveEmailOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "email", otp);
    res.json({ ok: true, mockOtp: otp });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function confirmEmailOtp(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.email_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.email_otp_hash))) return fail(res, 400, "OTP salah");

    await userModel.verifyEmail(req.user.id);
    clearMockOtp(req.user.id, "email");
    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function verifyPhoneStatus(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    res.json({
      ok: true,
      verified: isPhoneVerified(req.user),
      emailVerified: isEmailVerified(req.user),
      phone: user.phone,
      mockOtp: getMockOtp(req.user.id, "phone"),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function sendPhoneOtp(req, res) {
  try {
    if (!isEmailVerified(req.user)) return fail(res, 403, "Verifikasi email dulu");
    const user = await userModel.findById(req.user.id);
    if (!user.phone) return fail(res, 400, "Nomor HP belum diisi saat registrasi");

    const otp = generateOtp();
    await userModel.savePhoneOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "phone", otp);
    res.json({ ok: true, mockOtp: otp });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function confirmPhoneOtp(req, res) {
  try {
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.phone_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.phone_otp_hash))) return fail(res, 400, "OTP salah");

    await userModel.verifyPhone(req.user.id);
    clearMockOtp(req.user.id, "phone");
    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitKtp(req, res) {
  try {
    if (!isContactVerified(req.user)) return fail(res, 403, "Verifikasi email & HP dulu");
    if (req.user.ktp_status === "APPROVED") {
      return fail(res, 400, "KTP sudah disetujui dan tidak bisa diajukan ulang");
    }
    if (req.user.ktp_status === "PENDING") {
      return fail(res, 400, "KTP masih menunggu review admin");
    }

    const { ktp_number, ktp_name, ktp_birthplace, ktp_birthdate, ktp_gender, ktp_address } = req.body;
    const errors = [];
    if (req.ktpUploadError) errors.push(req.ktpUploadError);
    errors.push(...validateKtpNumber(ktp_number));
    if (!ktp_name || ktp_name.trim().length < 2) {
      errors.push("Nama lengkap sesuai KTP wajib diisi (minimal 2 karakter)");
    }
    if (!ktp_birthplace || ktp_birthplace.trim().length < 2) {
      errors.push("Tempat lahir wajib diisi");
    }
    if (!ktp_birthdate) {
      errors.push("Tanggal lahir wajib diisi");
    }
    if (!ktp_address || ktp_address.trim().length < 5) {
      errors.push("Alamat KTP wajib diisi lengkap");
    }

    const photoFile = req.files?.ktp_photo?.[0];
    const selfieFile = req.files?.ktp_selfie?.[0];
    if (!photoFile) errors.push("Foto KTP wajib diupload");
    if (!selfieFile) errors.push("Foto selfie dengan KTP wajib diupload");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const ok = await userModel.submitKtp(req.user.id, {
      ktp_name: ktp_name.trim(),
      ktp_number: ktp_number.trim(),
      ktp_birthplace: ktp_birthplace.trim(),
      ktp_birthdate: ktp_birthdate,
      ktp_gender: ktp_gender || "LAKI-LAKI",
      ktp_address: ktp_address.trim(),
      ktp_photo_url: "/uploads/ktp/" + photoFile.filename,
      ktp_selfie_url: "/uploads/ktp/" + selfieFile.filename,
    });
    if (!ok) return fail(res, 400, "KTP tidak bisa diajukan ulang pada status saat ini");

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitBank(req, res) {
  try {
    if (!isContactVerified(req.user)) {
      return fail(res, 403, "Verifikasi Email & Nomor HP terlebih dahulu");
    }
    if (!isKtpApproved(req.user)) {
      return fail(res, 403, "Verifikasi KTP wajib disetujui sebelum mengajukan rekening bank");
    }
    if (isBankVerified(req.user)) {
      return fail(res, 400, "Rekening bank sudah diverifikasi dan tidak bisa diajukan ulang");
    }
    if (bankStatusOf(req.user) === "PENDING") {
      return fail(res, 400, "Rekening bank masih menunggu review admin");
    }

    const { bank_name, bank_account_number, bank_account_holder } = req.body;
    const errors = [];
    if (!bank_name?.trim()) errors.push("Nama bank wajib diisi");
    if (!bank_account_number?.trim()) errors.push("Nomor rekening wajib diisi");
    if (!bank_account_holder?.trim()) errors.push("Nama pemilik rekening wajib diisi");
    if (errors.length) return fail(res, 400, errors[0], errors);

    const ok = await userModel.updateBank(req.user.id, {
      bank_name: bank_name.trim(),
      bank_account_number: bank_account_number.trim(),
      bank_account_holder: bank_account_holder.trim(),
    });
    if (!ok) return fail(res, 400, "Rekening tidak bisa diajukan ulang pada status saat ini");

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Profile ---

function mapProfileService(s, isOwner, owner) {
  const ownerName = owner ? `${owner.first_name || ""} ${owner.last_name || ""}`.trim() : "";
  return {
    id: s.id,
    seller_id: s.seller_id || owner?.id,
    title: s.title,
    description: s.description || "",
    skills: s.skills || "",
    price: s.price,
    delivery_days: s.delivery_days,
    cover_image_url: s.cover_image_url || "",
    is_active: Number(s.is_active) === 1,
    category_name: s.category_name || "",
    parent_type: s.parent_type || s.category_type || "",
    city: s.seller_city || s.city || owner?.city || "",
    seller_name: s.seller_name || ownerName,
    seller_avatar: s.seller_avatar || owner?.profilepic_url || "",
    seller_city: s.seller_city || owner?.city || "",
    seller_ktp_status: s.seller_ktp_status || owner?.ktp_status || "",
    seller_rating: s.seller_rating,
    seller_review_count: s.seller_review_count,
    completed_count: s.completed_count,
    created_at: s.created_at,
    ...(isOwner ? { can_edit: true } : {}),
  };
}

function mapProfileJob(j, isOwner, owner) {
  const ownerName = owner ? `${owner.first_name || ""} ${owner.last_name || ""}`.trim() : "";
  return {
    id: j.id,
    buyer_id: j.buyer_id || owner?.id,
    title: j.title,
    description: stripJobSkills(j.description || ""),
    budget: j.budget,
    status: j.status,
    deadline: j.deadline || null,
    is_urgent: Number(j.is_urgent) === 1,
    is_active: Number(j.is_active) !== 0,
    category_name: j.category_name || "",
    parent_type: j.parent_type || j.category_type || "",
    city: j.city || j.buyer_city || owner?.city || "",
    buyer_name: j.buyer_name || j.poster_name || ownerName,
    poster_name: j.poster_name || j.buyer_name || ownerName,
    poster_avatar: j.poster_avatar || j.buyer_avatar || owner?.profilepic_url || "",
    poster_ktp_status: j.poster_ktp_status || owner?.ktp_status || "",
    applicant_count: Number(j.applicant_count) || 0,
    created_at: j.created_at,
    ...(isOwner ? { can_edit: true } : {}),
  };
}

function mapProfileHistory(o, { withAmount, counterpart }) {
  return {
    id: o.id,
    title: o.title,
    source: o.source,
    completed_at: o.completed_at,
    ...(withAmount ? { amount: o.amount } : {}),
    ...(counterpart ? { counterpart } : {}),
  };
}

function mapProfileReview(r) {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer_id: r.reviewer_id,
    reviewer_name: r.reviewer_name,
    order_title: r.order_title,
    order_source: r.order_source,
    order_seller_id: r.order_seller_id,
    order_buyer_id: r.order_buyer_id,
  };
}

async function profileShow(req, res) {
  try {
    const user = await userModel.findPublicProfile(req.params.id);
    if (!user) return fail(res, 404, "Profil tidak ditemukan");

    const isOwner = req.user && uid(req.user.id) === uid(user.id);
    const isAdmin = req.user && req.user.role === "ADMIN";
    const privateView = isOwner || isAdmin;
    const identityVerified = user.ktp_status === "APPROVED";

    let profile = {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      bio: user.bio,
      city: user.city,
      province: user.province,
      profilepic_url: user.profilepic_url,
      created_at: user.created_at,
      identity_verified: identityVerified,
    };

    if (privateView) {
      const full = await userModel.findById(user.id);
      profile = {
        ...profile,
        email: full?.email || null,
        phone: full?.phone || null,
        email_verified_at: full?.email_verified_at || null,
        phone_verified_at: full?.phone_verified_at || null,
        ktp_status: full?.ktp_status || user.ktp_status,
        ktp_number: full?.ktp_number || null,
        bank_status: full?.bank_status || null,
        bank_name: full?.bank_name || null,
        bank_account_number: full?.bank_account_number || null,
        bank_account_holder: full?.bank_account_holder || null,
      };
    }

    const [ratingStats, reviewsRaw, allServices, allJobs, doneAsSeller, doneAsBuyer, portfolios] =
      await Promise.all([
        reviewModel.getStatsForUser(user.id),
        reviewModel.findByReviewee(user.id),
        serviceModel.findBySeller(user.id),
        jobModel.findByBuyer(user.id),
        orderModel.findCompletedAsSeller(user.id),
        privateView ? orderModel.findCompletedAsBuyer(user.id) : Promise.resolve([]),
        portfolioModel.findByUser(user.id),
      ]);

    const publicServices = allServices.filter((s) => Number(s.is_active) === 1);
    const publicJobs = allJobs.filter((j) =>
      (j.status === "OPEN" && Number(j.is_active) !== 0) || j.status === "FILLED",
    );
    const services = (privateView ? allServices : publicServices).map((s) => mapProfileService(s, privateView, user));
    const jobs = (privateView ? allJobs : publicJobs).map((j) => mapProfileJob(j, privateView, user));
    const workHistory = doneAsSeller.map((o) => mapProfileHistory(o, {
      withAmount: privateView,
      counterpart: privateView ? o.buyer_name : "",
    }));
    const hireHistory = privateView
      ? doneAsBuyer.map((o) => mapProfileHistory(o, { withAmount: true, counterpart: o.seller_name }))
      : [];

    res.json({
      ok: true,
      user: {
        ...profile,
        name: `${profile.first_name} ${profile.last_name}`.trim(),
        member_since: profile.created_at,
      },
      is_own: !!isOwner,
      stats: {
        jasa: publicServices.length,
        lowongan: publicJobs.filter((j) => j.status === "OPEN").length,
        completed: doneAsSeller.length,
        rating: ratingStats.avg_rating || 0,
        rating_count: ratingStats.total || 0,
        portfolio: portfolios.length,
      },
      ratingStats,
      reviews: reviewsRaw.map(mapProfileReview),
      services,
      jobs,
      workHistory,
      hireHistory,
      portfolios: portfolios.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description || "",
        category_id: p.category_id || null,
        category_name: p.category_name || "",
        category_code: p.category_code || "",
        parent_name: p.parent_name || "",
        parent_type: p.parent_type || "",
        parent_code: p.parent_code || "",
        image_url: p.image_url || "",
        file_url: p.file_url || "",
        created_at: p.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileUpdate(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);
    const {
      bio, city, province, onboarding, first_name, last_name,
      remove_photo, current_password, new_password, new_password_confirm,
    } = req.body;
    const requireComplete = onboarding === "true" || onboarding === true;
    const bioText = bio?.trim() || "";
    const cityText = city?.trim() || "";
    const provinceText = province?.trim() || "";
    const removePhoto = remove_photo === "true" || remove_photo === true;
    let profilepic_url = null;
    if (req.file?.filename) {
      profilepic_url = "/uploads/profile/" + req.file.filename;
    }

    const current = await userModel.findById(req.user.id);
    const errors = [];
    errors.push(...validateBio(bioText, { required: requireComplete }));
    if (requireComplete) {
      if (!cityText) errors.push("Kota wajib diisi");
      if (!provinceText) errors.push("Provinsi wajib diisi");
      if (!profilepic_url && !current?.profilepic_url) {
        errors.push("Foto profil wajib diupload");
      }
    }

    const ktpLocked = current?.ktp_status === "APPROVED" || current?.ktp_status === "PENDING";
    let nextFirst = null;
    let nextLast = null;
    if (!ktpLocked && (first_name != null || last_name != null)) {
      if (first_name != null) errors.push(...validateName(first_name, "Nama depan"));
      if (last_name != null) errors.push(...validateName(last_name, "Nama belakang"));
      nextFirst = first_name ? capitalizeName(first_name) : null;
      nextLast = last_name ? capitalizeName(last_name) : null;
    }

    const wantsPassword = Boolean(new_password || new_password_confirm || current_password);
    if (wantsPassword) {
      if (!current_password) errors.push("Password saat ini wajib diisi");
      errors.push(...validatePassword(new_password));
      if (new_password !== new_password_confirm) errors.push("Konfirmasi password baru tidak sama");
      if (current_password && current?.password_hash) {
        const ok = await userModel.comparePassword(current_password, current.password_hash);
        if (!ok) errors.push("Password saat ini salah");
      }
    }

    if (errors.length) return fail(res, 400, errors[0], errors);

    await userModel.updateProfile(req.user.id, {
      first_name: nextFirst,
      last_name: nextLast,
      bio: bioText,
      city: cityText,
      province: provinceText,
      profilepic_url,
      remove_photo: removePhoto && !profilepic_url,
    });

    if (wantsPassword) {
      await userModel.updatePassword(req.user.id, new_password);
    }

    const fresh = await refreshUser(res, req.user.id);
    res.json({ ok: true, user: buildSessionUser(fresh) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangeEmailStart(req, res) {
  try {
    const errors = validateEmail(req.body.email);
    if (errors.length) return fail(res, 400, errors[0], errors);
    const email = req.body.email.trim().toLowerCase();
    const current = await userModel.findById(req.user.id);
    if (email === (current.email || "").toLowerCase()) {
      return fail(res, 400, "Email baru sama dengan email saat ini");
    }
    const taken = await userModel.findByEmail(email);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Email sudah dipakai akun lain");
    }
    const otp = generateOtp();
    await userModel.saveEmailOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "email-change", otp);
    setPendingChange(req.user.id, "email", email);
    res.json({ ok: true, mockOtp: otp, email });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangeEmailConfirm(req, res) {
  try {
    const pending = getPendingChange(req.user.id, "email");
    const email = (req.body.email || "").trim().toLowerCase();
    if (!pending || pending !== email) {
      return fail(res, 400, "Kirim OTP ke email baru terlebih dahulu");
    }
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.email_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.email_otp_hash))) return fail(res, 400, "OTP salah");
    const taken = await userModel.findByEmail(email);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Email sudah dipakai akun lain");
    }
    await userModel.updateEmail(req.user.id, email);
    clearMockOtp(req.user.id, "email-change");
    clearPendingChange(req.user.id, "email");
    const fresh = await refreshUser(res, req.user.id);
    res.json({ ok: true, user: buildSessionUser(fresh) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangePhoneStart(req, res) {
  try {
    const errors = validatePhone(req.body.phone);
    if (errors.length) return fail(res, 400, errors[0], errors);
    const phone = normalizePhone(req.body.phone);
    const current = await userModel.findById(req.user.id);
    if (phone === current.phone) {
      return fail(res, 400, "Nomor baru sama dengan nomor saat ini");
    }
    const taken = await userModel.findByPhone(phone);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Nomor HP sudah dipakai akun lain");
    }
    const otp = generateOtp();
    await userModel.savePhoneOtp(req.user.id, await hashOtp(otp), getExpiry());
    saveMockOtp(req.user.id, "phone-change", otp);
    setPendingChange(req.user.id, "phone", phone);
    res.json({ ok: true, mockOtp: otp, phone });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileChangePhoneConfirm(req, res) {
  try {
    const pending = getPendingChange(req.user.id, "phone");
    const phone = normalizePhone(req.body.phone || "");
    if (!pending || pending !== phone) {
      return fail(res, 400, "Kirim OTP ke nomor baru terlebih dahulu");
    }
    const user = await userModel.findById(req.user.id);
    if (isExpired(user.phone_otp_expires_at)) return fail(res, 400, "OTP sudah kadaluarsa. Kirim ulang.");
    if (!(await compareOtp(req.body.otp, user.phone_otp_hash))) return fail(res, 400, "OTP salah");
    const taken = await userModel.findByPhone(phone);
    if (taken && Number(taken.id) !== Number(req.user.id)) {
      return fail(res, 400, "Nomor HP sudah dipakai akun lain");
    }
    await userModel.updatePhone(req.user.id, phone);
    clearMockOtp(req.user.id, "phone-change");
    clearPendingChange(req.user.id, "phone");
    const fresh = await refreshUser(res, req.user.id);
    res.json({ ok: true, user: buildSessionUser(fresh) });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileAddPortfolio(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);
    const title = String(req.body.title || "").trim();
    if (title.length < 3) return fail(res, 400, "Judul portfolio minimal 3 karakter");
    if (title.length > 120) return fail(res, 400, "Judul portfolio maksimal 120 karakter");
    const description = String(req.body.description || "").trim().slice(0, 240);
    const file = req.files?.portfolio_file?.[0];
    if (!file) return fail(res, 400, "Unggah file karya (gambar, PDF, atau dokumen)");

    const existing = await portfolioModel.countByUser(req.user.id);
    if (existing >= 12) return fail(res, 400, "Maksimal 12 karya di portfolio");

    let categoryId = req.body.category_id ? parseInt(req.body.category_id, 10) : null;
    if (categoryId) {
      const catErr = await validateCategory(categoryId);
      if (catErr) return fail(res, 400, catErr);
    } else {
      categoryId = null;
    }

    const url = "/uploads/profile/" + file.filename;
    const isImage = String(file.mimetype || "").startsWith("image/");
    const id = await portfolioModel.create({
      user_id: req.user.id,
      category_id: categoryId,
      title,
      description,
      image_url: isImage ? url : "",
      file_url: url,
    });

    res.json({ ok: true, id });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileDeletePortfolio(req, res) {
  try {
    const ok = await portfolioModel.remove(req.params.itemId, req.user.id);
    if (!ok) return fail(res, 404, "Item portfolio tidak ditemukan");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Admin ---

async function adminDashboard(req, res) {
  try {
    const totalUsers = await userModel.countUsers().catch(() => 0);
    const pendingKtp = await userModel.countPendingKtp().catch(() => 0);
    const pendingBank = await userModel.countPendingBank().catch(() => 0);
    const totalOrders = await orderModel.countAll().catch(() => 0);
    const totalServices = await serviceModel.countAll().catch(() => 0);
    const totalJobs = await jobModel.countAll().catch(() => 0);
    const recentKtp = await userModel.findPendingKtp().catch(() => []);
    const recentBank = await userModel.findPendingBank().catch(() => []);

    res.json({
      ok: true,
      stats: { totalUsers, pendingKtp, pendingBank, totalOrders, totalServices, totalJobs },
      recentKtp: (recentKtp || []).slice(0, 5),
      recentBank: (recentBank || []).slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminUsers(req, res) {
  try {
    const data = await userModel.findAllForAdmin();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminUserDetail(req, res) {
  try {
    const user = await userModel.findAdminUserDetail(req.params.id);
    if (!user) return fail(res, 404, "Pengguna tidak ditemukan");
    if (isPlatformAdmin(user)) return fail(res, 404, "Pengguna tidak ditemukan");

    const history = await orderModel.findByUserHistory(req.params.id).catch(() => ({ asBuyer: [], asSeller: [] }));
    res.json({
      ok: true,
      user,
      ordersAsBuyer: history.asBuyer || [],
      ordersAsSeller: history.asSeller || [],
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminOrders(req, res) {
  try {
    const status = req.query.status || "all";
    const data = await orderModel.findAllAdminWithFilter(status);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminKtpQueue(req, res) {
  try {
    const data = await userModel.findPendingKtp();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminKtpDetail(req, res) {
  try {
    const data = await userModel.findKtpDetail(req.params.id);
    if (!data) return fail(res, 404, "Pengajuan KTP tidak ditemukan");
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminApproveKtp(req, res) {
  try {
    const target = await userModel.findById(req.params.id);
    if (!target || isPlatformAdmin(target)) return fail(res, 404, "Pengguna tidak ditemukan");
    if (target.ktp_status !== "PENDING") return fail(res, 400, "Status KTP bukan antrian");

    await userModel.approveKtp(req.params.id);
    await notify.notify({
      userId: target.id,
      actorId: req.user.id,
      type: "KTP_APPROVED",
      title: "Verifikasi KTP disetujui",
      message: "Identitas KTP kamu telah diverifikasi. Kamu sekarang bisa posting jasa dan transaksi penuh.",
      linkUrl: "/verify",
      referenceType: "user",
      referenceId: target.id,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminRejectKtp(req, res) {
  try {
    const target = await userModel.findById(req.params.id);
    if (!target || isPlatformAdmin(target)) return fail(res, 404, "Pengguna tidak ditemukan");
    if (target.ktp_status !== "PENDING") return fail(res, 400, "Status KTP bukan antrian");

    const { action_type, reason } = req.body;
    const reasonText = reason?.trim() || "Dokumen KTP tidak sesuai ketentuan";
    const isBan = action_type === "BAN_ACCOUNT";

    if (isBan) {
      await userModel.rejectKtp(target.id, `BANNED: ${reasonText}`);
      await pool.query(
        "UPDATE users SET is_active = 0, is_banned = 1 WHERE id = ? AND role = 'USER'",
        [target.id],
      );
      await notify.notify({
        userId: target.id,
        actorId: req.user.id,
        type: "ACCOUNT_BANNED",
        title: "🚫 AKUN DIBANNED PERMANEN",
        message: `Akun kamu telah DIBANNED PERMANEN oleh sistem karena indikasi kecurangan identitas (${reasonText}).`,
        linkUrl: "/login",
        referenceType: "user",
        referenceId: target.id,
      });
      res.json({ ok: true, is_banned: true });
    } else {
      await userModel.rejectKtp(target.id, reasonText);
      await notify.notify({
        userId: target.id,
        actorId: req.user.id,
        type: "KTP_REJECTED",
        title: "Verifikasi KTP Ditolak (Silakan Upload Ulang)",
        message: `Pengajuan KTP ditolak (${reasonText}). Silakan unggah foto KTP ulang yang jelas.`,
        linkUrl: "/verify/ktp",
        referenceType: "user",
        referenceId: target.id,
      });
      res.json({ ok: true, is_banned: false });
    }
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminBankQueue(req, res) {
  try {
    const data = await userModel.findPendingBank();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminBankDetail(req, res) {
  try {
    const data = await userModel.findBankDetail(req.params.id);
    if (!data) return fail(res, 404, "Pengajuan rekening tidak ditemukan");
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminApproveBank(req, res) {
  try {
    const target = await userModel.findById(req.params.id);
    if (!target || isPlatformAdmin(target)) return fail(res, 404, "Pengguna tidak ditemukan");
    if (target.bank_status !== "PENDING") return fail(res, 400, "Status rekening bukan antrian");

    await userModel.approveBank(req.params.id);
    await notify.notify({
      userId: target.id,
      actorId: req.user.id,
      type: "BANK_APPROVED",
      title: "Rekening bank disetujui",
      message: "Rekening bank kamu telah diverifikasi. Kamu sekarang bisa posting jasa.",
      linkUrl: "/verify",
      referenceType: "user",
      referenceId: target.id,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminRejectBank(req, res) {
  try {
    const target = await userModel.findById(req.params.id);
    if (!target || isPlatformAdmin(target)) return fail(res, 404, "Pengguna tidak ditemukan");
    if (target.bank_status !== "PENDING") return fail(res, 400, "Status rekening bukan antrian");

    const reason = req.body.reason?.trim() || "Ditolak admin";
    await userModel.rejectBank(req.params.id, reason);
    await notify.notify({
      userId: target.id,
      actorId: req.user.id,
      type: "BANK_REJECTED",
      title: "Rekening bank ditolak",
      message: `Pengajuan rekening ditolak. Alasan: ${reason}. Silakan ajukan ulang.`,
      linkUrl: "/verify/bank",
      referenceType: "user",
      referenceId: target.id,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function orderDispute(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) return fail(res, 404, "Pesanan tidak ditemukan");
    if (uid(order.buyer_id) !== uid(req.user.id) && uid(order.seller_id) !== uid(req.user.id)) {
      return fail(res, 403, "Tidak boleh akses");
    }
    if (order.status === "DISPUTED") {
      return fail(res, 400, "Pesanan sudah dalam status sengketa");
    }
    if (!orderModel.canDispute(order)) {
      return fail(res, 400, "Sengketa hanya bisa diajukan saat pesanan sedang dikerjakan dan dana ditahan");
    }

    const { reason } = req.body;
    if (!reason?.trim() || reason.trim().length < 10) {
      return fail(res, 400, "Alasan komplain/sengketa minimal 10 karakter");
    }

    const updated = await orderModel.updateStatusIf(order.id, "IN_PROGRESS", "DISPUTED", {
      cancel_reason: reason.trim(),
    });
    if (!updated) return fail(res, 400, "Status pesanan sudah berubah");

    const counterpartId =
      uid(order.buyer_id) === uid(req.user.id) ? order.seller_id : order.buyer_id;
    await notify.notify({
      userId: counterpartId,
      actorId: req.user.id,
      type: "ORDER_DISPUTED",
      title: "Sengketa pesanan diajukan",
      message: `Komplain diajukan untuk pesanan ${order.order_number}: "${reason.trim()}". Admin akan meninjau.`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });

    const adminIds = await userModel.findAdminIds();
    for (const adminId of adminIds) {
      if (Number(adminId) === Number(req.user.id)) continue;
      await notify.notify({
        userId: adminId,
        actorId: req.user.id,
        type: "ORDER_DISPUTED",
        title: "Sengketa perlu ditinjau",
        message: `Pesanan ${order.order_number} masuk sengketa: "${reason.trim()}"`,
        linkUrl: "/admin/orders",
        referenceType: "order",
        referenceId: order.id,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminResolveDispute(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order) return fail(res, 404, "Pesanan tidak ditemukan");
    if (order.status !== "DISPUTED") {
      return fail(res, 400, "Pesanan bukan dalam status sengketa");
    }

    const { outcome, note } = req.body;
    if (outcome === "REFUND") {
      const result = await refundEscrowToBuyer({
        orderId: order.id,
        actorId: req.user.id,
        reason: `Resolusi Admin: Refund. ${note || ""}`.trim(),
        requireDisputed: true,
      });
      if (!result.ok) return fail(res, result.status || 400, result.error);
      return res.json({ ok: true, already: !!result.already, refundAmount: result.refundAmount });
    }

    if (outcome === "RELEASE") {
      const result = await releaseEscrowToSeller({
        orderId: order.id,
        actorId: req.user.id,
        note: `Resolusi Admin: Release. ${note || ""}`.trim(),
        notifyBuyer: true,
      });
      if (!result.ok) return fail(res, result.status || 400, result.error);
      return res.json({ ok: true, already: !!result.already });
    }

    return fail(res, 400, "Outcome harus REFUND atau RELEASE");
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function requestWithdrawal(req, res) {
  try {
    const amount = Number(req.body.amount);
    if (!amount || amount < 10000) return fail(res, 400, "Minimal penarikan saldo adalah Rp 10.000");

    const user = await userModel.findById(req.user.id);
    if (!isBankVerified(user)) {
      return fail(res, 400, "Rekening bank harus diverifikasi admin sebelum penarikan");
    }
    if (!user.bank_name || !user.bank_account_number) {
      return fail(res, 400, "Lengkapi data rekening bank terverifikasi terlebih dahulu");
    }

    const conn = await pool.getConnection();
    let withdrawalId;
    try {
      await conn.beginTransaction();
      const [lockedRows] = await conn.query(
        "SELECT id, wallet_balance FROM users WHERE id = ? FOR UPDATE",
        [req.user.id],
      );
      const locked = lockedRows[0];
      const available = Number(locked?.wallet_balance || 0);
      if (available < amount) {
        await conn.rollback();
        return fail(res, 400, "Saldo kamu tidak mencukupi untuk penarikan ini");
      }

      const [result] = await conn.query(
        `INSERT INTO withdrawals (user_id, amount, bank_name, bank_account_number, bank_account_holder, status)
         VALUES (?, ?, ?, ?, ?, 'PENDING')`,
        [
          req.user.id,
          amount,
          user.bank_name,
          user.bank_account_number,
          user.bank_account_holder || `${user.first_name} ${user.last_name}`,
        ],
      );
      withdrawalId = result.insertId;

      const ledger = await walletLedger.applyLedgerEntry(conn, {
        userId: req.user.id,
        idempotencyKey: `WITHDRAWAL_REQUEST:withdrawal:${withdrawalId}`,
        entryType: "WITHDRAWAL_REQUEST",
        amount: -amount,
        withdrawalId,
        note: "Permintaan penarikan saldo",
      });
      if (!ledger.ok) {
        await conn.rollback();
        return fail(res, 400, ledger.error || "Gagal memproses penarikan");
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    res.json({ ok: true, id: withdrawalId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function listWithdrawals(req, res) {
  try {
    const data = await withdrawalModel.findByUser(req.user.id);
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminWithdrawals(req, res) {
  try {
    const data = await withdrawalModel.findAllAdmin();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminApproveWithdrawal(req, res) {
  try {
    const withdrawal = await withdrawalModel.findById(req.params.id);
    if (!withdrawal) return fail(res, 404, "Penarikan tidak ditemukan");
    const note = req.body.note || "Transfer berhasil";
    const ok = await withdrawalModel.approveIfPending(withdrawal.id, note);
    if (!ok) return fail(res, 400, "Penarikan tidak dalam status PENDING");
    await notify.notify({
      userId: withdrawal.user_id,
      actorId: req.user.id,
      type: "WITHDRAWAL_APPROVED",
      title: "Penarikan saldo disetujui",
      message: `Penarikan ${Number(withdrawal.amount).toLocaleString("id-ID")} telah ditransfer. ${note}`,
      linkUrl: "/dashboard",
      referenceType: "withdrawal",
      referenceId: withdrawal.id,
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminRejectWithdrawal(req, res) {
  try {
    const note = req.body.note || "Penarikan ditolak admin";
    const withdrawal = await withdrawalModel.findById(req.params.id);
    if (!withdrawal) return fail(res, 404, "Penarikan tidak ditemukan");
    if (withdrawal.status !== "PENDING") {
      return fail(res, 400, "Penarikan tidak dalam status PENDING");
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `UPDATE withdrawals SET status = 'REJECTED', note = ?, processed_at = NOW()
         WHERE id = ? AND status = 'PENDING'`,
        [note, withdrawal.id],
      );
      if (!result.affectedRows) {
        await conn.rollback();
        return fail(res, 400, "Penarikan tidak dalam status PENDING");
      }

      await walletLedger.applyLedgerEntry(conn, {
        userId: withdrawal.user_id,
        idempotencyKey: `WITHDRAWAL_REJECT:withdrawal:${withdrawal.id}`,
        entryType: "WITHDRAWAL_REJECT",
        amount: Number(withdrawal.amount),
        withdrawalId: withdrawal.id,
        note,
      });
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    await notify.notify({
      userId: withdrawal.user_id,
      actorId: req.user.id,
      type: "WITHDRAWAL_REJECTED",
      title: "Penarikan saldo ditolak",
      message: `Penarikan ditolak dan dana dikembalikan ke wallet. Alasan: ${note}`,
      linkUrl: "/dashboard",
      referenceType: "withdrawal",
      referenceId: withdrawal.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function createUserReport(req, res) {
  try {
    const { reported_user_id, reason, description } = req.body;
    if (!reported_user_id || !reason) {
      return fail(res, 400, "User yang dilaporkan dan alasan wajib diisi");
    }
    if (uid(reported_user_id) === uid(req.user.id)) {
      return fail(res, 400, "Tidak bisa melaporkan akun sendiri");
    }
    const target = await userModel.findById(reported_user_id);
    if (!target) return fail(res, 404, "User yang dilaporkan tidak ditemukan");
    if (isPlatformAdmin(target)) return fail(res, 400, "Akun operasional tidak dapat dilaporkan");

    const reportId = await reportModel.create({
      reporter_id: req.user.id,
      reported_user_id: uid(reported_user_id),
      reason: String(reason).trim(),
      description: description || "",
    });
    res.json({ ok: true, id: reportId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminReports(req, res) {
  try {
    const data = await reportModel.findAllAdmin();
    res.json({ ok: true, data });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function adminActionReport(req, res) {
  try {
    const { reportId } = req.params;
    const { action, admin_note, reported_user_id } = req.body;
    const target = reported_user_id ? await userModel.findById(reported_user_id) : null;
    if (!target) return fail(res, 404, "Pengguna yang dilaporkan tidak ditemukan");
    if (isPlatformAdmin(target)) return fail(res, 403, "Akun admin tidak dapat dikenai sanksi");

    if (action === "WARNING") {
      await notify.notify({
        userId: target.id,
        actorId: req.user.id,
        type: "ACCOUNT_WARNING",
        title: "Peringatan dari admin",
        message: `Akun kamu menerima peringatan resmi. Catatan: ${admin_note || "Harap patuhi ketentuan layanan platform."}`,
        linkUrl: "/notifikasi",
        referenceType: "user",
        referenceId: target.id,
      });
      await reportModel.resolveReport(reportId, { action_taken: "WARNING", admin_note });
    } else if (action === "BANNED") {
      const banned = await userModel.banUser(target.id);
      if (!banned) return fail(res, 403, "Akun admin tidak dapat dibanned");
      await notify.notify({
        userId: target.id,
        actorId: req.user.id,
        type: "ACCOUNT_BANNED",
        title: "Akun dibekukan",
        message: `Akun kamu dibekukan karena pelanggaran. Catatan: ${admin_note || "Pelanggaran aturan platform."}`,
        linkUrl: "/login",
        referenceType: "user",
        referenceId: target.id,
      });
      await reportModel.resolveReport(reportId, { action_taken: "BANNED", admin_note });
    } else if (action === "DISMISS") {
      await reportModel.dismissReport(reportId, { admin_note });
    } else {
      return fail(res, 400, "Tindakan sanksi tidak valid");
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  home,
  me,
  register,
  login,
  logout,
  categories,
  jasaList,
  jasaShow,
  jasaCreate,
  jasaUpdate,
  jasaDelete,
  jasaToggleActive,
  jasaSewa,
  jasaChat,
  jasaChatSend,
  chatInbox,
  chatThread,
  chatSend,
  chatRead,
  lowonganList,
  lowonganShow,
  lowonganCreate,
  lowonganUpdate,
  lowonganDelete,
  lowonganClose,
  lowonganToggleActive,
  lowonganLamar,
  lowonganChat,
  lowonganChatSend,
  dashboard,
  notifikasiList,
  notifikasiBaca,
  notifikasiBacaSemua,
  orderShow,
  orderAccept,
  orderReject,
  orderCancel,
  paymentInfo,
  paymentProcess,
  paymentCheck,
  submitWork,
  approveWork,
  requestRevision,
  submitReview,
  applicationAccept,
  applicationReject,
  getJobApplications,
  getServiceRequests,
  verifyHub,
  verifyEmailStatus,
  sendEmailOtp,
  confirmEmailOtp,
  verifyPhoneStatus,
  sendPhoneOtp,
  confirmPhoneOtp,
  submitKtp,
  submitBank,
  profileShow,
  profileUpdate,
  profileChangeEmailStart,
  profileChangeEmailConfirm,
  profileChangePhoneStart,
  profileChangePhoneConfirm,
  profileAddPortfolio,
  profileDeletePortfolio,
  adminDashboard,
  adminUsers,
  adminUserDetail,
  adminOrders,
  adminKtpQueue,
  adminKtpDetail,
  adminApproveKtp,
  adminRejectKtp,
  adminBankQueue,
  adminBankDetail,
  adminApproveBank,
  adminRejectBank,
  orderDispute,
  adminResolveDispute,
  requestWithdrawal,
  listWithdrawals,
  adminWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  createUserReport,
  adminReports,
  adminActionReport,
};
