import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import BackLink from "../../components/BackLink.jsx";
import { api } from "../../services/api.js";
import { rupiah, jobStatusLabel } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { needsVerification } from "../../utils/verification.js";

export default function LowonganDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    api.lowonganShow(id).then((d) => {
      setData(d.data);
      setMeta(d.meta || {});
    });
  }, [id]);

  if (!data) return <Layout wide compact><Loading /></Layout>;

  const posterName = data.buyer_name || data.poster_name;
  const needsVerify = user && needsVerification(user);

  async function handleDelete() {
    if (!confirm("Hapus lowongan ini? Tindakan tidak bisa dibatalkan.")) return;
    setDeleteErr("");
    try {
      await api.lowonganDelete(id);
      nav("/lowongan");
    } catch (err) {
      setDeleteErr(err.message);
    }
  }

  return (
    <Layout wide compact>
      <BackLink to="/lowongan">← Kembali ke daftar lowongan</BackLink>
      <div className="panel detail-panel detail-panel-compact">
        <span className="badge">{data.category_name}</span>
        <h1>{data.title}</h1>
        <p className="price-lg">{rupiah(data.budget)}</p>
        <p className="muted detail-meta-compact">
          Pemberi kerja:{" "}
          <Link to={`/profile/${data.buyer_id}`} className="text-link">{posterName}</Link>
          {" · "}{jobStatusLabel(data.status)}
        </p>
        {data.deadline && <p className="muted detail-meta-compact">Deadline: {new Date(data.deadline).toLocaleDateString("id-ID")}</p>}
        <div className="detail-desc detail-desc-compact">{data.description}</div>

        {!meta.is_owner && data.status === "OPEN" && (
          <HelpBox title="Cara melamar">
            <ol style={{ margin: "6px 0 0", paddingLeft: "1.2rem" }}>
              <li>Kirim penawaran harga & surat pengantar</li>
              <li>Tunggu pemberi kerja terima atau tolak</li>
              <li>Jika diterima, pemberi kerja bayar — uang ditahan aman</li>
              <li>Kerjakan pekerjaan → kirim bukti → selesai</li>
            </ol>
          </HelpBox>
        )}

        {meta.is_owner && (
          <Alert type="warn">Ini lowongan milik kamu. Pengguna lain yang bisa melamar.</Alert>
        )}
        {deleteErr && <Alert>{deleteErr}</Alert>}
        {meta.has_applied && !meta.is_owner && (
          <Alert type="success">Kamu sudah melamar lowongan ini. Cek statusnya di Beranda Saya.</Alert>
        )}
        {!meta.is_owner && needsVerify && data.status === "OPEN" && !meta.has_applied && (
          <Alert type="warn">Verifikasi akun (email, HP, KTP) diperlukan sebelum melamar.</Alert>
        )}
        {!user && data.status === "OPEN" && (
          <Alert type="warn">Masuk atau daftar dulu untuk melamar pekerjaan ini.</Alert>
        )}

        <div className="btn-row detail-actions-compact">
          {meta.is_owner ? (
            <>
              <Link to="/dashboard#lamaran-masuk" className="btn btn-primary">Lihat Lamaran Masuk</Link>
              {data.status === "OPEN" && (
                <>
                  <Link to={`/lowongan/${id}/edit`} className="btn">Edit Lowongan</Link>
                  <button type="button" className="btn" onClick={handleDelete}>Hapus Lowongan</button>
                </>
              )}
            </>
          ) : data.status === "OPEN" && meta.can_apply ? (
            <Link to={`/lowongan/${id}/lamar`} className="btn btn-primary">Lamar Pekerjaan</Link>
          ) : meta.has_applied ? (
            <Link to="/dashboard" className="btn btn-primary">Ke Beranda Saya</Link>
          ) : needsVerify && data.status === "OPEN" ? (
            <Link to="/verify" className="btn btn-primary">Verifikasi Dulu</Link>
          ) : !user && data.status === "OPEN" ? (
            <Link to="/login" className="btn btn-primary">Masuk untuk Melamar</Link>
          ) : data.status !== "OPEN" ? (
            <span className="btn" style={{ opacity: 0.6 }}>Lowongan sudah ditutup</span>
          ) : null}
          {!meta.is_owner && (
            <Link to={`/lowongan/${id}/chat`} className="btn">Chat</Link>
          )}
        </div>
      </div>
    </Layout>
  );
}
