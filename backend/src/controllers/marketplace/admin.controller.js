import { pool } from "../../config/db.js";
import userModel from "../../models/user/userModel.js";
import serviceModel from "../../models/marketplace/serviceModel.js";
import jobModel from "../../models/marketplace/jobModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import withdrawalModel from "../../models/transaction/withdrawalModel.js";
import notify from "../../utils/notify.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import { isBankVerified } from "../../services/user/verification.js";
import reportModel from "../../models/communication/reportModel.js";
import { releaseEscrowToSeller, refundEscrowToBuyer } from "../../services/payment/escrowFlow.js";
import walletLedger from "../../services/payment/walletLedger.js";
import { uid, fail, isPlatformAdmin } from "./_helpers.js";

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
    await notify({
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
      await notify({
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
      await notify({
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
    await notify({
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
    await notify({
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
    await notify({
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

    await notify({
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
      await notify({
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
      await notify({
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
