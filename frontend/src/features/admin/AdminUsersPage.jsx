import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { api } from "../../services/api.js";
import { bankStatusLabel, ktpStatusLabel } from "../../utils/verification.js";
import { orderStatusLabel, rupiah } from "../../utils/format.js";

function badgeClass(status) {
  if (status === "APPROVED") return "badge-ok";
  if (status === "PENDING") return "badge-warn";
  if (status === "REJECTED") return "badge-danger";
  return "badge-muted";
}

function orderBadge(status) {
  if (status === "COMPLETED") return "badge-ok";
  if (status === "PENDING" || status === "ACCEPTED" || status === "IN_PROGRESS") return "badge-warn";
  if (status === "DISPUTED" || status === "REJECTED" || status === "CANCELLED") return "badge-danger";
  return "badge-muted";
}

function initials(user) {
  return `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase() || "U";
}

function mediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return path;
}

export default function AdminUsersPage() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  function fetchUsers() {
    api.adminUsers()
      .then((d) => setList((d.data || []).filter((u) => u.role !== "ADMIN")))
      .catch((e) => {
        setErr(e.message || "Gagal memuat daftar pengguna");
        setList([]);
      });
  }

  async function openInspector(userId) {
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setActiveTab("profile");
    try {
      const res = await api.adminUserDetail(userId);
      setUserDetail(res);
    } catch (error) {
      setErr(error.message || "Gagal memuat detail pengguna");
      setSelectedUserId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  if (err && !list) {
    return (
      <div className="admin-error-block">
        <Alert>{err}</Alert>
        <button type="button" className="btn btn-primary" onClick={fetchUsers}>Coba lagi</button>
      </div>
    );
  }

  if (!list) return <Loading />;

  const filtered = list.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q);

    if (!matchesSearch) return false;
    if (filterStatus === "banned") return Number(u.is_banned) === 1;
    if (filterStatus === "approved_ktp") return u.ktp_status === "APPROVED";
    if (filterStatus === "pending_ktp") return u.ktp_status === "PENDING";
    if (filterStatus === "pending_bank") return u.bank_status === "PENDING";
    return true;
  });

  const u = userDetail?.user;

  return (
    <>
      <AdminPageHeader
        title="Pengguna"
        subtitle="Daftar akun marketplace. Akun admin operasional tidak ditampilkan di sini."
      />

      {err ? <Alert>{err}</Alert> : null}

      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          {[
            { id: "all", label: "Semua" },
            { id: "approved_ktp", label: "KTP disetujui" },
            { id: "pending_ktp", label: "KTP pending" },
            { id: "pending_bank", label: "Bank pending" },
            { id: "banned", label: "Dibanned" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-chip ${filterStatus === tab.id ? "active" : ""}`}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="admin-toolbar-right">
          <span className="admin-count">{filtered.length} akun</span>
          <input
            type="search"
            className="admin-search"
            placeholder="Cari nama, email, HP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada pengguna" hint="Coba ubah kata kunci atau filter status." />
      ) : (
        <div className="admin-table-wrap">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Kontak</th>
                <th>KTP</th>
                <th>Bank</th>
                <th>Akun</th>
                <th>Terdaftar</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="admin-person">
                      <span className="admin-avatar">{initials(row)}</span>
                      <div>
                        <strong>{row.first_name} {row.last_name}</strong>
                        <span className="admin-person-sub">Akun marketplace</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-stack">
                      <span>{row.email}</span>
                      <span className="muted">{row.phone || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${badgeClass(row.ktp_status)}`}>{ktpStatusLabel(row.ktp_status)}</span>
                  </td>
                  <td>
                    <span className={`badge ${badgeClass(row.bank_status)}`}>{bankStatusLabel(row.bank_status)}</span>
                  </td>
                  <td>
                    {Number(row.is_banned) === 1 ? (
                      <span className="badge badge-danger">Dibanned</span>
                    ) : (
                      <span className="badge badge-ok">Aktif</span>
                    )}
                  </td>
                  <td className="admin-date">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString("id-ID") : "—"}
                  </td>
                  <td className="admin-cell-action">
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => openInspector(row.id)}>
                      Inspeksi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUserId && (
        <div className="admin-inspect-backdrop" onClick={() => { setSelectedUserId(null); setUserDetail(null); }}>
          <div className="admin-inspect" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="admin-inspect-head">
              <div>
                <p className="admin-inspect-kicker">Inspeksi akun</p>
                <h2>{u ? `${u.first_name} ${u.last_name}` : "Memuat..."}</h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => { setSelectedUserId(null); setUserDetail(null); }}
              >
                Tutup
              </button>
            </div>

            {loadingDetail || !userDetail ? (
              <Loading />
            ) : (
              <>
                <div className="admin-inspect-tabs">
                  {[
                    { id: "profile", label: "Profil" },
                    { id: "buyer_orders", label: `Pembelian (${userDetail.ordersAsBuyer?.length || 0})` },
                    { id: "seller_orders", label: `Penjualan (${userDetail.ordersAsSeller?.length || 0})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`admin-inspect-tab ${activeTab === tab.id ? "active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "profile" && (
                  <div className="admin-inspect-body">
                    <div className="admin-inspect-hero">
                      <span className="admin-avatar admin-avatar-lg">
                        {u.profilepic_url ? <img src={mediaUrl(u.profilepic_url)} alt="" /> : initials(u)}
                      </span>
                      <div>
                        <h3>
                          {u.first_name} {u.last_name}
                          {Number(u.is_banned) === 1
                            ? <span className="badge badge-danger">Dibanned</span>
                            : <span className="badge badge-ok">Aktif</span>}
                        </h3>
                        <p>{u.bio || "Belum ada bio."}</p>
                      </div>
                    </div>

                    <div className="admin-inspect-grid">
                      <section className="admin-detail-panel">
                        <h3>Kontak</h3>
                        <dl className="admin-dl">
                          <div><dt>Email</dt><dd>{u.email} · {u.email_verified_at ? "Terverifikasi" : "Belum"}</dd></div>
                          <div><dt>HP</dt><dd>{u.phone || "—"} · {u.phone_verified_at ? "Terverifikasi" : "Belum"}</dd></div>
                          <div><dt>Member sejak</dt><dd>{u.created_at ? new Date(u.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}</dd></div>
                          <div><dt>Saldo wallet</dt><dd>{rupiah(u.wallet_balance)}</dd></div>
                        </dl>
                      </section>
                      <section className="admin-detail-panel">
                        <h3>Lokasi</h3>
                        <dl className="admin-dl">
                          <div><dt>Kota</dt><dd>{u.city || "—"}</dd></div>
                          <div><dt>Provinsi</dt><dd>{u.province || "—"}</dd></div>
                          <div><dt>Login</dt><dd>{u.is_active ? "Aktif" : "Nonaktif"}</dd></div>
                          <div><dt>Sanksi</dt><dd>{Number(u.is_banned) === 1 ? "Dibanned" : "Tidak ada"}</dd></div>
                        </dl>
                      </section>
                      <section className="admin-detail-panel">
                        <h3>Identitas KTP</h3>
                        <dl className="admin-dl">
                          <div><dt>Status</dt><dd><span className={`badge ${badgeClass(u.ktp_status)}`}>{ktpStatusLabel(u.ktp_status)}</span></dd></div>
                          <div><dt>Nama KTP</dt><dd>{u.ktp_name || "—"}</dd></div>
                          <div><dt>NIK</dt><dd>{u.ktp_number || "—"}</dd></div>
                          <div><dt>TTL</dt><dd>{u.ktp_birthplace || "—"}{u.ktp_birthdate ? `, ${new Date(u.ktp_birthdate).toLocaleDateString("id-ID")}` : ""}</dd></div>
                          <div><dt>Alamat</dt><dd>{u.ktp_address || "—"}</dd></div>
                          {u.ktp_rejected_reason ? <div><dt>Alasan tolak</dt><dd className="admin-danger-text">{u.ktp_rejected_reason}</dd></div> : null}
                        </dl>
                      </section>
                      <section className="admin-detail-panel">
                        <h3>Rekening</h3>
                        <dl className="admin-dl">
                          <div><dt>Status</dt><dd><span className={`badge ${badgeClass(u.bank_status)}`}>{bankStatusLabel(u.bank_status)}</span></dd></div>
                          <div><dt>Bank</dt><dd>{u.bank_name || "—"}</dd></div>
                          <div><dt>Nomor</dt><dd>{u.bank_account_number || "—"}</dd></div>
                          <div><dt>Pemilik</dt><dd>{u.bank_account_holder || "—"}</dd></div>
                          {u.bank_rejected_reason ? <div><dt>Alasan tolak</dt><dd className="admin-danger-text">{u.bank_rejected_reason}</dd></div> : null}
                        </dl>
                      </section>
                    </div>

                    <section className="admin-detail-panel">
                      <h3>Dokumen KTP</h3>
                      {u.ktp_photo_url || u.ktp_selfie_url ? (
                        <div className="admin-doc-grid">
                          <div>
                            <span className="admin-doc-label">Foto KTP</span>
                            {u.ktp_photo_url ? (
                              <a href={mediaUrl(u.ktp_photo_url)} target="_blank" rel="noreferrer">
                                <img src={mediaUrl(u.ktp_photo_url)} alt="KTP" className="admin-doc-img" />
                              </a>
                            ) : <div className="admin-doc-empty">Belum diunggah</div>}
                          </div>
                          <div>
                            <span className="admin-doc-label">Selfie dengan KTP</span>
                            {u.ktp_selfie_url ? (
                              <a href={mediaUrl(u.ktp_selfie_url)} target="_blank" rel="noreferrer">
                                <img src={mediaUrl(u.ktp_selfie_url)} alt="Selfie KTP" className="admin-doc-img" />
                              </a>
                            ) : <div className="admin-doc-empty">Belum diunggah</div>}
                          </div>
                        </div>
                      ) : (
                        <p className="muted">Belum ada dokumen identitas.</p>
                      )}
                    </section>
                  </div>
                )}

                {activeTab === "buyer_orders" && (
                  <OrderTable rows={userDetail.ordersAsBuyer} empty="Belum ada pembelian." />
                )}
                {activeTab === "seller_orders" && (
                  <OrderTable rows={userDetail.ordersAsSeller} empty="Belum ada penjualan." seller />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function OrderTable({ rows, empty, seller }) {
  if (!rows?.length) return <p className="admin-empty-inline">{empty}</p>;
  return (
    <div className="admin-table-wrap admin-inspect-table">
      <table className="table admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Judul</th>
            <th>{seller ? "Pendapatan" : "Total"}</th>
            <th>Status</th>
            <th>Tanggal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.order_number}</td>
              <td>{o.title}</td>
              <td>{rupiah(seller ? o.seller_net_amount || o.amount : o.amount)}</td>
              <td><span className={`badge ${orderBadge(o.status)}`}>{orderStatusLabel(o.status)}</span></td>
              <td>{o.created_at ? new Date(o.created_at).toLocaleDateString("id-ID") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
