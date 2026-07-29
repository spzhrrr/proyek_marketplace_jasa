import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import HelpBox from "../../components/HelpBox.jsx";
import { api } from "../../services/api.js";

export default function HomePage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.home().then(setStats);
  }, []);

  if (!stats) return <Layout><Loading /></Layout>;

  return (
    <Layout>
      <section className="hero">
        <h1>Temukan Jasa & Peluang Kerja</h1>
        <p>
          Platform untuk menyewa jasa profesional atau memposting pekerjaan freelance.
          Uang kamu aman — baru cair ke penjual setelah pekerjaan kamu setujui.
        </p>
        <div className="hero-actions">
          <Link to="/jasa" className="btn btn-primary">Cari Jasa</Link>
          <Link to="/lowongan" className="btn">Cari Kerja</Link>
        </div>
      </section>

      <HelpBox title="Cara kerja singkat">
        <ul>
          <li><strong>Beli jasa:</strong> Pilih jasa → kirim pesanan → tunggu penjual setuju → bayar → terima hasil → setujui.</li>
          <li><strong>Cari kerja:</strong> Pilih lowongan → kirim lamaran → jika diterima → pemberi kerja bayar → kerjakan → kirim bukti.</li>
          <li><strong>Jual jasa:</strong> Daftar → lengkapi profil & verifikasi → post jasa → terima pesanan → kerjakan → terima bayaran.</li>
        </ul>
      </HelpBox>

      <div className="stat-row">
        <div className="stat-box">
          <strong>{stats.totalJasa}</strong>
          <span>Jasa siap dipesan</span>
        </div>
        <div className="stat-box">
          <strong>{stats.totalLowongan}</strong>
          <span>Lowongan terbuka</span>
        </div>
      </div>

      <div className="how-it-works">
        <div className="how-card">
          <strong>1. Daftar & lengkapi profil</strong>
          <p>Isi biodata dan foto profil agar akun dipercaya pengguna lain.</p>
        </div>
        <div className="how-card">
          <strong>2. Verifikasi akun</strong>
          <p>Email, HP, dan KTP — wajib sebelum transaksi. Rekening bank untuk yang ingin jual jasa.</p>
        </div>
        <div className="how-card">
          <strong>3. Transaksi aman</strong>
          <p>Pembayaran ditahan sistem sampai pembeli puas dengan hasil pekerjaan.</p>
        </div>
      </div>
    </Layout>
  );
}
