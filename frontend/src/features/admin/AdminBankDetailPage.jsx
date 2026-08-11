import { Link, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { api } from "../../services/api.js";

function maskAccount(num) {
  if (!num || num.length < 4) return num || "-";
  return `****${String(num).slice(-4)}`;
}

export default function AdminBankDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { refreshStats } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);

  useEffect(() => {
    api.adminBankDetail(id).then((d) => setData(d.data)).catch((e) => setError(e.message));
  }, [id]);

  async function approve() {
    setConfirmApprove(false);
    setLoading(true);
    setError("");
    try {
      await api.adminApproveBank(id);
      refreshStats?.();
      nav("/admin/bank");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function reject(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.adminRejectBank(id, reason.trim());
      refreshStats?.();
      nav("/admin/bank");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!data && !error) return <Loading />;

  if (error && !data) {
    return (
      <>
        <Alert>{error}</Alert>
        <Link to="/admin/bank" className="btn">← Antrian bank</Link>
      </>
    );
  }

  const ktpName = data.ktp_name || `${data.first_name} ${data.last_name}`.trim();
  const bankHolder = (data.bank_account_holder || "").trim();
  const nameMatch = ktpName.toLowerCase() === bankHolder.toLowerCase();

  return (
    <>
      <AdminPageHeader
        title={`Review rekening — ${data.first_name} ${data.last_name}`}
        subtitle={`${data.email} · ${data.phone || "-"}`}
        action={<Link to="/admin/bank" className="btn btn-sm">← Antrian bank</Link>}
      />

      <Alert>{error}</Alert>

      <div className={`admin-match ${nameMatch ? "ok" : "warn"}`}>
        <div>
          <h4>{nameMatch ? "Nama rekening sesuai KTP" : "Nama rekening berbeda dengan KTP"}</h4>
          <p>KTP: <strong>{ktpName}</strong> · Rekening: <strong>{bankHolder || "-"}</strong></p>
        </div>
        <span className="admin-match-pill">{nameMatch ? "Cocok" : "Periksa ulang"}</span>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-detail-panel">
          <h3>Data rekening</h3>
          <dl className="detail-list">
            <dt>Bank</dt><dd><strong>{data.bank_name}</strong></dd>
            <dt>Nomor rekening</dt><dd className="mono">{data.bank_account_number}</dd>
            <dt>Nama pemilik</dt><dd><strong>{data.bank_account_holder}</strong></dd>
            <dt>Status</dt><dd><span className="pill pill-wait">Menunggu review</span></dd>
            <dt>Diajukan</dt>
            <dd>{data.bank_submitted_at ? new Date(data.bank_submitted_at).toLocaleString("id-ID") : "-"}</dd>
          </dl>
        </div>

        <div className="admin-detail-panel">
          <h3>Identitas pengguna</h3>
          <dl className="detail-list">
            <dt>Nama KTP</dt><dd><strong>{ktpName}</strong></dd>
            <dt>NIK</dt><dd className="mono">{data.ktp_number || "Belum diisi"}</dd>
            <dt>Status KTP</dt><dd><span className={`badge ${data.ktp_status === "APPROVED" ? "badge-ok" : "badge-warn"}`}>{data.ktp_status}</span></dd>
            <dt>Email</dt><dd>{data.email_verified_at ? "Terverifikasi" : "Belum"}</dd>
            <dt>HP</dt><dd>{data.phone_verified_at ? "Terverifikasi" : "Belum"}</dd>
          </dl>
        </div>

        <div className="admin-detail-panel">
          <h3>Ringkasan pencairan</h3>
          <div className="bank-preview-box">
            <span className="bank-preview-label">Dana akan ditransfer ke</span>
            <strong>{data.bank_name} {maskAccount(data.bank_account_number)}</strong>
            <span>a.n. {data.bank_account_holder}</span>
          </div>
        </div>
      </div>

      {!showReject ? (
        <div className="admin-actions">
          <button type="button" className="btn btn-primary" onClick={() => setConfirmApprove(true)} disabled={loading}>
            Setujui rekening
          </button>
          <button type="button" className="btn" onClick={() => setShowReject(true)} disabled={loading}>
            Tolak
          </button>
        </div>
      ) : (
        <form onSubmit={reject} className="admin-reject-form">
          <h3>Alasan penolakan</h3>
          <label>
            Jelaskan alasan (dikirim ke pengguna)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={4}
              placeholder="Contoh: Nama pemilik rekening tidak sesuai KTP"
            />
          </label>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-cta-danger" disabled={loading}>Kirim penolakan</button>
            <button type="button" className="btn" onClick={() => setShowReject(false)} disabled={loading}>Batal</button>
          </div>
        </form>
      )}

      <ConfirmModal
        isOpen={confirmApprove}
        title="Setujui rekening ini?"
        message="Rekening akan dipakai untuk pencairan dana. Pastikan nama pemilik sama dengan KTP."
        confirmText="Ya, Setujui"
        cancelText="Batal"
        confirmTone="success"
        loading={loading}
        onConfirm={approve}
        onCancel={() => setConfirmApprove(false)}
      />
    </>
  );
}
