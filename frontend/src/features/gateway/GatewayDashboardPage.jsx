import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PagePanel from "../../components/PagePanel.jsx";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { api } from "../../services/api.js";
import { rupiah, paymentStatusLabel } from "../../utils/format.js";

export default function GatewayDashboardPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTransactions().then(setList).finally(() => setLoading(false));
  }, []);

  return (
    <PagePanel title="Halaman Pembayaran" subtitle="Daftar transaksi yang menunggu atau sudah dibayar">
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState title="Belum ada transaksi" hint="Transaksi muncul saat kamu melakukan pembayaran pesanan" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Deskripsi</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.transaction_code}</td>
                  <td>{tx.description || "-"}</td>
                  <td>{rupiah(tx.amount)}</td>
                  <td><span className={`pill pill-${tx.status}`}>{paymentStatusLabel(tx.status)}</span></td>
                  <td><Link to={`/gateway/pay/${tx.transaction_code}`} className="btn btn-sm btn-primary">Bayar</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PagePanel>
  );
}
