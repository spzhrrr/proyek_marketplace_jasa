import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { api } from "../../services/api.js";

function maskAccount(num) {
  if (!num || num.length < 4) return num || "-";
  return `****${String(num).slice(-4)}`;
}

export default function AdminBankPage() {
  const [list, setList] = useState(null);

  useEffect(() => {
    api.adminBank().then((d) => setList(d.data));
  }, []);

  if (!list) return <Loading />;

  return (
    <>
      <AdminPageHeader
        title="Antrian verifikasi rekening"
        subtitle="Pastikan nama pemilik rekening sama dengan nama di KTP sebelum menyetujui."
      />

      {list.length === 0 ? (
        <EmptyState title="Tidak ada antrian rekening" hint="Pengajuan baru akan muncul di sini." />
      ) : (
        <div className="admin-table-wrap">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Email</th>
                <th>Bank</th>
                <th>Rekening</th>
                <th>Nama pemilik</th>
                <th>Diajukan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.first_name} {u.last_name}</strong></td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-ok">{u.bank_name}</span></td>
                  <td className="mono">{maskAccount(u.bank_account_number)}</td>
                  <td>{u.bank_account_holder}</td>
                  <td>{u.bank_submitted_at ? new Date(u.bank_submitted_at).toLocaleString("id-ID") : "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/admin/bank/${u.id}`} className="btn btn-sm btn-primary">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
