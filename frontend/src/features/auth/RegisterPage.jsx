import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    password_confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErrors([]);

    if (form.password !== form.password_confirm) {
      setErrors(["Password dan konfirmasi password tidak cocok."]);
      return;
    }

    setLoading(true);
    try {
      await register(form);
      nav("/lengkapi-profil");
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message || "Gagal membuat akun"]);
    } finally {
      setLoading(false);
    }
  }

  function field(k) {
    return (e) => setForm({ ...form, [k]: e.target.value });
  }

  return (
    <Layout wide auth>
      <div className="auth-wrapper auth-wrapper-wide">
        <div className="auth-brand-card">
          <div className="auth-brand-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>Tolong<span className="highlight">in</span></span>
          </div>

          <div className="auth-brand-hero">
            <h2>Gabung Ekosistem Tolongin Sekarang</h2>
            <p>Daftar gratis dalam hitungan detik. Cari jasa terpercaya atau mulai hasilkan uang dari keahlian kamu.</p>
          </div>

          <div className="auth-step-timeline">
            <h3>Alur mudah setelah pendaftaran:</h3>
            <div className="timeline-step active">
              <span className="step-num">1</span>
              <div>
                <strong>Buat Akun Gratis</strong>
                <p>Isi data diri dasar & buat sandi yang aman</p>
              </div>
            </div>
            <div className="timeline-step">
              <span className="step-num">2</span>
              <div>
                <strong>Lengkapi Profil & Foto</strong>
                <p>Tambahkan bio, kota, dan foto profil profesional</p>
              </div>
            </div>
            <div className="timeline-step">
              <span className="step-num">3</span>
              <div>
                <strong>Verifikasi & Transaksi</strong>
                <p>Verifikasi kontak & KTP untuk keamanan penuh</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-form-card auth-form-card-wide">
          <div className="auth-form-header">
            <h1>Buat Akun Baru</h1>
            <p className="muted">Isi formulir di bawah untuk memulai pengalaman di Tolongin</p>
          </div>

          {errors.map((e, idx) => (
            <Alert key={idx}>{e}</Alert>
          ))}

          <form onSubmit={submit} className="auth-form">
            <div className="form-row-2col">
              <div className="input-group">
                <label htmlFor="first_name">Nama Depan</label>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    id="first_name"
                    required
                    value={form.first_name}
                    onChange={field("first_name")}
                    placeholder="Nama depan"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="last_name">Nama Belakang</label>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    id="last_name"
                    required
                    value={form.last_name}
                    onChange={field("last_name")}
                    placeholder="Nama belakang"
                  />
                </div>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="input-group">
                <label htmlFor="reg-email">Email Active</label>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={field("email")}
                    placeholder="nama@email.com"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="reg-phone">No. WhatsApp / Telepon</label>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                      <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                  </span>
                  <input
                    id="reg-phone"
                    required
                    value={form.phone}
                    onChange={field("phone")}
                    placeholder="081234567890"
                  />
                </div>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="input-group">
                <div className="input-label-row">
                  <label htmlFor="reg-password">Password</label>
                </div>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={field("password")}
                    placeholder="Min. 8 karakter"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
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

              <div className="input-group">
                <div className="input-label-row">
                  <label htmlFor="reg-confirm-password">Konfirmasi Password</label>
                </div>
                <div className="input-with-icon">
                  <span className="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={form.password_confirm}
                    onChange={field("password_confirm")}
                    placeholder="Ulangi password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
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
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg auth-submit-btn" disabled={loading}>
              {loading ? "Mendaftar Akun Baru..." : "Daftar Sekarang"}
            </button>
          </form>

          <div className="auth-footer-links">
            <p className="muted">
              Sudah mempunyai akun Tolongin? <Link to="/login" className="auth-link-bold">Masuk di sini</Link>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
