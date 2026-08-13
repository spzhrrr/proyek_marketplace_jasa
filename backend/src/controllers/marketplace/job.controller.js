import userModel from "../../models/user/userModel.js";
import jobModel, { parseJobSkills, stripJobSkills, withJobSkills } from "../../models/marketplace/jobModel.js";
import chatModel from "../../models/communication/chatModel.js";
import applicationModel from "../../models/transaction/applicationModel.js";
import notify from "../../utils/notify.js";
import { jobLocks } from "../../services/order/listingLifecycle.js";
import { fullName } from "../../utils/userDisplay.js";
import { parseMoneyInput } from "../../utils/money.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { isContactVerified, isKtpApproved } from "../../services/user/verification.js";
import { normalizeJobWindow, isApplyWindowOpen } from "../../services/order/jobWindow.js";
import { uid, fail, validateCategory } from "./_helpers.js";
import { mergeLowonganChatPeers, ownerCanMessageLowonganPeer } from "./_chat.helpers.js";

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
      await notify({
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

    await notify({
      userId: job.buyer_id,
      actorId: req.user.id,
      type: "JOB_APPLICATION",
      title: "📩 Lamaran Kerja Baru Masuk",
      message: `${fullName(req.user)} telah melamar lowongan "${job.title}". Klik untuk meninjau penawaran.`,
      linkUrl: `/lowongan/${job.id}/lamaran`,
      referenceType: "application",
      referenceId: applicationId,
    });

    await notify({
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
};
