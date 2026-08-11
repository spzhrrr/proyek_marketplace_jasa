import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { rupiah, formatMemberSince, portfolioDisplayName } from "../../utils/format.js";
import { CatalogJasaCard, CatalogKerjaCard } from "../../components/CatalogCards.jsx";
import CategoryMark from "../../components/CategoryMark.jsx";
import { resolveUploadUrl } from "../../utils/media.js";
import { INDONESIA_PROVINCES, INDONESIA_CITIES } from "../../utils/indonesiaLocations.js";
import { BIO_MAX_LENGTH } from "../../utils/profile.js";

const TABS = [
  { id: "services", label: "Jasa" },
  { id: "jobs", label: "Lowongan" },
  { id: "portfolio", label: "Portfolio" },
  { id: "reviews", label: "Ulasan" },
  { id: "history", label: "Selesai" },
  { id: "verification", label: "Verifikasi", ownOnly: true },
];

function pickStorefrontTab(payload) {
  const s = payload?.stats || {};
  if (Number(s.jasa) > 0) return "services";
  if (Number(s.lowongan) > 0) return "jobs";
  if (Number(s.portfolio) > 0) return "portfolio";
  if (Number(s.rating_count) > 0) return "reviews";
  return "services";
}

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span className="stars" title={`${rating || 0} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? "star on" : "star"}>★</span>
      ))}
    </span>
  );
}

function EyeIcon({ off }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function PasswordReveal({ id, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pf-pass">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

function ContactChange({ kind, current, verified, onDone }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isEmail = kind === "email";

  async function sendOtp() {
    setErr("");
    setLoading(true);
    try {
      const res = isEmail
        ? await api.profileChangeEmailStart(value)
        : await api.profileChangePhoneStart(value);
      setSent(true);
      setMockOtp(res.mockOtp || "");
      if (res.phone) setValue(res.phone);
      if (res.email) setValue(res.email);
    } catch (e) {
      setErr(e.message || "Gagal kirim OTP");
    } finally {
      setLoading(false);
    }
  }

  async function confirmOtp() {
    setErr("");
    setLoading(true);
    try {
      const res = isEmail
        ? await api.profileChangeEmailConfirm(value, otp)
        : await api.profileChangePhoneConfirm(value, otp);
      setOpen(false);
      setSent(false);
      setOtp("");
      setValue("");
      setMockOtp("");
      onDone(res.user, isEmail ? "Email berhasil diganti." : "Nomor HP berhasil diganti.");
    } catch (e) {
      setErr(e.message || "OTP tidak valid");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pf-contact">
      <div className="pf-contact-top">
        <div>
          <strong>{isEmail ? "Email" : "Nomor HP"}</strong>
          <span>{current || "-"}</span>
          <span className="muted">{verified ? "Terverifikasi" : "Belum terverifikasi"}</span>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => { setOpen((v) => !v); setErr(""); setSent(false); setOtp(""); }}
        >
          {open ? "Tutup" : "Ubah"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          <Alert>{err}</Alert>
          {!sent ? (
            <>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isEmail ? "email.baru@mail.com" : "08xxxxxxxxxx"}
              />
              <button type="button" className="btn btn-sm btn-primary" style={{ marginTop: 8 }} disabled={loading || !value.trim()} onClick={sendOtp}>
                {loading ? "Mengirim..." : "Kirim OTP"}
              </button>
            </>
          ) : (
            <div>
              {mockOtp && <div className="pf-otp-banner">Kode OTP (simulasi): {mockOtp}</div>}
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 digit OTP"
                inputMode="numeric"
                style={{ marginTop: 8 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-sm btn-primary" disabled={loading || otp.length < 6} onClick={confirmOtp}>
                  {loading ? "Memeriksa..." : "Konfirmasi OTP"}
                </button>
                <button type="button" className="btn btn-sm" disabled={loading} onClick={sendOtp}>Kirim ulang</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function statusPill(ok, pending, rejected, labelOk = "Terverifikasi") {
  if (ok) return <span className="badge badge-ok">{labelOk}</span>;
  if (pending) return <span className="badge badge-warn">Menunggu review</span>;
  if (rejected) return <span className="badge badge-danger">Ditolak</span>;
  return <span className="badge badge-muted">Belum</span>;
}

function EmptyBlock({ title, hint, children }) {
  return (
    <div className="pf-empty">
      <strong>{title}</strong>
      {hint ? <p>{hint}</p> : null}
      {children}
    </div>
  );
}

function ServiceCardGrid({ services, isOwn }) {
  if (!services.length) {
    return (
      <EmptyBlock
        title="Belum ada jasa"
        hint={isOwn ? "Jasa yang kamu pasang akan tampil di sini untuk pengunjung." : "Pengguna ini belum memasang jasa."}
      >
        {isOwn ? <Link to="/jasa/baru" className="btn btn-sm btn-primary">Pasang jasa</Link> : null}
      </EmptyBlock>
    );
  }
  return (
    <div className="catalog-grid is-jasa">
      {services.map((s) => <CatalogJasaCard key={s.id} item={s} />)}
    </div>
  );
}

function JobCardGrid({ jobs, isOwn }) {
  if (!jobs.length) {
    return (
      <EmptyBlock
        title="Belum ada lowongan"
        hint={isOwn ? "Lowongan yang kamu pasang akan tampil di sini untuk pelamar." : "Pengguna ini belum memasang lowongan."}
      >
        {isOwn ? <Link to="/lowongan/baru" className="btn btn-sm btn-primary">Pasang lowongan</Link> : null}
      </EmptyBlock>
    );
  }
  return (
    <div className="catalog-grid is-kerja">
      {jobs.map((j) => <CatalogKerjaCard key={j.id} item={j} />)}
    </div>
  );
}

function PortfolioList({ items, isOwn, onDelete }) {
  return (
    <ul className="pf-folio-list">
      {items.map((p) => {
        const fileUrl = resolveUploadUrl(p.file_url || p.image_url);
        const catLabel = [p.category_name, p.parent_name].filter(Boolean).join(" · ");
        return (
          <li key={p.id} className="pf-folio-row">
            <CategoryMark
              code={p.category_code}
              parentCode={p.parent_code}
              parentType={p.parent_type}
              name={p.category_name || p.parent_name}
            />
            <div className="pf-folio-copy">
              <h3>{p.title}</h3>
              <p className="pf-folio-meta">
                {catLabel || "Tanpa kategori"}
                {fileUrl ? ` · ${portfolioDisplayName(p.file_url)}` : ""}
              </p>
              {p.description ? <p className="pf-folio-desc">{p.description}</p> : null}
            </div>
            <div className="pf-folio-actions">
              {fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm">Buka</a> : null}
              {isOwn && onDelete ? (
                <button type="button" className="btn btn-sm" onClick={() => onDelete(p)}>Hapus</button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function ProfilePage() {
  const { id } = useParams();
  const { user: me, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("services");
  const [reviewSide, setReviewSide] = useState("seller");
  const [showPfModal, setShowPfModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("Penipuan / Indikasi Fraud");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [editBio, setEditBio] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", bio: "", city: "", province: "",
    current_password: "", new_password: "", new_password_confirm: "",
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catRoots, setCatRoots] = useState([]);
  const [catTree, setCatTree] = useState({});
  const [pfParentId, setPfParentId] = useState("");
  const [pfCategoryId, setPfCategoryId] = useState("");
  const [pfTitle, setPfTitle] = useState("");
  const [pfDesc, setPfDesc] = useState("");
  const [pfFile, setPfFile] = useState(null);
  const [pfPreview, setPfPreview] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loadError, setLoadError] = useState("");
  const [confirm, setConfirm] = useState({
    open: false, title: "", message: "", confirmText: "Ya", tone: "primary", onYes: null,
  });

  function load({ resetTab } = {}) {
    setLoadError("");
    api.profileShow(id)
      .then((payload) => {
        setData(payload);
        if (resetTab) setTab(pickStorefrontTab(payload));
      })
      .catch((e) => setLoadError(e.message || "Gagal memuat profil"));
  }

  useEffect(() => { setData(null); load({ resetTab: true }); }, [id]);

  useEffect(() => {
    if (data?.user) {
      const u = data.user;
      setEditForm((prev) => ({
        ...prev,
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        bio: String(u.bio || "").slice(0, BIO_MAX_LENGTH),
        city: u.city || "",
        province: u.province || "",
      }));
    }
  }, [data]);

  useEffect(() => {
    if (!data?.is_own) return;
    if (catRoots.length) return;
    api.categories().then((d) => {
      setCatRoots(d.roots || []);
      setCatTree(d.tree || {});
    }).catch(() => {});
  }, [data?.is_own, catRoots.length]);

  if (!data && loadError) {
    return (
      <Layout wide compact bgClass="app-dash-bg">
        <div className="pf-page">
          <Alert>{loadError}</Alert>
          <button type="button" className="btn btn-primary btn-sm" onClick={load}>Coba lagi</button>
        </div>
      </Layout>
    );
  }

  if (!data) return <Layout wide compact bgClass="app-dash-bg"><Loading /></Layout>;

  const {
    user, is_own, ratingStats, reviews = [], services = [], jobs = [],
    workHistory = [], hireHistory = [], portfolios = [], stats = {},
  } = data;

  const sellerReviews = reviews.filter((r) => Number(r.order_seller_id) === Number(user.id));
  const buyerReviews = reviews.filter((r) => Number(r.order_buyer_id) === Number(user.id));
  const activeReviews = reviewSide === "seller" ? sellerReviews : buyerReviews;

  const visibleTabs = TABS.filter((t) => !t.ownOnly || is_own);
  const pfParent = catRoots.find((r) => String(r.id) === String(pfParentId));
  const pfSubs = pfParent ? catTree[pfParent.url_code] || [] : [];

  async function submitUserReport(e) {
    e.preventDefault();
    if (!me) { alert("Login dulu untuk mengirim laporan"); return; }
    setReportSubmitting(true);
    try {
      await api.createUserReport({ reported_user_id: user.id, reason: reportReason, description: reportDesc });
      setShowReportModal(false);
      setReportDesc("");
      setMsg("Laporan terkirim ke admin.");
    } catch (ex) {
      setErr(ex.message || "Gagal mengirim laporan");
    } finally {
      setReportSubmitting(false);
    }
  }

  function openEdit() {
    const u = data?.user;
    setEditForm({
      first_name: u?.first_name || "",
      last_name: u?.last_name || "",
      bio: String(u?.bio || "").slice(0, BIO_MAX_LENGTH),
      city: u?.city || "",
      province: u?.province || "",
      current_password: "",
      new_password: "",
      new_password_confirm: "",
    });
    setPhotoFile(null);
    setRemovePhoto(false);
    setPhotoPreview("");
    setEditBio(true);
    setErr("");
    setMsg("");
  }

  function askSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (editForm.new_password || editForm.current_password || editForm.new_password_confirm) {
      if (!editForm.current_password) {
        setErr("Isi password saat ini untuk mengganti password.");
        return;
      }
      if (editForm.new_password !== editForm.new_password_confirm) {
        setErr("Password baru dan ulangi password tidak sama.");
        return;
      }
    }
    setConfirm({
      open: true,
      title: "Simpan perubahan profil?",
      message: editForm.new_password
        ? "Data profil dan password baru akan disimpan ke akun kamu."
        : "Perubahan foto, nama, bio, dan lokasi akan disimpan ke akun kamu.",
      confirmText: "Ya, Simpan",
      tone: "primary",
      onYes: doSave,
    });
  }

  async function doSave() {
    setConfirm((c) => ({ ...c, open: false }));
    setSaving(true);
    setErr("");
    const fd = new FormData();
    fd.append("first_name", editForm.first_name);
    fd.append("last_name", editForm.last_name);
    fd.append("bio", editForm.bio);
    fd.append("city", editForm.city);
    fd.append("province", editForm.province);
    if (photoFile) fd.append("profilepic", photoFile);
    if (removePhoto && !photoFile) fd.append("remove_photo", "true");
    if (editForm.new_password || editForm.current_password) {
      fd.append("current_password", editForm.current_password);
      fd.append("new_password", editForm.new_password);
      fd.append("new_password_confirm", editForm.new_password_confirm);
    }
    try {
      const res = await api.profileUpdate(fd);
      await refresh();
      if (res?.user) {
        setData((prev) => prev ? {
          ...prev,
          user: {
            ...prev.user,
            ...res.user,
            name: res.user.name || `${res.user.first_name || ""} ${res.user.last_name || ""}`.trim(),
            identity_verified: prev.user.identity_verified,
            ktp_status: res.user.ktp_status || prev.user.ktp_status,
            member_since: prev.user.member_since,
          },
        } : prev);
      }
      setEditBio(false);
      setPhotoPreview("");
      setPhotoFile(null);
      setRemovePhoto(false);
      setMsg("Profil berhasil disimpan.");
      load();
    } catch (ex) {
      setErr(ex.errors?.length ? ex.errors.join(" · ") : ex.message);
      document.getElementById("pf-edit-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setSaving(false);
    }
  }

  async function addPortfolio(e) {
    e.preventDefault();
    setErr("");
    if (pfTitle.trim().length < 3) {
      setErr("Judul portfolio minimal 3 karakter.");
      return;
    }
    if (!pfFile) {
      setErr("Unggah file karya (gambar, PDF, atau dokumen).");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("title", pfTitle.trim());
      fd.append("description", pfDesc.trim());
      if (pfCategoryId) fd.append("category_id", pfCategoryId);
      fd.append("portfolio_file", pfFile);
      await api.profileAddPortfolio(fd);
      setPfParentId("");
      setPfCategoryId("");
      setPfTitle("");
      setPfDesc("");
      setPfFile(null);
      setPfPreview("");
      setShowPfModal(false);
      setMsg("Karya portfolio ditambahkan.");
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  function askDelete(title, message, fn) {
    setConfirm({ open: true, title, message, confirmText: "Ya, Hapus", tone: "danger", onYes: fn });
  }

  async function runDelete(fn) {
    setConfirm((c) => ({ ...c, open: false }));
    try {
      await fn();
      load();
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <Layout wide compact bgClass="app-dash-bg">
      <div className="pf-page">
        <Alert type="success">{msg}</Alert>
        {!editBio && <Alert>{err}</Alert>}

        <div className="pf-card">
          <div className="pf-head">
            <div className="pf-head-left">
              {(photoPreview || (!removePhoto && user.profilepic_url)) ? (
                <img src={photoPreview || user.profilepic_url} alt="" className="pf-avatar" />
              ) : (
                <div className="pf-avatar ph">{(user.first_name?.[0] || "?").toUpperCase()}</div>
              )}
              <div>
                <h1 className="pf-name">
                  {user.name}
                  {user.identity_verified && (
                    <span className="badge badge-ok" title="Identitas KTP terverifikasi">Terverifikasi</span>
                  )}
                </h1>
                <div className="pf-meta">
                  {(user.city || user.province) && <span>{[user.city, user.province].filter(Boolean).join(", ")}</span>}
                  <span>Bergabung {formatMemberSince(user.member_since)}</span>
                </div>
                {user.bio?.trim() ? (
                  <p className="pf-bio">{user.bio.trim().slice(0, BIO_MAX_LENGTH)}</p>
                ) : is_own ? (
                  <p className="pf-bio is-empty">Belum ada bio. Isi lewat Edit profil — singkat, max {BIO_MAX_LENGTH} karakter.</p>
                ) : null}
              </div>
            </div>
            <div className="pf-head-actions">
              {is_own ? (
                <>
                  <Link to="/dashboard" className="btn btn-sm">Beranda</Link>
                  <button type="button" className="btn btn-sm" onClick={() => (editBio ? setEditBio(false) : openEdit())}>
                    {editBio ? "Batal" : "Edit profil"}
                  </button>
                </>
              ) : me ? (
                <button type="button" className="btn btn-sm" onClick={() => setShowReportModal(true)}>
                  Laporkan
                </button>
              ) : null}
            </div>
          </div>
          <div className="pf-stats">
            <button type="button" className="pf-stat is-jasa" onClick={() => setTab("services")}>
              <span>Jasa</span><strong>{stats.jasa ?? 0}</strong>
            </button>
            <button type="button" className="pf-stat is-kerja" onClick={() => setTab("jobs")}>
              <span>Lowongan</span><strong>{stats.lowongan ?? 0}</strong>
            </button>
            <button type="button" className="pf-stat" onClick={() => setTab("history")}>
              <span>Selesai</span><strong>{stats.completed ?? 0}</strong>
            </button>
            <button type="button" className="pf-stat" onClick={() => setTab("reviews")}>
              <span>Rating</span><strong>{Number(stats.rating || 0).toFixed(1)} <small>({stats.rating_count ?? 0})</small></strong>
            </button>
          </div>
        </div>

        {editBio && is_own && (
          <form id="pf-edit-card" onSubmit={askSave} className="pf-edit">
            <h2>Edit profil</h2>
            <p className="pf-edit-lead">Perbarui identitas publik, kontak, dan keamanan akun.</p>
            <Alert>{err}</Alert>
            {(() => {
              const nameLocked = user.ktp_status === "APPROVED" || user.ktp_status === "PENDING";
              const cities = [
                ...(INDONESIA_CITIES[editForm.province] || []),
                ...(editForm.city && !(INDONESIA_CITIES[editForm.province] || []).includes(editForm.city) ? [editForm.city] : []),
              ];
              const shownPhoto = photoPreview || (!removePhoto && user.profilepic_url);
              return (
                <>
                  <div className="pf-photo-row">
                    {shownPhoto ? (
                      <img src={shownPhoto} alt="" className="profile-avatar" />
                    ) : (
                      <div className="profile-avatar placeholder">{(editForm.first_name?.[0] || "?").toUpperCase()}</div>
                    )}
                    <div>
                      <div className="pf-photo-actions">
                        <input
                          id="pf-pic-input"
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setPhotoFile(file);
                            setRemovePhoto(false);
                            setPhotoPreview(URL.createObjectURL(file));
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-primary photo-pick-btn"
                          onClick={() => document.getElementById("pf-pic-input")?.click()}
                        >
                          Ganti foto
                        </button>
                        {shownPhoto && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoPreview("");
                              setRemovePhoto(true);
                            }}
                          >
                            Hapus foto
                          </button>
                        )}
                      </div>
                      <span className="hint">JPG/PNG, maks. 5 MB. Disimpan saat kamu konfirmasi simpan profil.</span>
                    </div>
                  </div>

                  <div className="form-row">
                    <label>
                      Nama depan
                      <input
                        required
                        disabled={nameLocked}
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      />
                    </label>
                    <label>
                      Nama belakang
                      <input
                        required
                        disabled={nameLocked}
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      />
                    </label>
                  </div>
                  {nameLocked && (
                    <span className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
                      Nama terkunci karena KTP {user.ktp_status === "APPROVED" ? "sudah disetujui" : "sedang ditinjau"}.
                    </span>
                  )}

                  <label>
                    Bio
                    <textarea
                      rows={3}
                      maxLength={BIO_MAX_LENGTH}
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value.slice(0, BIO_MAX_LENGTH) })}
                      placeholder="Keahlian atau cara kerjamu, singkat saja"
                    />
                    <span className="hint">{editForm.bio.length}/{BIO_MAX_LENGTH} karakter. Tampil di bawah nama, bukan tab terpisah.</span>
                  </label>

                  <div className="form-row">
                    <label>
                      Provinsi
                      <select
                        required
                        value={editForm.province}
                        onChange={(e) => {
                          const province = e.target.value;
                          const firstCity = INDONESIA_CITIES[province]?.[0] || "";
                          setEditForm({ ...editForm, province, city: firstCity });
                        }}
                      >
                        <option value="">Pilih provinsi</option>
                        {INDONESIA_PROVINCES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        {editForm.province && !INDONESIA_PROVINCES.includes(editForm.province) && (
                          <option value={editForm.province}>{editForm.province}</option>
                        )}
                      </select>
                    </label>
                    <label>
                      Kota / Kabupaten
                      <select
                        required
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      >
                        <option value="">Pilih kota</option>
                        {cities.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="pf-edit-sec">Kontak</div>
                  <div className="form-row">
                    <ContactChange
                      kind="email"
                      current={user.email}
                      verified={!!user.email_verified_at}
                      onDone={(fresh, message) => {
                        if (fresh) {
                          setData((prev) => prev ? { ...prev, user: { ...prev.user, ...fresh, identity_verified: prev.user.identity_verified, member_since: prev.user.member_since } } : prev);
                        }
                        refresh();
                        setMsg(message);
                      }}
                    />
                    <ContactChange
                      kind="phone"
                      current={user.phone}
                      verified={!!user.phone_verified_at}
                      onDone={(fresh, message) => {
                        if (fresh) {
                          setData((prev) => prev ? { ...prev, user: { ...prev.user, ...fresh, identity_verified: prev.user.identity_verified, member_since: prev.user.member_since } } : prev);
                        }
                        refresh();
                        setMsg(message);
                      }}
                    />
                  </div>

                  <div className="pf-edit-sec">Ganti password</div>
                  <p className="hint" style={{ margin: "-4px 0 10px" }}>Kosongkan jika tidak ingin mengubah password.</p>
                  <label>
                    Password saat ini
                    <PasswordReveal
                      id="pf-pass-current"
                      autoComplete="current-password"
                      value={editForm.current_password}
                      onChange={(e) => setEditForm({ ...editForm, current_password: e.target.value })}
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Password baru
                      <PasswordReveal
                        id="pf-pass-new"
                        autoComplete="new-password"
                        value={editForm.new_password}
                        onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
                      />
                    </label>
                    <label>
                      Ulangi password baru
                      <PasswordReveal
                        id="pf-pass-confirm"
                        autoComplete="new-password"
                        value={editForm.new_password_confirm}
                        onChange={(e) => setEditForm({ ...editForm, new_password_confirm: e.target.value })}
                      />
                    </label>
                  </div>
                  <span className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
                    Minimal 8 karakter, huruf besar, huruf kecil, angka, dan simbol.
                  </span>

                  <div className="pf-edit-actions">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? "Menyimpan..." : "Simpan perubahan"}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => { setEditBio(false); setErr(""); }} disabled={saving}>Batal</button>
                  </div>
                </>
              );
            })()}
          </form>
        )}

        <div className="pf-tabs">
          {visibleTabs.map((t) => (
            <button key={t.id} type="button" className={`pf-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="pf-body">
          {tab === "reviews" && (
            <>
              <div className="pf-body-head">
                <h2>Ulasan ({ratingStats?.total || 0})</h2>
                <div className="pf-side-toggle">
                  <button type="button" className={reviewSide === "seller" ? "is-on" : ""} onClick={() => setReviewSide("seller")}>
                    Sebagai freelancer ({sellerReviews.length})
                  </button>
                  <button type="button" className={reviewSide === "buyer" ? "is-on" : ""} onClick={() => setReviewSide("buyer")}>
                    Sebagai klien ({buyerReviews.length})
                  </button>
                </div>
              </div>
              <div className="pf-rating-row">
                <div>
                  <strong>{Number(ratingStats?.avg_rating || 0).toFixed(1)}</strong>
                  <div><Stars rating={ratingStats?.avg_rating} /></div>
                </div>
                <div className="pf-rating-bars">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratingStats?.breakdown?.[star] ?? reviews.filter((r) => Math.round(r.rating) === star).length;
                    const pct = ratingStats?.total ? Math.round((count / ratingStats.total) * 100) : 0;
                    return (
                      <div key={star} className="pf-bar">
                        <span>{star}★</span>
                        <i><b style={{ width: `${pct}%` }} /></i>
                        <small>{count}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
              {activeReviews.length === 0 ? (
                <EmptyBlock
                  title={reviewSide === "seller" ? "Belum ada ulasan sebagai freelancer" : "Belum ada ulasan sebagai klien"}
                  hint="Ulasan masuk setelah lawan transaksi memberi rating. Tab ini tetap ada agar riwayat reputasi bisa dicek kapan saja."
                />
              ) : (
                <ul className="pf-list">
                  {activeReviews.map((r) => (
                    <li key={r.id} className="pf-review">
                      <div className="pf-review-top">
                        <span><Stars rating={r.rating} /> <strong>{r.reviewer_id ? <Link to={`/profile/${r.reviewer_id}`}>{r.reviewer_name}</Link> : r.reviewer_name}</strong></span>
                        <small>{formatMemberSince(r.created_at)}</small>
                      </div>
                      {r.order_title && (
                        <span className={`pf-chip is-${r.order_source === "JOB" ? "kerja" : "jasa"}`}>{r.order_title}</span>
                      )}
                      {r.comment ? <p>{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "services" && (
            <>
              <div className="pf-body-head">
                <h2>Jasa ({services.length})</h2>
                {is_own && <Link to="/dashboard" className="home-more">Kelola di beranda</Link>}
              </div>
              <ServiceCardGrid services={services} isOwn={is_own} />
            </>
          )}

          {tab === "jobs" && (
            <>
              <div className="pf-body-head">
                <h2>Lowongan ({jobs.length})</h2>
                {is_own && <Link to="/dashboard" className="home-more">Kelola di beranda</Link>}
              </div>
              <JobCardGrid jobs={jobs} isOwn={is_own} />
            </>
          )}

          {tab === "history" && (
            <>
              <h2>Selesai sebagai freelancer ({workHistory.length})</h2>
              {workHistory.length === 0 ? (
                <EmptyBlock
                  title="Belum ada pekerjaan selesai"
                  hint="Riwayat sebagai freelancer tampil di sini setelah pesanan ditandai selesai."
                />
              ) : (
                <ul className="pf-list">
                  {workHistory.map((o) => (
                    <li key={o.id}>
                      <span>
                        {is_own ? <Link to={`/orders/${o.id}`}><strong>{o.title}</strong></Link> : <strong>{o.title}</strong>}
                        {o.counterpart ? ` · ${o.counterpart}` : ""}
                      </span>
                      <span className="pf-hist-meta">
                        {o.completed_at ? <small>{formatMemberSince(o.completed_at)}</small> : null}
                        {is_own && o.amount != null ? <strong className="is-money">{rupiah(o.amount)}</strong> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {is_own && (
                <>
                  <h2 className="pf-subhead">Selesai sebagai klien ({hireHistory.length})</h2>
                  <p className="pf-private-hint">Hanya kamu yang melihat daftar ini.</p>
                  {hireHistory.length === 0 ? (
                    <EmptyBlock
                      title="Belum ada pesanan selesai"
                      hint="Daftar hire sebagai klien bersifat privat — hanya kamu yang melihatnya."
                    />
                  ) : (
                    <ul className="pf-list">
                      {hireHistory.map((o) => (
                        <li key={o.id}>
                          <span>
                            <Link to={`/orders/${o.id}`}><strong>{o.title}</strong></Link>
                            {o.counterpart ? ` · ${o.counterpart}` : ""}
                          </span>
                          <span className="pf-hist-meta">
                            {o.completed_at ? <small>{formatMemberSince(o.completed_at)}</small> : null}
                            <strong className="is-money">{rupiah(o.amount)}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}

          {tab === "portfolio" && (
            <>
              <div className="pf-body-head">
                <div>
                  <h2>Portfolio karya ({portfolios.length})</h2>
                  <p className="pf-private-hint">Daftar karya. Logo mengikuti kategori; file tetap bisa dibuka.</p>
                </div>
                {is_own && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => { setErr(""); setShowPfModal(true); }}>Tambah karya</button>
                )}
              </div>
              {portfolios.length === 0 ? (
                <EmptyBlock
                  title="Belum ada karya"
                  hint={is_own ? "Unggah PDF, gambar, atau dokumen dengan judul yang jelas." : "Pengguna ini belum menambahkan karya."}
                >
                  {is_own ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => { setErr(""); setShowPfModal(true); }}>Tambah karya</button>
                  ) : null}
                </EmptyBlock>
              ) : (
                <PortfolioList
                  items={portfolios}
                  isOwn={is_own}
                  onDelete={(p) => askDelete("Hapus karya?", `"${p.title}" akan dihapus dari portfolio.`, () => runDelete(() => api.profileDeletePortfolio(p.id)))}
                />
              )}
            </>
          )}

          {tab === "verification" && is_own && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0 }}>Status verifikasi</h2>
                  <p className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>Hanya kamu yang melihat ini. Publik hanya melihat lencana Terverifikasi.</p>
                </div>
                <Link to="/verify" className="btn btn-sm btn-primary">Kelola</Link>
              </div>
              <div className="pf-vgrid">
                <div className="pf-vcard">
                  <h4>Email</h4>
                  {statusPill(!!user.email_verified_at)}
                  <p>{user.email || "-"}</p>
                </div>
                <div className="pf-vcard">
                  <h4>Telepon</h4>
                  {statusPill(!!user.phone_verified_at)}
                  <p>{user.phone || "-"}</p>
                </div>
                <div className="pf-vcard">
                  <h4>KTP</h4>
                  {statusPill(user.ktp_status === "APPROVED", user.ktp_status === "PENDING", user.ktp_status === "REJECTED")}
                  <p>{user.ktp_number ? `NIK ${user.ktp_number}` : "Belum unggah"}</p>
                </div>
                <div className="pf-vcard">
                  <h4>Rekening</h4>
                  {statusPill(user.bank_status === "APPROVED", user.bank_status === "PENDING", user.bank_status === "REJECTED")}
                  <p>{user.bank_name ? `${user.bank_name} (${user.bank_account_number || "****"})` : "Belum diisi"}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {showPfModal && (
          <div className="modal-backdrop" onClick={() => setShowPfModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Tambah karya portfolio</h3>
              <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 12px" }}>Judul dan file wajib. Kategori dipakai sebagai logo di daftar. Maksimal 12 karya.</p>
              <Alert>{err}</Alert>
              <form onSubmit={addPortfolio} className="form">
                <label>
                  Judul karya
                  <input required minLength={3} value={pfTitle} onChange={(e) => setPfTitle(e.target.value)} placeholder="Contoh: Redesign dashboard UMKM" />
                </label>
                <label>
                  Deskripsi singkat (opsional)
                  <textarea rows={2} maxLength={240} value={pfDesc} onChange={(e) => setPfDesc(e.target.value.slice(0, 240))} placeholder="Apa yang dikerjakan, tools, atau hasilnya" />
                </label>
                <label>
                  Kategori (untuk logo)
                  <select value={pfParentId} onChange={(e) => { setPfParentId(e.target.value); setPfCategoryId(""); }}>
                    <option value="">Tanpa kategori</option>
                    {catRoots.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </label>
                {pfParentId ? (
                  <label>
                    Sub kategori
                    <select value={pfCategoryId} onChange={(e) => setPfCategoryId(e.target.value)}>
                      <option value="">Pilih sub kategori</option>
                      {pfSubs.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  File karya
                  <input
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/jpg,application/pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setPfFile(file || null);
                      setPfPreview(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
                    }}
                  />
                </label>
                {pfPreview ? <img src={pfPreview} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10 }} /> : null}
                {pfFile && !pfPreview ? <p className="hint">{pfFile.name}</p> : null}
                <div className="btn-row">
                  <button type="submit" className="btn btn-primary">Simpan karya</button>
                  <button type="button" className="btn" onClick={() => setShowPfModal(false)}>Batal</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showReportModal && (
          <div className="modal-backdrop" onClick={() => setShowReportModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem" }}>Laporkan {user.name}</h3>
              <form onSubmit={submitUserReport} className="form">
                <label>
                  Alasan
                  <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                    <option>Penipuan / Indikasi Fraud</option>
                    <option>Perilaku Tidak Sopan / Perundungan</option>
                    <option>Pelanggaran Janji Kualitas / Keterlambatan</option>
                    <option>Spam / Iklan Terlarang</option>
                    <option>Pelanggaran Hak Cipta / Karya Orang Lain</option>
                    <option>Lainnya</option>
                  </select>
                </label>
                <label>Detail<textarea required rows={3} value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} /></label>
                <div className="btn-row">
                  <button type="submit" className="btn btn-cta-danger" disabled={reportSubmitting}>{reportSubmitting ? "Mengirim..." : "Kirim"}</button>
                  <button type="button" className="btn" onClick={() => setShowReportModal(false)}>Batal</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={confirm.open}
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText || "Ya"}
          cancelText="Batal"
          confirmTone={confirm.tone || "primary"}
          loading={saving}
          onConfirm={confirm.onYes}
          onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
        />
      </div>
    </Layout>
  );
}
