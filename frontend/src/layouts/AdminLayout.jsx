import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ICONS = {
  dash: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4V4zm9 0h7v5h-7V4zM4 13h7v7H4v-7zm9 7v-9h7v9h-7z" fill="currentColor" />
    </svg>
  ),
  ktp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11zM7 9h4v1.5H7V9zm0 3h10v1.5H7V12zm0 3h7V16.5H7V15zM16 8.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" fill="currentColor" />
    </svg>
  ),
  bank: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 3 8v2h18V8L12 3zm-7 8h2v6H5v-6zm4 0h2v6H9v-6zm4 0h2v6h-2v-6zm4 0h2v6h-2v-6zM3 19h18v2H3v-2z" fill="currentColor" />
    </svg>
  ),
  withdraw: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 4h2v8.6l3.2-3.2 1.4 1.4L12 16.4 6.4 10.8l1.4-1.4L11 12.6V4zM4 18h16v2H4v-2z" fill="currentColor" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" fill="currentColor" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10l1 4H6l1-4zm-2 6h14l-1.2 10H6.2L5 10zm4 2v6h2v-6H9zm4 0v6h2v-6h-2z" fill="currentColor" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6V3zm8 1.5V9h4.5L14 4.5zM8 12h8v1.6H8V12zm0 3.2h8V17H8v-1.8z" fill="currentColor" />
    </svg>
  ),
};

const NAV = [
  { to: "/admin", label: "Dashboard", icon: "dash", end: true },
  { to: "/admin/ktp", label: "Verifikasi KTP", icon: "ktp", badgeKey: "pendingKtp" },
  { to: "/admin/bank", label: "Verifikasi Bank", icon: "bank", badgeKey: "pendingBank" },
  { to: "/admin/withdrawals", label: "Penarikan Saldo", icon: "withdraw" },
  { to: "/admin/users", label: "Pengguna", icon: "users" },
  { to: "/admin/orders", label: "Pesanan", icon: "orders" },
  { to: "/admin/reports", label: "Laporan User", icon: "reports" },
];

const PAGE_META = [
  { prefix: "/admin/ktp/", title: "Review KTP", sub: "Periksa dokumen identitas" },
  { prefix: "/admin/bank/", title: "Review Rekening", sub: "Cocokkan nama rekening dengan KTP" },
  { prefix: "/admin/ktp", title: "Verifikasi KTP", sub: "Antrian pengajuan identitas" },
  { prefix: "/admin/bank", title: "Verifikasi Bank", sub: "Antrian rekening pencairan" },
  { prefix: "/admin/withdrawals", title: "Penarikan Saldo", sub: "Persetujuan transfer ke bank" },
  { prefix: "/admin/users", title: "Pengguna", sub: "Akun marketplace dan riwayat" },
  { prefix: "/admin/orders", title: "Pesanan", sub: "Transaksi, escrow, dan sengketa" },
  { prefix: "/admin/reports", title: "Laporan User", sub: "Pengaduan dan sanksi" },
  { prefix: "/admin", title: "Dashboard", sub: "Ringkasan operasional platform" },
];

function pageMeta(pathname) {
  return PAGE_META.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix)) || PAGE_META.at(-1);
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [stats, setStats] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const meta = pageMeta(pathname);

  useEffect(() => {
    api.adminDashboard().then((d) => setStats(d.stats)).catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      nav("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-mark">T</div>
          <div>
            <span className="admin-brand-title">Tolongin Admin</span>
            <span className="admin-brand-sub">Panel operasional</span>
          </div>
        </div>
        <nav className="admin-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}
            >
              <span className="admin-nav-icon">{ICONS[item.icon]}</span>
              <span className="admin-nav-label">{item.label}</span>
              {item.badgeKey && stats?.[item.badgeKey] > 0 && (
                <span className="admin-badge">{stats[item.badgeKey]}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <Link to="/" className="admin-nav-link muted-link">
            Marketplace
          </Link>
          <div className="admin-user">
            <div className="admin-user-meta">
              <span className="admin-user-name">{user?.displayName || user?.name || "Admin"}</span>
              <span className="admin-user-role">Operator</span>
            </div>
            <button type="button" className="admin-logout-btn" onClick={() => setLogoutOpen(true)}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-page-title">Administrasi · {meta.title}</p>
            <p className="admin-topbar-sub">{meta.sub}</p>
          </div>
        </header>
        <div className="admin-content">
          <Outlet context={{ stats, refreshStats: () => api.adminDashboard().then((d) => setStats(d.stats)) }} />
        </div>
      </div>
      <ConfirmModal
        isOpen={logoutOpen}
        title="Keluar dari panel admin?"
        message="Sesi admin di perangkat ini akan ditutup. Antrian verifikasi tidak berubah."
        confirmText="Keluar"
        cancelText="Tetap masuk"
        confirmTone="logout"
        loading={loggingOut}
        identity={user ? {
          name: user.displayName || user.name || "Admin",
          photo: user.profilepic_url,
          initial: (user.first_name?.[0] || user.name?.[0] || "A").toUpperCase(),
          caption: "Akses panel operasional",
        } : null}
        note="Masuk lagi diperlukan untuk mengelola verifikasi, pesanan, dan laporan."
        onConfirm={handleLogout}
        onCancel={() => !loggingOut && setLogoutOpen(false)}
      />
    </div>
  );
}
