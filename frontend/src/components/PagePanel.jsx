import BackLink from "./BackLink.jsx";

export default function PagePanel({
  title,
  subtitle,
  backTo,
  backLabel,
  actions,
  children,
  className = "",
  compact = false,
}) {
  return (
    <div className={`panel page-panel ${compact ? "page-panel-compact" : ""} ${className}`.trim()}>
      {backTo && <BackLink to={backTo}>{backLabel}</BackLink>}
      {(title || subtitle || actions) && (
        <header className="page-panel-head">
          <div className="page-panel-head-text">
            {title && <h1>{title}</h1>}
            {subtitle && <p className="page-panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="page-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="page-panel-body">{children}</div>
    </div>
  );
}
