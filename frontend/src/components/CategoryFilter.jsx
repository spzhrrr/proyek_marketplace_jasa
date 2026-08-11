import { useEffect, useState } from "react";
import { api } from "../services/api.js";

function IconFolder() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconSort() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M6 12h12M10 18h4" />
    </svg>
  );
}

export default function CategoryFilter({ tipe, sub, sort = "terbaru", city = "semua", priceRange = "semua", isJob = false, onChange }) {
  const [roots, setRoots] = useState([]);
  const [tree, setTree] = useState({});
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    api.categories().then((d) => {
      setRoots(d.roots || []);
      setTree(d.tree || {});
    }).catch(() => {
      setRoots([]);
      setTree({});
    });
  }, []);

  useEffect(() => {
    if (!tree || Object.keys(tree).length === 0) {
      setSubs([]);
      return;
    }
    if (tipe === "semua" || !tipe) {
      setSubs(Object.values(tree).flat());
      return;
    }
    const tipeUpper = String(tipe).toUpperCase();
    const root = roots.find(
      (r) =>
        r.url_code.toUpperCase() === tipeUpper ||
        r.type?.toUpperCase() === tipeUpper ||
        (tipeUpper === "PHYSICAL" && (r.url_code === "fisik" || r.type === "PHYSICAL")) ||
        (tipeUpper === "DIGITAL" && (r.url_code === "digital" || r.type === "DIGITAL"))
    );
    if (root) {
      setSubs(tree[root.url_code] || []);
      return;
    }
    const matchedKey = Object.keys(tree).find(
      (k) => k.toUpperCase() === tipeUpper || (tipeUpper === "PHYSICAL" && k === "fisik") || (tipeUpper === "DIGITAL" && k === "digital")
    );
    setSubs(matchedKey ? tree[matchedKey] : Object.values(tree).flat());
  }, [tipe, roots, tree]);

  const showCity = tipe === "PHYSICAL" || tipe === "fisik" || city !== "semua";

  return (
    <div className="catalog-filter-group">
      <label className="catalog-select-chip" title="Subkategori">
        <IconFolder />
        <select
          value={sub}
          onChange={(e) => onChange({ tipe, sub: e.target.value, sort, city, priceRange })}
          className="catalog-filter-select"
        >
          <option value="semua">Kategori</option>
          {subs.map((s) => (
            <option key={s.id} value={s.url_code}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="catalog-select-chip" title={isJob ? "Rentang budget" : "Rentang harga"}>
        <IconTag />
        <select
          value={priceRange}
          onChange={(e) => onChange({ tipe, sub, sort, city, priceRange: e.target.value })}
          className="catalog-filter-select"
        >
          <option value="semua">{isJob ? "Budget" : "Harga"}</option>
          <option value="under_100k">&lt; 100rb</option>
          <option value="100k_500k">100–500rb</option>
          <option value="500k_1m">500rb–1jt</option>
          <option value="over_1m">&gt; 1jt</option>
        </select>
      </label>

      {showCity && (
        <label className="catalog-select-chip" title="Lokasi">
          <IconPin />
          <select
            value={city}
            onChange={(e) => onChange({ tipe, sub, sort, city: e.target.value, priceRange })}
            className="catalog-filter-select"
          >
            <option value="semua">Lokasi</option>
            <option value="Jakarta">Jakarta</option>
            <option value="Bandung">Bandung</option>
            <option value="Surabaya">Surabaya</option>
            <option value="Tangerang">Tangerang</option>
            <option value="Yogyakarta">Yogyakarta</option>
            <option value="Bekasi">Bekasi</option>
            <option value="Depok">Depok</option>
            <option value="Semarang">Semarang</option>
            <option value="Medan">Medan</option>
            <option value="Bali">Bali</option>
          </select>
        </label>
      )}

      <label className="catalog-select-chip" title="Urutkan">
        <IconSort />
        <select
          value={sort}
          onChange={(e) => onChange({ tipe, sub, sort: e.target.value, city, priceRange })}
          className="catalog-filter-select"
        >
          <option value="terbaru">Terbaru</option>
          {!isJob && <option value="rating">Rating tertinggi</option>}
          {!isJob && <option value="termurah">Harga terendah</option>}
          {!isJob && <option value="termahal">Harga tertinggi</option>}
          {isJob && <option value="budget_tinggi">Budget tertinggi</option>}
          {isJob && <option value="budget_rendah">Budget terendah</option>}
        </select>
      </label>
    </div>
  );
}
