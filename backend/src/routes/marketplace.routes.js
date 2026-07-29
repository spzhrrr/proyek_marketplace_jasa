import express from "express";
import api from "../controllers/marketplace.controller.js";
import {
  requireLoginApi,
  requireAdminApi,
  requireContactVerifiedApi,
  requireKtpApprovedApi,
  requireSellerVerifiedApi,
} from "../middleware/apiGuards.js";
import { handleJasaPostUpload } from "../middleware/uploadMarketplace.js";
import { handleKtpUpload } from "../middleware/uploadKtp.js";
import { handleWorkUpload } from "../middleware/uploadWork.js";
import { handleApplicationUpload } from "../middleware/uploadApplication.js";
import { handleProfilePortfolioUpload, handleProfilePicUpload } from "../middleware/uploadProfile.js";

const router = express.Router();

router.get("/home", api.home);
router.get("/me", api.me);
router.post("/auth/register", api.register);
router.post("/auth/login", api.login);
router.post("/auth/logout", api.logout);

router.get("/categories", api.categories);

router.get("/jasa", api.jasaList);
router.get("/jasa/:id", api.jasaShow);
router.post("/jasa", requireLoginApi, requireSellerVerifiedApi, handleJasaPostUpload, api.jasaCreate);
router.put("/jasa/:id", requireLoginApi, requireSellerVerifiedApi, handleJasaPostUpload, api.jasaUpdate);
router.delete("/jasa/:id", requireLoginApi, requireSellerVerifiedApi, api.jasaDelete);
router.post("/jasa/:id/sewa", requireLoginApi, requireKtpApprovedApi, api.jasaSewa);
router.get("/jasa/:id/chat", requireLoginApi, api.jasaChat);
router.post("/jasa/:id/chat", requireLoginApi, api.jasaChatSend);

router.get("/lowongan", api.lowonganList);
router.get("/lowongan/:id", api.lowonganShow);
router.post(
  "/lowongan",
  requireLoginApi,
  requireKtpApprovedApi,
  api.lowonganCreate,
);
router.put("/lowongan/:id", requireLoginApi, requireKtpApprovedApi, api.lowonganUpdate);
router.delete("/lowongan/:id", requireLoginApi, requireKtpApprovedApi, api.lowonganDelete);
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
router.post(
  "/profile/portfolio",
  requireLoginApi,
  handleProfilePortfolioUpload,
  api.profileAddPortfolio,
);
router.delete("/profile/portfolio/:itemId", requireLoginApi, api.profileDeletePortfolio);

router.get("/admin/dashboard", requireLoginApi, requireAdminApi, api.adminDashboard);
router.get("/admin/users", requireLoginApi, requireAdminApi, api.adminUsers);
router.get("/admin/orders", requireLoginApi, requireAdminApi, api.adminOrders);
router.get("/admin/ktp", requireLoginApi, requireAdminApi, api.adminKtpQueue);
router.get("/admin/ktp/:id", requireLoginApi, requireAdminApi, api.adminKtpDetail);
router.post("/admin/ktp/:id/approve", requireLoginApi, requireAdminApi, api.adminApproveKtp);
router.post("/admin/ktp/:id/reject", requireLoginApi, requireAdminApi, api.adminRejectKtp);

export default router;
