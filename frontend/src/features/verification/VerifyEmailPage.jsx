import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import VerifyStepper from "../../components/VerifyStepper.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

function EmailVerify() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [hub, setHub] = useState(null);
  const [mockOtp, setMockOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.verifyHub(), api.verifyEmailStatus()]).then(([h, s]) => {
      setHub(h);
      if (s.mockOtp) setMockOtp(s.mockOtp);
    });
  }, []);

  async function send() {
    setError("");
    setLoading(true);
    try {
      const d = await api.sendEmailOtp();
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
      await api.confirmEmailOtp(otp);
      await refresh();
      nav("/verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!hub) return null;
  if (hub.steps.email.done) {
    return (
      <div className="panel">
        <Alert type="success">Email sudah terverifikasi.</Alert>
        <Link to="/verify" className="btn">← Kembali ke halaman verifikasi</Link>
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>Verifikasi Email</h1>
      <VerifyStepper steps={hub.steps} current="email" />
      <p className="muted">Kode OTP akan dikirim ke <strong>{hub.user.email}</strong></p>
      {mockOtp && (
        <p className="hint">Kode verifikasi kamu: <strong>{mockOtp}</strong> (salin ke kolom di bawah)</p>
      )}
      <Alert>{error}</Alert>
      <div className="btn-row">
        <button type="button" className="btn btn-sm" onClick={send} disabled={loading}>
          {sent ? "Kirim ulang OTP" : "Kirim OTP"}
        </button>
      </div>
      <form onSubmit={confirm} className="form">
        <label>
          Masukkan kode OTP (6 digit)
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            maxLength={6}
            inputMode="numeric"
            placeholder="000000"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading || otp.length < 6}>
          Konfirmasi Email
        </button>
      </form>
      <Link to="/verify" className="btn">← Kembali</Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Layout narrow>
      <ProtectedRoute><EmailVerify /></ProtectedRoute>
    </Layout>
  );
}
