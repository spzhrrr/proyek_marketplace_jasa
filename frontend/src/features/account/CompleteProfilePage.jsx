import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { isProfileComplete } from "../../utils/profile.js";

function SetupForm() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ bio: "", city: "", province: "" });
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(user?.profilepic_url || "");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        bio: user.bio || "",
        city: user.city || "",
        province: user.province || "",
      });
      if (user.profilepic_url) setPreview(user.profilepic_url);
    }
  }, [user]);

  useEffect(() => {
    if (isProfileComplete(user)) {
      nav("/verify", { replace: true });
    }
  }, [user, nav]);

  function onPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
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
      nav("/verify", { replace: true });
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout narrow auth>
      <div className="panel auth-card onboarding-panel">
        <div className="onboarding-steps">
          <span className="onboarding-step active">1. Lengkapi Profil</span>
          <span className="onboarding-step">2. Verifikasi Akun</span>
        </div>
        <h1>Lengkapi profil kamu</h1>
        <p className="muted">
          Upload foto profil dan isi biodata. Langkah ini wajib sebelum verifikasi akun.
        </p>
        <div className="onboarding-steps-preview">
          <strong>Setelah profil lengkap, verifikasi:</strong>
          <ol>
            <li>Email & nomor HP (kode OTP)</li>
            <li>KTP (dicek admin 1–2 hari)</li>
            <li>Rekening bank (hanya jika ingin jual jasa)</li>
          </ol>
        </div>

        {errors.map((msg) => (
          <Alert key={msg}>{msg}</Alert>
        ))}

        <form onSubmit={submit} className="form">
          <div className="profile-setup-photo">
            <div className="profile-setup-preview">
              {preview ? (
                <img src={preview} alt="Preview foto profil" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder">
                  {(user?.first_name?.[0] || "?").toUpperCase()}
                </div>
              )}
            </div>
            <label className="profile-setup-upload">
              Foto profil <span className="text-danger">*</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                required={!user?.profilepic_url}
                onChange={onPhotoChange}
              />
              <span className="hint">JPG atau PNG, maks. 5 MB</span>
            </label>
          </div>

          <label>
            Bio / tentang kamu <span className="text-danger">*</span>
            <textarea
              required
              rows={4}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Keahlian, pengalaman, atau hal yang ingin ditampilkan di profil..."
            />
          </label>

          <div className="form-row">
            <label>
              Kota <span className="text-danger">*</span>
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Jakarta"
              />
            </label>
            <label>
              Provinsi <span className="text-danger">*</span>
              <input
                required
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                placeholder="DKI Jakarta"
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Menyimpan..." : "Simpan & lanjut verifikasi"}
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
