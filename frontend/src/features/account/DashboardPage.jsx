import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import Alert from "../../components/Alert.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ChatIcon } from "../../components/BellIcon.jsx";

import { api } from "../../services/api.js";
import {
  rupiah,
  orderStatusLabel,
  applicationStatusLabel,
  jobStatusLabel,
  orderTotal,
  isJobUrgent,
} from "../../utils/format.js";
import { isBankVerified } from "../../utils/verification.js";
import ConfirmModal from "../../components/ConfirmModal.jsx";

const TAB_HASH = {
  "my-services": "jasa",
  "my-jobs": "lowongan",
  "buyer-orders": "pesanan",
  "seller-orders": "penjual",
  "my-applications": "lamaran",
  payouts: "dompet",
};

const HASH_TAB = {
  jasa: "my-services",
  services: "my-services",
  lowongan: "my-jobs",
  jobs: "my-jobs",
  pesanan: "buyer-orders",
  penjual: "seller-orders",
  lamaran: "my-applications",
  applications: "my-applications",
  dompet: "payouts",
  pendapatan: "payouts",
};

function tabFromLocation(location) {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("tab") || location.state?.tab;
  if (fromQuery && (TAB_HASH[fromQuery] || HASH_TAB[fromQuery])) {
    return TAB_HASH[fromQuery] ? fromQuery : HASH_TAB[fromQuery];
  }
  const hash = (location.hash || "").replace("#", "");
  return HASH_TAB[hash] || "my-services";
}

function formatPayoutDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status) {
  if (status === "COMPLETED" || status === "APPROVED" || status === "OPEN") return "ok";
  if (status === "PENDING" || status === "IN_PROGRESS" || status === "FILLED" || status === "ACCEPTED") return "warn";
  if (status === "DISPUTED" || status === "REJECTED" || status === "CANCELLED" || status === "CLOSED") return "danger";
  return "muted";
}

function SourceChip({ source }) {
  const isJob = source === "JOB";
  return <span className={`dash-source ${isJob ? "is-job" : "is-jasa"}`}>{isJob ? "Kerja" : "Jasa"}</span>;
}

function OrderTable({ rows, columns }) {
  if (!rows?.length) return null;
  return (
    <div className="table-responsive-wrap">
      <table className="dash-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <div className="dash-panel">
      <div className="dash-panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <span className="dash-listing-stat">
      <em>{value}</em>
      {label}
    </span>
  );
}

function coverOf(service) {
  const raw = service.cover_image_url || "";
  if (!raw) return null;
  return raw.includes("||") ? raw.split("||").filter(Boolean)[0] : raw;
}

function DashboardContent() {
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState(location.state?.msg || "");
  const [msgTone, setMsgTone] = useState("success");
  const [activeTab, setActiveTab] = useState(() => tabFromLocation(location));
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.dashboard()
      .then((data) => { if (alive) setD(data); })
      .catch((e) => { if (alive) setErr(e.message || "Gagal memuat data dashboard"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setActiveTab(tabFromLocation(location));
  }, [location.hash, location.search, location.state]);

  function selectTab(id) {
    setActiveTab(id);
    nav(`/dashboard#${TAB_HASH[id] || "jasa"}`, { replace: true });
  }

  async function reload() {
    const data = await api.dashboard();
    setD(data);
  }

  const bankOk = isBankVerified(user);
  const earnings = d?.earnings || {};
  const services = d?.myServices || [];
  const jobs = d?.myJobs || [];
  const buyerOrders = d?.ordersAsBuyer || [];
  const sellerOrders = d?.ordersAsSeller || [];
  const applicationsSent = d?.applicationsSent || [];
  const withdrawals = d?.withdrawals || [];
  const recentPayouts = d?.recentPayouts || [];

  const counts = useMemo(() => {
    const pendingIncoming = (d?.applicationsIncoming || []).filter((a) => a.status === "PENDING").length;
    const openJobs = jobs.filter((j) => j.status === "OPEN").length;
    const activeBuyer = buyerOrders.filter((o) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(o.status)).length;
    const activeSeller = sellerOrders.filter((o) => ["ACCEPTED", "IN_PROGRESS", "DISPUTED"].includes(o.status)).length;
    const pendingRequests = services.reduce((n, s) => n + Number(s.pending_requests_count || 0), 0);
    return { pendingIncoming, openJobs, activeBuyer, activeSeller, pendingRequests };
  }, [d, jobs, buyerOrders, sellerOrders, services]);

  const wallet = Number(earnings.availableBalance ?? user?.wallet_balance ?? 0);
  const firstName = user?.first_name || user?.displayName || "kamu";

  async function runConfirm() {
    if (!confirm) return;
    setBusyId(confirm.id);
    setErr("");
    try {
      if (confirm.kind === "jasa-toggle") {
        const res = await api.toggleJasaActive(confirm.id);
        setMsg(res.status === "INACTIVE" ? "Jasa disembunyikan dari katalog." : "Jasa kembali aktif di katalog.");
      } else if (confirm.kind === "jasa-delete") {
        await api.jasaDelete(confirm.id);
        setMsg("Jasa dihapus dari katalog.");
      } else if (confirm.kind === "job-toggle") {
        const res = await api.toggleLowonganActive(confirm.id);
        setMsg(res.is_active
          ? "Lowongan tampil lagi di Cari Kerja."
          : "Lowongan disembunyikan dari Cari Kerja.");
      } else if (confirm.kind === "job-delete") {
        await api.lowonganDelete(confirm.id);
        setMsg("Lowongan dihapus.");
      } else if (confirm.kind === "job-close") {
        const res = await api.lowonganClose(confirm.id);
        setMsg(`Lowongan ditutup. ${res.rejected || 0} lamaran ditolak.`);
      }
      setMsgTone("success");
      setConfirm(null);
      await reload();
    } catch (e) {
      setMsgTone("error");
      setMsg(e.message || "Gagal memproses");
    } finally {
      setBusyId(null);
    }
  }

  async function submitWithdraw(e) {
    e.preventDefault();
    const amt = Number(withdrawAmt);
    if (!amt || amt < 10000) {
      setMsgTone("error");
      setMsg("Nominal minimal penarikan adalah Rp 10.000");
      return;
    }
    if (amt > wallet) {
      setMsgTone("error");
      setMsg("Nominal melebihi saldo siap ditarik");
      return;
    }
    setWithdrawBusy(true);
    try {
      await api.requestWithdrawal(amt);
      setWithdrawOpen(false);
      setWithdrawAmt("");
      setMsgTone("success");
      setMsg("Pengajuan penarikan dikirim. Admin akan memproses ke rekening kamu.");
      await reload();
    } catch (error) {
      setMsgTone("error");
      setMsg(error.message || "Gagal mengajukan penarikan");
    } finally {
      setWithdrawBusy(false);
    }
  }

  if (err && !d) {
    return (
      <div className="dash-error">
        <Alert>{err}</Alert>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Coba lagi
        </button>
      </div>
    );
  }

  if (!d) return <Loading />;

  const tabs = [
    { id: "my-services", label: "Jasa", count: services.length },
    { id: "my-jobs", label: "Lowongan", count: jobs.length, alert: counts.pendingIncoming },
    { id: "buyer-orders", label: "Pembelian", count: buyerOrders.length },
    { id: "seller-orders", label: "Penjualan", count: sellerOrders.length },
    { id: "my-applications", label: "Lamaran", count: applicationsSent.length },
    { id: "payouts", label: "Dompet" },
  ];

  return (
    <div className="dash-page">
      {msg ? <Alert type={msgTone === "error" ? undefined : "success"}>{msg}</Alert> : null}

      <header className="dash-head">
        <div className="catalog-hero-copy">
          <h1 className="catalog-display dash-display">
            <span className="catalog-display-kicker">Halo,</span>
            <span className="catalog-display-word">{firstName}</span>
          </h1>
          <p className="mockup-hero-sub dash-lead">
            {counts.pendingIncoming || counts.pendingRequests
              ? `${counts.pendingIncoming ? `${counts.pendingIncoming} lamaran` : ""}${counts.pendingIncoming && counts.pendingRequests ? " · " : ""}${counts.pendingRequests ? `${counts.pendingRequests} permintaan jasa` : ""} menunggu.`
              : "Kelola jasa, lowongan, pesanan, dan dana di satu tempat."}
          </p>
        </div>
      </header>

      <section className="dash-finance">
        <button type="button" className="dash-fin-card is-wallet" onClick={() => selectTab("payouts")}>
          <span>Saldo</span>
          <strong>{rupiah(wallet)}</strong>
          <small>
            {Number(earnings.pendingWithdrawalTotal || 0) > 0
              ? `${rupiah(earnings.pendingWithdrawalTotal)} diproses`
              : "Siap ditarik"}
          </small>
        </button>
        <button type="button" className="dash-fin-card is-earn" onClick={() => selectTab("payouts")}>
          <span>Pendapatan</span>
          <strong>{rupiah(earnings.totalReceived || 0)}</strong>
          <small>{earnings.payoutCount || 0} pencairan selesai</small>
        </button>
        <button type="button" className="dash-fin-card is-escrow" onClick={() => selectTab("seller-orders")}>
          <span>Escrow</span>
          <strong>{rupiah(earnings.pendingHeld || 0)}</strong>
          <small>{earnings.pendingHeldCount || 0} ditahan · {counts.activeSeller} jalan</small>
        </button>
        <button type="button" className="dash-fin-card is-spend" onClick={() => selectTab("buyer-orders")}>
          <span>Pengeluaran</span>
          <strong>{rupiah(earnings.totalSpent || 0)}</strong>
          <small>{counts.activeBuyer} pembelian aktif</small>
        </button>
      </section>

      <section className="dash-workspace">
        <div className="dash-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`dash-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
              {tab.count != null ? <em>{tab.count}</em> : null}
              {tab.alert ? <i className="dash-tab-dot" /> : null}
            </button>
          ))}
        </div>

        {activeTab === "my-services" && (
          <Panel
            title="Jasa yang kamu tawarkan"
            action={<Link to="/jasa/baru" className="btn btn-sm btn-primary">Post jasa</Link>}
          >
            {services.length === 0 ? (
              <EmptyState
                title="Belum ada jasa"
                hint="Tawarkan keahlianmu untuk mulai menerima permintaan sewa."
                action={<Link to="/jasa/baru" className="btn btn-primary">Post Jasa</Link>}
              />
            ) : (
              <div className="dash-listing-list">
                {services.map((s) => {
                  const cover = coverOf(s);
                  const pending = Number(s.pending_requests_count || 0);
                  const chats = Number(s.chat_peers_count || 0);
                  const active = Number(s.active_orders_count || 0);
                  const done = Number(s.completed_count || 0);
                  return (
                    <article key={s.id} className={`dash-listing is-jasa ${s.is_active ? "" : "is-off"}`}>
                      {cover ? <img src={cover} alt="" className="dash-listing-cover" /> : <div className="dash-listing-cover ph">Jasa</div>}
                      <div className="dash-listing-body">
                        <div className="dash-listing-top">
                          <div>
                            <Link to={`/jasa/${s.id}`} className="dash-title-link">{s.title}</Link>
                            <p className="dash-listing-sub">{s.category_name || "Umum"} · {rupiah(s.price)}</p>
                          </div>
                          <span className={`dash-pill ${s.is_active ? "ok" : "muted"}`}>{s.is_active ? "Aktif di katalog" : "Nonaktif"}</span>
                        </div>
                        <div className="dash-listing-stats">
                          <Stat value={pending} label="permintaan" />
                          <Stat value={chats} label="percakapan" />
                          <Stat value={active} label="berjalan" />
                          <Stat value={done} label="selesai" />
                        </div>
                        <div className="dash-row-actions">
                          <Link to={`/jasa/${s.id}/requests`} className="btn btn-sm btn-primary">
                            Permintaan{pending ? ` (${pending})` : ""}
                          </Link>
                          {chats > 0 && (
                            <Link to={`/chat?kind=jasa&id=${s.id}`} className="btn btn-sm btn-chat">
                              <ChatIcon size={14} /> Chat
                            </Link>
                          )}
                          <Link to={`/jasa/${s.id}`} className="btn btn-sm">Lihat</Link>
                          {s.can_edit ? (
                            <Link to={`/jasa/${s.id}/edit`} className="btn btn-sm">Edit</Link>
                          ) : null}
                          {s.can_toggle ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyId === s.id}
                              onClick={() => setConfirm({
                                kind: "jasa-toggle",
                                id: s.id,
                                title: s.is_active ? "Sembunyikan jasa?" : "Aktifkan jasa?",
                                message: s.is_active
                                  ? `"${s.title}" tidak akan tampil di Cari Jasa. Hanya bisa jika tidak ada sewa berjalan.`
                                  : `"${s.title}" akan tampil lagi di katalog.`,
                                confirmText: s.is_active ? "Ya, sembunyikan" : "Ya, aktifkan",
                                tone: s.is_active ? "danger" : "success",
                              })}
                            >
                              {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          ) : null}
                          {s.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyId === s.id}
                              onClick={() => setConfirm({
                                kind: "jasa-delete",
                                id: s.id,
                                title: "Hapus jasa?",
                                message: `"${s.title}" dihapus. Tidak bisa jika masih ada permintaan atau pesanan berjalan.`,
                                confirmText: "Ya, hapus",
                                tone: "danger",
                              })}
                            >
                              Hapus
                            </button>
                          ) : null}
                          {!s.can_toggle ? (
                            <span className="dash-lock">{s.lock_reason || "Terkunci — selesaikan sewa dulu"}</span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {activeTab === "my-jobs" && (
          <Panel
            title="Lowongan yang kamu post"
            action={<Link to="/lowongan/baru" className="btn btn-sm btn-primary-kerja">Post lowongan</Link>}
          >
            {counts.pendingIncoming > 0 ? (
              <p className="dash-inline-note">{counts.pendingIncoming} lamaran menunggu tinjauan.</p>
            ) : null}
            {jobs.length === 0 ? (
              <EmptyState
                title="Belum ada lowongan"
                hint="Buat lowongan untuk mencari pekerja yang sesuai."
                action={<Link to="/lowongan/baru" className="btn btn-primary-kerja">Post Lowongan</Link>}
              />
            ) : (
              <div className="dash-listing-list">
                {jobs.map((j) => {
                  const pending = Number(j.pending_applications || 0);
                  const applicants = Number(j.applicant_count || 0);
                  const chats = Number(j.chat_peers_count || 0);
                  const active = Number(j.active_orders || 0);
                  const listed = j.status === "OPEN" && Number(j.is_active) !== 0;
                  const paused = !listed;
                  return (
                    <article key={j.id} className={`dash-listing is-job ${paused ? "is-off" : ""}`}>
                      <div className="dash-listing-body">
                        <div className="dash-listing-top">
                          <div>
                            <Link to={`/lowongan/${j.id}`} className="dash-title-link">{j.title}</Link>
                            <p className="dash-listing-sub">
                              {j.category_name || "Umum"} · {rupiah(j.budget)}
                              {isJobUrgent(j) ? " · Urgent hari ini" : ""}
                            </p>
                          </div>
                          <span className={`dash-pill ${listed ? "ok" : statusTone(j.status)}`}>
                            {listed ? "Aktif di katalog" : Number(j.is_active) === 0 && j.status === "OPEN" ? "Nonaktif" : jobStatusLabel(j.status)}
                          </span>
                        </div>
                        <div className="dash-listing-stats">
                          <Stat value={pending} label="menunggu" />
                          <Stat value={applicants} label="pelamar" />
                          <Stat value={chats} label="percakapan" />
                          <Stat value={active} label="proyek" />
                        </div>
                        <div className="dash-row-actions">
                          <Link to={`/lowongan/${j.id}/lamaran`} className="btn btn-sm btn-primary-kerja">
                            Pelamar{pending ? ` (${pending})` : ""}
                          </Link>
                          {chats > 0 && (
                            <Link to={`/chat?kind=lowongan&id=${j.id}`} className="btn btn-sm btn-chat">
                              <ChatIcon size={14} /> Chat
                            </Link>
                          )}
                          <Link to={`/lowongan/${j.id}`} className="btn btn-sm">Lihat</Link>
                          {j.can_edit ? (
                            <Link to={`/lowongan/${j.id}/edit`} className="btn btn-sm">Edit</Link>
                          ) : null}
                          {j.status === "FILLED" && (
                            <Link to="/lowongan/baru" state={{ repostJob: j }} className="btn btn-sm btn-primary-kerja">Post serupa</Link>
                          )}
                          {j.can_toggle ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyId === j.id}
                              onClick={() => setConfirm({
                                kind: "job-toggle",
                                id: j.id,
                                title: listed ? "Sembunyikan lowongan?" : "Aktifkan lowongan?",
                                message: listed
                                  ? `"${j.title}" disembunyikan dari Cari Kerja. Hanya bisa jika belum ada pelamar menunggu.`
                                  : `"${j.title}" akan tampil lagi di Cari Kerja.`,
                                confirmText: listed ? "Ya, sembunyikan" : "Ya, aktifkan",
                                tone: listed ? "danger" : "success",
                              })}
                            >
                              {listed ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          ) : null}
                          {j.can_close ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyId === j.id}
                              onClick={() => setConfirm({
                                kind: "job-close",
                                id: j.id,
                                title: "Tutup lowongan?",
                                message: `Semua lamaran menunggu untuk "${j.title}" akan ditolak. Tidak bisa jika sudah ada pelamar diterima.`,
                                confirmText: "Ya, tutup & tolak",
                                tone: "danger",
                              })}
                            >
                              Tutup
                            </button>
                          ) : null}
                          {j.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busyId === j.id}
                              onClick={() => setConfirm({
                                kind: "job-delete",
                                id: j.id,
                                title: "Hapus lowongan?",
                                message: `"${j.title}" dihapus. Hanya jika belum ada pelamar.`,
                                confirmText: "Ya, hapus",
                                tone: "danger",
                              })}
                            >
                              Hapus
                            </button>
                          ) : null}
                          {(!j.can_toggle || !j.can_delete) && j.lock_reason ? (
                            <span className="dash-lock">{j.lock_reason}</span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {activeTab === "buyer-orders" && (
          <Panel title="Pembelian">
            {buyerOrders.length === 0 ? (
              <EmptyState
                title="Belum ada pembelian"
                hint="Sewa jasa atau rekrut pekerja untuk memulai proyek."
                action={
                  <div className="dash-row-actions is-center">
                    <Link to="/jasa" className="btn btn-primary">Cari Jasa</Link>
                    <Link to="/lowongan" className="btn btn-primary-kerja">Cari Kerja</Link>
                  </div>
                }
              />
            ) : (
              <OrderTable
                rows={buyerOrders}
                columns={[
                  { key: "order_number", label: "Order", render: (o) => <strong>{o.order_number}</strong> },
                  { key: "title", label: "Judul", render: (o) => (
                    <div className="dash-cell-stack">
                      <span>{o.title}</span>
                      <SourceChip source={o.source} />
                    </div>
                  ) },
                  { key: "amount", label: "Total", render: (o) => <strong className="price-text">{rupiah(orderTotal(o))}</strong> },
                  { key: "status", label: "Status", render: (o) => (
                    <span className={`dash-pill ${statusTone(o.status)}`}>{orderStatusLabel(o.status)}</span>
                  ) },
                  { key: "link", label: "", render: (o) => (
                    <div className="dash-row-actions">
                      <Link to={`/orders/${o.id}`} className="btn btn-sm btn-primary">Detail</Link>
                      <Link
                        to={o.source === "JOB" ? `/lowongan/${o.job_id}/chat` : `/jasa/${o.service_id}/chat`}
                        className="btn btn-sm btn-chat"
                      >
                        <ChatIcon size={14} /> Chat
                      </Link>
                    </div>
                  ) },
                ]}
              />
            )}
          </Panel>
        )}

        {activeTab === "seller-orders" && (
          <Panel title="Penjualan">
            {sellerOrders.length === 0 ? (
              <EmptyState
                title="Belum ada pesanan masuk"
                hint="Post jasa agar pembeli bisa mengirim permintaan sewa."
                action={<Link to="/jasa/baru" className="btn btn-primary">Post Jasa</Link>}
              />
            ) : (
              <OrderTable
                rows={sellerOrders}
                columns={[
                  { key: "order_number", label: "Order", render: (o) => <strong>{o.order_number}</strong> },
                  { key: "title", label: "Judul", render: (o) => (
                    <div className="dash-cell-stack">
                      <span>{o.title}</span>
                      <SourceChip source={o.source} />
                    </div>
                  ) },
                  { key: "buyer_name", label: "Pembeli", render: (o) => o.buyer_id
                    ? <Link to={`/profile/${o.buyer_id}`} className="dash-title-link">{o.buyer_name}</Link>
                    : o.buyer_name },
                  { key: "amount", label: "Net", render: (o) => <strong className="price-text">{rupiah(o.seller_net_amount || o.amount)}</strong> },
                  { key: "status", label: "Status", render: (o) => (
                    <span className={`dash-pill ${statusTone(o.status)}`}>{orderStatusLabel(o.status)}</span>
                  ) },
                  { key: "link", label: "", render: (o) => (
                    <div className="dash-row-actions">
                      {o.source === "SERVICE" && o.status === "PENDING"
                        ? <Link to={`/jasa/${o.service_id}/requests`} className="btn btn-sm btn-primary">Permintaan</Link>
                        : <Link to={`/orders/${o.id}`} className="btn btn-sm btn-primary">Kelola</Link>}
                      <Link
                        to={o.source === "JOB"
                          ? `/lowongan/${o.job_id}/chat${o.seller_id ? `?with=${o.seller_id}` : ""}`
                          : `/jasa/${o.service_id}/chat${o.buyer_id ? `?with=${o.buyer_id}` : ""}`}
                        className="btn btn-sm btn-chat"
                      >
                        <ChatIcon size={14} /> Chat
                      </Link>
                    </div>
                  ) },
                ]}
              />
            )}
          </Panel>
        )}

        {activeTab === "my-applications" && (
          <Panel title="Lamaran kamu">
            {applicationsSent.length === 0 ? (
              <EmptyState
                title="Belum ada lamaran"
                hint="Cari lowongan yang cocok, lalu kirim penawaran."
                action={<Link to="/lowongan" className="btn btn-primary-kerja">Cari Kerja</Link>}
              />
            ) : (
              <OrderTable
                rows={applicationsSent}
                columns={[
                  { key: "job_title", label: "Lowongan", render: (a) => <Link to={`/lowongan/${a.job_id}`} className="dash-title-link">{a.job_title}</Link> },
                  { key: "proposed_price", label: "Penawaran", render: (a) => <strong className="price-text is-kerja">{rupiah(a.proposed_price)}</strong> },
                  { key: "estimated_days", label: "Estimasi", render: (a) => `${a.estimated_days || "—"} hari` },
                  { key: "status", label: "Status", render: (a) => (
                    <span className={`dash-pill ${statusTone(a.status)}`}>{applicationStatusLabel(a.status, a.reject_kind)}</span>
                  ) },
                  { key: "link", label: "", render: (a) => (
                    <div className="dash-row-actions">
                      {a.order_id
                        ? <Link to={`/orders/${a.order_id}`} className="btn btn-sm btn-primary-kerja">Ruang kerja</Link>
                        : <Link to={`/lowongan/${a.job_id}`} className="btn btn-sm">Lihat</Link>}
                      <Link to={`/lowongan/${a.job_id}/chat`} className="btn btn-sm btn-chat">
                        <ChatIcon size={14} /> Chat
                      </Link>
                    </div>
                  ) },
                ]}
              />
            )}
          </Panel>
        )}

        {activeTab === "payouts" && (
          <Panel title="Dompet & pencairan">
            <div className="dash-wallet-box">
              <div>
                <span>Saldo siap ditarik</span>
                <strong>{rupiah(wallet)}</strong>
                <small>
                  Dari pencairan penjual {rupiah(earnings.fromSellerPayouts || 0)}
                  {Number(earnings.fromBuyerRefunds || 0) > 0 ? ` + refund ${rupiah(earnings.fromBuyerRefunds)}` : ""}
                  . Bukan angka lifetime.
                </small>
                {!bankOk ? (
                  <small className="is-warn">Rekening harus diverifikasi sebelum penarikan. <Link to="/verify/bank">Verifikasi bank</Link></small>
                ) : null}
              </div>
              {bankOk ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setWithdrawAmt(String(Math.max(wallet, 0) || 10000));
                    setWithdrawOpen(true);
                  }}
                  disabled={wallet < 10000}
                >
                  Tarik saldo
                </button>
              ) : (
                <Link to="/verify/bank" className="btn btn-primary">Verifikasi bank</Link>
              )}
            </div>

            <h3 className="dash-subhead">Penarikan</h3>
            {withdrawals.length === 0 ? (
              <p className="dash-muted">Belum ada pengajuan penarikan.</p>
            ) : (
              <OrderTable
                rows={withdrawals}
                columns={[
                  { key: "created_at", label: "Diajukan", render: (w) => formatPayoutDate(w.created_at) },
                  { key: "amount", label: "Jumlah", render: (w) => <strong className="price-text">{rupiah(w.amount)}</strong> },
                  { key: "status", label: "Status", render: (w) => (
                    <span className={`dash-pill ${statusTone(w.status)}`}>
                      {w.status === "PENDING" ? "Menunggu admin" : w.status === "APPROVED" ? "Ditransfer" : "Ditolak"}
                    </span>
                  ) },
                  { key: "bank", label: "Rekening", render: (w) => `${w.bank_name || "—"} ****${String(w.bank_account_number || "").slice(-4)}` },
                  { key: "note", label: "Catatan", render: (w) => w.note || "—" },
                ]}
              />
            )}

            <h3 className="dash-subhead">Pencairan pesanan selesai</h3>
            {recentPayouts.length === 0 ? (
              <p className="dash-muted">Pendapatan masuk ke saldo setelah pesanan selesai disetujui pembeli.</p>
            ) : (
              <OrderTable
                rows={recentPayouts}
                columns={[
                  { key: "paid_at", label: "Waktu", render: (p) => formatPayoutDate(p.paid_at) },
                  { key: "title", label: "Pesanan", render: (p) => (
                    <div className="dash-cell-stack">
                      <Link to={`/orders/${p.order_id}`} className="dash-title-link">{p.title}</Link>
                      <SourceChip source={p.source} />
                    </div>
                  ) },
                  { key: "amount", label: "Masuk", render: (p) => <strong className="price-text">{rupiah(p.amount)}</strong> },
                  { key: "bank", label: "Rekening", render: (p) => p.bank_account_masked || "—" },
                ]}
              />
            )}
          </Panel>
        )}
      </section>

      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.title || "Konfirmasi"}
        message={confirm?.message || ""}
        confirmText={confirm?.confirmText || "Lanjutkan"}
        confirmTone={confirm?.tone || "primary"}
        loading={!!busyId}
        onConfirm={runConfirm}
        onCancel={() => !busyId && setConfirm(null)}
      />

      {withdrawOpen ? (
        <div className="dash-modal-backdrop" onClick={() => !withdrawBusy && setWithdrawOpen(false)}>
          <form className="dash-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitWithdraw}>
            <h3>Tarik saldo</h3>
            <p>Dana dikirim ke rekening yang sudah diverifikasi. Minimal Rp 10.000.</p>
            <label>
              Nominal
              <input
                type="number"
                min="10000"
                max={wallet}
                step="1000"
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                required
              />
            </label>
            <p className="dash-muted">Saldo tersedia {rupiah(wallet)}</p>
            <div className="dash-row-actions">
              <button type="button" className="btn btn-sm" disabled={withdrawBusy} onClick={() => setWithdrawOpen(false)}>Batal</button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={withdrawBusy}>
                {withdrawBusy ? "Mengirim…" : "Ajukan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute><DashboardContent /></ProtectedRoute>
    </Layout>
  );
}
