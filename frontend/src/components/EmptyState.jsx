export default function EmptyState({ title = "Belum ada data", hint, action, icon = "○" }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden>{icon}</div>
      <p className="empty-state-title">{title}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
