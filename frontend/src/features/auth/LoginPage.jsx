import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { postAuthPath } from "../../utils/profile.js";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedIn = await login(form.email, form.password);
      const backTo = typeof loc.state?.from === "string" ? loc.state.from : "";
      nav(backTo && backTo !== "/login" ? backTo : postAuthPath(loggedIn));
    } catch (err) {
      setError(err.message || "Email atau password tidak sesuai");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout wide auth>
      <div className="auth-wrapper">
        <div className="auth-brand-card">
          <div className="auth-brand-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Tolong<span className="highlight">in</span></span>
          </div>

          <div className="auth-brand-hero">
            <h2>Solusi Terpercaya Cari Jasa & Lowongan Kerja</h2>
            <p>Ribuan freelancer profesional terverifikasi siap menyelesaikan pekerjaan kamu dengan aman & cepat.</p>
          </div>

          <div className="auth-brand-features">
            <div className="auth-feature-item">
              <span className="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </span>
              <div>
                <strong>Escrow System Aman</strong>
                <p>Uang kamu ditahan aman hingga hasil kerja disetujui</p>
              </div>
            </div>
            <div className="auth-feature-item">
              <span className="icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </span>
              <div>
                <strong>Pengerjaan Cepat & Tepat</strong>
                <p>Terhubung langsung dengan freelancer bertalenta</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-form-card">
          <div className="auth-form-header">
            <h1>Selamat Datang Kembali</h1>
            <p className="muted">Masuk ke akun Tolongin kamu untuk melanjutkan</p>
          </div>

          <Alert>{error}</Alert>

          <form onSubmit={submit} className="auth-form">
            <div className="input-group">
              <label htmlFor="login-email">Email</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama@email.com"
                />
              </div>
            </div>

            <div className="input-group">
              <div className="input-label-row">
                <label htmlFor="login-password">Password</label>
              </div>
              <div className="input-with-icon">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="loading-spinner-inline">Memproses...</span>
              ) : (
                "Masuk ke Akun"
              )}
            </button>
          </form>

          <div className="auth-footer-links">
            <p className="muted">
              Belum punya akun Tolongin? <Link to="/register" className="auth-link-bold">Daftar sekarang</Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
