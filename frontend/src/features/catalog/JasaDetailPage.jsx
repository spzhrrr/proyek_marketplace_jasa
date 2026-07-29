import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import BackLink from "../../components/BackLink.jsx";
import { api } from "../../services/api.js";
import { rupiah } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { needsVerification } from "../../utils/verification.js";

export default function JasaDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [deleteErr, setDeleteErr] = useState("");

  useEffect(() => {
    api.jasaShow(id).then((d) => {
      setData(d.data);
      setMeta(d.meta || {});
    });
  }, [id]);

  if (!data) return <Layout wide compact><Loading /></Layout>;

  const needsVerify = user && needsVerification(user);
  const fee = Math.round(data.price * 0.05);
  const total = data.price + fee;

  async function handleDelete() {
    if (!confirm("Hapus jasa ini? Tindakan tidak bisa dibatalkan.")) return;
    setDeleteErr("");
    try {
      await api.jasaDelete(id);
      nav("/jasa");
    } catch (err) {
      setDeleteErr(err.message);
    }
  }

  return (
    <Layout wide compact>
      <BackLink to="/jasa">← Kembali ke daftar jasa</BackLink>
      <div className="panel detail-panel detail-panel-compact">
        <div className="detail-compact-grid">
          {data.cover_image_url && (
            <div className="detail-compact-media">
              <img src={data.cover_image_url} alt="" className="detail-img detail-img-compact" />
            </div>
          )}
          <div className="detail-compact-main">
            <span className="badge">{data.category_name}</span>
            <h1>{data.title}</h1>
            <p className="price-lg">{rupiah(data.price)}</p>
            <p className="muted detail-meta-compact">
              Penyedia:{" "}
              <Link to={`/profile/${data.seller_id}`} className="text-link">{data.seller_name}</Link>
              {" · "}Estimasi {data.delivery_days} hari
            </p>
            {!meta.is_owner && (
              <p className="hint">Perkiraan total bayar: {rupiah(total)} (termasuk biaya layanan 5%)</p>
            )}
          </div>
        </div>
        <div className="detail-desc detail-desc-compact">{data.description}</div>

        {!meta.is_owner && (
          <HelpBox title="Cara pesan jasa ini">
            <ol style={{ margin: "6px 0 0", paddingLeft: "1.2rem" }}>
              <li>Klik Pesan → tulis catatan kebutuhan kamu</li>
              <li>Tunggu penjual terima (maks. 1×24 jam)</li>
              <li>Bayar — uang ditahan aman sampai pekerjaan selesai</li>
              <li>Terima hasil → setujui → transaksi selesai</li>
            </ol>
          </HelpBox>
        )}

        {meta.is_owner && (
          <Alert type="warn">Ini jasa milik kamu. Pengguna lain yang bisa menyewa.</Alert>
        )}
        {deleteErr && <Alert>{deleteErr}</Alert>}
        {!meta.is_owner && needsVerify && (
          <Alert type="warn">Verifikasi akun (email, HP, KTP) diperlukan sebelum menyewa jasa.</Alert>
        )}
        {!user && (
          <Alert type="warn">Masuk atau daftar dulu untuk memesan jasa ini.</Alert>
        )}
        {!meta.is_owner && meta.has_active_request && (
          <Alert type="success">Kamu punya pesanan aktif untuk jasa ini.</Alert>
        )}

        <div className="btn-row detail-actions-compact">
          {meta.is_owner ? (
            <>
              <Link to={`/jasa/${id}/edit`} className="btn btn-primary">Edit Jasa</Link>
              <button type="button" className="btn" onClick={handleDelete}>Hapus Jasa</button>
            </>
          ) : meta.has_active_request ? (
            <Link to={`/orders/${meta.active_order_id}`} className="btn btn-primary">Lihat Pesanan</Link>
          ) : meta.can_rent ? (
            <Link to={`/jasa/${id}/sewa`} className="btn btn-primary">Pesan Sekarang</Link>
          ) : needsVerify ? (
            <Link to="/verify" className="btn btn-primary">Verifikasi Dulu</Link>
          ) : !user ? (
            <Link to="/login" className="btn btn-primary">Masuk untuk Pesan</Link>
          ) : (
            <span className="btn" style={{ opacity: 0.6 }} title="Jasa sedang tidak bisa dipesan">Tidak tersedia</span>
          )}
          {!meta.is_owner && (
            <Link to={`/jasa/${id}/chat`} className="btn">Chat</Link>
          )}
        </div>
      </div>
    </Layout>
  );
}
