import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Loading from "./Loading.jsx";
import { needsSellerVerification, needsVerification } from "../utils/verification.js";

export default function ProtectedRoute({ children, admin, requireSeller, requireKtp }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "ADMIN") return <Navigate to="/" replace />;
  if (requireSeller && needsSellerVerification(user)) {
    return <Navigate to="/verify" replace state={{ msg: "Lengkapi verifikasi (email, HP, KTP, bank) sebelum post jasa." }} />;
  }
  if (requireKtp && needsVerification(user)) {
    return <Navigate to="/verify" replace state={{ msg: "Lengkapi verifikasi (email, HP, KTP) sebelum post lowongan." }} />;
  }
  return children;
}
