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

function KtpForm() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [hub, setHub] = useState(null);
  const [ktp_number, setKtp] = useState("");
  const [photo, setPhoto] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.verifyHub().then(setHub);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    setLoading(true);
    const fd = new FormData();
    fd.append("ktp_number", ktp_number);
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
      <div className="panel">
        <h1>Verifikasi KTP</h1>
        <Alert type="warn">Selesaikan verifikasi email dan nomor HP terlebih dahulu.</Alert>
        <Link to="/verify" className="btn btn-primary">Ke halaman verifikasi</Link>
      </div>
    );
  }

  if (hub.steps.ktp.done) {
    return (
      <div className="panel">
        <Alert type="success">KTP kamu sudah disetujui.</Alert>
        <Link to="/verify" className="btn">← Kembali</Link>
      </div>
    );
  }

  if (hub.steps.ktp.pending) {
    return (
      <div className="panel">
        <h1>Verifikasi KTP</h1>
        <VerifyStepper steps={hub.steps} current="ktp" />
        <Alert type="warn">
          Pengajuan KTP sedang direview admin. Status: {ktpStatusLabel("PENDING")}
        </Alert>
        <p className="muted">Kamu akan mendapat notifikasi setelah admin selesai memverifikasi.</p>
        <Link to="/verify" className="btn">← Kembali</Link>
      </div>
    );
  }

  return (
    <div className="panel">
      <h1>{hub.steps.ktp.status === "REJECTED" ? "Unggah Ulang KTP" : "Submit KTP"}</h1>
      <VerifyStepper steps={hub.steps} current="ktp" />

      {hub.steps.ktp.rejectedReason && (
        <Alert type="danger">Pengajuan sebelumnya ditolak: {hub.steps.ktp.rejectedReason}</Alert>
      )}

      <p className="muted">
        Unggah foto KTP yang jelas dan selfie sambil memegang KTP. Data hanya digunakan untuk verifikasi identitas.
      </p>

      {errors.map((e) => <Alert key={e}>{e}</Alert>)}

      <form onSubmit={submit} className="form">
        <label>
          NIK KTP (16 digit)
          <input
            required
            value={ktp_number}
            onChange={(e) => setKtp(e.target.value.replace(/\D/g, "").slice(0, 16))}
            maxLength={16}
            inputMode="numeric"
            placeholder="3201xxxxxxxxxxxx"
          />
        </label>
        <label>
          Foto KTP
          <input type="file" accept="image/*" required onChange={(e) => setPhoto(e.target.files[0])} />
        </label>
        <label>
          Selfie memegang KTP
          <input type="file" accept="image/*" required onChange={(e) => setSelfie(e.target.files[0])} />
        </label>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Mengirim..." : "Kirim untuk review admin"}
          </button>
          <Link to="/verify" className="btn">Batal</Link>
        </div>
      </form>
    </div>
  );
}

export default function VerifyKtpPage() {
  return (
    <Layout narrow>
      <ProtectedRoute><KtpForm /></ProtectedRoute>
    </Layout>
  );
}
