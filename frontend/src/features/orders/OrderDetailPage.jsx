import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import FlowSteps from "../../components/FlowSteps.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderStatusLabel, escrowLabel, submissionStatusLabel, orderTotal } from "../../utils/format.js";
import { getOrderFlowSteps, getOrderNextHint } from "../../utils/orderGuide.js";

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
  const [files, setFiles] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function load() {
    setD(await api.orderShow(id));
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!searchParams.get("ok") || !d) return;
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
  }

  if (!d) return <Loading />;

  const { order, isBuyer, isSeller, canPay, canCancel, canSubmitWork, hasReviewed, pendingSubmission, payout } = d;
  const total = orderTotal(order);
  const flowSteps = getOrderFlowSteps(order);
  const nextHint = getOrderNextHint(order, { isBuyer, isSeller, canPay, canSubmitWork, pendingSubmission });

  return (
    <PagePanel
      title={`Pesanan ${order.order_number}`}
      subtitle={order.source === "JOB" ? "Dari lowongan kerja" : "Sewa jasa"}
      backTo="/dashboard"
      backLabel="← Beranda Saya"
      compact
    >

      {order.status !== "REJECTED" && order.status !== "CANCELLED" && (
        <FlowSteps steps={flowSteps} />
      )}

      {nextHint && (
        <HelpBox title="Langkah selanjutnya" tone={nextHint.tone}>
          <p>{nextHint.text}</p>
        </HelpBox>
      )}

      <Alert type={msg.includes("berhasil") || msg.includes("terkirim") || msg.includes("dikonfirmasi") || msg.includes("disetujui") || msg.includes("diterima") ? "success" : "error"}>{msg}</Alert>

      <div className="detail-grid">
        <div><span className="muted">Judul</span><p>{order.title}</p></div>
        <div><span className="muted">Harga jasa</span><p>{rupiah(order.amount)}</p></div>
        <div><span className="muted">Biaya layanan (5%)</span><p>{rupiah(order.platform_fee)}</p></div>
        <div><span className="muted">Total bayar</span><p><strong>{rupiah(total)}</strong></p></div>
        <div><span className="muted">Status pesanan</span><p><span className="pill">{orderStatusLabel(order.status)}</span></p></div>
        <div><span className="muted">Status pembayaran</span><p><span className="pill">{escrowLabel(order.escrow)}</span></p></div>
        <div><span className="muted">Pembeli</span><p>{order.buyer_name}</p></div>
        <div><span className="muted">Penjual / Pekerja</span><p>{order.seller_name}</p></div>
        {isSeller && (
          <div><span className="muted">Pendapatan kamu</span><p><strong>{rupiah(order.seller_net_amount || order.amount)}</strong></p></div>
        )}
      </div>

      {isSeller && payout && (
        <div className="payout-receipt">
          <h3>Dana sudah masuk ke saldo kamu</h3>
          <p><strong>{rupiah(payout.amount)}</strong> ditransfer ke rekening {payout.bank_account_masked || "terdaftar"}</p>
          <p className="hint">Tanggal: {new Date(payout.paid_at).toLocaleString("id-ID")}</p>
          <Link to="/dashboard#pendapatan" className="btn btn-sm">Lihat saldo & riwayat →</Link>
        </div>
      )}

      {isSeller && order.escrow === "HELD" && !payout && (
        <HelpBox title="Dana sedang ditahan" tone="info">
          <p>
            Pembeli sudah bayar <strong>{rupiah(order.seller_net_amount || order.amount)}</strong>.
            Uang aman ditahan sistem dan akan masuk ke saldo kamu setelah pembeli menyetujui bukti pekerjaan.
          </p>
        </HelpBox>
      )}

      {order.buyer_note && (
        <p className="hint" style={{ marginTop: 12 }}><strong>Catatan pembeli:</strong> {order.buyer_note}</p>
      )}

      {order.status === "PENDING" && isSeller && (
        <div className="section">
          <h3>Konfirmasi pesanan</h3>
          <p className="hint">Terima jika kamu siap mengerjakan. Tolak hanya jika benar-benar tidak bisa — wajib isi alasan.</p>
          <label>Alasan penolakan (wajib jika menolak, min. 5 karakter)
            <textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Contoh: Jadwal penuh minggu ini" />
          </label>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => act(() => api.orderAccept(id), "Pesanan diterima. Pembeli akan diminta bayar.")}>Terima Pesanan</button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (rejectReason.trim().length < 5) {
                  setMsg("Alasan penolakan minimal 5 karakter");
                  return;
                }
                act(() => api.orderReject(id, rejectReason.trim()), "Pesanan ditolak");
              }}
            >
              Tolak Pesanan
            </button>
          </div>
        </div>
      )}

      {canCancel && isBuyer && (
        <div className="section">
          <h3>Batalkan pesanan</h3>
          <p className="hint">Kamu masih bisa batalkan selama belum dibayar atau masih menunggu konfirmasi penjual.</p>
          <label>Alasan (opsional)
            <textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => act(() => api.orderCancel(id, cancelReason.trim()), "Pesanan dibatalkan")}
          >
            Batalkan Pesanan
          </button>
        </div>
      )}

      {canPay && (
        <Link to={`/orders/${id}/bayar`} className="btn btn-primary">Bayar Sekarang — {rupiah(total)}</Link>
      )}

      {canSubmitWork && (
        <form onSubmit={submitWork} className="form section">
          <h3>Kirim bukti pekerjaan</h3>
          <p className="hint">Unggah foto atau file hasil kerja. Pembeli akan meninjau sebelum uang cair ke kamu.</p>
          <label>Catatan<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jelaskan apa yang sudah dikerjakan..." /></label>
          <label>File bukti<input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></label>
          <button type="submit" className="btn btn-primary">Kirim Bukti</button>
        </form>
      )}

      {isBuyer && order.status === "IN_PROGRESS" && pendingSubmission && (
        <div className="section">
          <h3>Tinjau hasil pekerjaan</h3>
          <p>{pendingSubmission.note}</p>
          <p className="hint">
            <strong>Setujui</strong> = pekerjaan selesai, uang cair ke penjual.
            {" "}<strong>Minta revisi</strong> = penjual harus perbaiki dan kirim ulang.
          </p>
          <label>Catatan untuk penjual<textarea rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} /></label>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => act(() => api.approveWork(id, reviewNote), "Pekerjaan disetujui — pesanan selesai")}>Setujui Pekerjaan</button>
            <button type="button" className="btn" onClick={() => act(() => api.requestRevision(id, reviewNote), "Permintaan revisi terkirim")}>Minta Revisi</button>
          </div>
        </div>
      )}

      {order.status === "COMPLETED" && !hasReviewed && (
        <form className="form section" onSubmit={(e) => { e.preventDefault(); act(() => api.submitReview(id, { rating, comment }), "Terima kasih! Ulasan kamu sudah terkirim."); }}>
          <h3>Beri ulasan</h3>
          <label>Rating (1–5 bintang)<input type="number" min="1" max="5" value={rating} onChange={(e) => setRating(e.target.value)} /></label>
          <label>Komentar<textarea required rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ceritakan pengalaman kamu..." /></label>
          <button type="submit" className="btn btn-primary">Kirim Ulasan</button>
        </form>
      )}

      {d.submissions?.length > 0 && (
        <section className="section">
          <h3>Riwayat bukti pekerjaan</h3>
          {d.submissions.map((s) => (
            <div key={s.id} className="sub-item">
              <p>Pengiriman ke-{s.revision_number} — {submissionStatusLabel(s.status)}</p>
              <p>{s.note}</p>
              {s.files?.map((f) => (
                <a key={f.id} href={f.file_path} target="_blank" rel="noreferrer">{f.file_name}</a>
              ))}
            </div>
          ))}
        </section>
      )}

    </PagePanel>
  );
}

export default function OrderDetailPage() {
  return (
    <Layout wide compact>
      <ProtectedRoute><OrderContent /></ProtectedRoute>
    </Layout>
  );
}
