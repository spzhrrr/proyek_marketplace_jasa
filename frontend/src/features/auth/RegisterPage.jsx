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
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      await register(form);
      nav("/lengkapi-profil");
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    } finally {
      setLoading(false);
    }
  }

  function field(k) {
    return (e) => setForm({ ...form, [k]: e.target.value });
  }

  return (
    <Layout narrow auth>
      <div className="panel auth-card">
        <h1>Buat akun baru</h1>
        <p className="muted">Daftar gratis — setelah ini kamu akan diminta lengkapi profil dan verifikasi akun</p>
        <div className="onboarding-steps-preview">
          <strong>Alur setelah daftar:</strong>
          <ol>
            <li>Lengkapi profil & foto</li>
            <li>Verifikasi email, HP, dan KTP</li>
            <li>Mulai cari jasa, posting kerja, atau jual jasa</li>
          </ol>
        </div>
        {errors.map((e) => (
          <Alert key={e}>{e}</Alert>
        ))}
        <form onSubmit={submit} className="form">
          <div className="form-row">
            <label>Nama depan<input required value={form.first_name} onChange={field("first_name")} /></label>
            <label>Nama belakang<input required value={form.last_name} onChange={field("last_name")} /></label>
          </div>
          <label>Email<input type="email" required value={form.email} onChange={field("email")} placeholder="nama@email.com" /></label>
          <label>No. HP<input required value={form.phone} onChange={field("phone")} placeholder="08xxxxxxxxxx" /></label>
          <label>Password<span className="hint" style={{ display: "block", fontWeight: 400 }}>Min. 8 karakter, huruf dan angka</span><input type="password" required value={form.password} onChange={field("password")} /></label>
          <label>Konfirmasi password<input type="password" required value={form.password_confirm} onChange={field("password_confirm")} /></label>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Mendaftar..." : "Daftar"}
          </button>
        </form>
        <p className="auth-divider muted">
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </p>
      </div>
    </Layout>
  );
}
