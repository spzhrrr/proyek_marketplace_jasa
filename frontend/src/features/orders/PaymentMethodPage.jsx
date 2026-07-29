import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderTotal } from "../../utils/format.js";

function PaymentContent() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [method, setMethod] = useState("qris");
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    api.paymentInfo(id).then((d) => {
      if (d.redirectUrl) {
        setRedirecting(true);
        window.location.href = d.redirectUrl;
      } else {
        setInfo(d);
      }
    }).catch((e) => setError(e.message));
  }, [id]);

  async function pay(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await api.paymentProcess(id, method);
      if (res.redirectUrl) {
        setRedirecting(true);
        window.location.href = res.redirectUrl;
      }
    } catch (e) {
      setError(e.message);
    }
  }

  if (redirecting) {
    return (
      <PagePanel title="Pembayaran" compact>
        <Loading />
        <p className="muted center">Mengalihkan ke halaman pembayaran...</p>
      </PagePanel>
    );
  }

  if (error && !info) return <PagePanel title="Pembayaran" backTo={`/orders/${id}`} compact><Alert>{error}</Alert></PagePanel>;
  if (!info) return <Loading />;

  const order = info.order;
  const total = order.total_amount || orderTotal(order);

  return (
    <PagePanel
      title="Pembayaran Pesanan"
      subtitle={order.title}
      backTo={`/orders/${id}`}
      backLabel="← Kembali ke pesanan"
      compact
    >

      <HelpBox title="Bagaimana pembayaran aman?">
        <p>
          Uang kamu ditahan oleh sistem — bukan langsung ke penjual.
          Penjual baru menerima uang setelah kamu setujui hasil pekerjaan.
        </p>
      </HelpBox>

      <div className="payment-breakdown">
        <div className="payment-row"><span>Harga jasa</span><span>{rupiah(order.amount)}</span></div>
        <div className="payment-row"><span>Biaya layanan (5%)</span><span>{rupiah(order.platform_fee)}</span></div>
        <div className="payment-row payment-total"><span>Total bayar</span><strong>{rupiah(total)}</strong></div>
      </div>

      <p className="hint">Setelah klik bayar, kamu akan diarahkan ke halaman pembayaran. Selesaikan pembayaran, lalu kembali ke detail pesanan.</p>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={pay} className="form">
        <p className="muted" style={{ marginBottom: 8, fontWeight: 600 }}>Pilih metode pembayaran:</p>
        {Object.entries(info.methods).map(([key, label]) => (
          <label key={key} className="radio-card">
            <input type="radio" name="method" value={key} checked={method === key} onChange={() => setMethod(key)} />
            {label}
          </label>
        ))}
        <button type="submit" className="btn btn-primary">Lanjut Bayar</button>
        <Link to={`/orders/${id}`} className="btn">Batal</Link>
      </form>
    </PagePanel>
  );
}

export default function PaymentMethodPage() {
  return (
    <Layout wide compact>
      <ProtectedRoute><PaymentContent /></ProtectedRoute>
    </Layout>
  );
}
