import { Link } from "react-router-dom";
import CategoryFilter from "./CategoryFilter.jsx";

export default function CatalogHero({
  variant = "jasa",
  title,
  subtitle,
  badge,
  postLink,
  postLabel,
  q,
  tipe,
  sub,
  sort,
  city,
  priceRange,
  onParamsChange,
  resultCount,
  resultLabel,
}) {
  const isJasa = variant === "jasa";

  return (
    <header className={`catalog-hero ${isJasa ? "catalog-hero-jasa" : "catalog-hero-kerja"}`}>
      <div className="catalog-hero-top">
        <div className="catalog-hero-copy">
          <span className="catalog-hero-badge">{badge}</span>
          <h1 className="catalog-hero-title">{title}</h1>
          <p className="catalog-hero-sub">{subtitle}</p>
        </div>
        <Link to={postLink} className={`catalog-hero-cta ${isJasa ? "cta-jasa" : "cta-kerja"}`}>
          {postLabel}
        </Link>
      </div>

      <div className="catalog-filter-bar">
        <div className="catalog-search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => onParamsChange({ q: e.target.value })}
            placeholder={isJasa ? "Cari jasa..." : "Cari pekerjaan..."}
            aria-label={isJasa ? "Cari jasa" : "Cari pekerjaan"}
          />
        </div>

        <div className="catalog-type-pills">
          {[
            { key: "semua", label: "Semua" },
            { key: "DIGITAL", label: "Digital" },
            { key: "PHYSICAL", label: "Fisik" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`catalog-type-pill ${tipe === key ? "active" : ""}`}
              onClick={() =>
                onParamsChange({
                  tipe: key,
                  sub: "semua",
                  ...(key === "semua" || key === "DIGITAL" ? { city: "semua" } : {}),
                })
              }
            >
              {label}
            </button>
          ))}
        </div>

        <CategoryFilter
          tipe={tipe}
          sub={sub}
          sort={sort}
          city={city}
          priceRange={priceRange}
          isJob={!isJasa}
          onChange={({ tipe: t, sub: s, sort: st, city: c, priceRange: pr }) =>
            onParamsChange({ tipe: t, sub: s, sort: st, city: c, priceRange: pr })
          }
        />

        <span className={`catalog-result-count ${isJasa ? "count-jasa" : "count-kerja"}`}>
          {resultCount} {resultLabel}
        </span>
      </div>
    </header>
  );
}
