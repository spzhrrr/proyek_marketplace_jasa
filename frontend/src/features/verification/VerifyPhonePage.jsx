import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import VerifyStepper from "../../components/VerifyStepper.jsx";
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
      <div className="panel">
        <h1>Verifikasi Nomor HP</h1>
        <Alert type="warn">Verifikasi email terlebih dahulu sebelum verifikasi nomor HP.</Alert>
        <Link to="/verify/email" className="btn btn-primary">Verifikasi Email dulu</Link>
        <Link to="/verify" className="btn">← Kembali</Link>
      </div>
    );
  }

  if (hub.steps.phone.done) {
    return (
      <div className="panel">
        <Alert type="success">Nomor HP sudah terverifikasi.</Alert>
        <Link to="/verify" className="btn">← Kembali ke halaman verifikasi</Link>
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>Verifikasi Nomor HP</h1>
      <VerifyStepper steps={hub.steps} current="phone" />
      <p className="muted">Kode OTP akan dikirim ke <strong>{phone || "-"}</strong></p>
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
          Konfirmasi Nomor HP
        </button>
      </form>
      <Link to="/verify" className="btn">← Kembali</Link>
    </div>
  );
}

export default function VerifyPhonePage() {
  return (
    <Layout narrow>
      <ProtectedRoute><PhoneVerify /></ProtectedRoute>
    </Layout>
  );
}
