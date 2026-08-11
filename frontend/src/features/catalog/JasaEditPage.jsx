import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Alert from "../../components/Alert.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { parseJasaSkills, stripJasaSkills, withJasaSkills } from "../../utils/format.js";

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
    judul_jasa: "",
    deskripsi: "",
    category_id: "",
    harga: "150000",
    estimasi_hari: "3",
  });

  // Covers can contain strings (existing URLs) or File objects (newly uploaded)
  const [covers, setCovers] = useState([]);
  const [coverPreviews, setCoverPreviews] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [existingPortfolioUrl, setExistingPortfolioUrl] = useState("");

  const popularSkills = [
    "🧹 Bersih Rumah", "🔧 Perbaikan AC", "🚚 Pindahan Rumah", "🛠️ Pertukangan Kayu",
    "🚗 Cuci Mobil & Motor", "🔌 Kelistrikan", "👨‍🍳 Jasa Masak & Catering",
    "💻 Logo Design", "🎨 UI/UX Figma", "✍️ Content Writer", "📷 Photo & Video Editing",
    "📱 Mobile App", "📈 Digital Marketing", "🌐 Web Development"
  ];

  function parseCoverUrls(urlStr) {
    if (!urlStr) return [];
    if (urlStr.includes("||")) return urlStr.split("||").filter(Boolean);
    if (urlStr.startsWith("[")) {
      try { return JSON.parse(urlStr); } catch (e) {}
    }
    return [urlStr];
  }

  useEffect(() => {
    Promise.all([api.categories(), api.jasaShow(id)])
      .then(([cats, jasaRes]) => {
        setRoots(cats.roots || []);
        setTree(cats.tree || {});
        const data = jasaRes.data;

        if (!jasaRes.meta?.is_owner) {
          nav(`/jasa/${id}`);
          return;
        }
        if (jasaRes.meta?.can_edit === false) {
          nav(`/jasa/${id}`);
          return;
        }

        const cleanDesc = stripJasaSkills(data.description);
        setSelectedSkills(parseJasaSkills(data.description, data.skills));

        setForm({
          judul_jasa: data.title || "",
          deskripsi: cleanDesc,
          category_id: String(data.category_id || ""),
          harga: String(data.price || "150000"),
          estimasi_hari: String(data.delivery_days || "3"),
        });

        const existingCoversList = parseCoverUrls(data.cover_image_url);
        setCovers(existingCoversList);
        setCoverPreviews(existingCoversList);
        setExistingPortfolioUrl(data.portfolio_file_url || "");

        const root = (cats.roots || []).find((r) => {
          const subs = cats.tree?.[r.url_code] || [];
          return subs.some((s) => String(s.id) === String(data.category_id));
        });
        if (root) setParentId(String(root.id));

        setLoading(false);
      })
      .catch(() => nav("/jasa"));
  }, [id, nav]);

  const subs = parentId && tree
    ? (() => {
        const root = roots.find((r) => String(r.id) === parentId);
        return root ? tree[root.url_code] || [] : [];
      })()
    : [];

  function handleCoversChange(fileList) {
    if (!fileList || fileList.length === 0) return;
    const incomingFiles = Array.from(fileList);
    const combinedCovers = [...covers, ...incomingFiles].slice(0, 10);
    setCovers(combinedCovers);

    const newPreviews = [...coverPreviews];
    let loaded = 0;
    incomingFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result);
        loaded++;
        if (loaded === incomingFiles.length) {
          setCoverPreviews([...newPreviews.slice(0, 10)]);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removeCover(index) {
    const nextCovers = covers.filter((_, i) => i !== index);
    const nextPrevs = coverPreviews.filter((_, i) => i !== index);
    setCovers(nextCovers);
    setCoverPreviews(nextPrevs);
  }

  function toggleSkill(skill) {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      if (selectedSkills.length < 5) {
        setSelectedSkills([...selectedSkills, skill]);
      }
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

    // Append existing URL strings and new File objects separately
    covers.forEach((item) => {
      if (typeof item === "string") {
        fd.append("existing_cover_images", item);
      } else if (item instanceof File) {
        fd.append("cover_image", item);
      }
    });

    if (portfolio) {
      fd.append("portfolio_file", portfolio);
    }

    try {
      await api.jasaUpdate(id, fd);
      nav(`/jasa/${id}`);
    } catch (err) {
      if (err.need === "bank") nav("/verify/bank");
      else if (err.need === "ktp" || err.need === "contact") nav("/verify");
      else setErrors(err.errors?.length ? err.errors : [err.message]);
    }
  }

  if (loading) return <Layout wide compact><Loading /></Layout>;

  return (
    <div className="post-form-compact-container" style={{ maxWidth: "1080px", margin: "0 auto", padding: "10px 16px" }}>
      <div className="compact-form-header" style={{ marginBottom: "14px" }}>
        <Link to={`/jasa/${id}`} className="back-link-sm">← Kembali ke Detail Jasa</Link>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.5rem", fontWeight: 900, color: "#0f172a" }}>✏️ Edit Informasi Jasa</h1>
        <p className="compact-header-sub" style={{ color: "#334155", fontWeight: 600, fontSize: "0.875rem", margin: "4px 0 0" }}>
          Perbarui informasi, harga, serta media penawaran jasa kamu
        </p>
      </div>

      {errors.map((e) => <Alert key={e}>{e}</Alert>)}

      <form onSubmit={submit} className="post-form-grid-layout" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "16px" }}>
        {/* Left Column: Essential Info */}
        <div className="form-column-card" style={{ padding: "16px 20px" }}>
          <h3 className="column-section-title" style={{ fontSize: "1rem", marginBottom: "12px" }}>📝 Informasi Utama Jasa</h3>

          <div className="form-group-sm" style={{ marginBottom: "10px" }}>
            <label className="form-label-bold">Judul Jasa <span className="text-danger">*</span></label>
            <input
              required
              className="form-input-compact"
              value={form.judul_jasa}
              onChange={(e) => setForm({ ...form, judul_jasa: e.target.value })}
              placeholder="Contoh: Desain Logo Modern & Vector Art Profesional"
              maxLength={100}
            />
          </div>

          <div className="form-group-sm" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
            <div>
              <label className="form-label-bold">Jenis Jasa <span className="text-danger">*</span></label>
              <select
                required
                className="form-input-compact"
                value={parentId}
                onChange={(e) => { setParentId(e.target.value); setForm({ ...form, category_id: "" }); }}
              >
                <option value="">Pilih Jenis...</option>
                {roots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label-bold">Sub Kategori <span className="text-danger">*</span></label>
              <select
                required
                className="form-input-compact"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">Pilih Sub...</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group-sm" style={{ marginBottom: "10px" }}>
            <label className="form-label-bold">Deskripsi Penawaran Jasa <span className="text-danger">*</span></label>
            <textarea
              required
              rows={3}
              className="form-input-compact"
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
              placeholder="Jelaskan apa yang pembeli dapatkan, garansi revisi, dan keunggulan jasa kamu..."
            />
          </div>

          {/* Skill Tags Section */}
          <div className="form-group-sm" style={{ marginBottom: "0" }}>
            <label className="form-label-bold">Tag Keahlian / Tools (Pilih maks 5)</label>
            <div className="skill-pills-wrap" style={{ maxHeight: "110px", overflowY: "auto", padding: "4px" }}>
              {popularSkills.map((sk) => (
                <button
                  key={sk}
                  type="button"
                  className={`skill-pill-btn ${selectedSkills.includes(sk) ? "active" : ""}`}
                  onClick={() => toggleSkill(sk)}
                  style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                >
                  {selectedSkills.includes(sk) ? "✓ " : "+ "}{sk}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, Multi Cover Gallery & Guidance */}
        <div className="form-column-card" style={{ padding: "16px 20px" }}>
          <h3 className="column-section-title" style={{ fontSize: "1rem", marginBottom: "12px" }}>💰 Harga & Galeri Cover (1-10 Foto)</h3>

          <div className="form-group-sm" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginBottom: "8px" }}>
            <div>
              <label className="form-label-bold">Harga Paket (Rp) <span className="text-danger">*</span></label>
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
              <label className="form-label-bold">Pengerjaan (Hari) <span className="text-danger">*</span></label>
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

          {/* Quick Budget Pills */}
          <div className="budget-preset-row" style={{ marginBottom: "10px" }}>
            <span className="preset-label" style={{ fontSize: "0.75rem" }}>Quick Preset:</span>
            {["100000", "150000", "250000", "500000"].map((amt) => (
              <button
                key={amt}
                type="button"
                className="budget-preset-pill"
                onClick={() => setForm({ ...form, harga: amt })}
                style={{ fontSize: "0.75rem", padding: "2px 8px" }}
              >
                {Number(amt).toLocaleString("id-ID")}
              </button>
            ))}
          </div>

          {/* Seller Photo Guidance Box */}
          <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", padding: "8px 12px", borderRadius: "10px", marginBottom: "10px", fontSize: "0.775rem", color: "#0369a1" }}>
            <strong style={{ display: "block", marginBottom: "3px" }}>💡 Panduan Foto Cover Jasa (Bisa 1 Sampai 10 Foto):</strong>
            <ul style={{ margin: 0, paddingLeft: "14px", lineHeight: 1.35 }}>
              <li><strong>Jasa Digital:</strong> Mockup / screenshot hasil karya terbaik (Past Works).</li>
              <li><strong>Jasa Fisik:</strong> Foto pengerjaan nyata, seragam/alat kerja, atau contoh Before & After.</li>
            </ul>
          </div>

          {/* Multi-Image Upload Dropzone & Grid Gallery */}
          <div className="form-group-sm" style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <label className="form-label-bold">Foto Cover & Slide Galeri ({covers.length}/10 Foto) <span className="text-danger">*</span></label>
              {covers.length < 10 && (
                <label htmlFor="multi-cover-input-edit" className="btn btn-sm btn-primary" style={{ padding: "2px 8px", fontSize: "0.75rem", cursor: "pointer" }}>
                  + Tambah Foto
                </label>
              )}
            </div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/jpg,image/webp"
              id="multi-cover-input-edit"
              style={{ display: "none" }}
              onChange={(e) => handleCoversChange(e.target.files)}
            />

            {coverPreviews.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", background: "#f8fafc", padding: "8px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                {coverPreviews.map((src, idx) => (
                  <div key={idx} style={{ position: "relative", width: "100%", height: "60px", borderRadius: "8px", overflow: "hidden", border: idx === 0 ? "2px solid #0284c7" : "1.5px solid #e2e8f0" }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    {idx === 0 && (
                      <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(2,132,199,0.9)", color: "#fff", fontSize: "0.6rem", fontWeight: 800, textAlign: "center", padding: "1px 0" }}>UTAMA</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCover(idx)}
                      style={{ position: "absolute", top: "2px", right: "2px", width: "18px", height: "18px", borderRadius: "50%", background: "#ef4444", color: "#fff", border: "none", fontSize: "0.7rem", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Hapus foto ini"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <label htmlFor="multi-cover-input-edit" className="file-upload-dropzone" style={{ height: "70px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px dashed #0284c7", borderRadius: "10px", background: "#f0f9ff" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0284c7" }}>📷 Upload 1-10 Foto Cover Jasa</span>
                <span style={{ fontSize: "0.725rem", color: "#0369a1" }}>Klik untuk memilih foto dari galeri Anda</span>
              </label>
            )}
          </div>

          {/* Portfolio File Attachment Upload */}
          <div className="form-group-sm" style={{ marginBottom: "12px" }}>
            <label className="form-label-bold">File Dokumen/Portofolio (Opsional PDF/Gambar)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="form-input-compact"
              onChange={(e) => setPortfolio(e.target.files[0])}
            />
            {existingPortfolioUrl && !portfolio && (
              <span className="hint" style={{ fontSize: "0.725rem", color: "#166534", display: "block", marginTop: "2px" }}>
                ✓ Ada file portofolio tersimpan. Unggah baru jika ingin mengganti.
              </span>
            )}
            <span className="hint" style={{ fontSize: "0.725rem", color: "#64748b" }}>Format didukung: PDF, JPG, atau PNG (Maks 5MB)</span>
          </div>

          {/* Submit Action Group */}
          <div className="form-action-card-footer" style={{ marginTop: "10px" }}>
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ padding: "10px 16px", fontSize: "0.95rem" }}>
              💾 Simpan Perubahan Jasa
            </button>
            <Link to={`/jasa/${id}`} className="btn btn-block btn-sm" style={{ marginTop: "6px", textAlign: "center" }}>Batal</Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function JasaEditPage() {
  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <ProtectedRoute><EditForm /></ProtectedRoute>
    </Layout>
  );
}
