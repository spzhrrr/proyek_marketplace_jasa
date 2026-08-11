function iconForSkill(label) {
  const s = String(label || "").toLowerCase();
  if (/bersih|cuci|laundry/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 21v-7a4 4 0 0 1 4-4h8" />
        <path d="M9 10V5a2 2 0 0 1 4 0v5" />
        <path d="M5 21h14" />
      </svg>
    );
  }
  if (/ac|listrik|kelistrikan|elektr/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );
  }
  if (/pindah|angkut|truck/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="1" y="7" width="15" height="10" rx="2" />
        <path d="M16 11h4l3 3v3h-7" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="19" cy="18" r="2" />
      </svg>
    );
  }
  if (/kayu|tukang|pertukang/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 4l6 6-8 8H6v-6z" />
        <path d="M12 8l4 4" />
      </svg>
    );
  }
  if (/masak|catering|dapur/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 11h18v2a7 7 0 0 1-7 7H10a7 7 0 0 1-7-7v-2z" />
        <path d="M8 11V4M12 11V3M16 11V5" />
      </svg>
    );
  }
  if (/logo|design|ui|ux|figma/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }
  if (/tulis|writer|content|copy/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (/photo|video|edit|kamera/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );
  }
  if (/mobile|app|android|ios/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  if (/market|iklan|seo|sosmed/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 11v2a8 8 0 0 0 8 8h2" />
        <path d="M21 3l-8 8" />
        <path d="M15 3h6v6" />
      </svg>
    );
  }
  if (/web|dev|code|program/.test(s)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2z" />
    </svg>
  );
}

export default function SkillTag({ label }) {
  if (!label) return null;
  return (
    <span className="jd-skill has-icon">
      {iconForSkill(label)}
      {label}
    </span>
  );
}
