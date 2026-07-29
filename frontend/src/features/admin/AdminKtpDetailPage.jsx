import { Link, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
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

  useEffect(() => {
    api.adminKtpDetail(id).then((d) => setData(d.data)).catch((e) => setError(e.message));
  }, [id]);

  async function approve() {
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

  async function reject(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.adminRejectKtp(id, reason.trim());
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
      <div className="admin-section-head">
        <div>
          <h1>Review KTP — {data.first_name} {data.last_name}</h1>
          <p className="muted">{data.email} · {data.phone}</p>
        </div>
        <Link to="/admin/ktp" className="btn btn-sm">← Antrian KTP</Link>
      </div>

      <Alert>{error}</Alert>

      <div className="admin-detail-grid">
        <div className="admin-detail-panel">
          <h3>Data Pengajuan</h3>
          <dl className="detail-list">
            <dt>NIK</dt><dd>{data.ktp_number}</dd>
            <dt>Status</dt><dd>{data.ktp_status}</dd>
            <dt>Diajukan</dt>
            <dd>{data.ktp_submitted_at ? new Date(data.ktp_submitted_at).toLocaleString("id-ID") : "-"}</dd>
            <dt>Email terverifikasi</dt><dd>{data.email_verified_at ? "Ya" : "Tidak"}</dd>
            <dt>HP terverifikasi</dt><dd>{data.phone_verified_at ? "Ya" : "Tidak"}</dd>
          </dl>
        </div>

        <div className="admin-detail-panel">
          <h3>Foto KTP</h3>
          <a href={data.ktp_photo_url} target="_blank" rel="noreferrer">
            <img src={data.ktp_photo_url} alt="Foto KTP" className="admin-doc-img" />
          </a>
        </div>

        <div className="admin-detail-panel">
          <h3>Selfie + KTP</h3>
          <a href={data.ktp_selfie_url} target="_blank" rel="noreferrer">
            <img src={data.ktp_selfie_url} alt="Selfie KTP" className="admin-doc-img" />
          </a>
        </div>
      </div>

      {!showReject ? (
        <div className="btn-row admin-actions">
          <button type="button" className="btn btn-primary" onClick={approve} disabled={loading}>
            Setujui KTP
          </button>
          <button type="button" className="btn" onClick={() => setShowReject(true)} disabled={loading}>
            Tolak
          </button>
        </div>
      ) : (
        <form onSubmit={reject} className="admin-reject-form panel">
          <h3>Alasan Penolakan</h3>
          <label>
            Jelaskan alasan (akan dikirim ke pengguna)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={4}
              placeholder="Contoh: Foto KTP buram / NIK tidak terbaca / selfie tidak sesuai"
            />
          </label>
          <div className="btn-row">
            <button type="submit" className="btn" disabled={loading}>Kirim penolakan</button>
            <button type="button" className="btn btn-sm" onClick={() => setShowReject(false)} disabled={loading}>
              Batal
            </button>
          </div>
        </form>
      )}
    </>
  );
}
