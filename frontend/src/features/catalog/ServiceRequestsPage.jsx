import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { api } from "../../services/api.js";
import { rupiah, timeAgo, orderStatusLabel, escrowLabel } from "../../utils/format.js";

function badgeClass(status) {
  if (status === "PENDING") return "is-wait";
  if (status === "REJECTED" || status === "CANCELLED") return "is-bad";
  if (status === "COMPLETED" || status === "IN_PROGRESS" || status === "ACCEPTED") return "is-ok";
  return "is-muted";
}

export default function ServiceRequestsPage() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, process: 0, rejected: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [filterTab, setFilterTab] = useState("pending");
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setErr("");
    try {
      const reqRes = await api.getServiceRequests(id);
      setService(reqRes.service || null);
      const rows = reqRes.data || [];
      setRequests(rows);
      setCounts(reqRes.counts || {
        pending: rows.filter((r) => r.status === "PENDING").length,
        process: rows.filter((r) => ["ACCEPTED", "IN_PROGRESS", "DISPUTED", "COMPLETED"].includes(r.status)).length,
        rejected: rows.filter((r) => r.status === "REJECTED" || r.status === "CANCELLED").length,
        all: rows.length,
      });
    } catch (e) {
      setErr(e.message);
      setService(null);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function executeAccept() {
    if (!acceptingOrderId) return;
    setErr("");
    setMsg("");
    setProcessing(true);
    try {
      await api.orderAccept(acceptingOrderId);
      setMsg("Permintaan diterima. Pembeli akan diminta menyelesaikan pembayaran.");
      setAcceptingOrderId(null);
      await loadData();
    } catch (e) {
      setErr(e.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault();
    if (!rejectingOrderId) return;
    if (rejectReason.trim().length < 5) {
      setErr("Alasan penolakan minimal 5 karakter");
      return;
    }
    setErr("");
    setMsg("");
    setProcessing(true);
    try {
      await api.orderReject(rejectingOrderId, rejectReason.trim());
      setMsg("Permintaan ditolak. Pembeli sudah diberi tahu.");
      setRejectingOrderId(null);
      setRejectReason("");
      await loadData();
    } catch (e) {
      setErr(e.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <Layout wide compact bgClass="app-jasa-bg">
        <Loading />
      </Layout>
    );
  }

  if (!service) {
    return (
      <Layout wide compact bgClass="app-jasa-bg">
        <div className="sr-page">
          <Link to={`/jasa/${id}`} className="back-link-sm">← Kembali ke detail jasa</Link>
          <Alert type="danger">{err || "Jasa tidak ditemukan atau kamu bukan pemiliknya."}</Alert>
        </div>
      </Layout>
    );
  }

  const displayed =
    filterTab === "pending"
      ? requests.filter((r) => r.status === "PENDING")
      : filterTab === "process"
      ? requests.filter((r) => ["ACCEPTED", "IN_PROGRESS", "DISPUTED", "COMPLETED"].includes(r.status))
      : filterTab === "rejected"
      ? requests.filter((r) => r.status === "REJECTED" || r.status === "CANCELLED")
      : requests;

  const listingActive = !!service.is_active;

  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <div className="sr-page">
        <div className="sr-head">
          <Link to={`/jasa/${id}`} className="back-link-sm">← Kembali ke detail jasa</Link>
          <h1 className="catalog-display">
            <span className="catalog-display-kicker">Permintaan</span>
            <span className="catalog-display-word">Sewa</span>
          </h1>
          <p className="mockup-hero-sub">
            {service.title} · {rupiah(service.price)}
            {!listingActive ? " · Jasa non-aktif" : ""}
            {" · "}{counts.pending} menunggu dari {counts.all} total
          </p>
        </div>

        {err && <Alert type="danger">{err}</Alert>}
        {msg && <Alert type="success">{msg}</Alert>}

        <div className="sr-tabs">
          {[
            { id: "pending", label: `Menunggu (${counts.pending})` },
            { id: "process", label: `Diproses (${counts.process})` },
            { id: "rejected", label: `Ditolak (${counts.rejected})` },
            { id: "all", label: `Semua (${counts.all})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`sr-tab ${filterTab === tab.id ? "is-on" : ""}`}
              onClick={() => setFilterTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {displayed.length === 0 ? (
          <div className="sr-empty">
            {filterTab === "pending"
              ? "Belum ada permintaan yang menunggu tindakan."
              : "Tidak ada permintaan di tab ini."}
          </div>
        ) : (
          <div className="sr-list">
            {displayed.map((ord) => (
              <div key={ord.id} className="sr-card">
                <div className="sr-card-top">
                  <div className="sr-buyer">
                    {ord.buyer_avatar ? (
                      <img src={ord.buyer_avatar} alt="" />
                    ) : (
                      <span className="sr-buyer-ph">{(ord.buyer_name?.[0] || "B").toUpperCase()}</span>
                    )}
                    <div>
                      <strong>
                        {ord.buyer_id ? (
                          <Link to={`/profile/${ord.buyer_id}`}>{ord.buyer_name || "Pembeli"}</Link>
                        ) : (
                          ord.buyer_name || "Pembeli"
                        )}
                      </strong>
                      <span>{ord.order_number} · {timeAgo(ord.created_at)}</span>
                    </div>
                  </div>
                  <span className={`sr-badge ${badgeClass(ord.status)}`}>{orderStatusLabel(ord.status)}</span>
                </div>

                <div className="sr-meta">
                  <div>
                    <small>Nilai pesanan</small>
                    <strong>{rupiah(ord.amount)}</strong>
                  </div>
                  <div>
                    <small>Dana</small>
                    <strong>{escrowLabel(ord.escrow)}</strong>
                  </div>
                </div>

                {ord.buyer_note ? (
                  <div className="sr-note">Catatan pembeli: {ord.buyer_note}</div>
                ) : null}
                {ord.cancel_reason ? (
                  <div className="sr-reason">Alasan: {ord.cancel_reason}</div>
                ) : null}

                <div className="sr-actions">
                  {ord.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={processing || !listingActive}
                        title={!listingActive ? "Aktifkan jasa dulu sebelum menerima pesanan" : undefined}
                        onClick={() => setAcceptingOrderId(ord.id)}
                      >
                        Terima
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={processing}
                        onClick={() => {
                          setRejectingOrderId(ord.id);
                          setRejectReason("");
                          setErr("");
                        }}
                      >
                        Tolak
                      </button>
                    </>
                  )}
                  <Link to={`/orders/${ord.id}`} className="btn">Buka pesanan</Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {rejectingOrderId && (
          <div className="modal-backdrop sr-reject" onClick={() => !processing && setRejectingOrderId(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Tolak permintaan</h3>
              <p>Tulis alasan singkat. Pembeli akan melihat penjelasan ini.</p>
              <form onSubmit={handleRejectSubmit}>
                <textarea
                  rows={3}
                  className="form-input-compact"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Jadwal pengerjaan penuh minggu ini."
                  required
                />
                <div className="sr-actions" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-sm" disabled={processing} onClick={() => setRejectingOrderId(null)}>
                    Batal
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={processing || rejectReason.trim().length < 5}>
                    Kirim penolakan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(acceptingOrderId)}
          title="Terima permintaan sewa?"
          message="Pembeli akan diminta membayar ke rekening bersama (escrow) setelah kamu menerima."
          confirmText="Ya, terima"
          confirmTone="primary"
          onConfirm={executeAccept}
          onCancel={() => setAcceptingOrderId(null)}
          loading={processing}
        />
      </div>
    </Layout>
  );
}
