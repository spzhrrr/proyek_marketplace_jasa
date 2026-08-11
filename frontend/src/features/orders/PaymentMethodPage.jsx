import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderTotal } from "../../utils/format.js";

function PaymentContent() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [method, setMethod] = useState("qris");
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);

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

  function handleFormSubmit(e) {
    e.preventDefault();
    setShowConfirm(true);
  }

  async function executePay() {
    setProcessing(true);
    setError("");
    try {
      const res = await api.paymentProcess(id, method);
      if (res.redirectUrl) {
        setRedirecting(true);
        window.location.href = res.redirectUrl;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
      setShowConfirm(false);
    }
  }

  if (redirecting) {
    return (
      <Layout wide compact>
        <Loading />
        <p className="muted center" style={{ textAlign: "center", marginTop: "12px" }}>Mengalihkan ke gerbang pembayaran aman...</p>
      </Layout>
    );
  }

  if (error && !info) {
    return (
      <Layout wide compact>
        <div style={{ maxWidth: "600px", margin: "24px auto", background: "#ffffff", padding: "24px", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
          <Alert type="danger">{error}</Alert>
          <Link to={`/orders/${id}`} className="btn btn-primary" style={{ marginTop: "16px" }}>← Kembali ke Pesanan</Link>
        </div>
      </Layout>
    );
  }

  if (!info) return <Layout wide compact><Loading /></Layout>;

  const order = info.order;
  const total = order.total_amount || orderTotal(order);

  return (
    <Layout wide compact bgClass={info?.order?.source === "JOB" ? "app-kerja-bg" : "app-jasa-bg"}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ marginBottom: "16px" }}>
          <Link to={`/orders/${id}`} className="back-link" style={{ color: "#0284c7", fontWeight: 800, textDecoration: "none", fontSize: "0.875rem" }}>
            ← Kembali ke Pesanan #{order.order_number}
          </Link>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>💳 Pembayaran Pesanan Escrow</h1>
          <span style={{ color: "#64748b", fontWeight: 600, fontSize: "0.9rem" }}>{order.title}</span>
        </div>

        {error && <Alert type="danger" style={{ marginBottom: "16px" }}>{error}</Alert>}

        <form onSubmit={handleFormSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "24px", alignItems: "start" }}>
            {/* Left Column: Payment Methods Selection */}
            <div className="panel" style={{ borderRadius: "20px", padding: "24px", background: "#ffffff", border: "1.5px solid #e2e8f0", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", marginBottom: "14px" }}>📱 Pilih Metode Pembayaran</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {(info.methods
                  ? Object.entries(info.methods).map(([key, title]) => ({
                      key,
                      title,
                      sub:
                        key === "qris"
                          ? "Scan QR via BCA, Mandiri, GoPay, OVO, Dana, LinkAja"
                          : key === "gopay"
                            ? "Pembayaran instan langsung dari aplikasi Gojek"
                            : "Transfer VA otomatis terverifikasi 24 jam",
                      icon: key === "qris" ? "📱" : key === "gopay" ? "💳" : "🏦",
                    }))
                  : [
                      { key: "qris", title: "QRIS All Payment", sub: "Scan QR via BCA, Mandiri, GoPay, OVO, Dana, LinkAja", icon: "📱" },
                      { key: "gopay", title: "GoPay & e-Wallet", sub: "Pembayaran instan langsung dari aplikasi Gojek", icon: "💳" },
                      { key: "bank_va", title: "Virtual Account (BCA)", sub: "Transfer VA otomatis terverifikasi 24 jam", icon: "🏦" },
                    ]
                ).map((item) => (
                  <div
                    key={item.key}
                    onClick={() => setMethod(item.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "16px",
                      borderRadius: "16px",
                      border: method === item.key ? "2px solid #0284c7" : "1.5px solid #e2e8f0",
                      background: method === item.key ? "#f0f9ff" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: method === item.key ? "0 4px 14px rgba(2, 132, 199, 0.12)" : "none",
                    }}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={item.key}
                      checked={method === item.key}
                      onChange={() => setMethod(item.key)}
                      style={{ width: "18px", height: "18px", accentColor: "#0284c7" }}
                    />
                    <span style={{ fontSize: "1.6rem" }}>{item.icon}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{item.title}</strong>
                      <span style={{ fontSize: "0.775rem", color: "#64748b" }}>{item.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: "12px 20px", fontSize: "0.95rem", fontWeight: 800, borderRadius: "12px" }}>
                  ⚡ Lanjut Ke Pembayaran ({rupiah(total)}) →
                </button>
                <Link to={`/orders/${id}`} className="btn" style={{ padding: "12px 20px", borderRadius: "12px", background: "#f1f5f9", color: "#475569" }}>
                  Batal
                </Link>
              </div>
            </div>

            {/* Right Column: Order Summary & Escrow Protection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="panel" style={{ borderRadius: "20px", padding: "20px", background: "#ffffff", border: "1.5px solid #e2e8f0", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", marginBottom: "14px" }}>📋 Rincian Tagihan</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.875rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Harga Jasa</span>
                    <strong style={{ color: "#0f172a" }}>{rupiah(order.amount)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Biaya Layanan (5%)</span>
                    <strong style={{ color: "#0f172a" }}>{rupiah(order.platform_fee)}</strong>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px dashed #cbd5e1", margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.05rem" }}>
                    <strong style={{ color: "#0f172a" }}>Total Bayar</strong>
                    <strong style={{ color: "#0284c7" }}>{rupiah(total)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: "20px", padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0369a1", fontWeight: 800, fontSize: "0.9rem", marginBottom: "6px" }}>
                  <span>🛡️ Jaminan Sistem Rekening Bersama</span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#0c4a6e", lineHeight: 1.5, margin: 0 }}>
                  Uang Anda tidak langsung ditransfer ke penjual, melainkan ditahan di Rekening Bersama Tolongin. Dana baru dikirim ke penjual setelah Anda mengonfirmasi pekerjaan selesai.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Lanjut Pembayaran"
        message={`Lanjut pembayaran sebesar ${rupiah(total)} menggunakan metode ${method.toUpperCase()}?`}
        confirmText="Ya, Selesaikan"
        onConfirm={executePay}
        onCancel={() => setShowConfirm(false)}
        loading={processing}
      />
    </Layout>
  );
}

export default function PaymentMethodPage() {
  return (
    <ProtectedRoute>
      <PaymentContent />
    </ProtectedRoute>
  );
}
