import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import PagePanel from "../../components/PagePanel.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";

function EditForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [roots, setRoots] = useState([]);
  const [tree, setTree] = useState({});
  const [parentId, setParentId] = useState("");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [existingCover, setExistingCover] = useState("");
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
    Promise.all([api.categories(), api.jasaShow(id)]).then(([cats, jasaRes]) => {
      setRoots(cats.roots || []);
      setTree(cats.tree || {});
      const data = jasaRes.data;
      if (!jasaRes.meta?.is_owner) {
        nav(`/jasa/${id}`);
        return;
      }
      setForm({
        judul_jasa: data.title || "",
        deskripsi: data.description || "",
        category_id: String(data.category_id || ""),
        harga: String(data.price || ""),
        estimasi_hari: String(data.delivery_days || "3"),
      });
      setExistingCover(data.cover_image_url || "");
      const root = (cats.roots || []).find((r) => {
        const subs = cats.tree?.[r.url_code] || [];
        return subs.some((s) => String(s.id) === String(data.category_id));
      });
      if (root) setParentId(String(root.id));
      setLoading(false);
    }).catch(() => nav("/jasa"));
  }, [id, nav]);

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
      await api.jasaUpdate(id, fd);
      nav(`/jasa/${id}`);
    } catch (err) {
      if (err.need === "bank") nav("/verify/bank");
      else if (err.need === "ktp" || err.need === "contact") nav("/verify");
      else setErrors(err.errors?.length ? err.errors : [err.message]);
    }
  }

  if (loading) return <Loading />;

  return (
    <PagePanel
      title="Edit Jasa"
      subtitle="Perbarui detail jasa yang kamu posting"
      backTo={`/jasa/${id}`}
      backLabel="← Kembali ke detail jasa"
    >
      {errors.map((e) => <Alert key={e}>{e}</Alert>)}
      <form onSubmit={submit} className="form">
        <label>Judul jasa<input required value={form.judul_jasa} onChange={(e) => setForm({ ...form, judul_jasa: e.target.value })} /></label>
        <label>Deskripsi<textarea required rows={5} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /></label>
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
        <label>Harga (Rp)<input required value={form.harga} onChange={(e) => setForm({ ...form, harga: e.target.value })} /></label>
        <label>Estimasi hari<input type="number" min="1" required value={form.estimasi_hari} onChange={(e) => setForm({ ...form, estimasi_hari: e.target.value })} /></label>
        <label>
          Foto cover
          {existingCover && !cover && (
            <img src={existingCover} alt="" style={{ display: "block", maxHeight: 120, marginTop: 8, borderRadius: 8 }} />
          )}
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files[0])} />
          <span className="hint">Kosongkan jika tidak ingin mengganti cover</span>
        </label>
        <label>Portfolio (opsional)<input type="file" onChange={(e) => setPortfolio(e.target.files[0])} /></label>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
          <Link to={`/jasa/${id}`} className="btn">Batal</Link>
        </div>
      </form>
    </PagePanel>
  );
}

export default function JasaEditPage() {
  return (
    <Layout narrow>
      <div className="page-content-form">
        <ProtectedRoute><EditForm /></ProtectedRoute>
      </div>
    </Layout>
  );
}
