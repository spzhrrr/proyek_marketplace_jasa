import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { withJasaSkills } from "../../utils/format.js";

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

const PRICE_PRESETS = ["100000", "150000", "250000", "500000"];

const POPULAR_SKILLS = [
  "Bersih Rumah", "Perbaikan AC", "Pindahan Rumah", "Pertukangan Kayu",
  "Cuci Mobil & Motor", "Kelistrikan", "Jasa Masak & Catering",
  "Logo Design", "UI/UX Figma", "Content Writer", "Photo & Video Editing",
  "Mobile App", "Digital Marketing", "Web Development",
];

function PostForm() {
  const nav = useNavigate();
  const [roots, setRoots] = useState([]);
  const [tree, setTree] = useState({});
  const [parentId, setParentId] = useState("");
  const [errors, setErrors] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [form, setForm] = useState({
    judul_jasa: "",
    deskripsi: "",
    category_id: "",
    harga: "150000",
    estimasi_hari: "3",
  });
  const [covers, setCovers] = useState([]);
  const [coverPreviews, setCoverPreviews] = useState([]);
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

  function handleCoversChange(fileList) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    const combinedFiles = [...covers, ...incoming].slice(0, 10);
    setCovers(combinedFiles);

    const prevs = [];
    let loaded = 0;
    combinedFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        prevs[i] = reader.result;
        loaded++;
        if (loaded === combinedFiles.length) setCoverPreviews([...prevs]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeCover(index) {
    setCovers(covers.filter((_, i) => i !== index));
    setCoverPreviews(coverPreviews.filter((_, i) => i !== index));
  }

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
    if (covers.length === 0) {
      setErrors(["Foto cover jasa wajib diupload minimal 1 foto (maks 10 foto)"]);
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      fd.append(k, k === "deskripsi" ? withJasaSkills(v, selectedSkills) : v);
    });
    selectedSkills.forEach((s) => fd.append("skills", s));
    covers.forEach((f) => fd.append("cover_image", f));
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
    <div className="post-form-compact-container">
      <div className="compact-form-header">
        <Link to="/jasa" className="back-link-sm">← Kembali ke Cari Jasa</Link>
        <h1 className="catalog-display">
          <span className="catalog-display-kicker">Post</span>
          <span className="catalog-display-word">Jasa</span>
        </h1>
        <p className="mockup-hero-sub">
          Tawarkan keahlian terbaikmu kepada ribuan calon pembeli terverifikasi.
        </p>
      </div>

      {errors.map((e) => <Alert key={e}>{e}</Alert>)}

      <form onSubmit={submit} className="post-form-grid-layout">
        <div className="form-column-card">
          <h3 className="column-section-title">Informasi utama</h3>

          <div className="form-group-sm">
            <label className="form-label-bold">Judul jasa <span className="text-danger">*</span></label>
            <input
              required
              className="form-input-compact"
              value={form.judul_jasa}
              onChange={(e) => setForm({ ...form, judul_jasa: e.target.value })}
              placeholder="Contoh: Desain logo modern & vector art profesional"
              maxLength={100}
            />
          </div>

          <div className="form-group-sm form-row-2">
            <div>
              <label className="form-label-bold">Jenis jasa <span className="text-danger">*</span></label>
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
            <label className="form-label-bold">Deskripsi penawaran <span className="text-danger">*</span></label>
            <textarea
              required
              rows={3}
              className="form-input-compact"
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Jelaskan yang pembeli dapatkan, garansi revisi, dan keunggulan jasa kamu."
            />
          </div>

          <div className="form-group-sm" style={{ marginBottom: 0 }}>
            <label className="form-label-bold">
              Tag keahlian / tools
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
            </div>
          </div>
        </div>

        <div className="form-column-card">
          <h3 className="column-section-title">Harga & galeri</h3>

          <div className="form-group-sm form-row-2">
            <div>
              <label className="form-label-bold">Harga paket <span className="text-danger">*</span></label>
              <input
                required
                type="text"
                className="form-input-compact price-input-highlight"
                value={formatRupiahInput(form.harga)}
                onChange={(e) => setForm({ ...form, harga: parseRawPrice(e.target.value) })}
                placeholder="Rp 150.000"
              />
            </div>
            <div>
              <label className="form-label-bold">Pengerjaan (hari) <span className="text-danger">*</span></label>
              <input
                type="number"
                min="1"
                required
                className="form-input-compact"
                value={form.estimasi_hari}
                onChange={(e) => setForm({ ...form, estimasi_hari: e.target.value })}
              />
            </div>
          </div>

          <div className="budget-preset-row">
            <span className="preset-label">Preset</span>
            {PRICE_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`budget-preset-pill ${form.harga === amt ? "is-on" : ""}`}
                onClick={() => setForm({ ...form, harga: amt })}
              >
                {Number(amt).toLocaleString("id-ID")}
              </button>
            ))}
          </div>

          <div className="post-hint">
            <strong>Panduan foto cover</strong>
            <ul>
              <li>Jasa digital: mockup atau screenshot karya terbaik.</li>
              <li>Jasa fisik: foto pengerjaan nyata, alat kerja, atau before & after.</li>
            </ul>
          </div>

          <div className="form-group-sm">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="form-label-bold" style={{ marginBottom: 0 }}>
                Foto cover ({covers.length}/10) <span className="text-danger">*</span>
              </label>
              {covers.length < 10 && (
                <label htmlFor="multi-cover-input" className="btn btn-sm post-chip-action">
                  Tambah foto
                </label>
              )}
            </div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/jpg,image/webp"
              id="multi-cover-input"
              style={{ display: "none" }}
              onChange={(e) => {
                handleCoversChange(e.target.files);
                e.target.value = "";
              }}
            />

            {coverPreviews.length > 0 ? (
              <div className="cover-grid">
                {coverPreviews.map((src, idx) => (
                  <div key={idx} className={`cover-thumb ${idx === 0 ? "is-main" : ""}`}>
                    <img src={src} alt="" />
                    {idx === 0 && <span className="cover-thumb-badge">UTAMA</span>}
                    <button type="button" className="cover-thumb-x" onClick={() => removeCover(idx)} title="Hapus foto">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <label htmlFor="multi-cover-input" className="file-upload-dropzone">
                <strong>Upload 1–10 foto cover</strong>
                <span>JPG, PNG, atau WebP. Foto pertama jadi cover utama.</span>
              </label>
            )}
          </div>

          <div className="form-group-sm">
            <label className="form-label-bold">Portofolio (opsional)</label>
            <div className="file-picker">
              <input
                id="portfolio-input"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setPortfolio(e.target.files[0] || null)}
              />
              <label htmlFor="portfolio-input" className="btn btn-sm post-chip-action">
                Pilih file
              </label>
              <span className="file-picker-name">
                {portfolio ? portfolio.name : "PDF, JPG, atau PNG · maks 5MB"}
              </span>
            </div>
          </div>

          <div className="form-action-card-footer">
            <button type="submit" className="btn btn-primary btn-block btn-lg">
              Publish jasa
            </button>
            <Link to="/jasa" className="form-cancel-link">Batal</Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function JasaPostPage() {
  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <ProtectedRoute requireSeller><PostForm /></ProtectedRoute>
    </Layout>
  );
}
