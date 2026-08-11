const ICONS = {
  "desain-grafis": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 19h14" />
    </svg>
  ),
  "penulisan-konten": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7H12v-3z" />
      <path d="M16 8l3 3" />
      <path d="M4 20h4" />
      <path d="M4 4h8" />
    </svg>
  ),
  "pemrograman-web": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 6 3 12 8 18" />
      <polyline points="16 6 21 12 16 18" />
      <line x1="13" y1="5" x2="11" y2="19" />
    </svg>
  ),
  kebersihan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21h14" />
      <path d="M8 21V10l4-6 4 6v11" />
      <path d="M8 14h8" />
    </svg>
  ),
  "renovasi-rumah": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 6l7 7-3 3-7-7V6h3z" />
      <path d="M4 20l7-7" />
    </svg>
  ),
  "kurir-angkut": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="15" height="10" rx="1" />
      <path d="M16 10h4l3 4v3h-7" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </svg>
  ),
  digital: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  ),
  fisik: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
};

const FALLBACK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default function CategoryMark({ code, parentCode, parentType, name }) {
  const key = String(code || parentCode || "").toLowerCase();
  const icon = ICONS[key] || FALLBACK;
  const isPhysical = parentType === "PHYSICAL" || parentCode === "fisik" || key === "fisik"
    || key === "kebersihan" || key === "renovasi-rumah" || key === "kurir-angkut";
  const label = name || "Karya";
  return (
    <span className={`pf-catmark ${isPhysical ? "is-physical" : "is-digital"}`} title={label} aria-hidden="true">
      {icon}
    </span>
  );
}
