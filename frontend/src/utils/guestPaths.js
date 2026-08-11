const GUEST_EXACT = new Set(["/", "/login", "/register"]);

export function isPublicForGuest(pathname) {
  if (GUEST_EXACT.has(pathname)) return true;
  if (pathname === "/jasa" || pathname === "/lowongan") return true;
  if (/^\/jasa\/\d+$/.test(pathname)) return true;
  if (/^\/lowongan\/\d+$/.test(pathname)) return true;
  if (/^\/profile\/\d+$/.test(pathname)) return true;
  if (pathname.startsWith("/gateway/pay/")) return true;
  return false;
}

export function afterLogoutPath(pathname) {
  if (pathname.startsWith("/admin")) return "/login";
  if (isPublicForGuest(pathname)) return pathname;
  if (/^\/jasa\//.test(pathname)) return "/jasa";
  if (/^\/lowongan\//.test(pathname)) return "/lowongan";
  return "/jasa";
}
