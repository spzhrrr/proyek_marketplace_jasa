import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { api } from "../../services/api.js";

function StatCard({ label, value, hint, to, tone }) {
  const inner = (
    <div className={`admin-stat-card ${tone ? `admin-stat-${tone}` : ""}`}>
      <span className="admin-stat-label">{label}</span>
      <strong className="admin-stat-value">{value ?? 0}</strong>
      {hint ? <span className="admin-stat-hint">{hint}</span> : null}
    </div>
  );
  return to ? <Link to={to} className="admin-stat-link">{inner}</Link> : inner;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.adminDashboard().then(setData);
  }, []);

  if (!data) return <Loading />;

  const { stats, recentKtp, recentBank } = data;
  const ktpPending = Number(stats.pendingKtp || 0);
  const bankPending = Number(stats.pendingBank || 0);

  const queue = [
    ...recentKtp.map((u) => ({
      id: `ktp-${u.id}`,
      kind: "KTP",
      name: `${u.first_name} ${u.last_name}`.trim(),
      detail: u.email,
      extra: u.ktp_number,
      href: `/admin/ktp/${u.id}`,
    })),
    ...recentBank.map((u) => ({
      id: `bank-${u.id}`,
      kind: "Bank",
      name: `${u.first_name} ${u.last_name}`.trim(),
      detail: u.bank_name || "-",
      extra: `****${String(u.bank_account_number || "").slice(-4)}`,
      href: `/admin/bank/${u.id}`,
    })),
  ];

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Antrian verifikasi dan ringkasan aktivitas marketplace."
      />
      <div className="admin-stat-grid admin-stat-grid-dash">
        <StatCard
          label="Antrian KTP"
          value={ktpPending}
          hint={ktpPending > 0 ? "Perlu ditinjau" : null}
          to="/admin/ktp"
          tone={ktpPending > 0 ? "warn" : ""}
        />
        <StatCard
          label="Antrian Bank"
          value={bankPending}
          hint={bankPending > 0 ? "Perlu ditinjau" : null}
          to="/admin/bank"
          tone={bankPending > 0 ? "warn" : ""}
        />
        <StatCard label="Pengguna" value={stats.totalUsers} to="/admin/users" />
        <StatCard label="Pesanan" value={stats.totalOrders} to="/admin/orders" />
        <StatCard label="Jasa aktif" value={stats.totalServices} />
        <StatCard label="Lowongan" value={stats.totalJobs} />
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Antrian verifikasi</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <Link to="/admin/ktp" className="admin-link-quiet">KTP</Link>
            <Link to="/admin/bank" className="admin-link-quiet">Bank</Link>
          </div>
        </div>
        {queue.length === 0 ? (
          <div className="admin-empty-inline">Tidak ada pengajuan KTP atau rekening.</div>
        ) : (
          <div className="admin-table-wrap">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Nama</th>
                <th>Detail</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((row) => (
                <tr key={row.id}>
                  <td><span className="badge badge-muted">{row.kind}</span></td>
                  <td><strong>{row.name}</strong></td>
                  <td>
                    <span>{row.detail}</span>
                    {row.extra ? <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{row.extra}</span> : null}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={row.href} className="btn btn-sm btn-primary">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </>
  );
}
