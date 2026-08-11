import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { api } from "../../services/api.js";

export default function AdminKtpPage() {
  const [list, setList] = useState(null);

  useEffect(() => {
    api.adminKtp().then((d) => setList(d.data));
  }, []);

  if (!list) return <Loading />;

  return (
    <>
      <AdminPageHeader
        title="Antrian verifikasi KTP"
        subtitle="Tinjau foto KTP dan selfie sebelum menyetujui identitas pengguna."
      />

      {list.length === 0 ? (
        <EmptyState title="Tidak ada antrian KTP" hint="Semua pengajuan sudah diproses." />
      ) : (
        <div className="admin-table-wrap">
          <table className="table admin-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Email</th>
                <th>Nomor HP</th>
                <th>NIK</th>
                <th>Diajukan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.first_name} {u.last_name}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.phone || "-"}</td>
                  <td className="mono">{u.ktp_number}</td>
                  <td>{u.ktp_submitted_at ? new Date(u.ktp_submitted_at).toLocaleString("id-ID") : "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    <Link to={`/admin/ktp/${u.id}`} className="btn btn-sm btn-primary">Review</Link>
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
