import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import VerifyStepper from "../../components/VerifyStepper.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { bankStatusLabel } from "../../utils/verification.js";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import VerifyShell from "../../components/VerifyShell.jsx";

const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga"];

function BankForm() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [hub, setHub] = useState(null);
  const [form, setForm] = useState({
    bank_name: "",
    bank_account_number: "",
    bank_account_holder: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api.verifyHub().then((d) => {
      setHub(d);
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

  function askSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setConfirmOpen(true);
  }

  async function submitBank() {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const res = await api.submitBank(form);
      await refresh();
      if (res.pending) {
        setSuccess("Pengajuan terkirim. Admin akan meninjau rekeningmu.");
        api.verifyHub().then(setHub);
      } else {
        nav("/verify");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const bank = hub?.steps?.bank;

  return (
    <VerifyShell title="Rekening" subtitle="Wajib untuk posting jasa dan mencairkan pendapatan.">
      {hub && <VerifyStepper steps={hub.steps} current="bank" />}

      <div className="post-form-grid-layout" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="form-column-card">
          <h3 className="column-section-title">💳 Data Rekening Bank</h3>

          {/* Warning Banner: Nama Rekening Harus Sesuai KTP */}
          <div style={{ background: "#fffbebf5", border: "1.5px solid #fde68a", padding: "16px", borderRadius: "16px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>⚠️</span>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem", color: "#92400e", fontWeight: 800 }}>
                  PENTING: Nama Pemilik Rekening WAJIB Sesuai KTP
                </h4>
                <p style={{ margin: 0, fontSize: "0.825rem", color: "#78350f", lineHeight: 1.5 }}>
                  Nama pemilik rekening bank <strong>harus cocok 100%</strong> dengan Nama Lengkap di KTP Anda.
                  Pengajuan dengan nama berbeda akan <strong>DITOLAK</strong> oleh Admin demi mencegah penipuan & menjaga keamanan dana escrow.
                </p>
              </div>
            </div>
          </div>

          <Alert type="error">{error}</Alert>
          <Alert type="success">{success}</Alert>
          {bank?.rejectedReason && (
            <Alert type="danger" style={{ marginBottom: "16px" }}>⚠️ Penolakan Sebelumnya: {bank.rejectedReason}</Alert>
          )}

          {bank?.pending ? (
            <div className="info-box-compact" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "18px" }}>
              <h4 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#166534" }}>⏳ Rekening Bank Sedang Ditinjau Admin</h4>
              <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#15803d" }}>Pengajuan rekening bank kamu sudah diterima. Admin akan memverifikasi dalam 1-2 hari kerja.</p>
              <dl className="detail-list" style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #dcfce7", margin: "10px 0" }}>
                <dt>Bank</dt><dd><strong>{bank.bank_name}</strong></dd>
                <dt>Nomor Rekening</dt><dd>****{String(bank.bank_account_number || "").slice(-4)}</dd>
                <dt>Status</dt><dd><span className="pill pill-PENDING">{bankStatusLabel(bank.status)}</span></dd>
              </dl>
              <Link to="/verify" className="btn btn-primary btn-block" style={{ marginTop: "12px" }}>← Kembali ke Verifikasi Hub</Link>
            </div>
          ) : (
            <>
              <form onSubmit={askSubmit} className="form">
                <div className="form-group-sm">
                  <label className="form-label-bold">Nama Bank <span className="text-danger">*</span></label>
                  <select required className="form-input-compact" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })}>
                    <option value="">Pilih Bank...</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group-sm">
                  <label className="form-label-bold">Nomor Rekening Bank <span className="text-danger">*</span></label>
                  <input required className="form-input-compact" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} placeholder="Contoh: 1234567890" />
                </div>

                <div className="form-group-sm">
                  <label className="form-label-bold">Nama Pemilik Rekening <span className="text-danger">*</span></label>
                  <input required className="form-input-compact" value={form.bank_account_holder} onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })} placeholder="Harus sama persis dengan nama pada KTP" />
                  <span className="hint" style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600 }}>⚠️ Harus sama persis dengan Nama KTP (Beda nama = Ditolak Admin)</span>
                </div>

                <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: "16px" }}>
                  {loading ? "Mengirim Data..." : "Kirim untuk Verifikasi Admin →"}
                </button>
              </form>

              <ConfirmModal
                isOpen={confirmOpen}
                title="Kirim data rekening?"
                message="Pastikan nama pemilik rekening sama dengan nama di KTP. Setelah dikirim, admin akan meninjau pengajuanmu."
                confirmText="Ya, Kirim"
                cancelText="Periksa Lagi"
                confirmTone="primary"
                loading={loading}
                onConfirm={submitBank}
                onCancel={() => setConfirmOpen(false)}
              />
            </>
          )}
        </div>

        <div className="form-column-card">
          <h3 className="column-section-title">💡 Syarat Rekening Valid</h3>
          <div className="help-box-content" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.825rem", color: "#475569" }}>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <strong style={{ color: "#0f172a" }}>✓ Nama Pemilik Sesuai KTP</strong>
              <p style={{ margin: "2px 0 0", color: "#64748b" }}>Nama pemilik rekening harus cocok dengan nama yang tertera pada identitas KTP kamu.</p>
            </div>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <strong style={{ color: "#0f172a" }}>✓ Bank Resmi Indonesia</strong>
              <p style={{ margin: "2px 0 0", color: "#64748b" }}>Kami mendukung BCA, BNI, BRI, Mandiri, BSI, dan CIMB Niaga untuk pencairan otomatis.</p>
            </div>
          </div>
        </div>
      </div>
    </VerifyShell>
  );
}

export default function VerifyBankPage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute><BankForm /></ProtectedRoute>
    </Layout>
  );
}
