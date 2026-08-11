import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import VerifyStepper from "../../components/VerifyStepper.jsx";
import VerifyShell from "../../components/VerifyShell.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

function PhoneVerify() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [hub, setHub] = useState(null);
  const [phone, setPhone] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.verifyHub(), api.verifyPhoneStatus()]).then(([h, s]) => {
      setHub(h);
      setPhone(s.phone);
      if (s.mockOtp) setMockOtp(s.mockOtp);
    });
  }, []);

  async function send() {
    setError("");
    setLoading(true);
    try {
      const d = await api.sendPhoneOtp();
      if (d.mockOtp) setMockOtp(d.mockOtp);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.confirmPhoneOtp(otp);
      await refresh();
      nav("/verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!hub) return null;

  if (!hub.steps.email.done) {
    return (
      <VerifyShell title="Nomor HP" subtitle="Selesaikan email dulu sebelum verifikasi HP.">
        <Alert type="warn">Verifikasi email terlebih dahulu sebelum verifikasi nomor HP.</Alert>
        <div className="verify-actions">
          <Link to="/verify/email" className="btn btn-primary">Verifikasi Email dulu</Link>
        </div>
      </VerifyShell>
    );
  }

  if (hub.steps.phone.done) {
    return (
      <VerifyShell title="Nomor HP" subtitle="Nomor HP kamu sudah terverifikasi.">
        <Alert type="success">Nomor HP sudah terverifikasi.</Alert>
        <Link to="/verify" className="btn">← Kembali ke halaman verifikasi</Link>
      </VerifyShell>
    );
  }

  return (
    <VerifyShell title="Nomor HP" subtitle="Masukkan kode 6 digit yang dikirim ke nomor HP kamu.">
      <VerifyStepper steps={hub.steps} current="phone" />

      <div className="post-form-grid-layout" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="form-column-card">
          <h3 className="column-section-title">🔑 Masukkan Kode OTP Nomor HP</h3>

          <p style={{ fontSize: "0.875rem", color: "#334155", marginBottom: "12px" }}>
            Kode OTP dikirim ke <strong>{phone || "-"}</strong>.
          </p>

          {mockOtp && (
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "10px 14px", borderRadius: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "0.8rem", color: "#0369a1" }}>💡 Kode simulasi OTP kamu: <strong style={{ fontSize: "1.1rem", letterSpacing: "2px", color: "#0284c7" }}>{mockOtp}</strong></span>
            </div>
          )}

          <Alert type="error">{error}</Alert>

          <form onSubmit={confirm} className="form">
            <div className="form-group-sm">
              <label className="form-label-bold">Kode OTP 6-Digit <span className="text-danger">*</span></label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                inputMode="numeric"
                className="form-input-compact"
                style={{ fontSize: "1.4rem", letterSpacing: "4px", textAlign: "center", fontWeight: "bold" }}
                placeholder="000000"
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1 }} disabled={loading || otp.length < 6}>
                {loading ? "Memverifikasi..." : "Konfirmasi Nomor HP →"}
              </button>
              <button type="button" className="btn" onClick={send} disabled={loading}>
                {sent ? "Kirim Ulang OTP" : "Kirim OTP"}
              </button>
            </div>
          </form>
        </div>

        <div className="form-column-card">
          <h3 className="column-section-title">💡 Petunjuk Verifikasi Nomor HP</h3>
          <div className="help-box-content" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.825rem", color: "#475569" }}>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <strong style={{ color: "#0f172a" }}>✓ Pastikan Nomor Aktif</strong>
              <p style={{ margin: "2px 0 0", color: "#64748b" }}>Pastikan nomor seluler terpasang di HP yang aktif menerima SMS atau WhatsApp.</p>
            </div>
          </div>
        </div>
      </div>
    </VerifyShell>
  );
}

export default function VerifyPhonePage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute><PhoneVerify /></ProtectedRoute>
    </Layout>
  );
}
