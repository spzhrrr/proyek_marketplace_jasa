import Navbar from "../components/Navbar.jsx";
import VerificationBanner from "../components/VerificationBanner.jsx";

export default function Layout({ children, narrow, auth, wide, compact }) {
  return (
    <div className="app">
      <Navbar />
      <VerificationBanner />
      <main className={`wrap main ${wide ? "main-wide" : ""} ${narrow ? "main-narrow" : ""} ${auth ? "main-auth" : ""} ${compact ? "main-compact" : ""}`}>
        <div className={compact ? "page-shell-compact" : ""}>{children}</div>
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <span>Marketplace Jasa</span>
          <span className="footer-muted">Platform jasa & kerja freelance</span>
        </div>
      </footer>
    </div>
  );
}
