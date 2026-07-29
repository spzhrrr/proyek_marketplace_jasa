import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { needsVerification } from "../utils/verification.js";
import { isProfileComplete } from "../utils/profile.js";

export default function Navbar() {
  const { user, unread, logout } = useAuth();
  const loc = useLocation();

  if (user?.role === "ADMIN" && loc.pathname.startsWith("/admin")) {
    return null;
  }

  function active(path) {
    return loc.pathname === path || loc.pathname.startsWith(path + "/") ? "active" : "";
  }

  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden>MJ</span>
          <span className="brand-text">Marketplace Jasa</span>
        </Link>
        <nav className="nav" aria-label="Navigasi utama">
          <Link to="/jasa" className={active("/jasa")}>Cari Jasa</Link>
          <Link to="/lowongan" className={active("/lowongan")}>Cari Kerja</Link>
          {user && user.role !== "ADMIN" && (
            <>
              <Link to="/dashboard" className={active("/dashboard")}>Beranda Saya</Link>
              <Link to={`/profile/${user.id}`} className={active("/profile")}>Profil</Link>
              <Link to="/notifikasi" className={`nav-notif ${active("/notifikasi")}`}>
                Notifikasi
                {unread > 0 && <span className="nav-badge">{unread}</span>}
              </Link>
              {isProfileComplete(user) && needsVerification(user) && (
                <Link to="/verify" className={`nav-verify ${active("/verify")}`}>Verifikasi</Link>
              )}
            </>
          )}
          {user?.role === "ADMIN" && (
            <Link to="/admin" className={active("/admin")}>Admin</Link>
          )}
        </nav>
        <div className="nav-auth">
          {user ? (
            <div className="nav-user">
              {user.profilepic_url ? (
                <img src={user.profilepic_url} alt="" className="nav-avatar" />
              ) : (
                <span className="nav-avatar nav-avatar-placeholder">
                  {(user.first_name?.[0] || user.name?.[0] || "?").toUpperCase()}
                </span>
              )}
              <span className="user-chip">{user.displayName || user.name}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>Keluar</button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Masuk</Link>
              <Link to="/register" className="btn btn-sm btn-primary">Daftar</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
