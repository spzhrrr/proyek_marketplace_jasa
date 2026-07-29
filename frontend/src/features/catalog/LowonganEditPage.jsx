import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
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
  const [form, setForm] = useState({
    judul_lowongan: "",
    deskripsi: "",
    category_id: "",
    gaji: "",
    batas_waktu: "",
  });

  useEffect(() => {
    Promise.all([api.categories(), api.lowonganShow(id)]).then(([cats, jobRes]) => {
      setRoots(cats.roots || []);
      setTree(cats.tree || {});
      const data = jobRes.data;
      if (!jobRes.meta?.is_owner) {
        nav(`/lowongan/${id}`);
        return;
      }
      if (data.status !== "OPEN") {
        nav(`/lowongan/${id}`);
        return;
      }
      const deadline = data.deadline ? String(data.deadline).slice(0, 10) : "";
      setForm({
        judul_lowongan: data.title || "",
        deskripsi: data.description || "",
        category_id: String(data.category_id || ""),
        gaji: String(data.budget || ""),
        batas_waktu: deadline,
      });
      const root = (cats.roots || []).find((r) => {
        const subs = cats.tree?.[r.url_code] || [];
        return subs.some((s) => String(s.id) === String(data.category_id));
      });
      if (root) setParentId(String(root.id));
      setLoading(false);
    }).catch(() => nav("/lowongan"));
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
    try {
      await api.lowonganUpdate(id, form);
      nav(`/lowongan/${id}`);
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="panel">
      <h1>Edit Lowongan</h1>
      <p className="muted">Perbarui detail pekerjaan yang kamu posting</p>
      {errors.map((e) => <Alert key={e}>{e}</Alert>)}
      <form onSubmit={submit} className="form">
        <label>Judul lowongan<input required value={form.judul_lowongan} onChange={(e) => setForm({ ...form, judul_lowongan: e.target.value })} /></label>
        <label>Deskripsi pekerjaan<textarea required rows={5} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} /></label>
        <label>
          Jenis
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
        <label>Anggaran (Rp)<input required value={form.gaji} onChange={(e) => setForm({ ...form, gaji: e.target.value })} /></label>
        <label>Deadline (opsional)<input type="date" value={form.batas_waktu} onChange={(e) => setForm({ ...form, batas_waktu: e.target.value })} /></label>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
          <Link to={`/lowongan/${id}`} className="btn">Batal</Link>
        </div>
      </form>
    </div>
  );
}

export default function LowonganEditPage() {
  return (
    <Layout narrow>
      <ProtectedRoute><EditForm /></ProtectedRoute>
    </Layout>
  );
}
