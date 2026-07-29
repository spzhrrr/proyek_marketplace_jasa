import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";

export default function AdminKtpPage() {
  const [list, setList] = useState(null);

  useEffect(() => {
    api.adminKtp().then((d) => setList(d.data));
  }, []);

  if (!list) return <Loading />;

  return (
    <>
      <h1>Verifikasi KTP</h1>
      <p className="muted">Tinjau dokumen identitas pengguna yang menunggu persetujuan.</p>

      {list.length === 0 ? (
        <p className="empty">Tidak ada antrian verifikasi KTP.</p>
      ) : (
        <table className="table admin-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>HP</th>
              <th>NIK</th>
              <th>Diajukan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.first_name} {u.last_name}</td>
                <td>{u.email}</td>
                <td>{u.phone}</td>
                <td>{u.ktp_number}</td>
                <td>{u.ktp_submitted_at ? new Date(u.ktp_submitted_at).toLocaleString("id-ID") : "-"}</td>
                <td>
                  <Link to={`/admin/ktp/${u.id}`} className="btn btn-sm btn-primary">Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
