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
        </div>
      </PagePanel>
    );
  }

  return (
    <PagePanel
      title="Pesan Jasa"
      subtitle={data.title}
      backTo={`/jasa/${id}`}
      backLabel="← Kembali ke detail jasa"
      compact
    >

      <HelpBox title="Apa yang terjadi setelah kirim?">
        <ol style={{ margin: "6px 0 0", paddingLeft: "1.2rem" }}>
          <li>Pesanan terkirim ke penjual</li>
          <li>Penjual terima atau tolak (1×24 jam)</li>
          <li>Jika diterima, kamu bayar — uang ditahan aman</li>
          <li>Penjual kerjakan → kamu setujui → selesai</li>
        </ol>
      </HelpBox>

      <div className="payment-breakdown">
        <div className="payment-row"><span>Harga jasa</span><span>{rupiah(data.price)}</span></div>
        <div className="payment-row"><span>Biaya layanan (5%)</span><span>{rupiah(fee)}</span></div>
        <div className="payment-row payment-total"><span>Perkiraan total</span><strong>{rupiah(total)}</strong></div>
      </div>

      <Alert>{error}</Alert>
      <form onSubmit={submit} className="form">
        <label>
          Catatan untuk penjual
          <textarea rows={4} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Jelaskan kebutuhan kamu dengan jelas..." />
        </label>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary">Kirim Pesanan</button>
          <Link to={`/jasa/${id}`} className="btn">Batal</Link>
        </div>
      </form>
    </PagePanel>
  );
}

export default function JasaSewaPage() {
  return (
    <Layout wide compact>
      <ProtectedRoute>
        <SewaForm />
      </ProtectedRoute>
    </Layout>
  );
}
