export default function AdminPageHeader({ title, subtitle, action, children }) {
  return (
    <header className="admin-page-head">
      <div className="admin-page-head-text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {(action || children) && (
        <div className="admin-page-head-actions">
          {action}
          {children}
        </div>
      )}
    </header>
  );
}
