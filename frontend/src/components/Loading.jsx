export default function Loading({ label = "Memuat..." }) {
  return (
    <div className="loading-wrap" role="status" aria-live="polite">
      <div className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
