import express from "express";
import api from "../controllers/marketplace/index.js";
import {
  requireLoginApi,
  requireAdminApi,
  requireKtpApprovedApi,
  requireSellerVerifiedApi,
} from "../middleware/apiGuards.js";
import { handleJasaPostUpload } from "../middleware/uploadMarketplace.js";
import { handleKtpUpload } from "../middleware/uploadKtp.js";
import { handleWorkUpload } from "../middleware/uploadWork.js";
import { handleApplicationUpload } from "../middleware/uploadApplication.js";
import { handleProfilePicUpload, handleProfilePortfolioUpload } from "../middleware/uploadProfile.js";

const router = express.Router();

router.get("/home", api.home);
router.get("/me", api.me);
router.post("/auth/register", api.register);
router.post("/auth/login", api.login);
router.post("/auth/logout", api.logout);

router.get("/categories", api.categories);

router.get("/chats", requireLoginApi, api.chatInbox);
router.get("/chats/thread", requireLoginApi, api.chatThread);
router.post("/chats", requireLoginApi, api.chatSend);
router.post("/chats/read", requireLoginApi, api.chatRead);

router.get("/jasa", api.jasaList);
router.get("/jasa/:id", api.jasaShow);
router.post("/jasa", requireLoginApi, requireSellerVerifiedApi, handleJasaPostUpload, api.jasaCreate);
router.put("/jasa/:id", requireLoginApi, requireSellerVerifiedApi, handleJasaPostUpload, api.jasaUpdate);
router.patch("/jasa/:id/toggle-active", requireLoginApi, requireSellerVerifiedApi, api.jasaToggleActive);
router.delete("/jasa/:id", requireLoginApi, requireSellerVerifiedApi, api.jasaDelete);
router.post("/jasa/:id/sewa", requireLoginApi, requireKtpApprovedApi, api.jasaSewa);
router.get("/jasa/:id/requests", requireLoginApi, api.getServiceRequests);
router.get("/jasa/:id/chat", requireLoginApi, api.jasaChat);
router.post("/jasa/:id/chat", requireLoginApi, api.jasaChatSend);

router.get("/lowongan", api.lowonganList);
router.get("/lowongan/:id", api.lowonganShow);
router.get("/lowongan/:id/lamaran", requireLoginApi, api.getJobApplications);
router.post(
  "/lowongan",
  requireLoginApi,
  requireKtpApprovedApi,
  api.lowonganCreate,
);
router.put("/lowongan/:id", requireLoginApi, requireKtpApprovedApi, api.lowonganUpdate);
router.patch("/lowongan/:id/toggle-active", requireLoginApi, requireKtpApprovedApi, api.lowonganToggleActive);
router.delete("/lowongan/:id", requireLoginApi, requireKtpApprovedApi, api.lowonganDelete);
router.post("/lowongan/:id/tutup", requireLoginApi, requireKtpApprovedApi, api.lowonganClose);
router.post(
  "/lowongan/:id/lamar",
  requireLoginApi,
  requireKtpApprovedApi,
  handleApplicationUpload,
  api.lowonganLamar,
);
router.get("/lowongan/:id/chat", requireLoginApi, api.lowonganChat);
router.post("/lowongan/:id/chat", requireLoginApi, api.lowonganChatSend);

router.get("/dashboard", requireLoginApi, api.dashboard);
router.get("/notifikasi", requireLoginApi, api.notifikasiList);
router.post("/notifikasi/:id/baca", requireLoginApi, api.notifikasiBaca);
router.post("/notifikasi/baca-semua", requireLoginApi, api.notifikasiBacaSemua);

router.get("/orders/:id", requireLoginApi, api.orderShow);
router.post("/orders/:id/terima", requireLoginApi, api.orderAccept);
router.post("/orders/:id/tolak", requireLoginApi, api.orderReject);
router.post("/orders/:id/batal", requireLoginApi, api.orderCancel);
router.get("/orders/:id/bayar", requireLoginApi, api.paymentInfo);
router.post("/orders/:id/bayar", requireLoginApi, api.paymentProcess);
router.get("/orders/:id/cek-bayar", requireLoginApi, api.paymentCheck);
router.post("/orders/:id/kirim-bukti", requireLoginApi, handleWorkUpload, api.submitWork);
router.post("/orders/:id/setujui", requireLoginApi, api.approveWork);
router.post("/orders/:id/minta-revisi", requireLoginApi, api.requestRevision);
router.post("/orders/:id/review", requireLoginApi, api.submitReview);

router.post("/applications/:id/terima", requireLoginApi, api.applicationAccept);
router.post("/applications/:id/tolak", requireLoginApi, api.applicationReject);

router.get("/verify", requireLoginApi, api.verifyHub);
router.get("/verify/email", requireLoginApi, api.verifyEmailStatus);
router.post("/verify/email/send", requireLoginApi, api.sendEmailOtp);
router.post("/verify/email/confirm", requireLoginApi, api.confirmEmailOtp);
router.get("/verify/phone", requireLoginApi, api.verifyPhoneStatus);
router.post("/verify/phone/send", requireLoginApi, api.sendPhoneOtp);
router.post("/verify/phone/confirm", requireLoginApi, api.confirmPhoneOtp);
router.post("/verify/ktp", requireLoginApi, handleKtpUpload, api.submitKtp);
router.post("/verify/bank", requireLoginApi, api.submitBank);

router.get("/profile/:id", api.profileShow);
router.put("/profile/me", requireLoginApi, handleProfilePicUpload, api.profileUpdate);
router.post("/profile/email/start", requireLoginApi, api.profileChangeEmailStart);
router.post("/profile/email/confirm", requireLoginApi, api.profileChangeEmailConfirm);
router.post("/profile/phone/start", requireLoginApi, api.profileChangePhoneStart);
router.post("/profile/phone/confirm", requireLoginApi, api.profileChangePhoneConfirm);
router.post(
  "/profile/portfolio",
  requireLoginApi,
  handleProfilePortfolioUpload,
  api.profileAddPortfolio,
);
router.delete("/profile/portfolio/:itemId", requireLoginApi, api.profileDeletePortfolio);

router.get("/admin/dashboard", requireLoginApi, requireAdminApi, api.adminDashboard);
router.get("/admin/users", requireLoginApi, requireAdminApi, api.adminUsers);
router.get("/admin/users/:id", requireLoginApi, requireAdminApi, api.adminUserDetail);
router.get("/admin/orders", requireLoginApi, requireAdminApi, api.adminOrders);
router.get("/admin/ktp", requireLoginApi, requireAdminApi, api.adminKtpQueue);
router.get("/admin/ktp/:id", requireLoginApi, requireAdminApi, api.adminKtpDetail);
router.post("/admin/ktp/:id/approve", requireLoginApi, requireAdminApi, api.adminApproveKtp);
router.post("/admin/ktp/:id/reject", requireLoginApi, requireAdminApi, api.adminRejectKtp);
router.get("/admin/bank", requireLoginApi, requireAdminApi, api.adminBankQueue);
router.get("/admin/bank/:id", requireLoginApi, requireAdminApi, api.adminBankDetail);
router.post("/admin/bank/:id/approve", requireLoginApi, requireAdminApi, api.adminApproveBank);
router.post("/admin/bank/:id/reject", requireLoginApi, requireAdminApi, api.adminRejectBank);

router.post("/orders/:id/dispute", requireLoginApi, api.orderDispute);
router.post("/admin/orders/:id/resolve-dispute", requireLoginApi, requireAdminApi, api.adminResolveDispute);

router.post("/withdrawals", requireLoginApi, api.requestWithdrawal);
router.get("/withdrawals", requireLoginApi, api.listWithdrawals);
router.get("/admin/withdrawals", requireLoginApi, requireAdminApi, api.adminWithdrawals);
router.post("/admin/withdrawals/:id/approve", requireLoginApi, requireAdminApi, api.adminApproveWithdrawal);
router.post("/admin/withdrawals/:id/reject", requireLoginApi, requireAdminApi, api.adminRejectWithdrawal);

router.post("/reports", requireLoginApi, api.createUserReport);
router.get("/admin/reports", requireLoginApi, requireAdminApi, api.adminReports);
router.post("/admin/reports/:reportId/action", requireLoginApi, requireAdminApi, api.adminActionReport);

export default router;
