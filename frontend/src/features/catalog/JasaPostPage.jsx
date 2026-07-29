import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";

function PostForm() {
  const nav = useNavigate();
  const [roots, setRoots] = useState([]);
  const [tree, setTree] = useState({});
  const [parentId, setParentId] = useState("");
  const [errors, setErrors] = useState([]);
  const [form, setForm] = useState({
    judul_jasa: "",
    deskripsi: "",
    category_id: "",
    harga: "",
    estimasi_hari: "3",
  });
  const [cover, setCover] = useState(null);
  const [portfolio, setPortfolio] = useState(null);

  useEffect(() => {
    api.categories().then((d) => {
      setRoots(d.roots || []);
      setTree(d.tree || {});
    });
  }, []);

  const subs = parentId && tree
    ? (() => {
        const root = roots.find((r) => String(r.id) === parentId);
        return root ? tree[root.url_code] || [] : [];
      })()
    : [];

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (cover) fd.append("cover_image", cover);
    if (portfolio) fd.append("portfolio_file", portfolio);
    try {
      await api.jasaCreate(fd);
      nav("/jasa");
    } catch (err) {
      if (err.need === "bank") nav("/verify/bank");
      else if (err.need === "ktp" || err.need === "contact") nav("/verify");
      else setErrors(err.errors?.length ? err.errors : [err.message]);
    }
  }

  return (
    <PagePanel
      title="Post Jasa Baru"
      subtitle="Lengkapi detail jasa yang ingin kamu tawarkan"
      backTo="/jasa"
      backLabel="← Kembali ke daftar jasa"
    >
      {errors.map((e) => <Alert key={e}>{e}</Alert>)}
      <form onSubmit={submit} className="form">
        <label>Judul jasa<input required value={form.judul_jasa} onChange={(e) => setForm({ ...form, judul_jasa: e.target.value })} placeholder="Contoh: Desain logo profesional" /></label>
        <label>Deskripsi<textarea required rows={5} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Jelaskan apa yang pembeli dapatkan..." /></label>
        <label>
          Jenis jasa
          <select required value={parentId} onChange={(e) => { setParentId(e.target.value); setForm({ ...form, category_id: "" }); }}>
            <option value="">Pilih jenis</option>
            {roots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>
          Sub kategori
          <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Pilih sub</option>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label>Harga (Rp)<input required value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })} placeholder="150000" /></label>
          <label>Estimasi (hari)<input type="number" min="1" required value={form.estimasi_hari} onChange={(e) => setForm({ ...form, estimasi_hari: e.target.value })} /></label>
        </div>
        <label>Foto cover<input type="file" accept="image/*" required onChange={(e) => setCover(e.target.files[0])} /></label>
        <label>Portfolio (opsional)<input type="file" onChange={(e) => setPortfolio(e.target.files[0])} /></label>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary">Publish Jasa</button>
          <Link to="/jasa" className="btn">Batal</Link>
        </div>
      </form>
    </PagePanel>
  );
}

export default function JasaPostPage() {
  return (
    <Layout narrow>
      <div className="page-content-form">
        <ProtectedRoute><PostForm /></ProtectedRoute>
      </div>
    </Layout>
  );
}
