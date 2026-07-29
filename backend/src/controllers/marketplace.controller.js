import userModel from "../models/userModel.js";
import serviceModel from "../models/serviceModel.js";
import jobModel from "../models/jobModel.js";
import categoryModel from "../models/categoryModel.js";
import chatModel from "../models/chatModel.js";
import orderModel from "../models/orderModel.js";
import paymentModel from "../models/paymentModel.js";
import workSubmissionModel from "../models/workSubmissionModel.js";
import payoutModel from "../models/payoutModel.js";
import reviewModel from "../models/reviewModel.js";
import applicationModel from "../models/applicationModel.js";
import notificationModel from "../models/notificationModel.js";
import notify from "../services/notify.js";
import { setAuthCookie, clearAuthCookie } from "../services/token.js";
import { isBootstrapAdmin } from "../config/admin.js";
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  normalizePhone,
  validateKtpNumber,
} from "../services/validators.js";
import { capitalizeName } from "../services/formatName.js";
import { fullName } from "../services/userDisplay.js";
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
} from "../services/otp.js";
import {
  isEmailVerified,
  isPhoneVerified,
  isContactVerified,
  isKtpApproved,
  isBankVerified,
} from "../services/verification.js";
import gatewayClient from "../services/gatewayClient.js";
import { applyPaymentSuccess } from "../services/paymentFlow.js";
import { acceptApplication } from "../services/applicationFlow.js";
import { PAYMENT_METHODS } from "../services/paymentMethods.js";
import { GATEWAY_FRONTEND_URL } from "../config/gateway.js";
import portfolioModel from "../models/portfolioModel.js";

function uid(v) {
  return Number(v);
}

function fail(res, status, message, errors) {
  return res.status(status).json({ ok: false, error: message, errors: errors || [] });
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
      serviceModel.countAll(),
      jobModel.countAll(),
    ]);
    res.json({ ok: true, totalJasa, totalLowongan });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function me(req, res) {
  try {
    let unreadNotifCount = 0;
    if (req.user) {
      unreadNotifCount = await notificationModel.countUnread(req.user.id);
    }
    res.json({ ok: true, user: req.user, unreadNotifCount });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
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
    const data = await serviceModel.findAll({ tipe, sub, q });
    res.json({ ok: true, data, tipe, sub, q });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaShow(req, res) {
  try {
    const data = await serviceModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Jasa tidak ditemukan");

    const meta = { is_owner: false, can_rent: false, has_pending_request: false, has_active_request: false, active_order_id: null };
    if (req.user) {
      meta.is_owner = uid(data.seller_id) === uid(req.user.id);
      const active = await orderModel.findActiveServiceRequest(req.user.id, data.id);
      meta.has_active_request = !!active;
      meta.has_pending_request = active?.status === "PENDING";
      meta.active_order_id = active?.id || null;
      meta.can_rent =
        !meta.is_owner &&
        isKtpApproved(req.user) &&
        isContactVerified(req.user) &&
        !active;
    }

    res.json({ ok: true, data, meta });
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
    const coverFile = req.files?.cover_image?.[0];
    if (!coverFile) errors.push("Foto cover jasa wajib diupload");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const id = await serviceModel.create({
      seller_id: req.user.id,
      category_id: parseInt(category_id, 10),
      title: judul_jasa.trim(),
      description: deskripsi.trim(),
      price: hargaNum,
      delivery_days: deliveryDays,
      cover_image_url: "/uploads/jasa/cover/" + coverFile.filename,
      portfolio_file_url: req.files?.portfolio_file?.[0]
        ? "/uploads/jasa/portfolio/" + req.files.portfolio_file[0].filename
        : "",
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

    const coverFile = req.files?.cover_image?.[0];
    const portfolioFile = req.files?.portfolio_file?.[0];

    await serviceModel.update(service.id, {
      category_id: parseInt(category_id, 10),
      title: judul_jasa.trim(),
      description: deskripsi.trim(),
      price: hargaNum,
      delivery_days: deliveryDays,
      cover_image_url: coverFile ? "/uploads/jasa/cover/" + coverFile.filename : null,
      portfolio_file_url: portfolioFile ? "/uploads/jasa/portfolio/" + portfolioFile.filename : null,
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

    const activeOrders = await serviceModel.countActiveOrders(service.id);
    if (activeOrders > 0) {
      return fail(res, 400, "Jasa tidak bisa dihapus karena masih ada pesanan aktif");
    }

    await serviceModel.deactivate(service.id);
    res.json({ ok: true });
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
      linkUrl: "/orders/" + orderId,
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

async function jasaChat(req, res) {
  try {
    const data = await serviceModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Jasa tidak ditemukan");
    if (req.user && uid(data.seller_id) === uid(req.user.id)) {
      return fail(res, 403, "Tidak bisa chat pada jasa milik sendiri");
    }
    const messages = await chatModel.findAll("jasa-" + req.params.id);
    res.json({ ok: true, data, messages });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function jasaChatSend(req, res) {
  try {
    const data = await serviceModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Jasa tidak ditemukan");
    if (req.user && uid(data.seller_id) === uid(req.user.id)) {
      return fail(res, 403, "Tidak bisa chat pada jasa milik sendiri");
    }
    const pesan = (req.body.pesan || "").trim();
    if (!pesan) return fail(res, 400, "Pesan tidak boleh kosong");
    await chatModel.create("jasa-" + req.params.id, pesan, req.user?.id || null);
    const messages = await chatModel.findAll("jasa-" + req.params.id);
    res.json({ ok: true, messages });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Lowongan ---

async function lowonganList(req, res) {
  try {
    const tipe = req.query.tipe || "semua";
    const sub = req.query.sub || "semua";
    const q = req.query.q || "";
    const data = await jobModel.findAll({ tipe, sub, q });
    res.json({ ok: true, data, tipe, sub, q });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganShow(req, res) {
  try {
    const data = await jobModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Lowongan tidak ditemukan");

    const meta = { is_owner: false, can_apply: false, has_applied: false };
    if (req.user) {
      meta.is_owner = uid(data.buyer_id) === uid(req.user.id);
      meta.has_applied = await applicationModel.hasApplied(data.id, req.user.id);
      meta.can_apply =
        !meta.is_owner &&
        data.status === "OPEN" &&
        isContactVerified(req.user) &&
        isKtpApproved(req.user) &&
        !meta.has_applied;
    }

    res.json({ ok: true, data, meta });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganCreate(req, res) {
  try {
    const { judul_lowongan, deskripsi, category_id, gaji, batas_waktu } = req.body;
    const errors = [];
    if (!judul_lowongan || judul_lowongan.trim().length < 5) errors.push("Judul lowongan minimal 5 karakter");
    if (!deskripsi?.trim()) errors.push("Deskripsi pekerjaan wajib diisi");
    const catErr = await validateCategory(category_id);
    if (catErr) errors.push(catErr);
    const budgetNum = parseMoneyInput(gaji);
    if (budgetNum === null || budgetNum <= 0) errors.push("Anggaran wajib diisi");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    const id = await jobModel.create({
      buyer_id: req.user.id,
      category_id: parseInt(category_id, 10),
      title: judul_lowongan.trim(),
      description: deskripsi.trim(),
      budget: budgetNum,
      deadline: batas_waktu || null,
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

    const { judul_lowongan, deskripsi, category_id, gaji, batas_waktu } = req.body;
    const errors = [];
    if (!judul_lowongan || judul_lowongan.trim().length < 5) errors.push("Judul lowongan minimal 5 karakter");
    if (!deskripsi?.trim()) errors.push("Deskripsi pekerjaan wajib diisi");
    const catErr = await validateCategory(category_id);
    if (catErr) errors.push(catErr);
    const budgetNum = parseMoneyInput(gaji);
    if (budgetNum === null || budgetNum <= 0) errors.push("Anggaran wajib diisi");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    await jobModel.update(job.id, {
      category_id: parseInt(category_id, 10),
      title: judul_lowongan.trim(),
      description: deskripsi.trim(),
      budget: budgetNum,
      deadline: batas_waktu || null,
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
    if (job.status !== "OPEN") return fail(res, 400, "Lowongan sudah tidak aktif");

    const acceptedApps = await jobModel.countBlockingApplications(job.id);
    const activeOrders = await jobModel.countActiveJobOrders(job.id);
    if (acceptedApps > 0 || activeOrders > 0) {
      return fail(res, 400, "Lowongan tidak bisa dihapus karena masih ada lamaran atau pesanan aktif");
    }

    await jobModel.updateStatus(job.id, "CANCELLED");
    res.json({ ok: true });
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

    const estimatedDays = parseInt(req.body.estimated_days, 10);
    if (estimatedDays && (estimatedDays < 1 || estimatedDays > 30)) {
      return fail(res, 400, "Estimasi pengerjaan harus 1–30 hari");
    }

    const job = await jobModel.findById(req.params.id);
    if (!job) return fail(res, 404, "Lowongan tidak ditemukan");
    if (uid(job.buyer_id) === uid(req.user.id)) return fail(res, 400, "Tidak bisa melamar lowongan sendiri");
    if (job.status !== "OPEN") return fail(res, 400, "Lowongan sudah tidak menerima lamaran");
    const maxPrice = Math.round(job.budget * 1.5);
    if (proposedPrice < minPrice || proposedPrice > maxPrice) {
      return fail(res, 400, `Penawaran harus antara ${minPrice} dan ${maxPrice} (50%–150% budget)`);
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
      title: "Lamaran kerja baru",
      message: `${fullName(req.user)} melamar lowongan "${job.title}"`,
      linkUrl: "/dashboard#lamaran-masuk",
      referenceType: "application",
      referenceId: applicationId,
    });

    await notify.notify({
      userId: req.user.id,
      actorId: req.user.id,
      type: "APPLICATION_SENT",
      title: "Lamaran terkirim",
      message: `Lamaran untuk "${job.title}" berhasil dikirim.`,
      linkUrl: "/dashboard",
      referenceType: "application",
      referenceId: applicationId,
    });

    res.json({ ok: true, applicationId });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganChat(req, res) {
  try {
    const data = await jobModel.findById(req.params.id);
    if (!data) return fail(res, 404, "Lowongan tidak ditemukan");
    const messages = await chatModel.findAll("lowongan-" + req.params.id);
    res.json({ ok: true, data, messages });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function lowonganChatSend(req, res) {
  try {
    const pesan = (req.body.pesan || "").trim();
    if (!pesan) return fail(res, 400, "Pesan tidak boleh kosong");
    await chatModel.create("lowongan-" + req.params.id, pesan, req.user?.id || null);
    const messages = await chatModel.findAll("lowongan-" + req.params.id);
    res.json({ ok: true, messages });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Dashboard & Notifications ---

async function dashboard(req, res) {
  try {
    const userId = req.user.id;
    const [ordersAsBuyer, ordersAsSeller, applicationsSent, applicationsIncoming, myJobs, earnings, recentPayouts] =
      await Promise.all([
        orderModel.findByBuyer(userId),
        orderModel.findBySeller(userId),
        applicationModel.findByApplicant(userId),
        applicationModel.findIncomingForPoster(userId),
        jobModel.findByBuyer(userId),
        payoutModel.getSummaryForSeller(userId),
        payoutModel.findRecentBySeller(userId),
      ]);

    const bankMasked = req.user.bank_account_number
      ? `****${String(req.user.bank_account_number).slice(-4)}`
      : null;

    res.json({
      ok: true,
      ordersAsBuyer,
      ordersAsSeller,
      applicationsSent,
      applicationsIncoming,
      myJobs,
      earnings: { ...earnings, bankMasked },
      recentPayouts,
    });
  } catch (error) {
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
    const order = await orderModel.findById(req.params.id);
    if (!order) return fail(res, 404, "Pesanan tidak ditemukan");

    const isBuyer = order.buyer_id === req.user.id;
    const isSeller = order.seller_id === req.user.id;
    if (!isBuyer && !isSeller) return fail(res, 403, "Tidak boleh akses pesanan ini");

    const [payments, submissions, payout, reviews] = await Promise.all([
      paymentModel.findByOrder(order.id),
      workSubmissionModel.findByOrder(order.id),
      payoutModel.findByOrder(order.id),
      reviewModel.findByOrder(order.id),
    ]);

    const submissionsWithFiles = await loadSubmissionFiles(submissions);
    const pendingSubmission = await workSubmissionModel.findLatestSubmitted(order.id);
    const canSubmitWork =
      isSeller &&
      order.status === "IN_PROGRESS" &&
      (await workSubmissionModel.sellerCanSubmit(order.id));
    const canPay = isBuyer && orderModel.canPay(order);
    const canCancel = isBuyer && orderModel.canBuyerCancel(order);
    const hasReviewed = await reviewModel.hasReviewed(order.id, req.user.id);
    const totalAmount = orderModel.getTotalAmount(order);

    res.json({
      ok: true,
      order: { ...order, total_amount: totalAmount },
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
      hasReviewed,
      totalAmount,
      paymentMethods: PAYMENT_METHODS,
      gatewayFrontendUrl: GATEWAY_FRONTEND_URL,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function orderAccept(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || order.seller_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
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
    if (!order || order.seller_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "PENDING") return fail(res, 400, "Status sudah diproses");

    const reason = (req.body.reason || "").trim();
    if (reason.length < 5) return fail(res, 400, "Alasan penolakan minimal 5 karakter");

    await orderModel.updateStatus(order.id, "REJECTED", { cancel_reason: reason });
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
    if (!order || order.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
    if (!orderModel.canBuyerCancel(order)) {
      return fail(res, 400, "Pesanan tidak bisa dibatalkan pada status ini");
    }

    const paid = await paymentModel.findPaidByOrder(order.id);
    if (paid) {
      return fail(res, 400, "Pesanan sudah dibayar dan tidak bisa dibatalkan");
    }

    const reason = (req.body.reason || "").trim();
    await orderModel.cancelByBuyer(order.id, reason || "Dibatalkan pembeli");

    const pending = await paymentModel.findPendingByOrder(order.id);
    if (pending) {
      if (pending.gateway_transaction_code) {
        await gatewayClient.failTransaction(pending.gateway_transaction_code);
      }
      await paymentModel.markExpired(pending.id);
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
    if (!order || order.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
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
    const order = await orderModel.findById(req.params.id);
    if (!order || order.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
    if (!orderModel.canPay(order)) return fail(res, 400, "Pesanan tidak siap dibayar");

    const method = req.body.payment_method;
    if (!PAYMENT_METHODS[method]) return fail(res, 400, "Pilih metode pembayaran yang valid");

    const totalAmount = orderModel.getTotalAmount(order);

    let pending = await paymentModel.findPendingByOrder(order.id);
    if (pending?.gateway_transaction_code) {
      return res.json({
        ok: true,
        redirectUrl: gatewayClient.getPayUrl(pending.gateway_transaction_code),
      });
    }

    const paymentId = await paymentModel.create({
      order_id: order.id,
      buyer_id: order.buyer_id,
      amount: totalAmount,
      platform_fee: order.platform_fee,
      payment_method: method,
    });

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
    if (!order || order.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");

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
    if (!order || order.seller_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "IN_PROGRESS") return fail(res, 400, "Pesanan belum siap untuk pengiriman bukti");
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
      message: `${fullName(req.user)} mengirim bukti pengerjaan (revisi #${revisionNumber})`,
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
    if (!order || order.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");

    if (order.status === "COMPLETED") {
      return res.json({ ok: true, already: true });
    }
    if (order.status !== "IN_PROGRESS" || order.escrow !== "HELD") {
      return fail(res, 400, "Status pesanan tidak valid");
    }

    const existingPayout = await payoutModel.findByOrder(order.id);
    if (existingPayout) {
      return res.json({ ok: true, already: true });
    }

    const submission = await workSubmissionModel.findLatestSubmitted(order.id);
    if (!submission) return fail(res, 400, "Belum ada bukti yang perlu disetujui");

    await workSubmissionModel.updateStatus(submission.id, "APPROVED", req.body.review_note || "");
    await orderModel.markCompleted(order.id);
    const seller = await userModel.findById(order.seller_id);
    const bankMasked = seller?.bank_account_number
      ? `****${String(seller.bank_account_number).slice(-4)}`
      : undefined;

    await payoutModel.create({
      order_id: order.id,
      seller_id: order.seller_id,
      amount: order.seller_net_amount,
      bank_account_masked: bankMasked,
    });

    const amountLabel = "Rp " + Number(order.seller_net_amount || 0).toLocaleString("id-ID");

    await notify.notify({
      userId: order.seller_id,
      actorId: req.user.id,
      type: "ORDER_COMPLETED",
      title: "Pesanan selesai — dana masuk",
      message: `${fullName(req.user)} menyetujui bukti pengerjaan. ${amountLabel} sudah masuk ke saldo kamu.`,
      linkUrl: "/dashboard#pendapatan",
      referenceType: "order",
      referenceId: order.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function requestRevision(req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || order.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
    if (order.status !== "IN_PROGRESS") return fail(res, 400, "Status pesanan tidak valid");

    const submission = await workSubmissionModel.findLatestSubmitted(order.id);
    if (!submission) return fail(res, 400, "Belum ada bukti yang perlu direvisi");

    const revisionCount = await workSubmissionModel.countByOrder(order.id);
    if (revisionCount >= workSubmissionModel.MAX_REVISIONS) {
      return fail(res, 400, `Batas revisi (${workSubmissionModel.MAX_REVISIONS}x) sudah tercapai. Setujui atau batalkan pesanan.`);
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

    const isBuyer = order.buyer_id === req.user.id;
    const isSeller = order.seller_id === req.user.id;
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
        linkUrl: "/dashboard",
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
    if (!app || app.buyer_id !== req.user.id) return fail(res, 403, "Tidak boleh akses");
    if (app.status !== "PENDING") return fail(res, 400, "Lamaran sudah diproses");

    await applicationModel.updateStatus(app.id, "REJECTED");
    await notify.notify({
      userId: app.seller_id,
      actorId: req.user.id,
      type: "APPLICATION_REJECTED",
      title: "Lamaran ditolak",
      message: `${fullName(req.user)} menolak lamaran untuk "${app.job_title}"`,
      linkUrl: "/dashboard",
      referenceType: "application",
      referenceId: app.id,
    });

    res.json({ ok: true });
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
          bank_name: user.bank_name || "",
          bank_account_number: user.bank_account_number || "",
          bank_account_holder: user.bank_account_holder || "",
          canSubmit: ktpStatus === "APPROVED",
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

    const { ktp_number } = req.body;
    const errors = [];
    if (req.ktpUploadError) errors.push(req.ktpUploadError);
    errors.push(...validateKtpNumber(ktp_number));

    const photoFile = req.files?.ktp_photo?.[0];
    const selfieFile = req.files?.ktp_selfie?.[0];
    if (!photoFile) errors.push("Foto KTP wajib diupload");
    if (!selfieFile) errors.push("Foto selfie dengan KTP wajib diupload");
    if (errors.length > 0) return fail(res, 400, "Validasi gagal", errors);

    await userModel.submitKtp(req.user.id, {
      ktp_number: ktp_number.trim(),
      ktp_photo_url: "/uploads/ktp/" + photoFile.filename,
      ktp_selfie_url: "/uploads/ktp/" + selfieFile.filename,
    });

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function submitBank(req, res) {
  try {
    if (!isKtpApproved(req.user)) return fail(res, 403, "Verifikasi KTP dulu");

    const { bank_name, bank_account_number, bank_account_holder } = req.body;
    const errors = [];
    if (!bank_name?.trim()) errors.push("Nama bank wajib diisi");
    if (!bank_account_number?.trim()) errors.push("Nomor rekening wajib diisi");
    if (!bank_account_holder?.trim()) errors.push("Nama pemilik rekening wajib diisi");
    if (errors.length) return fail(res, 400, errors[0], errors);

    await userModel.updateBank(req.user.id, {
      bank_name: bank_name.trim(),
      bank_account_number: bank_account_number.trim(),
      bank_account_holder: bank_account_holder.trim(),
    });

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

// --- Profile ---

async function profileShow(req, res) {
  try {
    const user = await userModel.findPublicProfile(req.params.id);
    if (!user) return fail(res, 404, "Profil tidak ditemukan");

    const [ratingStats, reviews, services, jobs, workHistory, portfolios, applications] =
      await Promise.all([
        reviewModel.getStatsForUser(user.id),
        reviewModel.findByReviewee(user.id),
        serviceModel.findBySeller(user.id),
        jobModel.findByBuyer(user.id),
        orderModel.findCompletedAsSeller(user.id),
        portfolioModel.findByUser(user.id),
        req.user && uid(req.user.id) === uid(user.id)
          ? applicationModel.findByApplicant(user.id)
          : Promise.resolve([]),
      ]);

    res.json({
      ok: true,
      user: {
        ...user,
        name: `${user.first_name} ${user.last_name}`.trim(),
        member_since: user.created_at,
      },
      is_own: req.user ? uid(req.user.id) === uid(user.id) : false,
      ratingStats,
      reviews,
      services,
      jobs,
      workHistory,
      portfolios,
      applications: req.user && uid(req.user.id) === uid(user.id) ? applications : [],
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileUpdate(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);
    const { bio, city, province, onboarding } = req.body;
    const requireComplete = onboarding === "true" || onboarding === true;
    const bioText = bio?.trim() || "";
    const cityText = city?.trim() || "";
    const provinceText = province?.trim() || "";
    let profilepic_url = null;
    if (req.file?.filename) {
      profilepic_url = "/uploads/profile/" + req.file.filename;
    }

    const current = await userModel.findById(req.user.id);
    if (requireComplete) {
      const errors = [];
      if (!bioText) errors.push("Bio wajib diisi");
      if (!cityText) errors.push("Kota wajib diisi");
      if (!provinceText) errors.push("Provinsi wajib diisi");
      if (!profilepic_url && !current?.profilepic_url) {
        errors.push("Foto profil wajib diupload");
      }
      if (errors.length) return fail(res, 400, errors[0], errors);
    }

    await userModel.updateProfile(req.user.id, {
      bio: bioText,
      city: cityText,
      province: provinceText,
      profilepic_url,
    });

    await refreshUser(res, req.user.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

async function profileAddPortfolio(req, res) {
  try {
    if (req.uploadError) return fail(res, 400, req.uploadError);
    const { title, description } = req.body;
    if (!title?.trim()) return fail(res, 400, "Judul portfolio wajib diisi");

    const imageFile = req.files?.portfolio_image?.[0];
    const docFile = req.files?.portfolio_file?.[0];
    if (!imageFile && !docFile) {
      return fail(res, 400, "Upload gambar atau file portfolio");
    }

    const id = await portfolioModel.create({
      user_id: req.user.id,
      title: title.trim(),
      description: description?.trim() || "",
      image_url: imageFile ? "/uploads/profile/" + imageFile.filename : "",
      file_url: docFile ? "/uploads/profile/" + docFile.filename : "",
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
    const [totalUsers, pendingKtp, totalOrders, totalServices, totalJobs, recentKtp] =
      await Promise.all([
        userModel.countUsers(),
        userModel.countPendingKtp(),
        orderModel.countAll(),
        serviceModel.countAll(),
        jobModel.countAll(),
        userModel.findPendingKtp(),
      ]);
    res.json({
      ok: true,
      stats: { totalUsers, pendingKtp, totalOrders, totalServices, totalJobs },
      recentKtp: recentKtp.slice(0, 5),
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

async function adminOrders(req, res) {
  try {
    const data = await orderModel.findAllAdmin();
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
    if (!target) return fail(res, 404, "Pengguna tidak ditemukan");
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
    if (!target) return fail(res, 404, "Pengguna tidak ditemukan");
    if (target.ktp_status !== "PENDING") return fail(res, 400, "Status KTP bukan antrian");

    const reason = req.body.reason?.trim() || "Ditolak admin";
    await userModel.rejectKtp(req.params.id, reason);
    await notify.notify({
      userId: target.id,
      actorId: req.user.id,
      type: "KTP_REJECTED",
      title: "Verifikasi KTP ditolak",
      message: `Pengajuan KTP ditolak. Alasan: ${reason}. Silakan unggah ulang.`,
      linkUrl: "/verify/ktp",
      referenceType: "user",
      referenceId: target.id,
    });
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
  jasaSewa,
  jasaChat,
  jasaChatSend,
  lowonganList,
  lowonganShow,
  lowonganCreate,
  lowonganUpdate,
  lowonganDelete,
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
  profileAddPortfolio,
  profileDeletePortfolio,
  adminDashboard,
  adminUsers,
  adminOrders,
  adminKtpQueue,
  adminKtpDetail,
  adminApproveKtp,
  adminRejectKtp,
};
