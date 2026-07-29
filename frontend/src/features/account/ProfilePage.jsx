import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { rupiah, applicationStatusLabel, jobStatusLabel } from "../../utils/format.js";

const TABS = [
  { id: "about", label: "Tentang" },
  { id: "reviews", label: "Ulasan" },
  { id: "services", label: "Jasa" },
  { id: "jobs", label: "Lowongan" },
  { id: "history", label: "Riwayat Kerja" },
  { id: "portfolio", label: "Portfolio" },
];

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span className="stars" title={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? "star on" : "star"}>★</span>
      ))}
    </span>
  );
}

export default function ProfilePage() {
  const { id } = useParams();
  const { user: me, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("about");
  const [editBio, setEditBio] = useState(false);
  const [bioForm, setBioForm] = useState({ bio: "", city: "", province: "" });
  const [pfForm, setPfForm] = useState({ title: "", description: "" });
  const [pfImage, setPfImage] = useState(null);
  const [pfFile, setPfFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function load() {
    api.profileShow(id).then(setData);
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (data?.user) {
      setBioForm({
        bio: data.user.bio || "",
        city: data.user.city || "",
        province: data.user.province || "",
      });
    }
  }, [data]);

  if (!data) return <Layout wide compact><Loading /></Layout>;

  const { user, is_own, ratingStats, reviews, services, jobs, workHistory, portfolios, applications } = data;

  async function saveBio(e) {
    e.preventDefault();
    setErr("");
    const fd = new FormData();
    fd.append("bio", bioForm.bio);
    fd.append("city", bioForm.city);
    fd.append("province", bioForm.province);
    const picInput = document.getElementById("profilepic-input");
    if (picInput?.files[0]) fd.append("profilepic", picInput.files[0]);
    try {
      await api.profileUpdate(fd);
      await refresh();
      setEditBio(false);
      setPhotoPreview("");
      setMsg("Profil berhasil disimpan");
      load();
    } catch (ex) {
      setErr(ex.errors?.length ? ex.errors.join(", ") : ex.message);
    }
  }

  function onProfilePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function addPortfolio(e) {
    e.preventDefault();
    setErr("");
    const fd = new FormData();
    fd.append("title", pfForm.title);
    fd.append("description", pfForm.description);
    if (pfImage) fd.append("portfolio_image", pfImage);
    if (pfFile) fd.append("portfolio_file", pfFile);
    try {
      await api.profileAddPortfolio(fd);
      setPfForm({ title: "", description: "" });
      setPfImage(null);
      setPfFile(null);
      setMsg("Portfolio ditambahkan");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function removePortfolio(itemId) {
    if (!confirm("Hapus item portfolio ini?")) return;
    await api.profileDeletePortfolio(itemId);
    load();
  }

  async function deleteService(serviceId) {
    if (!confirm("Hapus jasa ini?")) return;
    try {
      await api.jasaDelete(serviceId);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function deleteJob(jobId) {
    if (!confirm("Hapus lowongan ini?")) return;
    try {
      await api.lowonganDelete(jobId);
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <Layout wide compact>
      <Alert type="success">{msg}</Alert>
      <Alert>{err}</Alert>

      <div className="profile-header panel">
        <div className="profile-header-main">
          <div className="profile-avatar-wrap">
            {(photoPreview || user.profilepic_url) ? (
              <img src={photoPreview || user.profilepic_url} alt="" className="profile-avatar" />
            ) : (
              <div className="profile-avatar placeholder">
                {(user.first_name?.[0] || "?").toUpperCase()}
              </div>
            )}
          </div>
          <div className="profile-header-info">
            <h1>{user.name}</h1>
            {(user.city || user.province) && (
              <p className="muted">{[user.city, user.province].filter(Boolean).join(", ")}</p>
            )}
            <div className="profile-rating-row">
              <Stars rating={ratingStats.avg_rating} />
              <span className="muted">
                {ratingStats.avg_rating || "—"} ({ratingStats.total} ulasan)
              </span>
            </div>
            <p className="muted profile-since">
              Member sejak {user.member_since ? new Date(user.member_since).toLocaleDateString("id-ID") : "-"}
              {user.ktp_status === "APPROVED" && <span className="badge badge-ok" style={{ marginLeft: 8 }}>Terverifikasi</span>}
            </p>
          </div>
        </div>
        {is_own && (
          <button type="button" className="btn btn-sm" onClick={() => setEditBio(!editBio)}>
            {editBio ? "Batal Edit" : "Edit Profil"}
          </button>
        )}
      </div>

      {editBio && is_own && (
        <form onSubmit={saveBio} className="panel form profile-edit-form">
          <h2>Edit Biodata</h2>
          <div className="profile-setup-photo">
            <div className="profile-setup-preview">
              {(photoPreview || user.profilepic_url) ? (
                <img src={photoPreview || user.profilepic_url} alt="" className="profile-avatar" />
              ) : (
                <div className="profile-avatar placeholder">
                  {(user.first_name?.[0] || "?").toUpperCase()}
                </div>
              )}
            </div>
            <label className="profile-setup-upload">
              Foto profil
              <input id="profilepic-input" type="file" accept="image/jpeg,image/png,image/jpg" onChange={onProfilePhotoChange} />
              <span className="hint">JPG atau PNG, maks. 5 MB</span>
            </label>
          </div>
          <label>Bio<textarea rows={4} value={bioForm.bio} onChange={(e) => setBioForm({ ...bioForm, bio: e.target.value })} placeholder="Ceritakan tentang kamu, keahlian, pengalaman..." /></label>
          <div className="form-row">
            <label>Kota<input value={bioForm.city} onChange={(e) => setBioForm({ ...bioForm, city: e.target.value })} /></label>
            <label>Provinsi<input value={bioForm.province} onChange={(e) => setBioForm({ ...bioForm, province: e.target.value })} /></label>
          </div>
          <button type="submit" className="btn btn-primary">Simpan</button>
        </form>
      )}

      <div className="profile-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`profile-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel profile-tab-content">
        {tab === "about" && (
          <>
            <h2>Tentang</h2>
            <p>{user.bio || "Belum ada bio."}</p>
            {is_own && applications.length > 0 && (
              <>
                <h3 style={{ marginTop: 20 }}>Lamaran Saya</h3>
                <ul className="simple-list">
                  {applications.map((a) => (
                    <li key={a.id}>
                      <strong>{a.job_title}</strong> — {rupiah(a.proposed_price)} · {applicationStatusLabel(a.status)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {tab === "reviews" && (
          <>
            <h2>Ulasan ({ratingStats.total})</h2>
            {reviews.length === 0 ? (
              <p className="empty-inline">Belum ada ulasan.</p>
            ) : (
              <div className="review-list">
                {reviews.map((r) => (
                  <div key={r.id} className="review-card">
                    <div className="review-card-head">
                      <Stars rating={r.rating} />
                      <strong>{r.reviewer_name}</strong>
                    </div>
                    <p className="muted">{r.order_title}</p>
                    <p>{r.comment}</p>
                    <small className="muted">{new Date(r.created_at).toLocaleDateString("id-ID")}</small>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "services" && (
          <>
            <h2>Jasa Diposting ({services.length})</h2>
            {services.length === 0 ? (
              <p className="empty-inline">Belum ada jasa.</p>
            ) : (
              <div className="grid grid-compact">
                {services.map((s) => (
                  <article key={s.id} className="card-item">
                    <Link to={`/jasa/${s.id}`} className="card-link">
                      {s.cover_image_url && <img src={s.cover_image_url} alt="" className="card-thumb" />}
                      <div className="card-body">
                        <h3>{s.title}</h3>
                        <p className="price">{rupiah(s.price)}</p>
                      </div>
                    </Link>
                    {is_own && (
                      <div className="card-actions-inline" style={{ padding: "0 var(--space-3) var(--space-3)" }}>
                        <Link to={`/jasa/${s.id}/edit`} className="btn btn-sm">Edit</Link>
                        <button type="button" className="btn btn-sm" onClick={() => deleteService(s.id)}>Hapus</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "jobs" && (
          <>
            <h2>Lowongan Diposting ({jobs.length})</h2>
            {jobs.length === 0 ? (
              <p className="empty-inline">Belum ada lowongan.</p>
            ) : (
              <ul className="simple-list">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <Link to={`/lowongan/${j.id}`}><strong>{j.title}</strong></Link>
                    {" "}— {rupiah(j.budget)} · {jobStatusLabel(j.status)}
                    {j.pending_applications > 0 && (
                      <span className="muted"> · {j.pending_applications} lamaran menunggu</span>
                    )}
                    {is_own && j.status === "OPEN" && (
                      <span className="card-actions-inline" style={{ display: "inline-flex", marginLeft: 8 }}>
                        <Link to={`/lowongan/${j.id}/edit`} className="btn btn-sm">Edit</Link>
                        <button type="button" className="btn btn-sm" onClick={() => deleteJob(j.id)}>Hapus</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            <h2>Riwayat Pengerjaan ({workHistory.length})</h2>
            {workHistory.length === 0 ? (
              <p className="empty-inline">Belum ada pekerjaan selesai.</p>
            ) : (
              <ul className="simple-list">
                {workHistory.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`}><strong>{o.title}</strong></Link>
                    {" "}— {o.buyer_name} · {rupiah(o.amount)} · Selesai
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "portfolio" && (
          <>
            <h2>Portfolio ({portfolios.length})</h2>
            {is_own && (
              <form onSubmit={addPortfolio} className="form portfolio-add-form">
                <label>Judul<input required value={pfForm.title} onChange={(e) => setPfForm({ ...pfForm, title: e.target.value })} /></label>
                <label>Deskripsi<textarea rows={2} value={pfForm.description} onChange={(e) => setPfForm({ ...pfForm, description: e.target.value })} /></label>
                <label>Gambar<input type="file" accept="image/*" onChange={(e) => setPfImage(e.target.files[0])} /></label>
                <label>File (PDF/DOC)<input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setPfFile(e.target.files[0])} /></label>
                <button type="submit" className="btn btn-sm btn-primary">+ Tambah Portfolio</button>
              </form>
            )}
            {portfolios.length === 0 ? (
              <p className="empty-inline">Belum ada portfolio.</p>
            ) : (
              <div className="portfolio-grid">
                {portfolios.map((p) => (
                  <div key={p.id} className="portfolio-item">
                    {p.image_url && <img src={p.image_url} alt="" />}
                    <h4>{p.title}</h4>
                    {p.description && <p className="muted">{p.description}</p>}
                    {p.file_url && (
                      <a href={p.file_url} target="_blank" rel="noreferrer" className="btn btn-sm">Lihat File</a>
                    )}
                    {is_own && (
                      <button type="button" className="btn btn-sm" onClick={() => removePortfolio(p.id)}>Hapus</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
