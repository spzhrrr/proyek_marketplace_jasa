import serviceModel from "../../models/marketplace/serviceModel.js";
import jobModel from "../../models/marketplace/jobModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import applicationModel from "../../models/transaction/applicationModel.js";
import notify from "../../utils/notify.js";
import { fullName } from "../../utils/userDisplay.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { acceptApplication } from "../../services/order/applicationFlow.js";
import portfolioModel from "../../models/user/portfolioModel.js";
import { uid, fail } from "./_helpers.js";

async function applicationAccept(req, res) {
  try {
    const result = await acceptApplication(req.params.id, req.user.id);
    if (!result.ok) {
      return fail(res, result.status || 400, result.error);
    }

    const { app, orderId, rejectedOthers } = result;

    await notify({
      userId: app.seller_id,
      actorId: req.user.id,
      type: "APPLICATION_ACCEPTED",
      title: "Lamaran diterima",
      message: `${fullName(req.user)} menerima lamaran kamu untuk "${app.job_title}"`,
      linkUrl: "/orders/" + orderId,
      referenceType: "order",
      referenceId: orderId,
    });

    await notify({
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
      await notify({
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
    await notify({
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

export default {
  applicationAccept,
  applicationReject,
  getJobApplications,
  getServiceRequests,
};
