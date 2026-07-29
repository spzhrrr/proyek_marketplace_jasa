import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";
import { rupiah } from "../../utils/format.js";

function statusClass(status) {
  if (status === "COMPLETED") return "badge-ok";
  if (status === "PENDING") return "badge-warn";
  if (status === "REJECTED" || status === "CANCELLED") return "badge-danger";
  return "badge-muted";
}

export default function AdminOrdersPage() {
  const [list, setList] = useState(null);

  useEffect(() => {
    api.adminOrders().then((d) => setList(d.data));
  }, []);

  if (!list) return <Loading />;

  return (
    <>
      <h1>Pesanan</h1>
      <p className="muted">Monitoring semua transaksi marketplace.</p>

      {list.length === 0 ? (
        <p className="empty">Belum ada pesanan.</p>
      ) : (
        <table className="table admin-table">
          <thead>
            <tr>
              <th>No. Order</th>
              <th>Judul</th>
              <th>Pembeli</th>
              <th>Penjual</th>
              <th>Nilai</th>
              <th>Status</th>
              <th>Escrow</th>
              <th>Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>{o.title}</td>
                <td>{o.buyer_name}</td>
                <td>{o.seller_name}</td>
                <td>{rupiah(o.amount)}</td>
                <td><span className={`badge ${statusClass(o.status)}`}>{o.status}</span></td>
                <td>{o.escrow}</td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
