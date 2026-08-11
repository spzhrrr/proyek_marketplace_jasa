import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import FlowSteps from "../../components/FlowSteps.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderStatusLabel, escrowLabel, submissionStatusLabel, orderTotal, timeAgo } from "../../utils/format.js";
import { getOrderFlowSteps, getOrderNextHint } from "../../utils/orderGuide.js";
import PortfolioFileView from "../../components/PortfolioFileView.jsx";
import { VerifiedMark } from "../../components/CatalogCards.jsx";
import { resolveUploadUrl } from "../../utils/media.js";

function OrderContent() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(location.state?.msg || "");
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelBox, setShowCancelBox] = useState(false);
  const [files, setFiles] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeBox, setShowDisputeBox] = useState(false);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "",
    confirmTone: "primary",
    onConfirm: null,
  });

  async function load() {
    try {
      const res = await api.orderShow(id);
      setD(res);
    } catch (e) {
      setD({ error: true, message: e.message || "Tidak dapat memuat detail pesanan ini." });
    }
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!searchParams.get("ok") || !d || d.error) return;
    api.paymentCheck(id).then((res) => {
      if (res.paid) {
        setMsg("Pembayaran berhasil! Penjual akan mulai mengerjakan pesananmu.");
        load();
      }
    }).catch(() => {});
  }, [searchParams, id, d]);

  async function act(fn, okMsg) {
    setMsg("");
    try {
      await fn();
      setMsg(okMsg);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function submitWork(e) {
    e.preventDefault();
    setConfirmModal({
      isOpen: true,
      title: "Kirim Bukti Pekerjaan",
      message: "Apakah Anda yakin ingin mengirimkan bukti pengerjaan ini ke pembeli?",
      confirmText: "Ya, Kirim Sekarang",
      confirmTone: "primary",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const fd = new FormData();
        fd.append("note", note);
        if (files) Array.from(files).forEach((f) => fd.append("proof_files", f));
        setMsg("");
        try {
          await api.submitWork(id, fd);
          setMsg("Bukti pekerjaan terkirim. Pembeli akan meninjaunya.");
          setNote("");
          setFiles(null);
          load();
        } catch (e) {
          setMsg(e.message);
        }
      },
    });
  }

  if (!d) return <Loading />;

  if (d.error) {
    return (
      <div style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center", padding: "0 20px" }}>
        <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px 24px", border: "1px solid #fee2e2", boxShadow: "0 10px 30px rgba(239, 68, 68, 0.08)" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 900, color: "#0f172a", margin: "0 0 8px" }}>
            Tidak Dapat Mengakses Pesanan
          </h3>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 20px", lineHeight: 1.5 }}>
            {d.message || "Anda tidak memiliki hak akses ke pesanan ini atau pesanan tidak ditemukan."}
          </p>
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: "10px 24px", borderRadius: "12px", fontWeight: 800, textDecoration: "none", display: "inline-block" }}>
            ← Kembali ke Beranda Saya
          </Link>
        </div>
      </div>
    );
  }

  const { order, isBuyer, isSeller, canPay, canCancel, canSubmitWork, hasReviewed, pendingSubmission, payout, canDispute, revisionsExhausted, maxRevisions, revisionCount, hired } = d;
  const total = orderTotal(order);
  const flowSteps = getOrderFlowSteps(order);
  const nextHint = getOrderNextHint(order, { isBuyer, isSeller, canPay, canSubmitWork, pendingSubmission, canDispute, revisionsExhausted });

  const partnerName = isBuyer ? order.seller_name : order.buyer_name;
  const partnerAvatar = isBuyer ? order.seller_avatar : order.buyer_avatar;
  const partnerRoleLabel = isBuyer ? "Penjual / Freelancer" : "Pembeli / Klien";

  const hasActiveAction =
    (order.status === "PENDING" && isSeller) ||
    (canPay && isBuyer) ||
    canSubmitWork ||
    (isBuyer && order.status === "IN_PROGRESS" && pendingSubmission) ||
    (canDispute && (isBuyer || isSeller)) ||
    (order.status === "COMPLETED" && !hasReviewed);

  // Extract latest submission files & note directly
  const latestSubmission = d.submissions?.length > 0 ? d.submissions[0] : null;
  const activeSubmissionFiles = pendingSubmission?.files?.length
    ? pendingSubmission.files
    : (latestSubmission?.files || []);
  const activeSubmissionNote = pendingSubmission?.note || latestSubmission?.note || "";

  return (
    <div style={{ maxWidth: "1120px", margin: "0 auto", paddingBottom: "40px" }}>
      
      {/* ── TOP BREADCRUMB & HEADER ROW ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <Link to="/dashboard" style={{ color: order.source === "JOB" ? "#7e22ce" : "#0284c7", fontWeight: 800, textDecoration: "none", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Kembali ke Beranda Saya
          </Link>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#0f172a", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
            Pesanan #{order.order_number}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ padding: "5px 14px", borderRadius: "999px", background: order.source === "JOB" ? "rgba(147, 51, 234, 0.1)" : "rgba(2, 132, 199, 0.1)", color: order.source === "JOB" ? "#7e22ce" : "#0284c7", border: `1px solid ${order.source === "JOB" ? "rgba(147, 51, 234, 0.25)" : "rgba(2, 132, 199, 0.25)"}`, fontSize: "0.775rem", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {order.source === "JOB" ? <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /> : <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />}
            </svg>
            {order.source === "JOB" ? "Dari Lowongan Kerja" : "Sewa Jasa Freelance"}
          </span>

          {/* Direct Chat Partner Action Button */}
          {order.service_id && (
            <Link
              to={`/jasa/${order.service_id}/chat${isSeller ? `?with=${order.buyer_id}` : ""}`}
              className="btn btn-primary"
              style={{ padding: "6px 14px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat terkait jasa
            </Link>
          )}
          {order.job_id && (
            <Link
              to={`/lowongan/${order.job_id}/chat${isBuyer ? `?with=${order.seller_id}` : ""}`}
              className="btn btn-primary"
              style={{ padding: "6px 14px", borderRadius: "10px", fontSize: "0.8rem", fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", background: "#7e22ce" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat terkait lowongan
            </Link>
          )}
        </div>
      </div>

      {msg && (
        <Alert type={msg.includes("berhasil") || msg.includes("terkirim") || msg.includes("dikonfirmasi") || msg.includes("disetujui") || msg.includes("diterima") ? "success" : "danger"} style={{ marginBottom: "16px" }}>
          {msg}
        </Alert>
      )}

      {/* ── 2-COLUMN RESPONSIVE LAYOUT ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.18fr 0.82fr", gap: "20px", alignItems: "start" }}>
        
        {/* 👈 LEFT COLUMN: Primary Actions (if any), Progress Stepper, Service Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* 🌟 1. ACTION CARD AT TOP WHEN ACTION REQUIRED (ZERO SCROLL NEEDED) 🌟 */}

          {/* Action Card: Review Submitted Work (Buyer) — hanya jika ada submission SUBMITTED */}
          {isBuyer && order.status === "IN_PROGRESS" && pendingSubmission && (
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "2px solid #0284c7", boxShadow: "0 10px 32px rgba(2, 132, 199, 0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ background: "#0284c7", color: "#fff", padding: "4px 10px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase" }}>
                  TINDAKAN UTAMA
                </span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Tinjau Hasil Pekerjaan Penjual
                </h3>
              </div>

              {/* UNIFIED CATATAN & LAMPIRAN BERKAS BOX */}
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                <span style={{ fontSize: "0.75rem", color: "#0284c7", fontWeight: 800, display: "block", marginBottom: "8px" }}>
                  CATATAN & LAMPIRAN BERKAS DARI PENJUAL
                </span>
                
                {activeSubmissionNote ? (
                  <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#0f172a", fontStyle: "italic", lineHeight: 1.5, background: "#ffffff", padding: "10px 14px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                    "{activeSubmissionNote}"
                  </p>
                ) : (
                  <p style={{ margin: "0 0 12px", fontSize: "0.825rem", color: "#64748b" }}>
                    Penjual telah mengirimkan pekerjaan untuk Anda tinjau.
                  </p>
                )}

                {activeSubmissionFiles.length > 0 ? (
                  <div>
                    <span style={{ fontSize: "0.725rem", color: "#334155", fontWeight: 800, display: "block", marginBottom: "8px" }}>
                      📥 LAMPIRAN FILE HASIL KERJA ({activeSubmissionFiles.length}):
                    </span>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {activeSubmissionFiles.map((f) => (
                        <a
                          key={f.id}
                          href={f.file_path}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-primary"
                          style={{ borderRadius: "10px", textDecoration: "none", fontSize: "0.825rem", fontWeight: 800, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Unduh Berkas: {f.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Tidak ada lampiran file tambahan.</span>
                )}
              </div>

              {/* DECISION FORM & BUTTONS */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#334155", display: "block", marginBottom: "6px" }}>
                  Catatan Persetujuan / Instruksi Revisi:
                </label>
                <textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Tulis masukan atau instruksi revisi jika ada..."
                  style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.85rem", marginBottom: "14px" }}
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "12px 22px", borderRadius: "12px", fontWeight: 800, flex: 1.2, fontSize: "0.9rem" }}
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: "Setujui Pekerjaan & Cairkan Dana",
                        message: "Apakah Anda sudah memeriksa file dan puas dengan pekerjaan ini? Dana escrow akan dicairkan langsung ke penjual.",
                        confirmText: "Ya, Setujui & Cairkan",
                        confirmTone: "success",
                        onConfirm: () => {
                          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                          act(() => api.approveWork(id, reviewNote), "Pekerjaan disetujui — pesanan selesai");
                        },
                      });
                    }}
                  >
                    Setujui & Selesaikan Pesanan
                  </button>

                  <button
                    type="button"
                    className="btn btn-nav-register"
                    style={{ padding: "12px 18px", borderRadius: "12px", fontWeight: 800, flex: 0.8, fontSize: "0.875rem", opacity: revisionsExhausted ? 0.5 : 1 }}
                    disabled={!!revisionsExhausted}
                    onClick={() => {
                      if (revisionsExhausted) return;
                      setConfirmModal({
                        isOpen: true,
                        title: "Minta Revisi Pekerjaan",
                        message: `Apakah Anda ingin meminta penjual memperbaiki hasil pekerjaan ini? (Revisi ${revisionCount || 0}/${maxRevisions || 3})`,
                        confirmText: "Ya, Kirim Revisi",
                        confirmTone: "primary",
                        onConfirm: () => {
                          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                          act(() => api.requestRevision(id, reviewNote), "Permintaan revisi terkirim");
                        },
                      });
                    }}
                  >
                    {revisionsExhausted ? "Batas Revisi Habis" : "Minta Revisi"}
                  </button>
                </div>
                {revisionsExhausted && (
                  <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "#b45309", fontWeight: 700 }}>
                    Batas revisi habis. Setujui hasil kerja atau ajukan sengketa di panel kanan.
                  </p>
                )}
              </div>
            </div>
          )}

          {order.status === "DISPUTED" && (
            <div style={{ background: "#fff7ed", borderRadius: "20px", padding: "20px", border: "2px solid #f97316" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#9a3412", margin: "0 0 8px" }}>Pesanan dalam Sengketa</h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#9a3412", lineHeight: 1.5 }}>
                Dana escrow tetap ditahan. Admin akan memutuskan refund ke pembeli atau pencairan ke penjual.
                {order.cancel_reason ? ` Alasan: "${order.cancel_reason}"` : ""}
              </p>
            </div>
          )}

          {/* Action Card: Submit Work (Seller) */}
          {canSubmitWork && (
            <form onSubmit={submitWork} style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "2px solid #0284c7", boxShadow: "0 10px 32px rgba(2, 132, 199, 0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ background: "#0284c7", color: "#fff", padding: "4px 10px", borderRadius: "999px", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase" }}>
                  TINDAKAN PENJUAL
                </span>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 900, color: "#0f172a", margin: 0 }}>Kirim Bukti Hasil Pekerjaan</h3>
              </div>
              <p style={{ fontSize: "0.825rem", color: "#64748b", margin: "0 0 14px" }}>
                Unggah foto atau berkas hasil kerja. Pembeli akan meninjau sebelum dana cair ke rekening kamu.
              </p>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "0.775rem", fontWeight: 800, color: "#334155", display: "block", marginBottom: "4px" }}>Catatan Hasil Kerja</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Jelaskan detail pekerjaan yang telah diselesaikan..."
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.825rem" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "0.775rem", fontWeight: 800, color: "#334155", display: "block", marginBottom: "4px" }}>Lampiran File Bukti (Foto / Dokumen)</label>
                <input type="file" multiple onChange={(e) => setFiles(e.target.files)} style={{ fontSize: "0.8rem" }} />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: "10px 22px", borderRadius: "10px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                Kirim Bukti Pekerjaan Sekarang
              </button>
            </form>
          )}

          {/* Action Card: Payment Required (Buyer) */}
          {canPay && (
            <div style={{ background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)", borderRadius: "20px", padding: "22px 24px", color: "#ffffff", boxShadow: "0 10px 30px rgba(2, 132, 199, 0.28)" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "0 0 6px" }}>Siap Melakukan Pembayaran</h3>
              <p style={{ fontSize: "0.85rem", color: "#e0f2fe", margin: "0 0 16px", lineHeight: 1.5 }}>
                Pembayaran Anda aman ditahan oleh sistem <strong>Safe Escrow TolongIn</strong> dan baru diteruskan ke penjual setelah Anda menyetujui hasil pekerjaan.
              </p>
              <Link to={`/orders/${id}/bayar`} className="btn" style={{ background: "#ffffff", color: "#0284c7", fontWeight: 900, padding: "12px 26px", borderRadius: "12px", fontSize: "0.9rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                Bayar Sekarang — {rupiah(total)}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          )}

          {/* Action Card: Seller Confirmation (Pending) */}
          {order.status === "PENDING" && isSeller && (
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "2px solid #0284c7", boxShadow: "0 8px 30px rgba(2, 132, 199, 0.12)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: "0 0 6px" }}>Konfirmasi Pesanan Masuk</h3>
              <p style={{ fontSize: "0.825rem", color: "#64748b", margin: "0 0 14px" }}>
                Terima jika kamu siap mengerjakan. Tolak hanya jika benar-benar tidak bisa — wajib isi alasan.
              </p>
              
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "0.775rem", fontWeight: 800, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Alasan Penolakan (Wajib jika menolak, min. 5 karakter)
                </label>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Jadwal pengerjaan penuh minggu ini..."
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.825rem" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "10px 22px", borderRadius: "10px", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: "6px" }}
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: "Terima Pesanan",
                      message: "Apakah Anda siap menerima pesanan ini? Pembeli akan diminta menyelesaikan pembayaran.",
                      confirmText: "Ya, Terima Pesanan",
                      confirmTone: "primary",
                      onConfirm: () => {
                        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                        act(() => api.orderAccept(id), "Pesanan diterima. Pembeli akan diminta bayar.");
                      },
                    });
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Terima Pesanan
                </button>

                <button
                  type="button"
                  className="btn btn-cta-danger"
                  style={{ padding: "10px 20px", borderRadius: "10px", fontWeight: 800 }}
                  onClick={() => {
                    if (rejectReason.trim().length < 5) {
                      setMsg("Alasan penolakan minimal 5 karakter");
                      return;
                    }
                    setConfirmModal({
                      isOpen: true,
                      title: "Tolak Pesanan",
                      message: `Apakah Anda yakin ingin menolak pesanan ini dengan alasan: "${rejectReason.trim()}"?`,
                      confirmText: "Ya, Tolak Pesanan",
                      confirmTone: "danger",
                      onConfirm: () => {
                        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                        act(() => api.orderReject(id, rejectReason.trim()), "Pesanan ditolak");
                      },
                    });
                  }}
                >
                  Tolak Pesanan
                </button>
              </div>
            </div>
          )}

          {/* 🌟 2. CONNECTED TIMELINE PROGRESS STEPPER 🌟 */}
          {order.status !== "REJECTED" && order.status !== "CANCELLED" && (
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "18px 20px", border: "1px solid rgba(226, 232, 240, 0.9)", boxShadow: "0 8px 26px rgba(15, 23, 42, 0.04)" }}>
              <FlowSteps steps={flowSteps} />
            </div>
          )}

          {order.source === "JOB" && hired ? (
            <div className="od-hired">
              <div className="od-hired-kicker">Pekerja terpilih</div>
              <Link to={`/profile/${hired.id}`} className="od-hired-person">
                {hired.avatar ? (
                  <img src={resolveUploadUrl(hired.avatar)} alt="" />
                ) : (
                  <span>{(hired.name?.[0] || "P").toUpperCase()}</span>
                )}
                <div>
                  <strong>
                    {hired.name}
                    {hired.verified ? <VerifiedMark tone="kerja" /> : null}
                  </strong>
                  <em>
                    {[hired.city, hired.province].filter(Boolean).join(", ") || "Indonesia"}
                    {hired.rating > 0 ? ` · ${Number(hired.rating).toFixed(1)} ★ (${hired.review_count})` : " · Belum ada rating"}
                  </em>
                  {hired.bio ? <p>{hired.bio}</p> : null}
                </div>
              </Link>
              <div className="od-hired-meta">
                {hired.proposed_price != null ? (
                  <div><span>Penawaran</span><b>{rupiah(hired.proposed_price)}</b></div>
                ) : null}
                {hired.estimated_days ? (
                  <div><span>Estimasi</span><b>{hired.estimated_days} hari</b></div>
                ) : null}
                {hired.applied_at ? (
                  <div><span>Melamar</span><b>{timeAgo(hired.applied_at)}</b></div>
                ) : null}
              </div>
              {hired.cover_letter ? (
                <div className="od-hired-letter">
                  <span>Pesan penawaran saat melamar</span>
                  <p>{hired.cover_letter}</p>
                </div>
              ) : null}
              {hired.portfolio_file_url ? (
                <PortfolioFileView url={hired.portfolio_file_url} title="Lampiran lamaran" />
              ) : null}
              {hired.portfolios?.length ? (
                <div className="od-hired-folios">
                  <span>Karya di profil</span>
                  <div className="ja-folio-grid">
                    {hired.portfolios.slice(0, 4).map((p) => {
                      const href = resolveUploadUrl(p.file_url || p.image_url);
                      return (
                        <a key={p.id} className="ja-folio-item" href={href || `/profile/${hired.id}`} target={href ? "_blank" : undefined} rel="noreferrer">
                          {p.image_url ? <img src={resolveUploadUrl(p.image_url)} alt="" /> : <span>📄</span>}
                          <strong>{p.title}</strong>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="od-hired-links">
                <Link to={`/profile/${hired.id}`} className="btn btn-sm">Lihat profil</Link>
                {isBuyer && order.job_id ? (
                  <Link to={`/lowongan/${order.job_id}/lamaran`} className="btn btn-sm">Semua pelamar</Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 🌟 3. PROMINENT CARD: INFORMASI LISTING YANG DIPESAN 🌟 */}
          <div style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid rgba(226, 232, 240, 0.9)", boxShadow: "0 8px 26px rgba(15, 23, 42, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 800, color: order.source === "JOB" ? "#7e22ce" : "#0284c7", background: order.source === "JOB" ? "rgba(147, 51, 234, 0.1)" : "rgba(2, 132, 199, 0.1)", padding: "3px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {order.source === "JOB" ? "DETAIL LOWONGAN YANG DIREKRUT" : "DETAIL JASA YANG DIPESAN"}
              </span>
              {order.service_id && (
                <Link to={`/jasa/${order.service_id}`} style={{ fontSize: "0.775rem", fontWeight: 800, color: "#0284c7", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Lihat Halaman Jasa Asli
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              )}
              {order.job_id && !order.service_id && (
                <Link to={`/lowongan/${order.job_id}`} style={{ fontSize: "0.775rem", fontWeight: 800, color: "#7e22ce", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  Lihat Lowongan Asli
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              )}
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
              {order.service_cover ? (
                <img src={order.service_cover} alt="" style={{ width: "96px", height: "72px", borderRadius: "12px", objectFit: "cover", border: "1px solid #e2e8f0" }} />
              ) : (
                <div style={{ width: "96px", height: "72px", borderRadius: "12px", background: "linear-gradient(135deg, #e0f2fe, #bae6fd)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
              )}

              <div style={{ flex: 1, minWidth: "220px" }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                  {order.source === "JOB" ? (
                    <span className="tag-pill-sub" style={{ fontSize: "0.675rem", padding: "2px 8px" }}>
                      Lowongan Kerja
                    </span>
                  ) : (
                    <span className={order.service_parent_type === "PHYSICAL" ? "tag-pill-type-physical" : "tag-pill-type-digital"} style={{ fontSize: "0.675rem", padding: "2px 8px" }}>
                      {order.service_parent_type === "PHYSICAL" ? "Jasa Fisik" : "Jasa Digital"}
                    </span>
                  )}
                  {(order.service_category_name || order.job_category_name) && (
                    <span className="tag-pill-sub" style={{ fontSize: "0.675rem", padding: "2px 8px" }}>
                      {order.service_category_name || order.job_category_name}
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: "0 0 6px", lineHeight: 1.3 }}>
                  {order.service_title || order.job_title || order.title}
                </h3>

                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "0.775rem", color: "#64748b", fontWeight: 600 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Estimasi {order.service_delivery_days || order.estimated_days || order.application_estimated_days || 3} Hari Pengerjaan
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#0284c7" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Proteksi Garansi Escrow
                  </span>
                </div>
              </div>
            </div>

            {(order.service_description || order.job_description) && (
              <div style={{ marginTop: "14px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#475569", display: "block", marginBottom: "4px" }}>Deskripsi Layanan:</span>
                <p style={{ fontSize: "0.825rem", color: "#64748b", margin: 0, lineHeight: 1.45, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {(order.service_description || order.job_description || "").split(/\n+Keahlian \/ Skill:/i)[0].trim()}
                </p>
              </div>
            )}
          </div>

          {/* 🌟 4. EKSPEKTASI & PANDUAN LANGKAH SELANJUTNYA 🌟 */}
          {nextHint && (
            <div style={{ background: nextHint.tone === "warn" ? "#fffbe5" : "#f0f9ff", border: `1.5px solid ${nextHint.tone === "warn" ? "#fef08a" : "#bae6fd"}`, padding: "18px 20px", borderRadius: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={nextHint.tone === "warn" ? "#b45309" : "#0284c7"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <h4 style={{ margin: 0, fontSize: "0.95rem", color: nextHint.tone === "warn" ? "#b45309" : "#0369a1", fontWeight: 900 }}>
                  Apa Yang Harus Diharapkan (Langkah Selanjutnya)
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155", lineHeight: 1.55 }}>
                {nextHint.text}
              </p>
            </div>
          )}

          {/* 🌟 5. CATATAN & BRIEF PEMBELI 🌟 */}
          {order.notes && (
            <div style={{ background: "#ffffff", borderRadius: "18px", padding: "16px 20px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span style={{ fontSize: "0.775rem", fontWeight: 800, color: "#334155" }}>Catatan & Brief Pembeli:</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#0f172a", fontStyle: "italic", background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #f1f5f9", lineHeight: 1.5 }}>
                "{order.notes}"
              </p>
            </div>
          )}

          {/* Submissions & Files History (Only for past submissions if > 1) */}
          {d.submissions?.length > 1 && (
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>
                Riwayat Pengiriman Sebelumnya ({d.submissions.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {d.submissions.map((s) => (
                  <div key={s.id} style={{ padding: "14px", borderRadius: "12px", border: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0f172a" }}>Pengiriman ke-{s.revision_number}</span>
                      <span className="badge badge-ok" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>{submissionStatusLabel(s.status)}</span>
                    </div>
                    {s.note && <p style={{ fontSize: "0.825rem", color: "#334155", margin: "4px 0 10px", fontStyle: "italic" }}>"{s.note}"</p>}
                    {s.files?.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {s.files.map((f) => (
                          <a key={f.id} href={f.file_path} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary" style={{ borderRadius: "8px", textDecoration: "none", fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Unduh: {f.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Card: Review Form after Completion */}
          {order.status === "COMPLETED" && !hasReviewed && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmModal({
                  isOpen: true,
                  title: "Kirim Ulasan",
                  message: `Kirim ulasan ${rating} Bintang dan komentar Anda?`,
                  confirmText: "Kirim Ulasan",
                  confirmTone: "primary",
                  onConfirm: () => {
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                    act(() => api.submitReview(id, { rating, comment }), "Terima kasih! Ulasan kamu telah terkirim.");
                  },
                });
              }}
              style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "1.5px solid #bae6fd", boxShadow: "0 4px 20px rgba(15,23,42,0.03)" }}
            >
              <h3 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0f172a", margin: "0 0 4px" }}>
                {isBuyer ? "Berikan Ulasan & Rating Penjual" : "Berikan Ulasan & Rating Pembeli"}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0 0 14px" }}>
                Pengalaman Anda sangat berharga bagi komunitas freelancing TolongIn.
              </p>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontWeight: 800, fontSize: "0.8rem", color: "#334155", display: "block", marginBottom: "6px" }}>Pilih Rating:</label>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.8rem", color: star <= rating ? "#f59e0b" : "#cbd5e1" }}
                    >
                      ★
                    </button>
                  ))}
                  <span style={{ fontWeight: 800, color: "#d97706", fontSize: "0.85rem", marginLeft: "8px" }}>
                    {rating === 5 ? "Sangat Puas!" : rating === 4 ? "Bagus!" : rating === 3 ? "Cukup" : rating === 2 ? "Kurang" : "Kecewa"}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <textarea
                  required
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tulis ulasan jujur Anda mengenai hasil pekerjaan, kecepatan respon, dan kualitas..."
                  style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "0.825rem" }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: "8px 22px", borderRadius: "10px", fontWeight: 800 }}>
                Kirim Ulasan Sekarang
              </button>
            </form>
          )}

        </div>

        {/* 👉 RIGHT COLUMN: Financial Summary & Order Meta Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Financial Breakdown Card */}
          <div style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid rgba(226, 232, 240, 0.9)", boxShadow: "0 8px 26px rgba(15, 23, 42, 0.04)" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#0284c7", background: "rgba(2, 132, 199, 0.1)", padding: "3px 10px", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              RINCIAN KEUANGAN ESCROW
            </span>

            <h3 style={{ fontSize: "1.05rem", fontWeight: 900, color: "#0f172a", margin: "10px 0 14px", lineHeight: 1.3 }}>
              {order.service_title || order.job_title || order.title}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", color: "#64748b" }}>
                <span>Harga Jasa / Layanan</span>
                <strong style={{ color: "#0f172a" }}>{rupiah(order.amount)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.825rem", color: "#64748b" }}>
                <span>Biaya Platform (5%)</span>
                <strong style={{ color: "#0f172a" }}>{rupiah(order.platform_fee)}</strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0f172a" }}>Total Pembayaran:</span>
              <span style={{ fontSize: "1.3rem", fontWeight: 900, color: "#0284c7" }}>{rupiah(total)}</span>
            </div>

            {isSeller && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px", borderRadius: "10px", marginTop: "12px" }}>
                <span style={{ fontSize: "0.725rem", color: "#166534", fontWeight: 700, display: "block" }}>PENDAPATAN BERSIH PENJUAL</span>
                <strong style={{ fontSize: "1.05rem", color: "#15803d" }}>{rupiah(order.seller_net_amount || order.amount)}</strong>
              </div>
            )}
          </div>

          {/* Status & Parties Info Card */}
          <div style={{ background: "#ffffff", borderRadius: "20px", padding: "20px", border: "1px solid rgba(226, 232, 240, 0.9)", boxShadow: "0 8px 26px rgba(15, 23, 42, 0.04)" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 900, color: "#0f172a", margin: "0 0 12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Metadata & Pihak Transaksi
            </h4>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.825rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>Status Pesanan:</span>
                <span style={{ fontWeight: 800, color: "#0f172a", background: "#f1f5f9", padding: "3px 10px", borderRadius: "8px", fontSize: "0.75rem" }}>
                  {orderStatusLabel(order.status)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#64748b" }}>Status Escrow:</span>
                <span style={{ fontWeight: 800, color: order.escrow === "HELD" ? "#0284c7" : "#64748b", background: order.escrow === "HELD" ? "#e0f2fe" : "#f1f5f9", padding: "3px 10px", borderRadius: "8px", fontSize: "0.75rem" }}>
                  {escrowLabel(order.escrow)}
                </span>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "4px 0" }} />
              <Link to={`/profile/${order.buyer_id}`} className="od-party-row">
                {order.buyer_avatar ? <img src={resolveUploadUrl(order.buyer_avatar)} alt="" /> : <span>{(order.buyer_name?.[0] || "B").toUpperCase()}</span>}
                <div>
                  <small>Pembeli</small>
                  <strong>{order.buyer_name}</strong>
                </div>
              </Link>
              <Link to={`/profile/${order.seller_id}`} className="od-party-row">
                {order.seller_avatar ? <img src={resolveUploadUrl(order.seller_avatar)} alt="" /> : <span>{(order.seller_name?.[0] || "P").toUpperCase()}</span>}
                <div>
                  <small>{order.source === "JOB" ? "Pekerja terpilih" : "Penjual"}</small>
                  <strong>{order.seller_name}</strong>
                </div>
              </Link>
            </div>
          </div>

          {/* Collapsible Cancel Action Card for Buyer */}
          {canCancel && isBuyer && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "16px", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.825rem", fontWeight: 800, color: "#991b1b" }}>Batalkan Pesanan</span>
                <button type="button" onClick={() => setShowCancelBox(!showCancelBox)} style={{ background: "none", border: "none", color: "#b91c1c", fontWeight: 800, cursor: "pointer", fontSize: "0.8rem" }}>
                  {showCancelBox ? "Sembunyikan ↑" : "Tampilkan Opsi ↓"}
                </button>
              </div>

              {showCancelBox && (
                <div style={{ marginTop: "10px" }}>
                  <textarea
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Alasan pembatalan (opsional)..."
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #fca5a5", fontSize: "0.8rem", marginBottom: "8px" }}
                  />
                  <button
                    type="button"
                    className="btn btn-cta-danger"
                    style={{ padding: "6px 14px", fontSize: "0.775rem", borderRadius: "8px", fontWeight: 800 }}
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: "Konfirmasi Batal Pesanan",
                        message: "Apakah Anda yakin ingin membatalkan pesanan ini?",
                        confirmText: "Ya, Batalkan Pesanan",
                        confirmTone: "danger",
                        onConfirm: () => {
                          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                          act(() => api.orderCancel(id, cancelReason.trim()), "Pesanan dibatalkan");
                        },
                      });
                    }}
                  >
                    Konfirmasi Batal Pesanan
                  </button>
                </div>
              )}
            </div>
          )}

          {canDispute && (
            <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: "16px", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.825rem", fontWeight: 800, color: "#9a3412" }}>Ajukan Sengketa</span>
                <button type="button" onClick={() => setShowDisputeBox(!showDisputeBox)} style={{ background: "none", border: "none", color: "#c2410c", fontWeight: 800, cursor: "pointer", fontSize: "0.8rem" }}>
                  {showDisputeBox ? "Sembunyikan ↑" : "Tampilkan Opsi ↓"}
                </button>
              </div>
              {showDisputeBox && (
                <div style={{ marginTop: "10px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: "0.775rem", color: "#9a3412" }}>
                    Gunakan jika hasil kerja bermasalah dan batas revisi sudah habis / tidak bisa diselesaikan. Dana tetap ditahan sampai admin memutuskan.
                  </p>
                  <textarea
                    rows={3}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Jelaskan alasan sengketa (minimal 10 karakter)..."
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #fdba74", fontSize: "0.8rem", marginBottom: "8px" }}
                  />
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "6px 14px", fontSize: "0.775rem", borderRadius: "8px", fontWeight: 800, background: "#ea580c", color: "#fff", border: "none" }}
                    onClick={() => {
                      if (!disputeReason.trim() || disputeReason.trim().length < 10) {
                        setMsg("Alasan sengketa minimal 10 karakter");
                        return;
                      }
                      setConfirmModal({
                        isOpen: true,
                        title: "Ajukan Sengketa Pesanan",
                        message: "Pesanan akan dibekukan dan menunggu keputusan admin. Lanjutkan?",
                        confirmText: "Ya, Ajukan Sengketa",
                        confirmTone: "danger",
                        onConfirm: () => {
                          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                          act(() => api.orderDispute(id, disputeReason.trim()), "Sengketa diajukan — menunggu admin");
                        },
                      });
                    }}
                  >
                    Kirim Sengketa ke Admin
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmTone={confirmModal.confirmTone}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const [bgClass, setBgClass] = useState("app-jasa-bg");

  useEffect(() => {
    api.orderShow(id).then((d) => {
      if (d?.order?.source === "JOB") {
        setBgClass("app-kerja-bg");
      } else {
        setBgClass("app-jasa-bg");
      }
    }).catch(() => {});
  }, [id]);

  return (
    <Layout wide compact bgClass={bgClass}>
      <ProtectedRoute><OrderContent /></ProtectedRoute>
    </Layout>
  );
}
