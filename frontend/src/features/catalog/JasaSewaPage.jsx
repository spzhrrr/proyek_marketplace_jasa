import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderTotal } from "../../utils/format.js";
import { ChatIcon } from "../../components/BellIcon.jsx";

function SewaForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [catatan, setCatatan] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.jasaShow(id).then((d) => {
      setData(d.data);
      setMeta(d.meta);
    });
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.jasaSewa(id, { catatan });
      nav(`/orders/${res.orderId}`, { state: { msg: "Pesanan terkirim! Tunggu penjual menerima, lalu kamu akan diminta bayar." } });
    } catch (err) {
      if (err.need === "ktp" || err.need === "contact") {
        setError("Verifikasi akun belum lengkap. Lengkapi email, HP, dan KTP dulu.");
        setTimeout(() => nav("/verify"), 2000);
      } else setError(err.message);
    }
  }

  if (!data) return <Loading />;

  const fee = Math.round(data.price * 0.05);
  const total = data.price + fee;

  if (meta?.is_owner) {
    return (
      <PagePanel title="Tidak bisa pesan" backTo={`/jasa/${id}`}>
        <Alert type="warn">Ini jasa milik kamu sendiri. Kamu tidak bisa menyewa jasa yang kamu post.</Alert>
      </PagePanel>
    );
  }

  if (meta?.has_active_request || meta?.has_pending_request) {
    return (
      <PagePanel title="Pesanan sudah ada" backTo={`/jasa/${id}`}>
        <Alert type="warn">
          {meta.has_pending_request
            ? "Kamu sudah mengirim pesanan dan menunggu konfirmasi penjual."
            : "Kamu punya pesanan aktif untuk jasa ini."}
        </Alert>
        <div className="btn-row">
          {meta.active_order_id ? (
            <Link to={`/orders/${meta.active_order_id}`} className="btn btn-primary">Lihat Pesanan</Link>
          ) : (
            <Link to="/dashboard" className="btn btn-primary">Ke Beranda Saya</Link>
          )}
          <Link to={`/jasa/${id}/chat`} className="btn btn-chat">
            <ChatIcon size={15} /> Chat penjual
          </Link>
        </div>
      </PagePanel>
    );
  }

  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
        <div style={{ marginBottom: "16px" }}>
          <Link to={`/jasa/${id}`} className="back-link" style={{ color: "#0284c7", fontWeight: 800, textDecoration: "none", fontSize: "0.875rem" }}>
            ← Kembali ke Detail Jasa
          </Link>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a", marginTop: "8px" }}>🛒 Form Pengajuan Pesanan Jasa</h1>
          <span style={{ color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>{data.title}</span>
        </div>

        <Alert>{error}</Alert>

        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "24px", alignItems: "start" }}>
            <div className="panel" style={{ borderRadius: "20px", padding: "24px", background: "#ffffff", border: "1.5px solid #e2e8f0" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>📝 Catatan & Instruksi Kebutuhan Proyek</h3>
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "16px" }}>
                Jelaskan secara rinci kebutuhan, referensi, atau instruksi khusus agar freelancer dapat langsung memproses pesanan Anda.
              </p>

              <div className="input-group">
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Saya membutuhkan desain poster ukuran A3 untuk acara seminar kampus, tema warna biru muda, materi tulisan lampirkan via chat..."
                  rows={5}
                  className="form-textarea"
                  style={{ borderRadius: "14px", padding: "14px", border: "1.5px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "12px 20px", fontSize: "0.95rem", fontWeight: 800, borderRadius: "12px" }}>
                  🚀 Kirim Pesanan Sekarang
                </button>
                <Link to={`/jasa/${id}`} className="btn" style={{ padding: "12px 20px", borderRadius: "12px", background: "#f1f5f9", color: "#475569" }}>
                  Batal
                </Link>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="panel" style={{ borderRadius: "20px", padding: "20px", background: "#ffffff", border: "1.5px solid #e2e8f0" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", marginBottom: "14px" }}>💳 Ringkasan Biaya Escrow</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.875rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Harga Jasa</span>
                    <strong style={{ color: "#0f172a" }}>{rupiah(data.price)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Biaya Layanan (5%)</span>
                    <strong style={{ color: "#0f172a" }}>{rupiah(fee)}</strong>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px dashed #cbd5e1", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.05rem" }}>
                    <strong style={{ color: "#0f172a" }}>Total Pembayaran</strong>
                    <strong style={{ color: "#0284c7" }}>{rupiah(total)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: "20px", padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#0369a1", fontWeight: 800, fontSize: "0.9rem", marginBottom: "8px" }}>
                  <span>🛡️ Garansi Keamanan Escrow</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "#0c4a6e", lineHeight: 1.5 }}>
                  <li>Pesanan dikirim langsung ke penjual untuk ditinjau (max 24 jam).</li>
                  <li>Uang Anda **ditahan aman oleh platform** hingga Anda menyetujui hasil pekerjaan.</li>
                  <li>Jika penjual menolak, Anda tidak dikenakan biaya apapun.</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default function JasaSewaPage() {
  return (
    <ProtectedRoute>
      <SewaForm />
    </ProtectedRoute>
  );
}
