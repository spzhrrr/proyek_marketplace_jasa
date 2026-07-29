import { useEffect, useState } from "react";
import { api } from "../services/api.js";

export default function CategoryFilter({ tipe, sub, onChange }) {
  const [roots, setRoots] = useState([]);
  const [tree, setTree] = useState({});
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    api.categories().then((d) => {
      setRoots(d.roots || []);
      setTree(d.tree || {});
    });
  }, []);

  useEffect(() => {
    if (tipe === "semua") {
      setSubs([]);
      return;
    }
    const root = roots.find((r) => r.url_code === tipe);
    if (root) setSubs(tree[root.url_code] || []);
    else setSubs([]);
  }, [tipe, roots, tree]);

  return (
    <div className="filter-bar">
      <label>
        Jenis
        <select value={tipe} onChange={(e) => onChange({ tipe: e.target.value, sub: "semua" })}>
          <option value="semua">Semua</option>
          {roots.map((p) => (
            <option key={p.id} value={p.url_code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sub kategori
        <select value={sub} onChange={(e) => onChange({ tipe, sub: e.target.value })} disabled={tipe === "semua"}>
          <option value="semua">Semua</option>
          {subs.map((s) => (
            <option key={s.id} value={s.url_code}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
