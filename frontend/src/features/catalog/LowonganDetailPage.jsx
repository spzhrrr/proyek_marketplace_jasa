import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import { api } from "../../services/api.js";
import { rupiah, jobStatusLabel, timeAgo, parseJobSkills, stripJobSkills, applyWindowLabel, isJobUrgent } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { needsVerification } from "../../utils/verification.js";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { ChatIcon } from "../../components/BellIcon.jsx";
import SkillTag from "../../components/SkillTag.jsx";

export default function LowonganDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    api.lowonganShow(id).then((d) => {
      setData(d.data);
      setMeta(d.meta || {});
    });
  }, [id]);

  if (!data) return <Layout wide compact bgClass="app-kerja-bg"><Loading /></Layout>;

  const posterName = data.buyer_name || data.poster_name || "Client";
  const city = data.poster_city || data.city || data.buyer_city || "—";
  const needsVerify = user && needsVerification(user);
  const cleanDesc = stripJobSkills(data.description) || "Deskripsi pekerjaan tidak tersedia.";
  const skills = parseJobSkills(data.description, data.skills);
  const skillChips = skills.length ? skills : (data.category_name ? [data.category_name] : []);
  const isDigital = data.parent_type === "DIGITAL";
  const urgent = isJobUrgent(data);
  const windowLabel = applyWindowLabel(data.deadline, urgent);
  const listed = data.status === "OPEN" && Number(data.is_active) !== 0;
  const isOpen = listed && (meta.apply_open !== false);
  const isPaused = data.status === "CLOSED" || data.status === "CANCELLED" || (data.status === "OPEN" && Number(data.is_active) === 0);
  const chatPeersCount = meta.chat_peers_count || 0;
  const canEdit = meta.can_edit ?? (isOpen && Number(data.applicant_count || 0) === 0);
  const canDelete = meta.can_delete ?? false;
  const canToggle = meta.can_toggle ?? false;
  const canClose = meta.can_close ?? false;
  const lockReason = meta.lock_reason || "Masih ada lamaran atau proyek yang berjalan.";
  const applicantCount = data.applicant_count || 0;

  async function executeToggleActive() {
    setActionErr("");
    setSuccessMsg("");
    setActionProcessing(true);
    try {
      const res = await api.toggleLowonganActive(id);
      setData((prev) => ({
        ...prev,
        status: res.status,
        is_active: res.is_active !== undefined ? Number(res.is_active) !== 0 : prev.is_active,
      }));
      setShowToggleModal(false);
      setShowManageModal(false);
      setSuccessMsg(res.is_active ? "Lowongan tampil lagi di Cari Kerja." : "Lowongan disembunyikan dari Cari Kerja.");
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setActionProcessing(false);
    }
  }

  async function executeDelete() {
    setActionErr("");
    setActionProcessing(true);
    try {
      await api.lowonganDelete(id);
      nav("/dashboard#lowongan", { state: { msg: "Lowongan berhasil dihapus." } });
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setActionProcessing(false);
    }
  }

  async function executeClose() {
    setActionErr("");
    setActionProcessing(true);
    try {
      const res = await api.lowonganClose(id);
      nav("/dashboard#lowongan", {
        state: { msg: `Lowongan ditutup. ${res.rejected || 0} lamaran ditolak otomatis.` },
      });
    } catch (err) {
      setActionErr(err.message);
    } finally {
      setActionProcessing(false);
    }
  }

  return (
    <Layout wide compact bgClass="app-kerja-bg">
      <div className="ld-page">
        <Link to="/lowongan" className="back-link-sm">← Kembali ke Cari Kerja</Link>

        {successMsg && <Alert type="success">{successMsg}</Alert>}
        {actionErr && !showManageModal && <Alert type="danger">{actionErr}</Alert>}

        <div className="ld-grid">
          <div className="jd-card ld-main">
            {meta.has_applied && (
              <div className="ld-banner is-ok">Lamaran kamu sudah terkirim. Tunggu tinjauan pemberi kerja.</div>
            )}
            {meta.is_owner && (
              <div className={`jd-owner ${isPaused ? "is-off" : ""}`}>
                <span>
                  <span className="jd-owner-mark">Milik kamu</span>
                  {jobStatusLabel(data.status)}
                </span>
                <button type="button" className="btn btn-sm post-chip-action" onClick={() => setShowManageModal(true)}>
                  Kelola
                </button>
              </div>
            )}

            <div className="ld-tags">
              <span className={isDigital ? "tag-pill-type-digital" : "tag-pill-type-physical"}>
                {isDigital ? "Lowongan Digital" : "Lowongan Fisik"}
              </span>
              {data.category_name && <span className="tag-pill-sub">{data.category_name}</span>}
              {urgent && <span className="tag-pill-urgent">Urgent · hari ini</span>}
              <span className={`ld-status ${isOpen ? "is-open" : isPaused ? "is-off" : "is-done"}`}>
                {jobStatusLabel(data.status)}
              </span>
            </div>

            <h1 className="jd-title">{data.title}</h1>

            <div className="jd-meta">
              <span>{city}</span>
              <span>{timeAgo(data.created_at)}</span>
              <span>{applicantCount} pelamar</span>
              {windowLabel ? <span className="ld-deadline">{windowLabel}</span> : null}
            </div>

            <div className="jd-block">
              <h4>Deskripsi pekerjaan</h4>
              <p className="jd-desc ld-desc">{cleanDesc}</p>
            </div>

            <div className="jd-block">
              <h4>Keahlian dibutuhkan</h4>
              <div className="jd-skills ld-skills">
                {skillChips.map((sk) => <SkillTag key={sk} label={sk} />)}
              </div>
            </div>

            <div className="jd-block" style={{ marginBottom: 0 }}>
              <h4>Diposting oleh</h4>
              <Link to={`/profile/${data.buyer_id}`} className="ld-poster">
                {data.poster_avatar ? (
                  <img src={data.poster_avatar} alt="" className="jd-avatar" />
                ) : (
                  <span className="jd-avatar-ph">{(posterName?.[0] || "C").toUpperCase()}</span>
                )}
                <span>
                  <strong>{posterName}</strong>
                  <small>{city !== "—" ? city : "Member Tolongin"}</small>
                </span>
              </Link>
            </div>
          </div>

          <aside className="jd-card ld-side">
            <div className="ld-budget">
              <span>Anggaran proyek</span>
              <strong>{rupiah(data.budget)}</strong>
            </div>
            <dl className="ld-facts">
              <div><dt>Kategori</dt><dd>{data.category_name || "—"}</dd></div>
              <div><dt>Lokasi</dt><dd>{city}</dd></div>
              <div><dt>Tipe</dt><dd>{isDigital ? "Remote" : "Onsite"}</dd></div>
              <div><dt>Batas lamaran</dt><dd>{windowLabel || "Sampai ditutup manual"}</dd></div>
              <div><dt>Pelamar</dt><dd>{applicantCount} orang</dd></div>
            </dl>
            <p className="jd-escrow">Pembayaran diamankan escrow Tolongin setelah pelamar diterima.</p>
            <div className="jd-cta">
              {meta.is_owner ? (
                <>
                  <Link to={`/lowongan/${id}/lamaran`} className="btn btn-primary">
                    Lihat pelamar ({applicantCount})
                  </Link>
                  {chatPeersCount > 0 && (
                    <Link to={`/chat?kind=lowongan&id=${id}`} className="btn btn-chat">
                      <ChatIcon size={15} /> Lihat percakapan ({chatPeersCount})
                    </Link>
                  )}
                  <button type="button" className="btn" onClick={() => setShowManageModal(true)}>
                    Kelola lowongan
                  </button>
                </>
              ) : isOpen && meta.can_apply ? (
                <>
                  <Link to={`/lowongan/${id}/lamar`} className="btn btn-primary">Lamar pekerjaan</Link>
                  {user && (
                    <Link to={`/lowongan/${id}/chat`} className="btn btn-chat">
                      <ChatIcon size={15} /> Tanya pemberi kerja
                    </Link>
                  )}
                </>
              ) : meta.has_applied ? (
                <>
                  <Link to="/dashboard#lamaran" className="btn btn-primary">Lihat status lamaran</Link>
                  <Link to={`/lowongan/${id}/chat`} className="btn btn-chat">
                    <ChatIcon size={15} /> Follow up lamaran
                  </Link>
                </>
              ) : needsVerify && isOpen ? (
                <Link to="/verify" className="btn btn-primary">Verifikasi akun dulu</Link>
              ) : !user && isOpen ? (
                <Link to="/login" className="btn btn-primary">Masuk untuk melamar</Link>
              ) : (
                <>
                  <span className="btn" style={{ opacity: 0.55 }}>Lowongan tidak menerima pelamar</span>
                  {user && (
                    <Link to={`/lowongan/${id}/chat`} className="btn btn-chat">
                      <ChatIcon size={15} /> Chat pemberi kerja
                    </Link>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {showManageModal && (
          <div className="modal-backdrop jd-manage" onClick={() => setShowManageModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="jd-manage-head">
                <div>
                  <h3>Kelola lowongan</h3>
                  <span>Status: {jobStatusLabel(data.status)}</span>
                </div>
                <button type="button" className="btn btn-sm post-chip-action" onClick={() => setShowManageModal(false)}>×</button>
              </div>
              {actionErr && <Alert type="danger">{actionErr}</Alert>}
              <div className="jd-manage-list">
                {canEdit ? (
                  <Link to={`/lowongan/${id}/edit`} className="btn">Edit informasi lowongan</Link>
                ) : null}
                {canToggle ? (
                  <button type="button" className="btn" onClick={() => setShowToggleModal(true)}>
                    {isPaused ? "Aktifkan di Cari Kerja" : "Nonaktifkan dari katalog"}
                  </button>
                ) : null}
                {canClose ? (
                  <button type="button" className="btn" onClick={() => setShowCloseModal(true)}>
                    Tutup lowongan (tolak pelamar)
                  </button>
                ) : null}
                {canDelete ? (
                  <button type="button" className="btn" onClick={() => setShowDeleteModal(true)}>Hapus lowongan</button>
                ) : null}
                {(!canToggle || !canDelete) ? (
                  <p className="jd-muted">{lockReason}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showToggleModal}
          title={isPaused ? "Aktifkan lowongan?" : "Sembunyikan lowongan?"}
          message={
            isPaused
              ? `“${data.title}” akan tampil lagi di Cari Kerja.`
              : `“${data.title}” tidak akan tampil di Cari Kerja sampai diaktifkan lagi.`
          }
          confirmText={isPaused ? "Ya, aktifkan" : "Ya, sembunyikan"}
          confirmTone={isPaused ? "success" : "danger"}
          onConfirm={executeToggleActive}
          onCancel={() => setShowToggleModal(false)}
          loading={actionProcessing}
        />
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Hapus lowongan?"
          message={`Hapus “${data.title}”? Hanya bisa jika belum ada pelamar.`}
          confirmText="Ya, hapus"
          confirmTone="danger"
          onConfirm={executeDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={actionProcessing}
        />
        <ConfirmModal
          isOpen={showCloseModal}
          title="Tutup lowongan?"
          message={`Semua lamaran menunggu untuk “${data.title}” akan ditolak otomatis. Proyek yang sudah diterima tidak terpengaruh — itu harus diselesaikan lewat pesanan.`}
          confirmText="Ya, tutup & tolak pelamar"
          confirmTone="danger"
          onConfirm={executeClose}
          onCancel={() => setShowCloseModal(false)}
          loading={actionProcessing}
        />
      </div>
    </Layout>
  );
}
