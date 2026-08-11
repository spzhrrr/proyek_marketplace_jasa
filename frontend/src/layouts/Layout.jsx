import Navbar from "../components/Navbar.jsx";
import VerificationBanner from "../components/VerificationBanner.jsx";

export default function Layout({ children, narrow, auth, wide, compact, bgClass }) {
  return (
    <div className={`app ${bgClass || ""}`}>
      <Navbar />
      <div className="wrap">
        <VerificationBanner />
      </div>
      <main className={`wrap main ${wide ? "main-wide" : ""} ${narrow ? "main-narrow" : ""} ${auth ? "main-auth" : ""} ${compact ? "main-compact" : ""}`}>
        <div className={compact ? "page-shell-compact" : ""}>{children}</div>
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <span>Tolongin</span>
          <span className="footer-muted">Marketplace jasa & kerja</span>
        </div>
      </footer>
    </div>
  );
}
