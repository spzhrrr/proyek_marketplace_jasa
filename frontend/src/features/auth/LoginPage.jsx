import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { postAuthPath } from "../../utils/profile.js";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedIn = await login(form.email, form.password);
      nav(postAuthPath(loggedIn));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout narrow auth>
      <div className="panel auth-card">
        <h1>Selamat datang kembali</h1>
        <p className="muted">Masuk ke akun Marketplace Jasa kamu</p>
        <Alert>{error}</Alert>
        <form onSubmit={submit} className="form">
          <label>
            Email
            <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
          </label>
          <label>
            Password
            <input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
        <p className="auth-divider muted">
          Belum punya akun? <Link to="/register">Daftar gratis</Link>
        </p>
      </div>
    </Layout>
  );
}
