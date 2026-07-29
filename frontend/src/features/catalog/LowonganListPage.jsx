import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import CategoryFilter from "../../components/CategoryFilter.jsx";
import ListSearchBar from "../../components/ListSearchBar.jsx";
import { api } from "../../services/api.js";
import { rupiah, jobStatusLabel } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

function toListParams({ tipe, sub, q }) {
  const next = { tipe, sub };
  if (q) next.q = q;
  return next;
}

function excerpt(text, max = 140) {
  if (!text) return "";
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
}

function formatDeadline(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function LowonganListPage() {
  const [params, setParams] = useSearchParams();
  const tipe = params.get("tipe") || "semua";
  const sub = params.get("sub") || "semua";
  const q = params.get("q") || "";
  const [data, setData] = useState(null);
  const { user } = useAuth();

  function updateParams(partial) {
    setParams(toListParams({ tipe, sub, q, ...partial }));
  }

  useEffect(() => {
    api.lowonganList({ tipe, sub, ...(q ? { q } : {}) }).then(setData);
  }, [tipe, sub, q]);

  if (!data) return <Layout wide compact><Loading /></Layout>;

  return (
    <Layout wide compact>
      <PageHeader
        title="Cari Lowongan"
        subtitle="Temukan pekerjaan freelance dan proyek dari pemberi kerja"
        action={<Link to="/lowongan/baru" className="btn btn-primary">+ Post Lowongan</Link>}
      />

      <div className="list-toolbar">
        <ListSearchBar
          value={q}
          onChange={(nextQ) => updateParams({ q: nextQ })}
          placeholder="Cari judul, deskripsi, kategori, atau pemberi kerja..."
        />
        <CategoryFilter
          tipe={tipe}
          sub={sub}
          onChange={({ tipe: t, sub: s }) => updateParams({ tipe: t, sub: s })}
        />
      </div>

      {data.data.length === 0 ? (
        <EmptyState
          title={q ? "Tidak ada lowongan ditemukan" : "Belum ada lowongan"}
          hint={
            q
              ? `Tidak ada hasil untuk "${q}". Coba kata kunci lain atau ubah filter.`
              : "Coba kategori lain atau post lowongan pertama"
          }
          action={<Link to="/lowongan/baru" className="btn btn-sm btn-primary">Post Lowongan</Link>}
        />
      ) : (
        <div className="job-list">
          {data.data.map((item) => {
            const deadline = formatDeadline(item.deadline);
            const isMine = user && Number(item.buyer_id) === Number(user.id);
            return (
              <Link key={item.id} to={`/lowongan/${item.id}`} className="job-list-item">
                <div className="job-list-main">
                  <div className="job-list-top">
                    <span className="badge">{item.category_name}</span>
                    {isMine && <span className="badge badge-mine">Lowongan Saya</span>}
                    <span className="pill pill-OPEN">{jobStatusLabel(item.status)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {item.description && (
                    <p className="job-list-desc">{excerpt(item.description)}</p>
                  )}
                  <p className="job-list-meta">
                    {item.buyer_name || item.poster_name}
                    {deadline ? ` · Deadline ${deadline}` : ""}
                  </p>
                </div>
                <div className="job-list-side">
                  <p className="price job-list-budget">{rupiah(item.budget)}</p>
                  <span className="job-list-cta">Lihat detail →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
