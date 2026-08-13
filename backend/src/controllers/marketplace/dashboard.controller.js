import { pool } from "../../config/db.js";
import userModel from "../../models/user/userModel.js";
import serviceModel from "../../models/marketplace/serviceModel.js";
import jobModel from "../../models/marketplace/jobModel.js";
import orderModel from "../../models/transaction/orderModel.js";
import payoutModel from "../../models/transaction/payoutModel.js";
import applicationModel from "../../models/transaction/applicationModel.js";
import withdrawalModel from "../../models/transaction/withdrawalModel.js";
import { jasaLocks, jobLocks } from "../../services/order/listingLifecycle.js";
import { getErrorMessage } from "../../utils/errorMessage.js";
import walletLedger from "../../services/payment/walletLedger.js";
import { expireStaleOrders, PENDING_ACCEPT_HOURS, UNPAID_PAY_HOURS } from "../../services/order/orderExpiry.js";

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

    const servicesWithCounts = await Promise.all(
      (myServices || []).map(async (s) => {
        const pending = pendingByService[Number(s.id)] || 0;
        const active = activeByService[Number(s.id)] || 0;
        const locks = await jasaLocks(s.id);
        return {
          ...s,
          pending_requests_count: pending,
          active_orders_count: active,
          chat_peers_count: chatByListing.jasa[Number(s.id)] || 0,
          can_edit: locks.can_edit,
          can_toggle: locks.can_toggle,
          can_delete: locks.can_delete,
          lock_reason: locks.lock_reason,
        };
      }),
    );

    const jobsWithCounts = await Promise.all(
      (myJobs || []).map(async (j) => {
        const locks = await jobLocks(j.id, j);
        return {
          ...j,
          chat_peers_count: chatByListing.lowongan[Number(j.id)] || 0,
          can_edit: locks.can_edit,
          can_toggle: locks.can_toggle,
          can_delete: locks.can_delete,
          can_close: locks.can_close,
          lock_reason: locks.lock_reason,
        };
      }),
    );

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

export default {
  dashboard,
};
