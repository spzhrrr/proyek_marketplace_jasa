import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import CategoryFilter from "../../components/CategoryFilter.jsx";
import { api } from "../../services/api.js";
import { CatalogJasaCard } from "../../components/CatalogCards.jsx";

function toListParams({ tipe, sub, q, sort, city, priceRange }) {
  const next = { tipe, sub };
  if (q) next.q = q;
  if (sort) next.sort = sort;
  if (city && city !== "semua") next.city = city;
  if (priceRange && priceRange !== "semua") next.priceRange = priceRange;
  return next;
}

export default function JasaListPage() {
  const [params, setParams] = useSearchParams();
  const tipe = params.get("tipe") || "semua";
  const sub = params.get("sub") || "semua";
  const q = params.get("q") || "";
  const sort = params.get("sort") || "terbaru";
  const city = params.get("city") || "semua";
  const priceRange = params.get("priceRange") || "semua";
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [qDraft, setQDraft] = useState(q);

  function updateParams(partial) {
    setParams(toListParams({ tipe, sub, q, sort, city, priceRange, ...partial }));
  }

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  useEffect(() => {
    if (qDraft === q) return;
    const t = setTimeout(() => {
      setParams(toListParams({ tipe, sub, q: qDraft.trim(), sort, city, priceRange }));
    }, 350);
    return () => clearTimeout(t);
  }, [qDraft, q, tipe, sub, sort, city, priceRange, setParams]);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    api.jasaList({ tipe, sub, sort, city, priceRange, ...(q ? { q } : {}) })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setData({ ok: false, data: [] });
        setLoadError(err.message || "Gagal memuat daftar jasa");
      });
    return () => { cancelled = true; };
  }, [tipe, sub, q, sort, city, priceRange]);

  if (!data) {
    return (
      <Layout wide compact bgClass="app-jasa-bg">
        <Loading />
      </Layout>
    );
  }

  const items = Array.isArray(data.data) ? data.data : [];
  const filtered = Boolean(q || (tipe && tipe !== "semua") || (sub && sub !== "semua") || (city && city !== "semua") || (priceRange && priceRange !== "semua"));

  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <div className="mockup-hero-jasa catalog-hero">
        <div className="catalog-hero-row">
          <div className="catalog-hero-copy">
            <h1 className="catalog-display">
              <span className="catalog-display-kicker">Cari</span>
              <span className="catalog-display-word">Jasa</span>
            </h1>
            <p className="mockup-hero-sub">Jasa digital dan fisik dari freelancer terverifikasi.</p>
          </div>
          <Link to="/jasa/baru" className="btn btn-primary btn-sm catalog-hero-cta">
            Post Jasa Baru
          </Link>
        </div>

        <ul className="catalog-highlights">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Freelancer terverifikasi
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Digital dan fisik
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Layanan di kotamu
          </li>
        </ul>

        <div className="mockup-floating-search-bar catalog-filter-bar">
          <div className="catalog-toolbar-row">
            <div className="mockup-search-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Cari jasa..."
                aria-label="Cari jasa"
              />
            </div>

            <div className="mockup-type-pills-group">
              <button type="button" className={`mockup-type-pill ${tipe === "semua" ? "active" : ""}`} onClick={() => updateParams({ tipe: "semua", sub: "semua", city: "semua" })}>
                Semua
              </button>
              <button type="button" className={`mockup-type-pill ${tipe === "DIGITAL" ? "active" : ""}`} onClick={() => updateParams({ tipe: "DIGITAL", sub: "semua", city: "semua" })}>
                Digital
              </button>
              <button type="button" className={`mockup-type-pill ${tipe === "PHYSICAL" ? "active" : ""}`} onClick={() => updateParams({ tipe: "PHYSICAL", sub: "semua" })}>
                Fisik
              </button>
            </div>

            <span className="catalog-results-count is-jasa">
              {loadError ? "—" : `${items.length} jasa`}
            </span>
          </div>

          <div className="catalog-toolbar-row">
            <CategoryFilter
              tipe={tipe}
              sub={sub}
              sort={sort}
              city={city}
              priceRange={priceRange}
              onChange={({ tipe: t, sub: s, sort: st, city: c, priceRange: pr }) => updateParams({ tipe: t, sub: s, sort: st, city: c, priceRange: pr })}
            />
          </div>
        </div>
      </div>

      {loadError ? (
        <EmptyState
          variant="catalog"
          title="Tidak bisa memuat jasa"
          hint={loadError}
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => {
              setData(null);
              setLoadError("");
              api.jasaList({ tipe, sub, sort, city, priceRange, ...(q ? { q } : {}) })
                .then(setData)
                .catch((err) => {
                  setData({ ok: false, data: [] });
                  setLoadError(err.message || "Gagal memuat daftar jasa");
                });
            }}>
              Coba lagi
            </button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          variant="catalog"
          title={filtered ? "Tidak ada jasa yang cocok" : "Belum ada jasa di sini"}
          hint={
            filtered
              ? "Coba ubah kata kunci atau filter agar hasilnya lebih luas."
              : "Jadilah yang pertama memposting jasa di marketplace ini."
          }
          action={
            <Link to="/jasa/baru" className="btn btn-sm btn-primary catalog-hero-cta">
              + Post Jasa Baru
            </Link>
          }
        />
      ) : (
        <div className="catalog-grid is-jasa">
          {items.map((item) => <CatalogJasaCard key={item.id} item={item} />)}
        </div>
      )}
    </Layout>
  );
}
