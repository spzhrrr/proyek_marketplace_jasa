import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Loading from "./Loading.jsx";
import { isProfileComplete } from "../utils/profile.js";
import { needsVerification } from "../utils/verification.js";
import { isPublicForGuest } from "../utils/guestPaths.js";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/lengkapi-profil"]);

function isBrowsePath(pathname) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/verify") ||
    /^\/jasa(\/\d+)?$/.test(pathname) ||
    /^\/lowongan(\/\d+)?$/.test(pathname)
  );
}

export default function OnboardingGate({ children }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <Loading label="Memuat..." />;

  if (!user && !isPublicForGuest(pathname)) {
    return <Navigate to="/login" replace state={{ from: pathname }} />;
  }

  if (user && user.role !== "ADMIN") {
    const complete = isProfileComplete(user);

    // Profil belum lengkap: boleh browse & verify, selain itu → lengkapi profil
    if (!complete && !isBrowsePath(pathname)) {
      return <Navigate to="/lengkapi-profil" replace />;
    }

    if (complete && pathname === "/lengkapi-profil") {
      return <Navigate to={needsVerification(user) ? "/verify" : "/dashboard"} replace />;
    }
  }

  return children;
}
