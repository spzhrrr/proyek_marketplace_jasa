import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { needsVerification } from "../utils/verification.js";
import { isProfileComplete } from "../utils/profile.js";
import { afterLogoutPath } from "../utils/guestPaths.js";
import { BellIcon, ChatIcon, HomeIcon } from "./BellIcon.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

function IconBtn({ to, label, active, badge, children }) {
  return (
    <Link to={to} className={`nav-icon-btn ${active ? "active" : ""}`} aria-label={label} title={label}>
      {children}
      {badge > 0 && <span className="nav-icon-badge">{badge > 9 ? "9+" : badge}</span>}
    </Link>
  );
}

export default function Navbar() {
  const { user, unread, unreadChat, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (user?.role === "ADMIN" && loc.pathname.startsWith("/admin")) {
    return null;
  }

  async function confirmLogout() {
    setLoggingOut(true);
    try {
      const next = afterLogoutPath(loc.pathname);
      await logout();
      nav(next, { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  function active(path) {
    if (path === "/jasa" && (loc.pathname === "/jasa" || loc.pathname.startsWith("/jasa/"))) return "active";
    if (path === "/lowongan" && (loc.pathname === "/lowongan" || loc.pathname.startsWith("/lowongan/"))) return "active";
    if (path === "/dashboard" && loc.pathname.startsWith("/dashboard")) return "active";
    return loc.pathname === path || (path !== "/" && loc.pathname.startsWith(path + "/")) ? "active" : "";
  }

  const chatActive = loc.pathname === "/chat" || loc.pathname.includes("/chat");
  const notifActive = loc.pathname === "/notifikasi";

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <div className="brand-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <span className="brand-text">Tolong<span className="brand-highlight">in</span></span>
        </Link>

        <nav className="nav-pill-group" aria-label="Navigasi utama">
          <Link to="/jasa" className={`nav-pill-item ${active("/jasa")}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Cari Jasa</span>
          </Link>
          <Link to="/lowongan" className={`nav-pill-item ${active("/lowongan")}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Cari Kerja</span>
          </Link>
          {user && user.role !== "ADMIN" && (
            <Link to="/dashboard" className={`nav-pill-item ${active("/dashboard")}`}>
              <HomeIcon size={15} />
              <span>Beranda Saya</span>
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link to="/admin" className={`nav-pill-item ${active("/admin")}`}>
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="nav-auth">
          <div className="nav-icon-cluster">
            <IconBtn
              to={user ? "/chat" : "/login"}
              label="Chat"
              active={chatActive}
              badge={user ? (unreadChat || 0) : 0}
            >
              <ChatIcon size={18} />
            </IconBtn>
            <IconBtn
              to={user ? "/notifikasi" : "/login"}
              label="Notifikasi"
              active={notifActive}
              badge={user ? (unread || 0) : 0}
            >
              <BellIcon size={18} />
            </IconBtn>
          </div>

          {user && isProfileComplete(user) && needsVerification(user) && user.role !== "ADMIN" && (
            <Link to="/verify" className={`nav-verify-chip ${active("/verify")}`}>Verifikasi</Link>
          )}

          {user ? (
            <div className="nav-user">
              <Link to={`/profile/${user.id}`} className="nav-user-link">
                {user.profilepic_url ? (
                  <img src={user.profilepic_url} alt="" className="nav-avatar" />
                ) : (
                  <span className="nav-avatar nav-avatar-placeholder">
                    {(user.first_name?.[0] || user.name?.[0] || "?").toUpperCase()}
                  </span>
                )}
                <span className="user-chip">{user.displayName || user.name || user.first_name}</span>
              </Link>
              <button type="button" className="btn-nav-logout" onClick={() => setLogoutOpen(true)}>
                Log out
              </button>
            </div>
          ) : (
            <div className="auth-btn-group">
              <Link to="/login" className="btn-nav-login">Masuk</Link>
              <Link to="/register" className="btn-nav-register">Daftar</Link>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={logoutOpen}
        title="Keluar dari akun?"
        message="Sesi di perangkat ini akan ditutup. Pesanan, chat, dan saldo escrow tetap aman."
        confirmText="Keluar"
        cancelText="Tetap masuk"
        confirmTone="logout"
        loading={loggingOut}
        identity={user ? {
          name: user.displayName || user.name || user.first_name || "Akun",
          photo: user.profilepic_url,
          initial: (user.first_name?.[0] || user.name?.[0] || "A").toUpperCase(),
          caption: user.email || "Sesi aktif di perangkat ini",
        } : null}
        note="Kamu bisa masuk lagi kapan saja dengan email dan kata sandi yang sama."
        onConfirm={confirmLogout}
        onCancel={() => !loggingOut && setLogoutOpen(false)}
      />
    </header>
  );
}
