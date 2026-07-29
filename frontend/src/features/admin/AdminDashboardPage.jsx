import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";

function StatCard({ label, value, hint, to }) {
  const inner = (
    <div className="admin-stat-card">
      <span className="admin-stat-label">{label}</span>
      <strong className="admin-stat-value">{value}</strong>
      {hint && <span className="admin-stat-hint">{hint}</span>}
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

  const { stats, recentKtp } = data;

  return (
    <>
      <h1>Dashboard Admin</h1>
      <p className="muted">Ringkasan operasional marketplace</p>

      <div className="admin-stat-grid">
        <StatCard label="Antrian KTP" value={stats.pendingKtp} hint="Perlu ditinjau" to="/admin/ktp" />
        <StatCard label="Total Pengguna" value={stats.totalUsers} to="/admin/users" />
        <StatCard label="Total Pesanan" value={stats.totalOrders} to="/admin/orders" />
        <StatCard label="Jasa Aktif" value={stats.totalServices} />
        <StatCard label="Lowongan" value={stats.totalJobs} />
      </div>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Antrian KTP Terbaru</h2>
          <Link to="/admin/ktp" className="btn btn-sm">Lihat semua</Link>
        </div>
        {recentKtp.length === 0 ? (
          <p className="empty">Tidak ada pengajuan KTP menunggu review.</p>
        ) : (
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>NIK</th>
                <th>Diajukan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recentKtp.map((u) => (
                <tr key={u.id}>
                  <td>{u.first_name} {u.last_name}</td>
                  <td>{u.email}</td>
                  <td>{u.ktp_number}</td>
                  <td>{u.ktp_submitted_at ? new Date(u.ktp_submitted_at).toLocaleString("id-ID") : "-"}</td>
                  <td>
                    <Link to={`/admin/ktp/${u.id}`} className="btn btn-sm btn-primary">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
