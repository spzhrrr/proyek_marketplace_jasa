import { pool } from "../../config/db.js";
import userModel from "../../models/user/userModel.js";
import serviceModel from "../../models/marketplace/serviceModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import paymentModel from "../../models/transaction/paymentModel.js";
import workSubmissionModel from "../../models/transaction/workSubmissionModel.js";
import payoutModel from "../../models/transaction/payoutModel.js";
import reviewModel from "../../models/marketplace/reviewModel.js";
import applicationModel from "../../models/transaction/applicationModel.js";
import notify from "../../utils/notify.js";
import { fullName } from "../../utils/userDisplay.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import gatewayClient from "../../services/payment/gatewayClient.js";
import { applyPaymentSuccess } from "../../services/payment/paymentFlow.js";
import { PAYMENT_METHODS } from "../../services/payment/paymentMethods.js";
import { GATEWAY_FRONTEND_URL } from "../../config/gateway.js";
import portfolioModel from "../../models/user/portfolioModel.js";
import { releaseEscrowToSeller } from "../../services/payment/escrowFlow.js";
import { expireStaleOrders, cancelUnpaidOrderInTx, PENDING_ACCEPT_HOURS, UNPAID_PAY_HOURS } from "../../services/order/orderExpiry.js";
import { uid, fail, loadSubmissionFiles } from "./_helpers.js";

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

    await notify({
      userId: order.buyer_id,
      actorId: req.user.id,
      type: "ORDER_ACCEPTED",
      title: "Permintaan sewa diterima",
      message: `${fullName(req.user)} menerima permintaan. Silakan lakukan pembayaran.`,
      linkUrl: "/orders/" + order.id,
      referenceType: "order",
      referenceId: order.id,
    });
    await notify({
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
    await notify({
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

    await notify({
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

    await notify({
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

    await notify({
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
    await notify({
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
      await notify({
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

export default {
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
  orderDispute,
};
