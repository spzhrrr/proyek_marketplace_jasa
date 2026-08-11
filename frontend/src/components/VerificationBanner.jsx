import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { needsVerification, isKtpApproved, isBankVerified, bankStatusLabel } from "../utils/verification.js";
import { isProfileComplete } from "../utils/profile.js";

export default function VerificationBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // Hub/step verify sudah punya CTA sendiri — banner di sini hanya dobel
  if (pathname.startsWith("/verify")) return null;
  if (!user || !isProfileComplete(user)) return null;

  if (needsVerification(user)) {
    let message = "Lengkapi verifikasi agar bisa menyewa jasa, posting lowongan, dan melamar kerja.";
    let cta = "Lengkapi verifikasi";
    let showBtn = true;

    if (!user.email_verified_at) {
      message = "Langkah 1: Verifikasi email kamu dengan kode OTP.";
      cta = "Verifikasi email";
    } else if (!user.phone_verified_at) {
      message = "Langkah 2: Verifikasi nomor HP kamu dengan kode OTP.";
      cta = "Verifikasi HP";
    } else if (user.ktp_status === "PENDING") {
      message = "KTP kamu sedang dicek admin (1–2 hari kerja). Kamu bisa jelajahi jasa sambil menunggu.";
      showBtn = false;
    } else if (user.ktp_status === "REJECTED") {
      message = "KTP ditolak. Perbaiki dan unggah ulang agar bisa transaksi.";
      cta = "Unggah ulang KTP";
    } else if (user.ktp_status !== "APPROVED") {
      message = "Langkah 3: Unggah KTP untuk bisa menyewa jasa dan melamar kerja.";
      cta = "Verifikasi KTP";
    }

    return (
      <div className="verify-banner">
        <div className="verify-banner-inner">
          <span>{message}</span>
          {showBtn && (
            <Link to="/verify" className="btn btn-sm btn-primary">{cta}</Link>
          )}
        </div>
      </div>
    );
  }

  if (isKtpApproved(user) && user.bank_status === "PENDING") {
    return (
      <div className="verify-banner verify-banner-soft">
        <div className="verify-banner-inner">
          <span>Rekening bank kamu sedang ditinjau admin ({bankStatusLabel("PENDING")}).</span>
          <Link to="/verify/bank" className="btn btn-sm">Lihat status</Link>
        </div>
      </div>
    );
  }

  if (isKtpApproved(user) && user.bank_status === "REJECTED") {
    return (
      <div className="verify-banner verify-banner-warn">
        <div className="verify-banner-inner">
          <span>Rekening bank ditolak. Perbaiki data dan ajukan ulang.</span>
          <Link to="/verify/bank" className="btn btn-sm btn-primary">Ajukan ulang</Link>
        </div>
      </div>
    );
  }

  if (isKtpApproved(user) && !isBankVerified(user)) {
    return (
      <div className="verify-banner verify-banner-soft">
        <div className="verify-banner-inner">
          <span>Isi rekening bank jika ingin post jasa dan menerima pendapatan (diverifikasi admin).</span>
          <Link to="/verify/bank" className="btn btn-sm btn-primary">Lengkapi rekening</Link>
        </div>
      </div>
    );
  }

  return null;
}
