import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { todayInputDate } from "../../utils/format.js";

function formatRupiahInput(val) {
  if (!val) return "";
  const raw = String(val).replace(/\D/g, "");
  if (!raw) return "";
  return "Rp " + Number(raw).toLocaleString("id-ID");
}

function parseRawPrice(val) {
  if (!val) return "";
  return String(val).replace(/\D/g, "");
}

const BUDGET_PRESETS = ["250000", "500000", "1000000", "2500000"];

const POPULAR_SKILLS = [
  "Bersih Rumah", "Perbaikan AC", "Pindahan Rumah", "Pertukangan Kayu",
  "Cuci Mobil & Motor", "Kelistrikan", "Jasa Masak & Catering",
  "Logo Design", "UI/UX Figma", "Content Writer", "Photo & Video Editing",
  "Mobile App", "Digital Marketing", "Web Development",
];

function EditForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [roots, setRoots] = useState([]);
  const [tree, setTree] = useState({});
  const [parentId, setParentId] = useState("");
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [form, setForm] = useState({
    judul_lowongan: "",
    deskripsi: "",
    category_id: "",
    gaji: "",
    batas_waktu: "",
    is_urgent: false,
  });

  useEffect(() => {
    Promise.all([api.categories(), api.lowonganShow(id)]).then(([cats, jobRes]) => {
      setRoots(cats.roots || []);
      setTree(cats.tree || {});
      const data = jobRes.data;
      if (!jobRes.meta?.is_owner || data.status !== "OPEN") {
        nav(`/lowongan/${id}`);
        return;
      }
      if (jobRes.meta?.can_edit === false) {
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
        is_urgent: Boolean(Number(data.is_urgent)),
      });
      const incomingSkills = Array.isArray(data.skills) ? data.skills : [];
      setSelectedSkills(incomingSkills.filter((s) => POPULAR_SKILLS.includes(s)).concat(
        incomingSkills.filter((s) => !POPULAR_SKILLS.includes(s)),
      ).slice(0, 5));
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

  function toggleSkill(skill) {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else if (selectedSkills.length < 5) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErrors([]);
    try {
      await api.lowonganUpdate(id, { ...form, skills: selectedSkills });
      nav(`/lowongan/${id}`);
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="post-form-compact-container">
      <div className="compact-form-header">
        <Link to={`/lowongan/${id}`} className="back-link-sm">← Kembali ke detail lowongan</Link>
        <h1 className="catalog-display">
          <span className="catalog-display-kicker">Edit</span>
          <span className="catalog-display-word">Lowongan</span>
        </h1>
        <p className="mockup-hero-sub">
          Perbarui ruang lingkup, anggaran, dan kualifikasi sebelum ada pelamar.
        </p>
      </div>

      {errors.map((e) => <Alert key={e}>{e}</Alert>)}

      <form onSubmit={submit} className="post-form-grid-layout">
        <div className="form-column-card">
          <h3 className="column-section-title">Detail lowongan</h3>

          <div className="form-group-sm">
            <label className="form-label-bold">Judul lowongan <span className="text-danger">*</span></label>
            <input
              required
              className="form-input-compact"
              value={form.judul_lowongan}
              onChange={(e) => setForm({ ...form, judul_lowongan: e.target.value })}
              placeholder="Contoh: Butuh desainer UI/UX untuk aplikasi mobile"
              maxLength={100}
            />
          </div>

          <div className="form-group-sm form-row-2">
            <div>
              <label className="form-label-bold">Jenis pekerjaan <span className="text-danger">*</span></label>
              <select
                required
                className="form-input-compact"
                value={parentId}
                onChange={(e) => { setParentId(e.target.value); setForm({ ...form, category_id: "" }); }}
              >
                <option value="">Pilih jenis</option>
                {roots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label-bold">Sub kategori <span className="text-danger">*</span></label>
              <select
                required
                className="form-input-compact"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Pilih sub</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group-sm">
            <label className="form-label-bold">Scope & ekspektasi <span className="text-danger">*</span></label>
            <textarea
              required
              rows={4}
              className="form-input-compact"
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Jelaskan ruang lingkup, jumlah deliverable, dan kualifikasi pelamar."
            />
          </div>

          <div className="form-group-sm" style={{ marginBottom: 0 }}>
            <label className="form-label-bold">
              Skill / kualifikasi
              <span style={{ fontWeight: 500, color: "#94a3b8" }}> · maks 5</span>
            </label>
            <div className="skill-pills-wrap">
              {POPULAR_SKILLS.map((sk) => (
                <button
                  key={sk}
                  type="button"
                  className={`skill-pill-btn ${selectedSkills.includes(sk) ? "active" : ""}`}
                  onClick={() => toggleSkill(sk)}
                >
                  {sk}
                </button>
              ))}
              {selectedSkills.filter((s) => !POPULAR_SKILLS.includes(s)).map((sk) => (
                <button
                  key={sk}
                  type="button"
                  className="skill-pill-btn active"
                  onClick={() => toggleSkill(sk)}
                >
                  {sk}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-column-card">
          <h3 className="column-section-title">Anggaran & tenggat</h3>

          <div className="form-group-sm">
            <label className="form-label-bold">Anggaran proyek <span className="text-danger">*</span></label>
            <input
              required
              type="text"
              className="form-input-compact price-input-highlight"
              value={formatRupiahInput(form.gaji)}
              onChange={(e) => setForm({ ...form, gaji: parseRawPrice(e.target.value) })}
              placeholder="Rp 500.000"
            />
          </div>

          <div className="budget-preset-row">
            <span className="preset-label">Preset</span>
            {BUDGET_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`budget-preset-pill ${form.gaji === amt ? "is-on" : ""}`}
                onClick={() => setForm({ ...form, gaji: amt })}
              >
                {Number(amt).toLocaleString("id-ID")}
              </button>
            ))}
          </div>

          <label className={`urgent-check ${form.is_urgent ? "is-on" : ""}`}>
            <input
              type="checkbox"
              checked={!!form.is_urgent}
              onChange={(e) => {
                const on = e.target.checked;
                setForm({
                  ...form,
                  is_urgent: on,
                  batas_waktu: on ? todayInputDate() : form.batas_waktu,
                });
              }}
            />
            <span>
              <strong>Urgent — butuh dikerjakan hari ini</strong>
              Lowongan ditutup malam ini. Pelamar hanya bisa menawar pengerjaan 1 hari.
            </span>
          </label>

          <div className="form-group-sm">
            <label className="form-label-bold">Batas akhir lamaran</label>
            <input
              type="date"
              className="form-input-compact"
              min={todayInputDate()}
              disabled={!!form.is_urgent}
              value={form.is_urgent ? todayInputDate() : form.batas_waktu}
              onChange={(e) => setForm({ ...form, batas_waktu: e.target.value, is_urgent: false })}
            />
            <span className="hint">Kosongkan jika tetap buka sampai kamu tutup dari beranda.</span>
          </div>

          <div className="post-hint">
            <strong>Catatan</strong>
            Setelah ada pelamar, judul dan anggaran dikunci agar penawaran tetap adil.
          </div>

          <div className="form-action-card-footer">
            <button type="submit" className="btn btn-primary btn-block btn-lg">
              Simpan perubahan
            </button>
            <Link to={`/lowongan/${id}`} className="form-cancel-link">Batal</Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function LowonganEditPage() {
  return (
    <Layout wide compact bgClass="app-kerja-bg">
      <ProtectedRoute requireKtp><EditForm /></ProtectedRoute>
    </Layout>
  );
}
