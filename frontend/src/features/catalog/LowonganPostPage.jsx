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
    judul_lowongan: "",
    deskripsi: "",
    category_id: "",
    gaji: "",
    batas_waktu: "",
  });

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
    try {
      await api.lowonganCreate(form);
      nav("/lowongan");
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    }
  }

  return (
    <PagePanel
      title="Post Lowongan Kerja"
      subtitle="Deskripsikan pekerjaan yang kamu butuhkan"
      backTo="/lowongan"
      backLabel="← Kembali ke daftar lowongan"
    >
      {errors.map((e) => <Alert key={e}>{e}</Alert>)}
      <form onSubmit={submit} className="form">
        <label>Judul lowongan<input required value={form.judul_lowongan} onChange={(e) => setForm({ ...form, judul_lowongan: e.target.value })} placeholder="Contoh: Butuh desainer logo startup" /></label>
        <label>Deskripsi pekerjaan<textarea required rows={5} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Jelaskan scope, deliverable, dan ekspektasi..." /></label>
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
        <div className="form-row">
          <label>Anggaran (Rp)<input required value={form.gaji} onChange={(e) => setForm({ ...form, gaji: e.target.value })} placeholder="500000" /></label>
          <label>Deadline<input type="date" value={form.batas_waktu} onChange={(e) => setForm({ ...form, batas_waktu: e.target.value })} /></label>
        </div>
        <div className="btn-row">
          <button type="submit" className="btn btn-primary">Publish Lowongan</button>
          <Link to="/lowongan" className="btn">Batal</Link>
        </div>
      </form>
    </PagePanel>
  );
}

export default function LowonganPostPage() {
  return (
    <Layout narrow>
      <div className="page-content-form">
        <ProtectedRoute><PostForm /></ProtectedRoute>
      </div>
    </Layout>
  );
}
