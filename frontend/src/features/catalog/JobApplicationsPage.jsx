import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import PortfolioFileView from "../../components/PortfolioFileView.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { VerifiedMark } from "../../components/CatalogCards.jsx";
import { api } from "../../services/api.js";
import { rupiah, timeAgo } from "../../utils/format.js";
import { resolveUploadUrl } from "../../utils/media.js";

function statusMeta(app, jobFilled) {
  if (app.status === "ACCEPTED") {
    return { label: "Diterima", hint: "Pekerja terpilih untuk lowongan ini", tone: "ok" };
  }
  if (app.status === "PENDING") {
    return { label: "Menunggu keputusan", hint: "Belum ada keputusan dari kamu", tone: "wait" };
  }
  if (app.reject_kind === "AUTO_EXPIRED") {
    return { label: "Dibatalkan", hint: app.reject_reason || "Rekrutmen dibatalkan", tone: "bad" };
  }
  if (app.reject_kind === "JOB_CLOSED") {
    return { label: "Lowongan ditutup", hint: app.reject_reason || "Klien menutup lowongan ini", tone: "muted" };
  }
  const auto = app.reject_kind === "AUTO_FILLED" || (!app.reject_kind && jobFilled);
  if (auto) {
    return {
      label: "Tidak terpilih",
      hint: app.reject_reason || "Klien sudah merekrut pelamar lain",
      tone: "muted",
    };
  }
  return { label: "Ditolak", hint: app.reject_reason || "Kamu menolak lamaran ini", tone: "bad" };
}

function MiniFolio({ items }) {
  if (!items?.length) return null;
  return (
    <div className="ja-folio-grid">
      {items.slice(0, 4).map((p) => {
        const href = resolveUploadUrl(p.file_url || p.image_url);
        return (
          <a key={p.id} className="ja-folio-item" href={href || `/profile/${p.user_id || ""}`} target={href ? "_blank" : undefined} rel="noreferrer">
            {p.image_url ? (
              <img src={resolveUploadUrl(p.image_url)} alt="" />
            ) : (
              <span>📄</span>
            )}
            <strong>{p.title}</strong>
          </a>
        );
      })}
    </div>
  );
}

export default function JobApplicationsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [acceptingApp, setAcceptingApp] = useState(null);
  const [rejectingApp, setRejectingApp] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    setErr("");
    try {
      const jRes = await api.lowonganShow(id);
      setJob(jRes.data);
      const appRes = await api.getJobApplications(id);
      setApplications(appRes.data || []);
      setSummary(appRes.summary || null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function executeAccept() {
    if (!acceptingApp) return;
    setErr("");
    setMsg("");
    setProcessing(true);
    try {
      const res = await api.applicationAccept(acceptingApp.id);
      setAcceptingApp(null);
      if (res.orderId) {
        nav(`/orders/${res.orderId}`, {
          state: { msg: "Lamaran diterima. Pelamar lain otomatis tidak terpilih. Lanjut bayar escrow agar pekerja mulai." },
        });
        return;
      }
      setMsg("Lamaran diterima. Pelamar lain otomatis ditandai tidak terpilih.");
      loadData();
    } catch (e) {
      setErr(e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectingApp) return;
    setErr("");
    setMsg("");
    setProcessing(true);
    try {
      await api.applicationReject(rejectingApp.id, { reason: rejectReason });
      setMsg("Lamaran ditolak. Pelamar akan mendapat notifikasi beserta alasannya.");
      setRejectingApp(null);
      setRejectReason("");
      loadData();
    } catch (e) {
      setErr(e.message);
    } finally {
      setProcessing(false);
    }
  }

  const jobFilled = job?.status === "FILLED" || applications.some((a) => a.status === "ACCEPTED");
  const counts = summary || {
    total: applications.length,
    pending: applications.filter((a) => a.status === "PENDING").length,
    accepted: applications.filter((a) => a.status === "ACCEPTED").length,
    rejected: applications.filter((a) => a.status === "REJECTED").length,
  };

  const sorted = useMemo(
    () => [...applications],
    [applications],
  );

  if (loading) return <Layout wide compact bgClass="app-kerja-bg"><Loading /></Layout>;
  if (!job) return <Layout wide compact bgClass="app-kerja-bg"><Alert>{err || "Lowongan tidak ditemukan"}</Alert></Layout>;

  return (
    <Layout wide compact bgClass="app-kerja-bg">
      <div className="ja-page">
        <Link to={`/lowongan/${id}`} className="back-link-sm">← Kembali ke detail lowongan</Link>
        <h1 className="catalog-display">
          <span className="catalog-display-kicker">Pelamar</span>
          <span className="catalog-display-word">Lowongan</span>
        </h1>
        <p className="mockup-hero-sub">{job.title}</p>

        <div className="ja-summary">
          <div>
            <span>Anggaran</span>
            <strong>{rupiah(job.budget)}</strong>
          </div>
          <div>
            <span>Total pelamar</span>
            <strong>{counts.total}</strong>
          </div>
          <div>
            <span>Menunggu</span>
            <strong>{counts.pending}</strong>
          </div>
          <div>
            <span>Diterima</span>
            <strong>{counts.accepted}</strong>
          </div>
          <div>
            <span>Tidak terpilih / ditolak</span>
            <strong>{counts.rejected}</strong>
          </div>
        </div>

        {jobFilled ? (
          <div className="ja-banner is-filled">
            Pekerja sudah dipilih. Lamaran lain otomatis berstatus <strong>tidak terpilih</strong> — mereka tidak bisa direkrut untuk lowongan ini.
          </div>
        ) : (
          <div className="ja-banner">
            Terima satu pelamar untuk membuat pesanan escrow. Pelamar lain akan otomatis tidak terpilih.
          </div>
        )}

        {err && <Alert type="danger">{err}</Alert>}
        {msg && <Alert type="success">{msg}</Alert>}

        {sorted.length === 0 ? (
          <div className="ja-empty">Belum ada pelamar untuk lowongan ini.</div>
        ) : sorted.map((app) => {
          const meta = statusMeta(app, jobFilled);
          const avatar = resolveUploadUrl(app.applicant_avatar);
          return (
            <article key={app.id} className={`ja-card is-${meta.tone}`}>
              <header className="ja-card-head">
                <Link to={`/profile/${app.seller_id}`} className="ja-person">
                  {avatar ? (
                    <img src={avatar} alt="" />
                  ) : (
                    <span className="ja-avatar-fallback">{(app.applicant_name?.[0] || "P").toUpperCase()}</span>
                  )}
                  <div>
                    <strong>
                      {app.applicant_name}
                      {app.applicant_verified ? <VerifiedMark tone="kerja" /> : null}
                    </strong>
                    <span>
                      {[app.applicant_city, app.applicant_province].filter(Boolean).join(", ") || "Indonesia"}
                      {" · "}Melamar {timeAgo(app.created_at)}
                    </span>
                    <em>
                      {Number(app.applicant_rating) > 0 ? `${Number(app.applicant_rating).toFixed(1)} ★` : "Belum ada rating"}
                      {app.applicant_review_count ? ` (${app.applicant_review_count})` : ""}
                      {app.applicant_completed ? ` · ${app.applicant_completed} selesai` : ""}
                    </em>
                  </div>
                </Link>
                <div className={`ja-status is-${meta.tone}`}>
                  <b>{meta.label}</b>
                  <small>{meta.hint}</small>
                </div>
              </header>

              {app.applicant_bio ? <p className="ja-bio">{app.applicant_bio}</p> : null}

              <div className="ja-offer">
                <div>
                  <span>Penawaran harga</span>
                  <strong>{rupiah(app.proposed_price)}</strong>
                </div>
                <div>
                  <span>Estimasi pengerjaan</span>
                  <strong>{app.estimated_days || "—"} hari</strong>
                </div>
              </div>

              <div className="ja-letter">
                <span>Pesan penawaran</span>
                <p>{app.cover_letter || "Tidak ada pesan tambahan."}</p>
              </div>

              <div className="ja-files">
                <span>Berkas lampiran lamaran</span>
                {app.portfolio_file_url ? (
                  <PortfolioFileView url={app.portfolio_file_url} title="Lampiran lamaran" />
                ) : (
                  <p className="ja-empty-file">Pelamar tidak mengunggah berkas pada lamaran ini.</p>
                )}
              </div>

              {app.portfolios?.length ? (
                <div className="ja-files">
                  <span>Karya di profil</span>
                  <MiniFolio items={app.portfolios} />
                </div>
              ) : (
                <p className="ja-empty-file">Belum ada karya di portfolio profil.</p>
              )}

              {app.status === "REJECTED" && app.reject_kind === "MANUAL" && app.reject_reason ? (
                <div className="ja-reject-note">Alasan kamu: “{app.reject_reason}”</div>
              ) : null}

              <footer className="ja-actions">
                <Link to={`/profile/${app.seller_id}`} className="btn btn-sm">Lihat profil lengkap</Link>
                {app.status === "PENDING" && job.status === "OPEN" && !jobFilled && (
                  <>
                    <button type="button" className="btn btn-sm btn-primary-kerja" onClick={() => setAcceptingApp(app)} disabled={processing}>
                      Terima & rekrut
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm ja-reject-btn"
                      onClick={() => { setRejectingApp(app); setRejectReason(""); }}
                      disabled={processing}
                    >
                      Tolak
                    </button>
                  </>
                )}
                {app.order_id ? (
                  <Link to={`/orders/${app.order_id}`} className="btn btn-sm btn-primary-kerja">Buka pesanan</Link>
                ) : null}
              </footer>
            </article>
          );
        })}

        {rejectingApp && (
          <div className="modal-backdrop" onClick={() => setRejectingApp(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>Tolak lamaran</h3>
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 12px" }}>
                {rejectingApp.applicant_name} akan mendapat notifikasi beserta alasan ini.
              </p>
              <form onSubmit={handleRejectSubmit} className="form">
                <label>
                  Alasan penolakan
                  <textarea
                    required
                    minLength={5}
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Contoh: Penawaran atau pengalaman belum sesuai kebutuhan."
                  />
                </label>
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => setRejectingApp(null)} disabled={processing}>Batal</button>
                  <button type="submit" className="btn btn-cta-danger" disabled={processing || rejectReason.trim().length < 5}>Kirim penolakan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(acceptingApp)}
          title="Rekrut pelamar ini?"
          message={`Menerima ${acceptingApp?.applicant_name} dengan penawaran ${rupiah(acceptingApp?.proposed_price)}. Pesanan escrow dibuat, dan pelamar lain otomatis tidak terpilih.`}
          confirmText="Ya, rekrut"
          confirmTone="success"
          onConfirm={executeAccept}
          onCancel={() => setAcceptingApp(null)}
          loading={processing}
        />
      </div>
    </Layout>
  );
}
