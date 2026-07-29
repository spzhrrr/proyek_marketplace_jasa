import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import SectionCard from "../../components/SectionCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import Alert from "../../components/Alert.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderStatusLabel, applicationStatusLabel, jobStatusLabel, orderTotal } from "../../utils/format.js";

function payoutSourceLabel(source) {
  return source === "JOB" ? "Lowongan kerja" : "Jasa";
}

function formatPayoutDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderTable({ rows, columns }) {
  if (rows.length === 0) return null;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
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

function DashStat({ label, value, hint, tone = "default" }) {
  return (
    <div className={`dash-stat dash-stat-${tone}`}>
      <span className="dash-stat-label">{label}</span>
      <strong className="dash-stat-value">{value}</strong>
      {hint && <span className="dash-stat-hint">{hint}</span>}
    </div>
  );
}

function DashboardContent() {
  const location = useLocation();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState(location.state?.msg || "");

  useEffect(() => {
    api.dashboard().then(setD);
  }, []);

  async function acceptApp(id, jobTitle) {
    if (!confirm(`Terima lamaran untuk "${jobTitle}"?\n\nPemberi kerja akan diminta bayar. Pelamar akan mulai mengerjakan setelah pembayaran.`)) return;
    setMsg("");
    try {
      const res = await api.applicationAccept(id);
      if (res.orderId) window.location.href = `/orders/${res.orderId}`;
      else api.dashboard().then(setD);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function rejectApp(id, jobTitle) {
    if (!confirm(`Tolak lamaran untuk "${jobTitle}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setMsg("");
    try {
      await api.applicationReject(id);
      api.dashboard().then(setD);
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (!d) return <Loading />;

  const pendingIncoming = d.applicationsIncoming.filter((a) => a.status === "PENDING").length;
  const activeBuyerOrders = d.ordersAsBuyer.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;
  const activeSellerOrders = d.ordersAsSeller.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;
  const openJobs = d.myJobs.filter((j) => j.status === "OPEN").length;
  const earnings = d.earnings || {
    totalReceived: 0,
    pendingHeld: 0,
    awaitingPayment: 0,
    payoutCount: 0,
    pendingHeldCount: 0,
    awaitingPaymentCount: 0,
    bankMasked: null,
  };
  const recentPayouts = d.recentPayouts || [];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Beranda Saya"
        subtitle="Semua pesanan, lamaran, dan pendapatan kamu ada di sini"
        action={(
          <div className="btn-row dashboard-quick-actions">
            <Link to="/jasa/baru" className="btn btn-sm">+ Post Jasa</Link>
            <Link to="/lowongan/baru" className="btn btn-sm btn-primary">+ Post Lowongan</Link>
          </div>
        )}
      />

      {msg && <Alert type="success">{msg}</Alert>}

      <HelpBox title="Kamu bisa jadi pembeli sekaligus penjual">
        <p>
          <strong>Pembeli</strong> = pesanan jasa yang kamu beli.
          {" "}<strong>Penyedia</strong> = pesanan dari orang lain yang menyewa jasamu.
          {" "}<strong>Lamaran</strong> = pekerjaan yang kamu lamar atau yang masuk ke lowonganmu.
        </p>
      </HelpBox>

      <section className="earnings-wallet" id="pendapatan">
        <div className="earnings-wallet-header">
          <div>
            <h2>Saldo Pendapatan</h2>
            <p>Uang yang sudah masuk setelah pembeli/pemberi kerja menyetujui pekerjaan kamu</p>
          </div>
          {earnings.bankMasked ? (
            <p className="hint" style={{ color: "rgba(255,255,255,0.9)", margin: 0 }}>
              Rekening tujuan: <strong>{earnings.bankMasked}</strong>
            </p>
          ) : (
            <Link to="/verify/bank" className="btn btn-sm" style={{ background: "#fff", color: "#1e40af" }}>
              Isi rekening bank
            </Link>
          )}
        </div>
        <div className="earnings-wallet-grid">
          <div className="earnings-wallet-stat primary">
            <span>Sudah masuk</span>
            <strong>{rupiah(earnings.totalReceived)}</strong>
            <small>{earnings.payoutCount} transaksi selesai</small>
          </div>
          <div className="earnings-wallet-stat">
            <span>Sedang ditahan</span>
            <strong>{rupiah(earnings.pendingHeld)}</strong>
            <small>
              {earnings.pendingHeldCount
                ? `${earnings.pendingHeldCount} pesanan — uang aman, menunggu disetujui`
                : "Belum ada dana ditahan"}
            </small>
          </div>
          <div className="earnings-wallet-stat">
            <span>Menunggu dibayar</span>
            <strong>{rupiah(earnings.awaitingPayment)}</strong>
            <small>
              {earnings.awaitingPaymentCount
                ? `${earnings.awaitingPaymentCount} pesanan — pembeli belum bayar`
                : "Tidak ada yang menunggu bayar"}
            </small>
          </div>
        </div>
      </section>

      <SectionCard title="Riwayat pendapatan masuk" id="riwayat-pendapatan">
        {recentPayouts.length === 0 ? (
          <EmptyState
            title="Belum ada pendapatan"
            hint="Dana masuk otomatis setelah pembeli menyetujui pekerjaan kamu — baik dari jasa maupun lowongan kerja."
            action={<Link to="/jasa/baru" className="btn btn-sm btn-primary">Post Jasa</Link>}
          />
        ) : (
          <OrderTable
            rows={recentPayouts}
            columns={[
              { key: "paid_at", label: "Tanggal", render: (p) => formatPayoutDate(p.paid_at) },
              { key: "title", label: "Dari pesanan", render: (p) => (
                <>
                  <Link to={`/orders/${p.order_id}`}>{p.title}</Link>
                  <span className="payout-source-label">{payoutSourceLabel(p.source)}</span>
                </>
              ) },
              { key: "order_number", label: "No. Order" },
              { key: "amount", label: "Masuk", render: (p) => <strong>{rupiah(p.amount)}</strong> },
              { key: "bank", label: "Ke rekening", render: (p) => p.bank_account_masked || "-" },
            ]}
          />
        )}
      </SectionCard>

      <div className="dashboard-stats">
        <DashStat label="Pesanan aktif (pembeli)" value={activeBuyerOrders} hint="Butuh tindakan atau sedang berjalan" />
        <DashStat label="Pesanan aktif (penyedia)" value={activeSellerOrders} hint="Order masuk dari pelanggan" tone="seller" />
        <DashStat
          label="Lamaran masuk"
          value={pendingIncoming}
          hint={pendingIncoming ? "Perlu ditinjau" : "Belum ada yang menunggu"}
          tone={pendingIncoming ? "warn" : "default"}
        />
        <DashStat label="Lowongan terbuka" value={openJobs} hint="Lowongan yang masih menerima pelamar" tone="jobs" />
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-col">
          <SectionCard
            title="Pesanan sebagai pembeli"
            action={<Link to="/jasa" className="text-link">Cari jasa</Link>}
          >
            {d.ordersAsBuyer.length === 0 ? (
              <EmptyState
                title="Belum ada pesanan"
                hint="Sewa jasa untuk memulai transaksi"
                action={<Link to="/jasa" className="btn btn-sm btn-primary">Jelajahi Jasa</Link>}
              />
            ) : (
              <OrderTable
                rows={d.ordersAsBuyer}
                columns={[
                  { key: "order_number", label: "No. Order" },
                  { key: "title", label: "Judul" },
                  { key: "amount", label: "Total", render: (o) => rupiah(orderTotal(o)) },
                  { key: "status", label: "Status", render: (o) => <span className="pill">{orderStatusLabel(o.status)}</span> },
                  { key: "link", label: "", render: (o) => <Link to={`/orders/${o.id}`}>Detail →</Link> },
                ]}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Lamaran terkirim"
            action={<Link to="/lowongan" className="text-link">Cari lowongan</Link>}
          >
            {d.applicationsSent.length === 0 ? (
              <EmptyState
                title="Belum pernah melamar"
                hint="Temukan proyek yang sesuai keahlianmu"
                action={<Link to="/lowongan" className="btn btn-sm btn-primary">Cari Lowongan</Link>}
              />
            ) : (
              <OrderTable
                rows={d.applicationsSent}
                columns={[
                  { key: "job_title", label: "Lowongan" },
                  { key: "proposed_price", label: "Harga", render: (a) => rupiah(a.proposed_price) },
                  { key: "status", label: "Status", render: (a) => <span className="pill">{applicationStatusLabel(a.status)}</span> },
                  {
                    key: "link",
                    label: "",
                    render: (a) => a.order_id ? (
                      <Link to={`/orders/${a.order_id}`}>Ke pesanan →</Link>
                    ) : null,
                  },
                ]}
              />
            )}
          </SectionCard>
        </div>

        <div className="dashboard-col">
          <SectionCard
            title="Pesanan sebagai penyedia"
            action={<Link to="/jasa/baru" className="text-link">Tambah jasa</Link>}
          >
            {d.ordersAsSeller.length === 0 ? (
              <EmptyState
                title="Belum ada pesanan masuk"
                hint="Post jasa agar pelanggan bisa menyewa"
                action={<Link to="/jasa/baru" className="btn btn-sm btn-primary">Post Jasa</Link>}
              />
            ) : (
              <OrderTable
                rows={d.ordersAsSeller}
                columns={[
                  { key: "order_number", label: "No. Order" },
                  { key: "title", label: "Judul" },
                  { key: "buyer_name", label: "Pembeli" },
                  { key: "amount", label: "Pendapatan", render: (o) => rupiah(o.seller_net_amount || o.amount) },
                  { key: "escrow", label: "Dana", render: (o) => (
                    o.escrow === "RELEASED" ? (
                      <span className="pill pill-ok">Sudah masuk</span>
                    ) : o.escrow === "HELD" ? (
                      <span className="pill pill-wait">Ditahan</span>
                    ) : (
                      <span className="pill">Belum bayar</span>
                    )
                  ) },
                  { key: "status", label: "Status", render: (o) => <span className="pill">{orderStatusLabel(o.status)}</span> },
                  { key: "link", label: "", render: (o) => <Link to={`/orders/${o.id}`}>Detail →</Link> },
                ]}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Lamaran masuk"
            id="lamaran-masuk"
            action={
              pendingIncoming > 0 ? (
                <span className="badge badge-warn">{pendingIncoming} menunggu</span>
              ) : null
            }
          >
            {d.applicationsIncoming.length === 0 ? (
              <EmptyState title="Belum ada lamaran" hint="Post lowongan untuk menerima lamaran" />
            ) : (
              <OrderTable
                rows={d.applicationsIncoming}
                columns={[
                  { key: "job_title", label: "Lowongan" },
                  { key: "applicant_name", label: "Pelamar", render: (a) => a.applicant_name || a.seller_name },
                  { key: "proposed_price", label: "Harga", render: (a) => rupiah(a.proposed_price) },
                  { key: "status", label: "Status", render: (a) => <span className="pill">{applicationStatusLabel(a.status)}</span> },
                  {
                    key: "aksi",
                    label: "Aksi",
                    render: (a) => a.status === "PENDING" ? (
                      <div className="btn-row" style={{ margin: 0 }}>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => acceptApp(a.id, a.job_title)}>Terima</button>
                        <button type="button" className="btn btn-sm" onClick={() => rejectApp(a.id, a.job_title)}>Tolak</button>
                      </div>
                    ) : null,
                  },
                ]}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Lowongan saya"
            action={<Link to="/lowongan/baru" className="text-link">Post baru</Link>}
          >
            {d.myJobs.length === 0 ? (
              <EmptyState
                title="Belum post lowongan"
                action={<Link to="/lowongan/baru" className="btn btn-sm btn-primary">Post Sekarang</Link>}
              />
            ) : (
              <OrderTable
                rows={d.myJobs}
                columns={[
                  { key: "title", label: "Judul", render: (j) => <Link to={`/lowongan/${j.id}`}>{j.title}</Link> },
                  { key: "budget", label: "Budget", render: (j) => rupiah(j.budget) },
                  { key: "status", label: "Status", render: (j) => <span className="pill">{jobStatusLabel(j.status)}</span> },
                ]}
              />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Layout wide compact>
      <ProtectedRoute><DashboardContent /></ProtectedRoute>
    </Layout>
  );
}
