import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import CategoryFilter from "../../components/CategoryFilter.jsx";
import ListSearchBar from "../../components/ListSearchBar.jsx";
import { api } from "../../services/api.js";
import { rupiah } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

function toListParams({ tipe, sub, q }) {
  const next = { tipe, sub };
  if (q) next.q = q;
  return next;
}

export default function JasaListPage() {
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
    api.jasaList({ tipe, sub, ...(q ? { q } : {}) }).then(setData);
  }, [tipe, sub, q]);

  if (!data) return <Layout wide compact><Loading /></Layout>;

  return (
    <Layout wide compact>
      <PageHeader
        title="Cari Jasa"
        subtitle="Temukan penyedia jasa digital & fisik terpercaya"
        action={<Link to="/jasa/baru" className="btn btn-primary">+ Post Jasa</Link>}
      />

      <div className="list-toolbar">
        <ListSearchBar
          value={q}
          onChange={(nextQ) => updateParams({ q: nextQ })}
          placeholder="Cari judul, deskripsi, kategori, atau penjual..."
        />
        <CategoryFilter
          tipe={tipe}
          sub={sub}
          onChange={({ tipe: t, sub: s }) => updateParams({ tipe: t, sub: s })}
        />
      </div>

      {data.data.length === 0 ? (
        <EmptyState
          title={q ? "Tidak ada jasa ditemukan" : "Belum ada jasa di kategori ini"}
          hint={
            q
              ? `Tidak ada hasil untuk "${q}". Coba kata kunci lain atau ubah filter.`
              : "Coba ubah filter atau jadi yang pertama posting jasa"
          }
          action={<Link to="/jasa/baru" className="btn btn-sm btn-primary">Post Jasa</Link>}
        />
      ) : (
        <div className="grid-listing">
          {data.data.map((item) => {
            const isMine = user && Number(item.seller_id) === Number(user.id);
            return (
            <Link key={item.id} to={`/jasa/${item.id}`} className="card-link">
              <article className="card-item">
                {item.cover_image_url ? (
                  <img src={item.cover_image_url} alt="" className="card-thumb" />
                ) : (
                  <div className="card-thumb card-thumb-placeholder">Tanpa cover</div>
                )}
                <div className="card-body">
                  <div className="card-tags">
                    <span className="badge">{item.category_name}</span>
                    {isMine && <span className="badge badge-mine">Jasa Saya</span>}
                  </div>
                  <h3>{item.title}</h3>
                  <p className="price">{rupiah(item.price)}</p>
                  <p className="card-meta">{item.seller_name}</p>
                </div>
              </article>
            </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
