import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useEffect, useState } from "react";
import { api } from "../services/api.js";

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/ktp", label: "Verifikasi KTP", badgeKey: "pendingKtp" },
  { to: "/admin/users", label: "Pengguna" },
  { to: "/admin/orders", label: "Pesanan" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.adminDashboard().then((d) => setStats(d.stats)).catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    nav("/login");
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-title">CourseNet Admin</span>
          <span className="admin-brand-sub">Panel Operasional</span>
        </div>
        <nav className="admin-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
            >
              {item.label}
              {item.badgeKey && stats?.[item.badgeKey] > 0 && (
                <span className="admin-badge">{stats[item.badgeKey]}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link to="/" className="admin-nav-link muted-link">
            ← Kembali ke Marketplace
          </Link>
          <div className="admin-user">
            <span>{user?.displayName || user?.name}</span>
            <button type="button" className="btn btn-sm" onClick={handleLogout}>
              Keluar
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <h2 className="admin-page-title">Administrasi</h2>
        </header>
        <div className="admin-content">
          <Outlet context={{ stats, refreshStats: () => api.adminDashboard().then((d) => setStats(d.stats)) }} />
        </div>
      </div>
    </div>
  );
}
