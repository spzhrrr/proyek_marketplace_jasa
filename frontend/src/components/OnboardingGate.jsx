import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Loading from "./Loading.jsx";
import { isProfileComplete } from "../utils/profile.js";

const PUBLIC_PATHS = new Set(["/", "/login", "/register", "/lengkapi-profil"]);

function isBrowsePath(pathname) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    /^\/jasa(\/\d+)?$/.test(pathname) ||
    /^\/lowongan(\/\d+)?$/.test(pathname)
  );
}

export default function OnboardingGate({ children }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return <Loading label="Memuat..." />;

  if (user && user.role !== "ADMIN") {
    const complete = isProfileComplete(user);

    if (!complete && pathname.startsWith("/verify")) {
      return <Navigate to="/lengkapi-profil" replace />;
    }

    if (!complete && !isBrowsePath(pathname)) {
      return <Navigate to="/lengkapi-profil" replace />;
    }

    if (complete && pathname === "/lengkapi-profil") {
      return <Navigate to="/verify" replace />;
    }
  }

  return children;
}
