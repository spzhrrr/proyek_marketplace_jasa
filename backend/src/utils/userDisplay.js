export function capitalizeName(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function fullName(user) {
  if (!user) return "";
  if (user.first_name) {
    const first = capitalizeName(user.first_name);
    const last = capitalizeName(user.last_name || "");
    return `${first} ${last}`.trim();
  }
  return user.name || "";
}
