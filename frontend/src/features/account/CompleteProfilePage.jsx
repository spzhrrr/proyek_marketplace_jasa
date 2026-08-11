import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { isProfileComplete, BIO_MAX_LENGTH } from "../../utils/profile.js";
import { needsVerification } from "../../utils/verification.js";

import { INDONESIA_PROVINCES, INDONESIA_CITIES } from "../../utils/indonesiaLocations.js";

function SetupForm() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ bio: "", city: "Jakarta Selatan", province: "DKI Jakarta" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(user?.profilepic_url || "");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        bio: String(user.bio || "").slice(0, BIO_MAX_LENGTH),
        city: user.city || "Jakarta Selatan",
        province: user.province || "DKI Jakarta",
      });
      if (user.profilepic_url) setPreview(user.profilepic_url);
    }
  }, [user]);

  useEffect(() => {
    if (isProfileComplete(user)) {
      nav(needsVerification(user) ? "/verify" : "/dashboard", { replace: true });
    }
  }, [user, nav]);

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  const availableCities = INDONESIA_CITIES[form.province] || ["Kota / Kabupaten"];

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    if (!photo && !user?.profilepic_url) {
      setErrors(["Pilih foto profil dulu."]);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("bio", form.bio);
      fd.append("city", form.city);
      fd.append("province", form.province);
      fd.append("onboarding", "true");
      if (photo) fd.append("profilepic", photo);
      await api.profileUpdate(fd);
      await refresh();
      nav("/verify", { replace: true }); // setelah profil: hub aksi KYC (OTP/KTP)
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout wide compact bgClass="app-dash-bg">
      <div style={{ maxWidth: "600px", margin: "12px auto", background: "#ffffff", borderRadius: "20px", padding: "24px", border: "1.5px solid #e2e8f0", boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}>
        {/* Stepper Header Pills */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#0284c7", color: "#ffffff", padding: "4px 12px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 800 }}>
            <span>1</span>
            <span>Lengkapi Profil</span>
          </div>
          <span style={{ color: "#94a3b8", fontWeight: 800 }}>→</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f1f5f9", color: "#64748b", padding: "4px 12px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700 }}>
            <span>2</span>
            <span>Verifikasi Akun</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0f172a", margin: "0 0 4px" }}>
            Lengkapi Profil Kamu ✨
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.825rem", fontWeight: 600, margin: 0 }}>
            Upload foto profil dan isi biodata singkat untuk mengaktifkan akun Anda di Tolongin.
          </p>
        </div>

        {errors.map((msg) => (
          <Alert key={msg}>{msg}</Alert>
        ))}

        <form onSubmit={submit} className="form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Avatar Upload Card */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", overflow: "hidden", background: "#0284c7", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "1.5rem", flexShrink: 0, border: "2px solid #ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
              {preview ? (
                <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (user?.first_name?.[0] || "?").toUpperCase()
              )}
            </div>

            <div style={{ flex: 1 }}>
              <input
                id="onboarding-photo"
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={onPhotoChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary photo-pick-btn"
                onClick={() => document.getElementById("onboarding-photo")?.click()}
              >
                Pilih foto profil
              </button>
              <span style={{ display: "block", fontSize: "0.725rem", color: "#64748b", marginTop: "6px", fontWeight: 600 }}>
                {photo ? `File dipilih: ${photo.name}` : "JPG atau PNG, maksimal 5 MB. Foto wajah yang jelas."}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px", display: "block" }}>
              Bio singkat <span className="text-danger">*</span>
            </label>
            <textarea
              required
              rows={2}
              maxLength={BIO_MAX_LENGTH}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.825rem", fontFamily: "inherit", width: "100%", background: "#ffffff", color: "#0f172a" }}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, BIO_MAX_LENGTH) })}
              placeholder="Keahlian atau cara kerjamu, tampil di bawah nama profil"
            />
            <span style={{ display: "block", fontSize: "0.72rem", color: "#64748b", marginTop: "4px", fontWeight: 600 }}>
              {form.bio.length}/{BIO_MAX_LENGTH} karakter
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px", display: "block" }}>
                Provinsi <span className="text-danger">*</span>
              </label>
              <select
                required
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.825rem", fontFamily: "inherit", width: "100%", background: "#ffffff", color: "#0f172a" }}
                value={form.province}
                onChange={(e) => {
                  const newProv = e.target.value;
                  const firstCity = INDONESIA_CITIES[newProv]?.[0] || "";
                  setForm({ ...form, province: newProv, city: firstCity });
                }}
              >
                {INDONESIA_PROVINCES.map((prov) => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px", display: "block" }}>
                Kota / Kabupaten <span className="text-danger">*</span>
              </label>
              <select
                required
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "0.825rem", fontFamily: "inherit", width: "100%", background: "#ffffff", color: "#0f172a" }}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              >
                {availableCities.map((ct) => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: "10px", borderRadius: "10px", fontWeight: 800, fontSize: "0.875rem", marginTop: "8px" }}>
            {loading ? "Menyimpan..." : "Simpan & Lanjut Verifikasi Akun →"}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export default function CompleteProfilePage() {
  return (
    <ProtectedRoute>
      <SetupForm />
    </ProtectedRoute>
  );
}
