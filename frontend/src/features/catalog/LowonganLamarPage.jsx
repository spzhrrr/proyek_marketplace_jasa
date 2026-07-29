import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { rupiah } from "../../utils/format.js";

function LamarForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [proposed_price, setPrice] = useState("");
  const [estimated_days, setDays] = useState("7");
  const [catatan, setCatatan] = useState("");
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.lowonganShow(id).then((d) => {
      setData(d.data);
      setMeta(d.meta);
      setPrice(String(d.data.budget || ""));
    });
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (catatan.trim().length < 20) {
      setError("Surat pengantar minimal 20 karakter");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("proposed_price", proposed_price);
    fd.append("estimated_days", estimated_days);
    fd.append("catatan", catatan);
    if (portfolio) fd.append("portfolio_file", portfolio);
    try {
      await api.lowonganLamar(id, fd);
      nav("/dashboard", { state: { msg: "Lamaran terkirim! Tunggu pemberi kerja meninjau lamaran kamu." } });
    } catch (err) {
      if (err.need === "ktp" || err.need === "contact") nav("/verify");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!data) return <Loading />;

  const minOffer = Math.round(data.budget * 0.5);
  const maxOffer = Math.round(data.budget * 1.5);

  if (meta?.is_owner) {
    return (
      <PagePanel title="Tidak bisa melamar" backTo={`/lowongan/${id}`}>
        <Alert type="warn">Ini lowongan milik kamu sendiri. Kamu tidak bisa melamar pekerjaan yang kamu post.</Alert>
      </PagePanel>
    );
  }

  if (meta?.has_applied) {
    return (
      <PagePanel title="Sudah melamar" backTo={`/lowongan/${id}`}>
        <Alert type="success">Kamu sudah mengirim lamaran untuk lowongan ini.</Alert>
        <Link to="/dashboard" className="btn btn-primary">Ke Beranda Saya</Link>
      </PagePanel>
    );
  }

  return (
    <PagePanel
      title="Lamar Pekerjaan"
      subtitle={`${data.title} — anggaran ${rupiah(data.budget)}`}
      backTo={`/lowongan/${id}`}
      backLabel="← Kembali ke detail lowongan"
      compact
    >
      <HelpBox title="Tips lamaran yang baik">
        <ul>
          <li>Jelaskan pengalaman relevan di surat pengantar (min. 20 karakter)</li>
          <li>Penawaran harga bisa antara 50%–150% dari anggaran</li>
          <li>Lampirkan portfolio jika ada — opsional tapi membantu</li>
        </ul>
      </HelpBox>

      <p className="hint">Rentang penawaran: {rupiah(minOffer)} – {rupiah(maxOffer)}</p>
      <Alert>{error}</Alert>
      <form onSubmit={submit} className="form">
        <div className="form-row">
          <label>
            Penawaran harga (Rp)
            <input required type="number" min={minOffer} max={maxOffer} value={proposed_price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label>
            Estimasi pengerjaan (hari)
            <input required type="number" min="1" max="30" value={estimated_days} onChange={(e) => setDays(e.target.value)} />
          </label>
        </div>
        <label>
          Surat pengantar (min. 20 karakter)
          <textarea required rows={5} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Jelaskan pengalaman dan kenapa kamu cocok untuk pekerjaan ini..." />
        </label>
        <label>
          Portfolio (PDF, DOC, atau gambar) — opsional
          <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setPortfolio(e.target.files[0])} />
        </label>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Mengirim..." : "Kirim Lamaran"}
          </button>
          <Link to={`/lowongan/${id}`} className="btn">Batal</Link>
        </div>
      </form>
    </PagePanel>
  );
}

export default function LowonganLamarPage() {
  return (
    <Layout wide compact>
      <ProtectedRoute><LamarForm /></ProtectedRoute>
    </Layout>
  );
}
