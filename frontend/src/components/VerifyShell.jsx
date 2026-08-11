import { Link } from "react-router-dom";

export default function VerifyShell({ kicker = "Verifikasi", title, subtitle, backTo = "/verify", children }) {
  return (
    <div className="verify-page">
      <header className="verify-head">
        {backTo ? (
          <Link to={backTo} className="back-link-sm">← Kembali</Link>
        ) : null}
        <h1 className="catalog-display dash-display">
          <span className="catalog-display-kicker">{kicker}</span>
          <span className="catalog-display-word">{title}</span>
        </h1>
        {subtitle ? <p className="mockup-hero-sub">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}
