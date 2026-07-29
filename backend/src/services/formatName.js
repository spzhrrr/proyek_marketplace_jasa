export function capitalizeName(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
