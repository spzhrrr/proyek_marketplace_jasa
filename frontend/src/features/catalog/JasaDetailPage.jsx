import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import { api } from "../../services/api.js";
import { rupiah, parseJasaSkills, stripJasaSkills, portfolioDisplayName } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { needsVerification } from "../../utils/verification.js";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { ChatIcon } from "../../components/BellIcon.jsx";
import SkillTag from "../../components/SkillTag.jsx";

export default function JasaDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [deleteErr, setDeleteErr] = useState("");
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionProcessing, setActionProcessing] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  function loadData() {
    api.jasaShow(id).then((d) => {
      setData(d.data);
      setMeta(d.meta || {});
      setReviews(d.reviews || []);
    });
  }

  useEffect(() => {
    loadData();
  }, [id]);

  if (!data) return <Layout wide compact bgClass="app-jasa-bg"><Loading /></Layout>;

  const needsVerify = user && needsVerification(user);
  const isMine = meta.is_owner || (user && Number(data.seller_id) === Number(user.id));

  const coverImages = data.cover_image_url
    ? (data.cover_image_url.includes("||")
        ? data.cover_image_url.split("||").filter(Boolean)
        : [data.cover_image_url])
    : [];

  const cleanDesc = stripJasaSkills(data.description);
  const skillsList = parseJasaSkills(data.description, data.skills);

  const activeOrdersCount = meta.active_orders_count || (meta.has_active_request ? 1 : 0);
  const pendingOrdersCount = meta.pending_orders_count || 0;
  const lockReason = meta.lock_reason || "Masih ada permintaan sewa atau pesanan yang belum selesai.";
  const canEdit = meta.can_edit ?? (activeOrdersCount === 0 && pendingOrdersCount === 0);
  const canDelete = meta.can_delete ?? (activeOrdersCount === 0 && pendingOrdersCount === 0);
  const canToggleActive = meta.can_toggle ?? (activeOrdersCount === 0 && pendingOrdersCount === 0);
  const isInactive = data.status === "INACTIVE";
  const portfolioFileName = portfolioDisplayName(data.portfolio_file_url);
  const portfolioExt = (data.portfolio_file_url || "").split(".").pop()?.toUpperCase() || "FILE";
  const portfolioIsImage = /\.(jpeg|jpg|png|webp|gif)$/i.test(data.portfolio_file_url || "");
  const portfolioIsPdf = /\.pdf$/i.test(data.portfolio_file_url || "");
  const chatPeersCount = meta.chat_peers_count || 0;
  const listingActive = !!data.is_active && !isInactive;

  async function executeToggleActive() {
    setActionMsg("");
    setActionProcessing(true);
    try {
      const res = await api.toggleJasaActive(id);
      setActionMsg(`Status jasa berhasil diubah menjadi: ${res.status === "INACTIVE" ? "Non-Aktif" : "Aktif"}`);
      setShowToggleModal(false);
      setShowManageModal(false);
      loadData();
    } catch (err) {
      setDeleteErr(err.message);
    } finally {
      setActionProcessing(false);
    }
  }

  async function executeDelete() {
    setDeleteErr("");
    setActionProcessing(true);
    try {
      await api.jasaDelete(id);
      setShowDeleteModal(false);
      setShowManageModal(false);
      nav("/dashboard#jasa", { state: { msg: "Jasa berhasil dihapus." } });
    } catch (err) {
      setDeleteErr(err.message);
    } finally {
      setActionProcessing(false);
    }
  }

  function prevImg(e) {
    e?.stopPropagation();
    setActiveImgIndex((prev) => (prev === 0 ? coverImages.length - 1 : prev - 1));
  }

  function nextImg(e) {
    e?.stopPropagation();
    setActiveImgIndex((prev) => (prev === coverImages.length - 1 ? 0 : prev + 1));
  }

  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <div className="jd-page">
        <Link to="/jasa" className="back-link-sm">← Kembali ke Cari Jasa</Link>

        {deleteErr && <Alert type="danger">{deleteErr}</Alert>}
        {actionMsg && <Alert type="success">{actionMsg}</Alert>}

        {showCoverModal && coverImages.length > 0 && (
          <div className="modal-backdrop jd-lightbox" onClick={() => setShowCoverModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="jd-x" onClick={() => setShowCoverModal(false)}>×</button>
              <div className="jd-lightbox-stage">
                <img src={coverImages[activeImgIndex]} alt="" />
                {coverImages.length > 1 && (
                  <>
                    <button type="button" className="jd-nav left" onClick={prevImg}>‹</button>
                    <button type="button" className="jd-nav right" onClick={nextImg}>›</button>
                  </>
                )}
              </div>
              <div className="jd-lightbox-bar">
                <span>Foto {activeImgIndex + 1} dari {coverImages.length}</span>
                <button type="button" className="btn btn-sm" onClick={() => setShowCoverModal(false)}>Tutup</button>
              </div>
            </div>
          </div>
        )}

        {showPortfolioModal && data.portfolio_file_url && (
          <div className="modal-backdrop jd-port" onClick={() => setShowPortfolioModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="jd-card-h" style={{ fontSize: "1rem", marginBottom: 4 }}>Portofolio</h3>
              <p className="jd-file-sub">{portfolioFileName}</p>
              <div className="jd-port-preview">
                {portfolioIsImage ? (
                  <img src={data.portfolio_file_url} alt="Portofolio" />
                ) : (
                  <iframe
                    title="Preview portofolio"
                    src={`${data.portfolio_file_url}#toolbar=0`}
                  />
                )}
              </div>
              <div className="jd-port-actions">
                <button type="button" className="btn btn-sm" onClick={() => setShowPortfolioModal(false)}>Tutup</button>
                <a href={data.portfolio_file_url} download className="btn btn-primary btn-sm">
                  Unduh
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="jd-grid">
          <div className="jd-col">
            <div className="jd-card">
              <div
                className={`jd-stage ${coverImages.length === 0 ? "is-empty" : ""}`}
                onClick={() => coverImages.length > 0 && setShowCoverModal(true)}
                title={coverImages.length > 0 ? "Perbesar foto" : undefined}
              >
                {coverImages.length > 0 ? (
                  <img src={coverImages[activeImgIndex] || coverImages[0]} alt={data.title} />
                ) : (
                  <div className="jd-stage-empty">Belum ada foto cover</div>
                )}
                {coverImages.length > 1 && (
                  <>
                    <button type="button" className="jd-nav left" onClick={prevImg}>‹</button>
                    <button type="button" className="jd-nav right" onClick={nextImg}>›</button>
                    <span className="jd-count">{activeImgIndex + 1}/{coverImages.length}</span>
                  </>
                )}
              </div>
              {coverImages.length > 1 && (
                <div className="jd-thumbs">
                  {coverImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`jd-thumb ${activeImgIndex === idx ? "is-on" : ""}`}
                      onClick={() => setActiveImgIndex(idx)}
                    >
                      <img src={imgUrl} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="jd-card">
              <h3 className="jd-card-h">Portofolio</h3>
              {data.portfolio_file_url ? (
                <div className="jd-file">
                  <span className="jd-file-ico">{portfolioExt.slice(0, 3)}</span>
                  <div className="jd-file-meta">
                    <span className="jd-file-name" title={portfolioFileName}>{portfolioFileName}</span>
                    <span className="jd-file-sub">{portfolioIsPdf ? "PDF" : portfolioIsImage ? "Gambar" : "Lampiran"}</span>
                  </div>
                  <button type="button" className="btn btn-sm post-chip-action" onClick={() => setShowPortfolioModal(true)}>
                    Lihat
                  </button>
                </div>
              ) : (
                <p className="jd-muted">Belum ada dokumen portofolio.</p>
              )}
            </div>

            <div className="jd-card">
              <h3 className="jd-card-h">Ulasan ({reviews.length})</h3>
              {reviews.length === 0 ? (
                <p className="jd-muted">Belum ada ulasan.</p>
              ) : (
                <div className="jd-reviews">
                  {reviews.map((r) => (
                    <div key={r.id} className="jd-review">
                      <div className="jd-review-top">
                        <strong>
                          {r.reviewer_id
                            ? <Link to={`/profile/${r.reviewer_id}`}>{r.reviewer_name || "Pembeli"}</Link>
                            : (r.reviewer_name || "Pembeli")}
                        </strong>
                        <span>{"★".repeat(Number(r.rating) || 0)}</span>
                      </div>
                      {r.comment ? <p>{r.comment}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="jd-card jd-info">
            {isMine && (
              <div className={`jd-owner ${isInactive ? "is-off" : ""}`}>
                <span>
                  <span className="jd-owner-mark">Jasa Anda</span>
                  {isInactive ? "Non-aktif" : "Aktif"}
                </span>
                <button type="button" className="btn btn-sm post-chip-action" onClick={() => setShowManageModal(true)}>
                  Kelola
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className={data.parent_type === "PHYSICAL" ? "tag-pill-type-physical" : "tag-pill-type-digital"}>
                {data.parent_type === "PHYSICAL" ? "Jasa fisik" : "Jasa digital"}
              </span>
              {data.category_name && <span className="tag-pill-sub">{data.category_name}</span>}
            </div>

            <h1 className="jd-title">{data.title}</h1>

            <div className="jd-meta">
              <span>
                <svg viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" strokeWidth="1">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {data.seller_rating
                  ? `${data.seller_rating} (${data.seller_review_count || 0})`
                  : `Belum ada rating`}
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {data.delivery_days || 3} hari
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Escrow
              </span>
            </div>

            <div className="jd-block" style={{ borderTop: "none", paddingTop: 0 }}>
              <h4>Keahlian</h4>
              {skillsList.length > 0 ? (
                <div className="jd-skills">
                  {skillsList.map((skill, sIdx) => (
                    <SkillTag key={sIdx} label={skill} />
                  ))}
                </div>
              ) : (
                <p className="jd-muted" style={{ padding: "6px 8px" }}>Belum ada tag keahlian pada jasa ini.</p>
              )}
            </div>

            <div className="jd-block">
              <h4>Tentang jasa</h4>
              <p className="jd-desc">{cleanDesc}</p>
            </div>

            <div className="jd-block jd-foot" style={{ marginBottom: 8 }}>
              <div>
                <h4>Penjual</h4>
                <Link to={`/profile/${data.seller_id}`} className="jd-seller">
                  {data.seller_avatar ? (
                    <img src={data.seller_avatar} alt="" className="jd-avatar" />
                  ) : (
                    <span className="jd-avatar-ph">{(data.seller_name?.[0] || "U").toUpperCase()}</span>
                  )}
                  <div>
                    <strong>
                      {data.seller_name}
                      {data.seller_ktp_status === "APPROVED" && <span className="ok" title="Terverifikasi"> ✓</span>}
                    </strong>
                  </div>
                </Link>
              </div>
              <div>
                <span className="jd-price-label">Harga</span>
                <div className="jd-price">{rupiah(data.price)}</div>
              </div>
            </div>

            <div className="jd-block" style={{ marginBottom: 0 }}>
              <div className="jd-escrow">Pembayaran diamankan escrow Tolongin</div>
              <div className="jd-cta">
                {isMine ? (
                  <>
                    <Link to={`/jasa/${id}/requests`} className="btn btn-primary">
                      Lihat permintaan ({meta.requests_count ?? meta.pending_orders_count ?? 0} menunggu)
                    </Link>
                    {chatPeersCount > 0 && (
                      <Link to={`/chat?kind=jasa&id=${id}`} className="btn btn-chat">
                        <ChatIcon size={15} /> Lihat percakapan ({chatPeersCount})
                      </Link>
                    )}
                  </>
                ) : meta.has_active_request || meta.has_pending_request ? (
                  <>
                    {meta.active_order_id ? (
                      <Link to={`/orders/${meta.active_order_id}`} className="btn btn-primary">Lihat pesanan</Link>
                    ) : (
                      <Link to="/dashboard#pesanan" className="btn btn-primary">Lihat permintaan</Link>
                    )}
                    <Link to={`/jasa/${id}/chat`} className="btn btn-chat">
                      <ChatIcon size={15} /> Chat penjual
                    </Link>
                  </>
                ) : meta.can_rent ? (
                  <>
                    <Link to={`/jasa/${id}/sewa`} className="btn btn-primary">Pesan sekarang</Link>
                    {user && listingActive && (
                      <Link to={`/jasa/${id}/chat`} className="btn btn-chat">
                        <ChatIcon size={15} /> Tanya penjual
                      </Link>
                    )}
                  </>
                ) : !user ? (
                  <Link to="/login" className="btn btn-primary">Masuk untuk pesan</Link>
                ) : needsVerify ? (
                  <Link to="/verify" className="btn btn-primary">Verifikasi akun dulu</Link>
                ) : !listingActive ? (
                  <span className="btn" style={{ opacity: 0.55 }}>Jasa sedang tidak aktif</span>
                ) : (
                  <>
                    <span className="btn" style={{ opacity: 0.55 }}>Tidak tersedia</span>
                    {user && (
                      <Link to={`/jasa/${id}/chat`} className="btn btn-chat">
                        <ChatIcon size={15} /> Chat penjual
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {showManageModal && (
          <div className="modal-backdrop jd-manage" onClick={() => setShowManageModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="jd-manage-head">
                <div>
                  <h3>Kelola jasa</h3>
                  <span>Status: {isInactive ? "Non-aktif" : "Aktif"}</span>
                </div>
                <button type="button" className="btn btn-sm post-chip-action" onClick={() => setShowManageModal(false)}>×</button>
              </div>

              {deleteErr && <Alert type="danger">{deleteErr}</Alert>}

              <div className="jd-manage-list">
                {canEdit ? (
                  <button type="button" className="btn" onClick={() => setShowEditConfirmModal(true)}>
                    Edit informasi jasa
                  </button>
                ) : null}

                {canToggleActive ? (
                  <button type="button" className="btn" onClick={() => setShowToggleModal(true)}>
                    {isInactive ? "Aktifkan jasa kembali" : "Non-aktifkan sementara"}
                  </button>
                ) : null}

                {canDelete ? (
                  <button type="button" className="btn" style={{ color: "#dc2626" }} onClick={() => setShowDeleteModal(true)}>
                    Hapus jasa
                  </button>
                ) : null}

                {(!canEdit || !canToggleActive || !canDelete) ? (
                  <div className="jd-manage-lock is-warn">{lockReason}</div>
                ) : null}
              </div>

              <button type="button" className="btn btn-block" onClick={() => setShowManageModal(false)}>Tutup</button>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showEditConfirmModal}
          title="Edit informasi jasa?"
          message={`Ubah jasa "${data.title}"? Perubahan judul, deskripsi, atau harga langsung tampil di katalog.`}
          confirmText="Lanjut edit"
          confirmTone="primary"
          onConfirm={() => {
            setShowEditConfirmModal(false);
            setShowManageModal(false);
            nav(`/jasa/${id}/edit`);
          }}
          onCancel={() => setShowEditConfirmModal(false)}
        />

        <ConfirmModal
          isOpen={showToggleModal}
          title={isInactive ? "Aktifkan jasa kembali?" : "Non-aktifkan jasa sementara?"}
          message={
            isInactive
              ? `Jasa "${data.title}" akan tampil lagi di Cari Jasa dan bisa dipesan.`
              : `Jasa "${data.title}" disembunyikan dari katalog. Hanya bisa dilakukan jika tidak ada permintaan sewa atau pesanan berjalan.`
          }
          confirmText={isInactive ? "Ya, aktifkan" : "Ya, non-aktifkan"}
          confirmTone={isInactive ? "success" : "danger"}
          onConfirm={executeToggleActive}
          onCancel={() => setShowToggleModal(false)}
          loading={actionProcessing}
        />

        <ConfirmModal
          isOpen={showDeleteModal}
          title="Hapus jasa?"
          message={`Hapus jasa "${data.title}" dari katalog? Tidak bisa jika masih ada sewa berjalan. Riwayat pesanan selesai tetap tersimpan.`}
          confirmText="Ya, hapus"
          confirmTone="danger"
          onConfirm={executeDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={actionProcessing}
        />
      </div>
    </Layout>
  );
}
