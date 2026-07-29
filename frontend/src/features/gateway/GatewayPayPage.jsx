import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "../../components/Alert.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";
import { rupiah, paymentStatusLabel } from "../../utils/format.js";

const METHOD_HINT = {
  qris: "Scan kode QR dengan aplikasi e-wallet kamu",
  gopay: "Konfirmasi pembayaran di aplikasi GoPay",
  bank_va: "Transfer ke Virtual Account di bawah",
};

export default function GatewayPayPage() {
  const { code } = useParams();
  const [tx, setTx] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [returnUrl, setReturnUrl] = useState(null);

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

  async function handlePay() {
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
      setSuccess("Pembayaran berhasil! Mengalihkan...");
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

  async function handleFail() {
    setPaying(true);
    try {
      await api.failTransaction(code);
      setError("Pembayaran dibatalkan.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <PagePanel title="Bayar Transaksi" backTo="/gateway" compact>
        <Loading />
      </PagePanel>
    );
  }

  if (!tx) {
    return (
      <PagePanel title="Bayar Transaksi" backTo="/gateway" compact>
        <Alert>{error || "Transaksi tidak ditemukan"}</Alert>
      </PagePanel>
    );
  }

  return (
    <PagePanel
      title="Bayar Transaksi"
      subtitle="Selesaikan pembayaran di bawah. Setelah berhasil, kamu akan kembali ke halaman pesanan."
      backTo="/gateway"
      backLabel="← Daftar transaksi"
      compact
    >
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <dl className="detail-list">
        <dt>Kode</dt><dd>{tx.transaction_code}</dd>
        <dt>Merchant</dt><dd>{tx.merchant_name}</dd>
        <dt>Deskripsi</dt><dd>{tx.description || "-"}</dd>
        <dt>Metode</dt><dd>{tx.payment_method || "-"}</dd>
        <dt>Total</dt><dd><strong>{rupiah(tx.amount)}</strong></dd>
        <dt>Status</dt><dd><span className={`pill pill-${tx.status}`}>{paymentStatusLabel(tx.status)}</span></dd>
      </dl>

      {tx.payment_method === "qris" && tx.status === "PENDING" && (
        <div className="qr-mock">[ Kode QR pembayaran ]</div>
      )}
      {tx.payment_method === "bank_va" && tx.status === "PENDING" && (
        <p className="center">VA BCA: <strong>8808 {String(tx.id).padStart(8, "0")}</strong></p>
      )}
      {METHOD_HINT[tx.payment_method] && tx.status === "PENDING" && (
        <p className="muted center">{METHOD_HINT[tx.payment_method]}</p>
      )}

      {tx.status === "PENDING" && (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={handlePay} disabled={paying}>
            {paying ? "Memproses..." : "Bayar Sekarang"}
          </button>
          <button type="button" className="btn" onClick={handleFail} disabled={paying}>Batalkan</button>
        </div>
      )}

      {tx.status === "PAID" && returnUrl && (
        <a className="btn btn-primary" href={returnUrl}>Kembali ke Marketplace</a>
      )}
    </PagePanel>
  );
}
