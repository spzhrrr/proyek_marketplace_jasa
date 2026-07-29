import { Link } from "react-router-dom";
import VerifyStepper from "../../components/VerifyStepper.jsx";
import Alert from "../../components/Alert.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import Layout from "../../layouts/Layout.jsx";
import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import { ktpStatusLabel } from "../../utils/verification.js";

function VerifyContent() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.verifyHub().then(setD);
  }, []);

  if (!d) return <Loading />;

  const allDone = d.level1 && d.level2;

  return (
    <>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-text">
          <h1>Verifikasi Akun</h1>
          <p className="page-header-sub">Agar transaksi aman, kami perlu memastikan identitas kamu</p>
        </div>
      </div>

      <HelpBox title="Apa fungsi tiap langkah?">
        <ul>
          <li><strong>Email & HP</strong> — agar kami bisa hubungi kamu (wajib untuk beli jasa & melamar kerja)</li>
          <li><strong>KTP</strong> — memastikan identitas asli (wajib untuk transaksi)</li>
          <li><strong>Rekening bank</strong> — hanya jika kamu ingin <em>menjual jasa</em> dan menerima uang</li>
        </ul>
      </HelpBox>

      <div className="panel">
      <VerifyStepper steps={d.steps} current={d.nextStep} />

      {allDone && d.level3 ? (
        <Alert type="success">Semua langkah selesai! Kamu bisa beli jasa, posting lowongan, melamar kerja, dan menjual jasa.</Alert>
      ) : allDone ? (
        <>
          <Alert type="success">Kamu sudah bisa beli jasa, posting lowongan, dan melamar kerja.</Alert>
          {!d.level3 && d.steps.bank?.canSubmit && (
            <div className="verify-step">
              <h3>Langkah 4 — Rekening bank (untuk jual jasa)</h3>
              <p>Diperlukan agar kamu bisa memposting jasa dan menerima pembayaran dari pembeli.</p>
              <Link to="/verify/bank" className="btn btn-sm btn-primary">Isi rekening bank</Link>
            </div>
          )}
        </>
      ) : (
        <>
          {!d.steps.email.done && (
            <div className="verify-step">
              <h3>Langkah 1 — Verifikasi email</h3>
              <p>Kami kirim kode 6 digit ke <strong>{d.user.email}</strong>. Masukkan kode tersebut.</p>
              <Link to="/verify/email" className="btn btn-sm btn-primary">Verifikasi email</Link>
            </div>
          )}

          {d.steps.email.done && !d.steps.phone.done && (
            <div className="verify-step">
              <h3>Langkah 2 — Verifikasi nomor HP</h3>
              <p>Kami kirim kode OTP ke <strong>{d.user.phone}</strong>.</p>
              <Link to="/verify/phone" className="btn btn-sm btn-primary">Verifikasi nomor HP</Link>
            </div>
          )}

          {d.steps.email.done && d.steps.phone.done && !d.steps.ktp.done && (
            <div className="verify-step">
              <h3>Langkah 3 — Verifikasi KTP</h3>
              <p>Status: <strong>{ktpStatusLabel(d.steps.ktp.status)}</strong></p>
              {d.steps.ktp.rejectedReason && (
                <Alert type="danger">Alasan penolakan: {d.steps.ktp.rejectedReason}</Alert>
              )}
              {d.steps.ktp.pending ? (
                <p className="muted">Dokumen sedang dicek admin (1–2 hari kerja). Kamu tetap bisa jelajahi jasa sambil menunggu.</p>
              ) : d.steps.ktp.canSubmit ? (
                <Link to="/verify/ktp" className="btn btn-sm btn-primary">
                  {d.steps.ktp.status === "REJECTED" ? "Unggah ulang KTP" : "Unggah KTP"}
                </Link>
              ) : null}
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}

export default function VerifyHubPage() {
  return (
    <Layout narrow>
      <div className="page-content-narrow">
        <ProtectedRoute><VerifyContent /></ProtectedRoute>
      </div>
    </Layout>
  );
}
