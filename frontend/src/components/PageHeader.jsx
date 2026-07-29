export default function PageHeader({ title, subtitle, action, children, className = "" }) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle && <p className="page-header-sub">{subtitle}</p>}
      </div>
      {(action || children) && (
        <div className="page-header-actions">
          {action}
          {children}
        </div>
      )}
    </header>
  );
}
