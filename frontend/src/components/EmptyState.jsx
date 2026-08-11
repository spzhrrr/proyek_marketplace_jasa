export default function EmptyState({
  title = "Belum ada data",
  hint,
  action,
  icon,
  darkTheme = false,
  variant = "default",
}) {
  return (
    <div className={`empty-state-panel ${darkTheme ? "is-dark" : ""} ${variant === "catalog" ? "is-catalog" : ""}`}>
      <div className="empty-state-icon">
        {icon || (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </div>
      <h3 className="empty-state-heading">{title}</h3>
      {hint && <p className="empty-state-copy">{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
