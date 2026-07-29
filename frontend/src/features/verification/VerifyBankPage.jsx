import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga"];

function BankForm() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    bank_name: "",
    bank_account_number: "",
    bank_account_holder: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.verifyHub().then((d) => {
      if (d.steps?.bank?.done) nav("/verify", { replace: true });
      if (d.steps?.bank) {
        setForm({
          bank_name: d.steps.bank.bank_name || "",
          bank_account_number: d.steps.bank.bank_account_number || "",
          bank_account_holder: d.steps.bank.bank_account_holder || "",
        });
      }
    });
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.submitBank(form);
      await refresh();
      nav("/verify");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel auth-card">
      <h1>Verifikasi Rekening Bank</h1>
      <p className="muted">Diperlukan untuk memposting jasa dan menerima pencairan dana (verifikasi mock instan).</p>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="form">
        <label>
          Bank
          <select required value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })}>
            <option value="">Pilih bank</option>
            {BANKS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label>
          Nomor rekening
          <input required value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} placeholder="1234567890" />
        </label>
        <label>
          Nama pemilik rekening
          <input required value={form.bank_account_holder} onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })} placeholder="Sesuai buku tabungan" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Menyimpan..." : "Simpan & Verifikasi"}
        </button>
        <Link to="/verify" className="btn" style={{ width: "100%", marginTop: 8 }}>← Kembali</Link>
      </form>
    </div>
  );
}

export default function VerifyBankPage() {
  return (
    <Layout narrow auth>
      <ProtectedRoute><BankForm /></ProtectedRoute>
    </Layout>
  );
}
