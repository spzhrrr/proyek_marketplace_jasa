import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import VerifyStepper from "../../components/VerifyStepper.jsx";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { ktpStatusLabel } from "../../utils/verification.js";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import VerifyShell from "../../components/VerifyShell.jsx";

function KtpForm() {
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [hub, setHub] = useState(null);
  const [ktp_name, setKtpName] = useState(user?.ktp_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim());
  const [ktp_number, setKtp] = useState(user?.ktp_number || "");
  const [ktp_birthplace, setKtpBirthplace] = useState(user?.ktp_birthplace || user?.city || "");
  const [ktp_birthdate, setKtpBirthdate] = useState(user?.ktp_birthdate ? String(user.ktp_birthdate).slice(0, 10) : "");
  const [ktp_gender, setKtpGender] = useState(user?.ktp_gender || "LAKI-LAKI");
  const [ktp_address, setKtpAddress] = useState(user?.ktp_address || "");
  const [photo, setPhoto] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api.verifyHub().then(setHub);
  }, []);

  function askSubmit(e) {
    e.preventDefault();
    setErrors([]);
    setConfirmOpen(true);
  }

  async function submitKtp() {
    setConfirmOpen(false);
    setLoading(true);
    const fd = new FormData();
    fd.append("ktp_name", ktp_name);
    fd.append("ktp_number", ktp_number);
    fd.append("ktp_birthplace", ktp_birthplace);
    fd.append("ktp_birthdate", ktp_birthdate);
    fd.append("ktp_gender", ktp_gender);
    fd.append("ktp_address", ktp_address);
    if (photo) fd.append("ktp_photo", photo);
    if (selfie) fd.append("ktp_selfie", selfie);
    try {
      await api.submitKtp(fd);
      await refresh();
      nav("/verify");
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    } finally {
      setLoading(false);
    }
  }

  if (!hub) return <Loading />;

  if (!hub.steps.email.done || !hub.steps.phone.done) {
    return (
      <VerifyShell title="KTP" subtitle="Selesaikan email dan nomor HP terlebih dahulu.">
        <Alert type="warn">Selesaikan verifikasi email dan nomor HP terlebih dahulu.</Alert>
        <Link to="/verify" className="btn btn-primary">Ke halaman verifikasi</Link>
      </VerifyShell>
    );
  }

  if (hub.steps.ktp.done) {
    return (
      <VerifyShell title="KTP" subtitle="Identitas KTP kamu sudah disetujui.">
        <Alert type="success">KTP kamu sudah disetujui.</Alert>
        <Link to="/verify" className="btn">← Kembali</Link>
      </VerifyShell>
    );
  }

  if (hub.steps.ktp.pending) {
    return (
      <VerifyShell title="KTP" subtitle="Pengajuan sedang ditinjau admin.">
        <VerifyStepper steps={hub.steps} current="ktp" />
        <Alert type="warn">
          Pengajuan KTP sedang direview admin. Status: {ktpStatusLabel("PENDING")}
        </Alert>
        <p className="muted">Kamu akan mendapat notifikasi setelah admin selesai memverifikasi.</p>
      </VerifyShell>
    );
  }

  return (
    <VerifyShell title="KTP" subtitle="Isi data sesuai KTP fisik. Data hanya untuk verifikasi identitas.">
      <VerifyStepper steps={hub.steps} current="ktp" />

      <div className="post-form-grid-layout" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="form-column-card">
          <h3 className="column-section-title">📄 Form Data & Dokumen KTP</h3>

          {hub.steps.ktp.rejectedReason && (
            <Alert type="danger" style={{ marginBottom: "16px" }}>⚠️ Penolakan Sebelumnya: {hub.steps.ktp.rejectedReason}</Alert>
          )}

          {errors.map((e) => <Alert key={e}>{e}</Alert>)}

          <form onSubmit={askSubmit} className="form">
            <div className="form-group-sm">
              <label className="form-label-bold">Nama Lengkap Sesuai KTP <span className="text-danger">*</span></label>
              <input
                required
                className="form-input-compact"
                value={ktp_name}
                onChange={(e) => setKtpName(e.target.value)}
                placeholder="Contoh: BUDI SANTOSO (Sesuai KTP fisik)"
              />
            </div>

            <div className="form-group-sm">
              <label className="form-label-bold">Nomor NIK KTP (16 Digit) <span className="text-danger">*</span></label>
              <input
                required
                className="form-input-compact"
                value={ktp_number}
                onChange={(e) => setKtp(e.target.value.replace(/\D/g, "").slice(0, 16))}
                maxLength={16}
                inputMode="numeric"
                placeholder="3201xxxxxxxxxxxx"
              />
            </div>

            <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group-sm">
                <label className="form-label-bold">Tempat Lahir <span className="text-danger">*</span></label>
                <input
                  required
                  className="form-input-compact"
                  value={ktp_birthplace}
                  onChange={(e) => setKtpBirthplace(e.target.value)}
                  placeholder="Contoh: Bandung"
                />
              </div>

              <div className="form-group-sm">
                <label className="form-label-bold">Tanggal Lahir <span className="text-danger">*</span></label>
                <input
                  type="date"
                  required
                  className="form-input-compact"
                  value={ktp_birthdate}
                  onChange={(e) => setKtpBirthdate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group-sm">
              <label className="form-label-bold">Jenis Kelamin <span className="text-danger">*</span></label>
              <select
                required
                className="form-input-compact"
                value={ktp_gender}
                onChange={(e) => setKtpGender(e.target.value)}
              >
                <option value="LAKI-LAKI">LAKI-LAKI</option>
                <option value="PEREMPUAN">PEREMPUAN</option>
              </select>
            </div>

            <div className="form-group-sm">
              <label className="form-label-bold">Alamat Lengkap Sesuai KTP <span className="text-danger">*</span></label>
              <textarea
                required
                rows={2}
                className="form-input-compact"
                value={ktp_address}
                onChange={(e) => setKtpAddress(e.target.value)}
                placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Provinsi"
              />
            </div>

            <div className="form-group-sm">
              <label className="form-label-bold">Foto KTP Asli (Tampak Depan) <span className="text-danger">*</span></label>
              <input type="file" className="form-input-compact" accept="image/jpeg,image/png,image/jpg" required onChange={(e) => setPhoto(e.target.files[0])} />
            </div>

            <div className="form-group-sm">
              <label className="form-label-bold">Foto Selfie Memegang KTP <span className="text-danger">*</span></label>
              <input type="file" className="form-input-compact" accept="image/jpeg,image/png,image/jpg" required onChange={(e) => setSelfie(e.target.files[0])} />
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: "16px" }}>
              {loading ? "Mengunggah Dokumen..." : "Kirim KTP untuk Review Admin →"}
            </button>
          </form>

          <ConfirmModal
            isOpen={confirmOpen}
            title="Kirim data KTP?"
            message="Pastikan data dan foto sesuai KTP fisik. Setelah dikirim, admin akan meninjau pengajuanmu."
            confirmText="Ya, Kirim"
            cancelText="Periksa Lagi"
            confirmTone="primary"
            loading={loading}
            onConfirm={submitKtp}
            onCancel={() => setConfirmOpen(false)}
          />
        </div>

        <div className="form-column-card">
          <h3 className="column-section-title">📷 Ketentuan Foto KTP Valid</h3>
          <div className="help-box-content" style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.825rem", color: "#475569" }}>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <strong style={{ color: "#0f172a" }}>✓ 4 Sudut KTP Terlihat Utuh</strong>
              <p style={{ margin: "2px 0 0", color: "#64748b" }}>Foto tidak boleh terpotong atau tertutup jari.</p>
            </div>
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <strong style={{ color: "#0f172a" }}>✓ Tulisan NIK & Nama Terbaca Jelas</strong>
              <p style={{ margin: "2px 0 0", color: "#64748b" }}>Pastikan pencahayaan cukup & tidak terkena pantulan cahaya kilat (pantulan lampu).</p>
            </div>
          </div>
        </div>
      </div>
    </VerifyShell>
  );
}

export default function VerifyKtpPage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute><KtpForm /></ProtectedRoute>
    </Layout>
  );
}
