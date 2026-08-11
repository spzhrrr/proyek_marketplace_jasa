import { Link, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { api } from "../../services/api.js";

export default function AdminKtpDetailPage() {
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
    api.adminKtpDetail(id).then((d) => setData(d.data)).catch((e) => setError(e.message));
  }, [id]);

  async function approve() {
    setConfirmApprove(false);
    setLoading(true);
    setError("");
    try {
      await api.adminApproveKtp(id);
      refreshStats?.();
      nav("/admin/ktp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const [actionType, setActionType] = useState("REJECT_REUPLOAD");

  const reuploadPresets = [
    "Foto KTP buram / NIK tidak terbaca jelas",
    "Foto KTP terpotong (4 sudut KTP wajib terlihat)",
    "NIK atau Nama Lengkap tidak sesuai dengan KTP",
    "Foto selfie dengan KTP kurang jelas atau buram"
  ];

  const banPresets = [
    "Terindikasi KTP Palsu / Hasil Editing Photoshop",
    "Pemilik Identitas Di Bawah Umur (< 17 Tahun)",
    "KTP Digunakan Orang Lain / Terindikasi Penipuan Identitas"
  ];

  async function reject(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.adminRejectKtp(id, { action_type: actionType, reason: reason.trim() });
      refreshStats?.();
      nav("/admin/ktp");
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
        <Link to="/admin/ktp" className="btn">← Kembali ke antrian</Link>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={`Review KTP — ${data.first_name} ${data.last_name}`}
        subtitle={`${data.email} · ${data.phone || "-"}`}
        action={<Link to="/admin/ktp" className="btn btn-sm">← Antrian KTP</Link>}
      />

      <Alert>{error}</Alert>

      <div className="admin-detail-grid">
        <div className="admin-detail-panel">
          <h3>Data pengajuan</h3>
          <dl className="detail-list">
            <dt>Nama KTP</dt><dd><strong>{data.ktp_name || `${data.first_name} ${data.last_name}`}</strong></dd>
            <dt>NIK</dt><dd><strong className="mono">{data.ktp_number}</strong></dd>
            <dt>TTL</dt><dd>{data.ktp_birthplace || "-"}, {data.ktp_birthdate ? new Date(data.ktp_birthdate).toLocaleDateString("id-ID") : "-"}</dd>
            <dt>Jenis kelamin</dt><dd>{data.ktp_gender || "-"}</dd>
            <dt>Alamat</dt><dd>{data.ktp_address || "-"}</dd>
            <dt>Status</dt><dd><span className="pill pill-PENDING">{data.ktp_status}</span></dd>
            <dt>Diajukan</dt>
            <dd>{data.ktp_submitted_at ? new Date(data.ktp_submitted_at).toLocaleString("id-ID") : "-"}</dd>
          </dl>
        </div>

        <div className="admin-detail-panel">
          <h3>Foto KTP</h3>
          <a href={data.ktp_photo_url} target="_blank" rel="noreferrer">
            <img src={data.ktp_photo_url} alt="Foto KTP" className="admin-doc-img" />
          </a>
        </div>

        <div className="admin-detail-panel">
          <h3>Selfie dengan KTP</h3>
          <a href={data.ktp_selfie_url} target="_blank" rel="noreferrer">
            <img src={data.ktp_selfie_url} alt="Selfie KTP" className="admin-doc-img" />
          </a>
        </div>
      </div>

      {!showReject ? (
        <div className="admin-actions">
          <button type="button" className="btn btn-primary" onClick={() => setConfirmApprove(true)} disabled={loading}>
            Setujui KTP
          </button>
          <button type="button" className="btn btn-cta-danger" onClick={() => setShowReject(true)} disabled={loading}>
            Tolak / Ban
          </button>
        </div>
      ) : (
        <form onSubmit={reject} className="admin-reject-form">
          <h3>Keputusan penolakan</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            <label className={`admin-radio-card ${actionType === "REJECT_REUPLOAD" ? "active-blue" : ""}`}>
              <input
                type="radio"
                name="actionType"
                value="REJECT_REUPLOAD"
                checked={actionType === "REJECT_REUPLOAD"}
                onChange={() => { setActionType("REJECT_REUPLOAD"); setReason(reuploadPresets[0]); }}
              />
              <div>
                <strong style={{ color: "#0284c7" }}>⚠️ Tolak & Izinkan Upload Ulang (Kesalahan Teknis)</strong>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Gunakan ini jika foto KTP buram, terpotong, atau NIK salah ketik. Pengguna bisa mengunggah ulang KTP yang benar.</p>
              </div>
            </label>

            <label className={`admin-radio-card ${actionType === "BAN_ACCOUNT" ? "active-red" : ""}`}>
              <input
                type="radio"
                name="actionType"
                value="BAN_ACCOUNT"
                checked={actionType === "BAN_ACCOUNT"}
                onChange={() => { setActionType("BAN_ACCOUNT"); setReason(banPresets[0]); }}
              />
              <div>
                <strong style={{ color: "#ef4444" }}>🚫 Tolak & BAN AKUN PERMANEN (Kecurangan / KTP Palsu)</strong>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#991b1b" }}>Gunakan ini jika terbukti KTP palsu/photoshop atau pemilik identitas di bawah umur. Akun akan dibanned permanen dan email tidak bisa dipakai lagi.</p>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <span className="form-label-bold">Pilih Alasan Cepat:</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
              {(actionType === "REJECT_REUPLOAD" ? reuploadPresets : banPresets).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`skill-pill-btn ${reason === p ? "active" : ""}`}
                  onClick={() => setReason(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group-sm">
            <label className="form-label-bold">Rincian Alasan Penolakan (Akan dikirim ke pengguna)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="form-input-compact"
              placeholder="Jelaskan alasan penolakan..."
            />
          </div>

          <div className="btn-row" style={{ marginTop: "16px", display: "flex", gap: "10px" }}>
            <button type="submit" className={`btn ${actionType === "BAN_ACCOUNT" ? "btn-cta-danger" : "btn-primary"}`} disabled={loading}>
              {actionType === "BAN_ACCOUNT" ? "Ban akun permanen" : "Kirim penolakan"}
            </button>
            <button type="button" className="btn" onClick={() => setShowReject(false)} disabled={loading}>
              Batal
            </button>
          </div>
        </form>
      )}

      <ConfirmModal
        isOpen={confirmApprove}
        title="Setujui KTP ini?"
        message="Identitas pengguna akan ditandai terverifikasi. Pastikan foto dan data sesuai."
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
