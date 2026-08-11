const API_BASE = import.meta.env.VITE_API_BASE || "";

/** Resolve relative upload paths to full URLs for img src */
export function resolveUploadUrl(path) {
  if (!path || typeof path !== "string") return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) return `${API_BASE}${trimmed}`;
  return `${API_BASE}/${trimmed}`;
}

/** Parse cover_image_url field (supports || joined or JSON array) */
export function parseCoverUrls(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return [];
  const raw = urlStr.trim();
  if (!raw) return [];
  if (raw.includes("||")) return raw.split("||").map((u) => u.trim()).filter(Boolean);
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [raw];
    } catch {
      return [raw];
    }
  }
  return [raw];
}

/** First cover URL resolved for card thumbnails */
export function getFirstCoverUrl(urlStr) {
  const first = parseCoverUrls(urlStr)[0];
  return first ? resolveUploadUrl(first) : "";
}

export const JASA_COVER_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'%3E%3Crect fill='%23e0f2fe' width='400' height='250'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%230284c7' font-family='system-ui' font-size='14' font-weight='600'%3ETolongin Jasa%3C/text%3E%3C/svg%3E";
