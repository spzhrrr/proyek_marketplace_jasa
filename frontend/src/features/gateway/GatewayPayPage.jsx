import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { api } from "../../services/api.js";
import { rupiah, paymentStatusLabel } from "../../utils/format.js";

export default function GatewayPayPage() {
  const { code } = useParams();
  const [tx, setTx] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [returnUrl, setReturnUrl] = useState(null);

  // Confirmation Modals State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    confirmTone: "primary",
    onConfirm: null,
  });

  useEffect(() => {
    load();
  }, [code]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getTransaction(code);
      setTx(data);
      const lookup = await api.lookupReturn(code);
      if (lookup?.return_url) setReturnUrl(lookup.return_url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function triggerPayConfirm() {
    setConfirmModal({
      isOpen: true,
      title: "Konfirmasi Pembayaran Escrow",
      message: `Apakah Anda yakin ingin membayar sebesar ${rupiah(tx?.amount)} melalui ${tx?.payment_method?.toUpperCase() || "QRIS"}? Uang Anda akan ditahan secara aman di Rekening Bersama Tolongin.`,
      confirmText: "Ya, Selesaikan Pembayaran",
      confirmTone: "success",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await executePay();
      },
    });
  }

  function triggerCancelConfirm() {
    setConfirmModal({
      isOpen: true,
      title: "Batalkan Transaksi",
      message: "Apakah Anda yakin ingin membatalkan transaksi pembayaran ini?",
      confirmText: "Ya, Batalkan",
      confirmTone: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        await executeFail();
      },
    });
  }

  async function executePay() {
    setPaying(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.payTransaction(code);
      if (result.error) {
        setError(result.error);
        await load();
        return;
      }
      setSuccess("Pembayaran Berhasil Disetujui! Mengalihkan kembali ke pesanan...");
      await load();
      setTimeout(async () => {
        const lookup = await api.lookupReturn(code);
        if (lookup?.return_url) window.location.href = lookup.return_url;
      }, 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  }

  async function executeFail() {
    setPaying(true);
    try {
      await api.failTransaction(code);
      setError("Transaksi pembayaran telah dibatalkan.");
      await load();
      const lookup = await api.lookupReturn(code).catch(() => null);
      const back = lookup?.return_url || returnUrl;
      if (back) {
        setTimeout(() => {
          window.location.href = back;
        }, 1200);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <Layout wide compact><Loading /></Layout>;

  if (!tx) {
    return (
      <Layout wide compact>
        <div style={{ maxWidth: "600px", margin: "32px auto", padding: "24px", background: "#ffffff", borderRadius: "20px", border: "1px solid #e2e8f0" }}>
          <Alert type="danger">{error || "Transaksi tidak ditemukan"}</Alert>
          <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: "16px" }}>Ke Beranda Saya</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Top Header */}
        <div style={{ marginBottom: "16px" }}>
          {returnUrl ? (
            <a href={returnUrl} style={{ color: "#0284c7", fontWeight: 800, textDecoration: "none", fontSize: "0.875rem" }}>
              ← Kembali ke Pesanan
            </a>
          ) : (
            <Link to="/dashboard" style={{ color: "#0284c7", fontWeight: 800, textDecoration: "none", fontSize: "0.875rem" }}>
              ← Beranda Saya
            </Link>
          )}
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a", marginTop: "4px" }}>
            💳 Gerbang Pembayaran Escrow
          </h1>
        </div>

        {error && <Alert type="danger" style={{ marginBottom: "16px" }}>{error}</Alert>}
        {success && <Alert type="success" style={{ marginBottom: "16px" }}>{success}</Alert>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
          
          {/* LEFT COLUMN: QRIS Mockup or Bank VA Card */}
          <div style={{ background: "#ffffff", borderRadius: "24px", padding: "24px", border: "1.5px solid #e2e8f0", boxShadow: "0 8px 30px rgba(15,23,42,0.04)", textAlign: "center" }}>
            {tx.payment_method === "qris" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "12px", background: "#dc2626", color: "#fff", padding: "6px 16px", borderRadius: "8px", fontWeight: 900, fontSize: "0.95rem", letterSpacing: "1px" }}>
                  <span>QRIS</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, opacity: 0.9 }}>NATIONAL QR CODE</span>
                </div>

                <div style={{ background: "#ffffff", padding: "16px", borderRadius: "16px", border: "2px solid #0f172a", display: "inline-block", margin: "8px 0 14px", boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
                  <svg width="180" height="180" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="white"/>
                    <rect x="5" y="5" width="30" height="30" fill="black"/>
                    <rect x="9" y="9" width="22" height="22" fill="white"/>
                    <rect x="13" y="13" width="14" height="14" fill="black"/>
                    <rect x="65" y="5" width="30" height="30" fill="black"/>
                    <rect x="69" y="9" width="22" height="22" fill="white"/>
                    <rect x="73" y="13" width="14" height="14" fill="black"/>
                    <rect x="5" y="65" width="30" height="30" fill="black"/>
                    <rect x="9" y="69" width="22" height="22" fill="white"/>
                    <rect x="13" y="73" width="14" height="14" fill="black"/>
                    <rect x="40" y="10" width="15" height="5" fill="black"/>
                    <rect x="40" y="20" width="10" height="15" fill="black"/>
                    <rect x="10" y="40" width="20" height="10" fill="black"/>
                    <rect x="40" y="40" width="20" height="20" fill="#0284c7"/>
                    <rect x="65" y="40" width="15" height="10" fill="black"/>
                    <rect x="40" y="65" width="10" height="25" fill="black"/>
                    <rect x="55" y="65" width="25" height="10" fill="black"/>
                    <rect x="65" y="80" width="25" height="15" fill="black"/>
                  </svg>
                </div>

                <h4 style={{ fontSize: "1rem", fontWeight: 900, color: "#0f172a", margin: "0 0 4px" }}>
                  {tx.merchant_name || "TolongIn Escrow Safe Pay"}
                </h4>
                <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 16px" }}>
                  Buka aplikasi e-Wallet (GoPay, OVO, Dana, ShopeePay, BCA Mobile, Livin) lalu scan kode QR di atas.
                </p>
              </div>
            )}

            {tx.payment_method === "bank_va" && (
              <div style={{ padding: "12px 0" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284c7", background: "#e0f2fe", padding: "4px 12px", borderRadius: "999px" }}>
                  VIRTUAL ACCOUNT BCA
                </span>
                <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: "16px", padding: "20px", margin: "16px 0" }}>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 700, display: "block" }}>NOMOR VIRTUAL ACCOUNT:</span>
                  <strong style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a", letterSpacing: "2px" }}>
                    8808 {String(tx.id).padStart(8, "0")}
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`8808${String(tx.id).padStart(8, "0")}`);
                      alert("Nomor Virtual Account tersalin!");
                    }}
                    style={{ marginTop: "10px", display: "inline-block", background: "#0284c7", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 14px", fontSize: "0.775rem", fontWeight: 800, cursor: "pointer" }}
                  >
                    📋 Salin Nomor VA
                  </button>
                </div>
              </div>
            )}

            {tx.payment_method === "gopay" && (
              <div style={{ padding: "16px 0" }}>
                <span style={{ fontSize: "2.5rem" }}>📱</span>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: "8px 0 4px" }}>
                  Pembayaran Instan GoPay
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
                  Klik tombol konfirmasi bayar di bawah untuk langsung memverifikasi transaksi GoPay Anda.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {tx.status === "PENDING" && (
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={triggerPayConfirm}
                  disabled={paying}
                  style={{ flex: 1.2, padding: "12px", borderRadius: "12px", fontWeight: 900, fontSize: "0.95rem" }}
                >
                  {paying ? "Memproses..." : `Simulasi Bayar (${rupiah(tx.amount)}) →`}
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={triggerCancelConfirm}
                  disabled={paying}
                  style={{ flex: 0.8, padding: "12px", borderRadius: "12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontWeight: 800, fontSize: "0.875rem" }}
                >
                  Batalkan
                </button>
              </div>
            )}

            {tx.status === "PAID" && returnUrl && (
              <a className="btn btn-primary" href={returnUrl} style={{ display: "block", marginTop: "16px", padding: "12px", borderRadius: "12px", fontWeight: 900, textDecoration: "none" }}>
                ✔ Pembayaran Berhasil — Kembali ke Pesanan →
              </a>
            )}
          </div>

          {/* RIGHT COLUMN: Transaction Summary & Escrow Protection */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#ffffff", borderRadius: "24px", padding: "24px", border: "1.5px solid #e2e8f0", boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}>
              <span style={{ fontSize: "0.725rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>
                DETAIL TRANSAKSI
              </span>

              <div style={{ margin: "12px 0", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                <span style={{ fontSize: "0.775rem", color: "#64748b" }}>KODE TRANSAKSI</span>
                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#0f172a" }}>{tx.transaction_code}</div>
              </div>

              <div style={{ margin: "0 0 12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                <span style={{ fontSize: "0.775rem", color: "#64748b" }}>DESKRIPSI PESANAN</span>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>{tx.description || "-"}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 0" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#0f172a" }}>TOTAL BAYAR:</span>
                <strong style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0284c7" }}>{rupiah(tx.amount)}</strong>
              </div>

              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>STATUS TAGIHAN:</span>
                <span className={`pill pill-${tx.status}`} style={{ fontWeight: 800 }}>{paymentStatusLabel(tx.status)}</span>
              </div>
            </div>

            <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: "20px", padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0369a1", fontWeight: 900, fontSize: "0.9rem", marginBottom: "6px" }}>
                <span>🛡️ Jaminan Sistem Rekening Bersama</span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>
                Uang Anda tidak langsung ditransfer ke penjual, melainkan ditahan di Rekening Bersama TolongIn. Dana baru dikirim ke penjual setelah Anda mengonfirmasi pekerjaan selesai.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Double Check Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmTone={confirmModal.confirmTone}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </Layout>
  );
}
