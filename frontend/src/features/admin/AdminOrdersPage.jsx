import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { api } from "../../services/api.js";
import { rupiah, orderStatusLabel } from "../../utils/format.js";

function statusClass(status) {
  if (status === "COMPLETED") return "badge-ok";
  if (status === "PENDING") return "badge-warn";
  if (status === "DISPUTED") return "badge-danger";
  if (status === "REJECTED" || status === "CANCELLED") return "badge-danger";
  return "badge-muted";
}

export default function AdminOrdersPage() {
  const [list, setList] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [noteById, setNoteById] = useState({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchOrders(statusFilter);
  }, [statusFilter]);

  function fetchOrders(st) {
    setMsg("");
    api.adminOrders(st).then((d) => setList(d.data));
  }

  async function resolve(orderId, outcome) {
    setBusyId(orderId);
    setMsg("");
    try {
      await api.adminResolveDispute(orderId, outcome, noteById[orderId] || "");
      setMsg(`Sengketa #${orderId} diselesaikan: ${outcome}`);
      fetchOrders(statusFilter);
    } catch (e) {
      setMsg(e.message || "Gagal resolve sengketa");
    } finally {
      setBusyId(null);
    }
  }

  if (!list) return <Loading />;

  const filtered = list.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.buyer_name?.toLowerCase().includes(q) ||
      o.seller_name?.toLowerCase().includes(q)
    );
  });

  const totalVolume = filtered.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <>
      <AdminPageHeader
        title="Pesanan"
        subtitle="Pantau escrow, sengketa, dan status transaksi."
      />

      {msg && (
        <p style={{ marginBottom: "12px", padding: "10px 14px", borderRadius: "10px", background: "#f0f9ff", color: "#0369a1", fontWeight: 700, fontSize: "0.875rem" }}>
          {msg}
        </p>
      )}

      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          {[
            { id: "all", label: "Semua" },
            { id: "PENDING", label: "Pending" },
            { id: "ACCEPTED", label: "Berjalan" },
            { id: "IN_PROGRESS", label: "Dikerjakan" },
            { id: "COMPLETED", label: "Selesai" },
            { id: "DISPUTED", label: "Sengketa" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-chip ${statusFilter === tab.id ? "active" : ""}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="admin-toolbar-right">
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            Volume: <strong style={{ color: "#166534" }}>{rupiah(totalVolume)}</strong>
          </span>
          <input
            type="text"
            className="admin-search"
            placeholder="Cari order, nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-table-wrap">
        {filtered.length === 0 ? (
          <p className="empty" style={{ padding: "24px" }}>Tidak ada pesanan ditemukan.</p>
        ) : (
          <table className="table admin-table" style={{ margin: 0 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th>No. Order</th>
                <th>Judul Proyek</th>
                <th>Pembeli (Buyer)</th>
                <th>Penjual (Freelancer)</th>
                <th>Nilai Transaksi</th>
                <th>Status</th>
                <th>Escrow</th>
                <th>Tanggal</th>
                <th>Aksi Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td><strong>{o.order_number}</strong></td>
                  <td>
                    {o.title}
                    {o.status === "DISPUTED" && o.cancel_reason && (
                      <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "4px" }}>
                        Alasan: {o.cancel_reason}
                      </div>
                    )}
                  </td>
                  <td>{o.buyer_name}</td>
                  <td>{o.seller_name}</td>
                  <td><strong style={{ color: "#0284c7" }}>{rupiah(o.amount)}</strong></td>
                  <td><span className={`badge ${statusClass(o.status)}`}>{orderStatusLabel(o.status)}</span></td>
                  <td><span className="badge badge-muted">{o.escrow}</span></td>
                  <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : "-"}
                  </td>
                  <td style={{ minWidth: "220px" }}>
                    {o.status === "DISPUTED" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <input
                          type="text"
                          placeholder="Catatan resolusi..."
                          value={noteById[o.id] || ""}
                          onChange={(e) => setNoteById((prev) => ({ ...prev, [o.id]: e.target.value }))}
                          style={{ padding: "6px 8px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => {
                              if (!window.confirm(`Refund dana order ${o.order_number} ke wallet pembeli?`)) return;
                              resolve(o.id, "REFUND");
                            }}
                            style={{ flex: 1, padding: "6px 8px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: "0.7rem", cursor: "pointer" }}
                          >
                            REFUND Buyer
                          </button>
                          <button
                            type="button"
                            disabled={busyId === o.id}
                            onClick={() => {
                              if (!window.confirm(`Cairkan dana order ${o.order_number} ke penjual?`)) return;
                              resolve(o.id, "RELEASE");
                            }}
                            style={{ flex: 1, padding: "6px 8px", borderRadius: "8px", border: "none", background: "#166534", color: "#fff", fontWeight: 800, fontSize: "0.7rem", cursor: "pointer" }}
                          >
                            RELEASE Seller
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
