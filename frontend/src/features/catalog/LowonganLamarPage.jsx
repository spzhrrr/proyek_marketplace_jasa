import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { rupiah, isJobUrgent } from "../../utils/format.js";
import { ChatIcon } from "../../components/BellIcon.jsx";

function formatRupiahInput(val) {
  if (!val) return "";
  const raw = String(val).replace(/\D/g, "");
  if (!raw) return "";
  return "Rp " + Number(raw).toLocaleString("id-ID");
}

function parseRawPrice(val) {
  return String(val || "").replace(/\D/g, "");
}

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
      if (isJobUrgent(d.data)) setDays("1");
    });
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const priceNum = Number(parseRawPrice(proposed_price));
    if (!priceNum) {
      setError("Masukkan penawaran harga yang valid");
      return;
    }
    if (priceNum < minOffer || priceNum > maxOffer) {
      setError(`Penawaran harus antara ${rupiah(minOffer)} dan ${rupiah(maxOffer)} (50%–150% anggaran).`);
      return;
    }
    if (catatan.trim().length < 20) {
      setError("Surat pengantar minimal 20 karakter agar lamaran terlihat profesional.");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("proposed_price", String(priceNum));
    fd.append("estimated_days", estimated_days);
    fd.append("catatan", catatan);
    if (portfolio) fd.append("portfolio_file", portfolio);
    try {
      await api.lowonganLamar(id, fd);
      nav("/dashboard#lamaran", { state: { msg: "Lamaran terkirim. Kamu bisa follow up lewat chat kapan saja." } });
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
  const priceNum = Number(parseRawPrice(proposed_price));
  const priceOk = priceNum >= minOffer && priceNum <= maxOffer;

  if (meta?.is_owner) {
    return (
      <div className="post-form-compact-container">
        <Link to={`/lowongan/${id}`} className="back-link-sm">← Kembali ke detail lowongan</Link>
        <div className="form-column-card" style={{ marginTop: 12 }}>
          <h2 className="column-section-title">Tidak bisa melamar</h2>
          <Alert type="warn">Ini lowongan milik kamu. Tinjau pelamar dari halaman kelola.</Alert>
          <Link to={`/lowongan/${id}/lamaran`} className="btn btn-primary" style={{ marginTop: 12 }}>Lihat pelamar</Link>
        </div>
      </div>
    );
  }

  if (data.status !== "OPEN" || meta?.apply_open === false) {
    return (
      <div className="post-form-compact-container">
        <Link to={`/lowongan/${id}`} className="back-link-sm">← Kembali ke detail lowongan</Link>
        <div className="form-column-card" style={{ marginTop: 12 }}>
          <h2 className="column-section-title">Lamaran ditutup</h2>
          <Alert type="warn">Batas akhir lamaran sudah lewat atau pemberi kerja menutup lowongan ini.</Alert>
          <Link to="/lowongan" className="btn btn-primary" style={{ marginTop: 12 }}>Cari lowongan lain</Link>
        </div>
      </div>
    );
  }

  if (meta?.has_applied) {
    return (
      <div className="post-form-compact-container">
        <Link to={`/lowongan/${id}`} className="back-link-sm">← Kembali ke detail lowongan</Link>
        <div className="form-column-card" style={{ marginTop: 12 }}>
          <h2 className="column-section-title">Lamaran sudah terkirim</h2>
          <Alert type="success">Pemberi kerja sedang meninjau penawaran kamu.</Alert>
          <div className="form-action-card-footer" style={{ marginTop: 16 }}>
            <Link to="/dashboard#lamaran" className="btn btn-primary">Lihat status lamaran</Link>
            <Link to={`/lowongan/${id}/chat`} className="btn btn-chat">
              <ChatIcon size={15} /> Follow up lewat chat
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="post-form-compact-container">
      <div className="compact-form-header">
        <Link to={`/lowongan/${id}`} className="back-link-sm">← Kembali ke detail lowongan</Link>
        <h1 className="catalog-display">
          <span className="catalog-display-kicker">Lamar</span>
          <span className="catalog-display-word">Pekerjaan</span>
        </h1>
        <p className="mockup-hero-sub">Kirim penawaran yang jelas. Harga otomatis dalam Rupiah, di rentang anggaran klien.</p>
      </div>

      {error && <Alert type="danger">{error}</Alert>}

      <form onSubmit={submit} className="post-form-grid-layout">
        <div className="form-column-card">
          <h3 className="column-section-title">Penawaran kamu</h3>

          <div className="form-group-sm form-row-2">
            <div>
              <label className="form-label-bold">Harga tawaran <span className="text-danger">*</span></label>
              <input
                required
                type="text"
                inputMode="numeric"
                className="form-input-compact price-input-highlight"
                value={formatRupiahInput(proposed_price)}
                onChange={(e) => setPrice(parseRawPrice(e.target.value))}
                placeholder={rupiah(data.budget)}
              />
              <p className={`lamar-range-hint ${priceOk ? "is-ok" : "is-off"}`}>
                Rentang {rupiah(minOffer)} – {rupiah(maxOffer)}
              </p>
            </div>
            <div>
              <label className="form-label-bold">Estimasi pengerjaan <span className="text-danger">*</span></label>
              <input
                required
                type="number"
                min="1"
                max={isJobUrgent(data) ? 1 : 30}
                className="form-input-compact"
                value={estimated_days}
                disabled={isJobUrgent(data)}
                onChange={(e) => setDays(e.target.value)}
              />
              <p className="lamar-range-hint">
                {isJobUrgent(data)
                  ? "Lowongan urgent: pekerjaan harus bisa dimulai hari ini."
                  : "Berapa hari kamu butuh untuk menyelesaikan kerja, bukan batas melamar."}
              </p>
            </div>
          </div>

          <div className="form-group-sm">
            <label className="form-label-bold">Surat pengantar <span className="text-danger">*</span></label>
            <textarea
              required
              rows={5}
              className="form-input-compact"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Jelaskan pengalaman relevan, pendekatan pengerjaan, dan kapan kamu bisa mulai."
            />
            <span className={`char-hint ${catatan.trim().length >= 20 ? "is-ok" : ""}`}>
              {catatan.trim().length} / min. 20 karakter
            </span>
          </div>

          <div className="form-group-sm" style={{ marginBottom: 0 }}>
            <label className="form-label-bold">Portofolio <span style={{ fontWeight: 500, color: "#94a3b8" }}>· opsional</span></label>
            <label className={`lamar-file ${portfolio ? "has-file" : ""}`}>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setPortfolio(e.target.files[0] || null)}
              />
              <strong>{portfolio ? portfolio.name : "Pilih PDF, gambar, atau dokumen"}</strong>
              <small>Maks sesuai batas unggah server. Bisa dilewati jika portofolio sudah di profil.</small>
            </label>
          </div>
        </div>

        <div className="form-column-card">
          <h3 className="column-section-title">Ringkasan lowongan</h3>
          <p className="lamar-job-title">{data.title}</p>
          <div className="ld-budget">
            <span>Anggaran klien</span>
            <strong>{rupiah(data.budget)}</strong>
          </div>
          <p className="post-hint" style={{ marginTop: 0 }}>
            <strong>Cara kerja</strong>
            Jika diterima, pesanan escrow dibuat otomatis. Kamu tetap bisa chat pemberi kerja untuk follow up.
          </p>
          <div className="form-action-card-footer">
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || !priceOk}>
              {loading ? "Mengirim…" : "Kirim lamaran"}
            </button>
            <Link to={`/lowongan/${id}`} className="form-cancel-link">Batal</Link>
            <Link to={`/lowongan/${id}/chat`} className="btn btn-chat btn-block" style={{ marginTop: 8 }}>
              <ChatIcon size={15} /> Tanya dulu lewat chat
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function LowonganLamarPage() {
  return (
    <Layout wide compact bgClass="app-kerja-bg">
      <ProtectedRoute requireKtp><LamarForm /></ProtectedRoute>
    </Layout>
  );
}
