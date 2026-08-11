import { Link } from "react-router-dom";
import VerifyStepper from "../../components/VerifyStepper.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import Layout from "../../layouts/Layout.jsx";
import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { ktpStatusLabel } from "../../utils/verification.js";
import { useAuth } from "../../context/AuthContext.jsx";
import VerifyShell from "../../components/VerifyShell.jsx";

function VerifyContent() {
  const { user } = useAuth();
  const [d, setD] = useState(null);

  useEffect(() => {
    api.verifyHub().then(setD);
  }, []);

  if (!d) return <Loading />;

  const allDone = d.level1 && d.level2;

  return (
    <VerifyShell kicker="Keamanan" title="Akun" subtitle="Lengkapi verifikasi untuk membuka jual-beli jasa dan lamaran kerja." backTo="/dashboard">
      <VerifyStepper steps={d.steps} current={d.nextStep} />

      <div className="post-form-grid-layout" style={{ gridTemplateColumns: "1.2fr 1fr", marginTop: "16px", gap: "16px" }}>
        {/* Left Column: Active Step Action Box */}
        <div className="form-column-card">
          <h3 className="column-section-title" style={{ fontSize: "0.95rem", fontWeight: 900, color: "#0f172a", marginBottom: "12px" }}>
            ⚡ Langkah Verifikasi Aktif
          </h3>

          {allDone && d.level3 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Alert type="success">🎉 Semua langkah verifikasi selesai. Hub ini tidak wajib dikunjungi lagi — status tetap ada di profil kamu.</Alert>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link to="/dashboard" className="btn btn-primary" style={{ borderRadius: "999px", padding: "10px 22px", fontWeight: 800 }}>
                  Ke Beranda Saya →
                </Link>
                <Link to={`/profile/${d.user?.id || user?.id}`} className="btn" style={{ borderRadius: "999px", padding: "10px 22px", fontWeight: 800 }}>
                  Lihat status di profil
                </Link>
              </div>
            </div>
          ) : allDone ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Alert type="success">
                ✅ Identitas utama selesai. Kamu sudah bisa sewa jasa, posting lowongan, dan melamar. Rekening bank hanya jika ingin jual jasa / tarik dana.
              </Alert>
              <Link to="/dashboard" className="btn" style={{ borderRadius: "999px", padding: "10px 22px", fontWeight: 800, alignSelf: "flex-start" }}>
                Lanjut ke Beranda Saya →
              </Link>
              
              {!d.level3 && d.steps.bank?.canSubmit && (
                <div className="info-box-compact" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "18px", borderRadius: "16px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0284c7", fontWeight: 800 }}>🏦 Langkah 4 — Rekening Bank (Untuk Jual Jasa)</h4>
                  <p style={{ margin: "0 0 14px", fontSize: "0.875rem", color: "#334155" }}>Diperlukan agar kamu bisa posting jasa dan menerima penarikan pendapatan ke bank kamu.</p>
                  <Link to="/verify/bank" className="btn btn-primary" style={{ borderRadius: "999px", padding: "10px 22px", fontWeight: 800 }}>Isi Rekening Bank Sekarang →</Link>
                </div>
              )}
              
              {!d.level3 && d.steps.bank?.pending && (
                <Alert type="info">
                  ⏳ Rekening bank kamu sedang ditinjau admin. Kamu akan mendapat notifikasi begitu disetujui.
                </Alert>
              )}
              
              {!d.level3 && d.steps.bank?.status === "REJECTED" && (
                <div>
                  <Alert type="danger">Rekening ditolak: {d.steps.bank.rejectedReason || "Perbaiki data rekening"}</Alert>
                  <Link to="/verify/bank" className="btn btn-primary" style={{ marginTop: "12px", borderRadius: "999px" }}>Ajukan Ulang Rekening Bank →</Link>
                </div>
              )}
            </div>
          ) : (
            <>
              {!d.steps.email.done && (
                <div className="info-box-compact" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "18px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0284c7" }}>📧 Langkah 1 — Verifikasi Email OTP</h4>
                  <p style={{ margin: "0 0 14px", fontSize: "0.875rem", color: "#334155" }}>Kami mengirimkan kode OTP 6 digit ke <strong>{d.user.email}</strong>.</p>
                  <Link to="/verify/email" className="btn btn-primary btn-lg">Lanjut Verifikasi Email →</Link>
                </div>
              )}

              {d.steps.email.done && !d.steps.phone.done && (
                <div className="info-box-compact" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "18px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0284c7" }}>📱 Langkah 2 — Verifikasi Nomor HP</h4>
                  <p style={{ margin: "0 0 14px", fontSize: "0.875rem", color: "#334155" }}>Kami mengirimkan kode OTP SMS/WhatsApp ke <strong>{d.user.phone}</strong>.</p>
                  <Link to="/verify/phone" className="btn btn-primary btn-lg">Lanjut Verifikasi Nomor HP →</Link>
                </div>
              )}

              {d.steps.email.done && d.steps.phone.done && !d.steps.ktp.done && (
                <div className="info-box-compact" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "18px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0284c7" }}>🪪 Langkah 3 — Verifikasi Foto KTP</h4>
                  <p style={{ margin: "0 0 8px", fontSize: "0.875rem", color: "#334155" }}>Status: <strong>{ktpStatusLabel(d.steps.ktp.status)}</strong></p>
                  {d.steps.ktp.rejectedReason && (
                    <Alert type="danger" style={{ marginTop: "8px" }}>Alasan penolakan: {d.steps.ktp.rejectedReason}</Alert>
                  )}
                  {d.steps.ktp.pending ? (
                    <p style={{ fontSize: "0.825rem", color: "#64748b", margin: "10px 0 0" }}>Dokumen sedang diverifikasi tim admin (1-2 hari kerja). Kamu tetap dapat menjelajahi jasa sambil menunggu.</p>
                  ) : d.steps.ktp.canSubmit ? (
                    <Link to="/verify/ktp" className="btn btn-primary btn-lg" style={{ marginTop: "12px" }}>
                      {d.steps.ktp.status === "REJECTED" ? "Unggah Ulang KTP →" : "Unggah Foto KTP Sekarang →"}
                    </Link>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Column: Security Guidance Box */}
        <div className="form-column-card">
          <h3 className="column-section-title">🛡️ Manfaat & Keamanan Akun</h3>
          <div className="help-box-content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <strong style={{ display: "block", fontSize: "0.85rem", color: "#0f172a" }}>📧 Email & Nomor HP (OTP)</strong>
              <span style={{ fontSize: "0.775rem", color: "#64748b" }}>Memastikan notifikasi transaksi & laporan pekerjaan langsung terhubung ke kontak kamu.</span>
            </div>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <strong style={{ display: "block", fontSize: "0.85rem", color: "#0f172a" }}>🪪 KTP (Review Admin)</strong>
              <span style={{ fontSize: "0.775rem", color: "#64748b" }}>Mencegah penipuan akun palsu & memberikan lencana terverifikasi terpercaya di profil kamu.</span>
            </div>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <strong style={{ display: "block", fontSize: "0.85rem", color: "#0f172a" }}>🏦 Rekening Bank (Seller Only)</strong>
              <span style={{ fontSize: "0.775rem", color: "#64748b" }}>Tujuan pencairan otomatis hasil kerja kamu langsung ke rekening bank pribadi.</span>
            </div>
          </div>
        </div>
      </div>
    </VerifyShell>
  );
}

export default function VerifyHubPage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute><VerifyContent /></ProtectedRoute>
    </Layout>
  );
}
