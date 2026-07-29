import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";
import { ktpStatusLabel } from "../../utils/verification.js";

function badgeClass(status) {
  if (status === "APPROVED") return "badge-ok";
  if (status === "PENDING") return "badge-warn";
  if (status === "REJECTED") return "badge-danger";
  return "badge-muted";
}

export default function AdminUsersPage() {
  const [list, setList] = useState(null);

  useEffect(() => {
    api.adminUsers().then((d) => setList(d.data));
  }, []);

  if (!list) return <Loading />;

  return (
    <>
      <h1>Pengguna</h1>
      <p className="muted">Daftar pengguna terdaftar beserta status verifikasi.</p>

      <table className="table admin-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Email</th>
            <th>HP</th>
            <th>Email ✓</th>
            <th>HP ✓</th>
            <th>Status KTP</th>
            <th>Daftar</th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id}>
              <td>{u.first_name} {u.last_name}</td>
              <td>{u.email}</td>
              <td>{u.phone}</td>
              <td>{u.email_verified_at ? "Ya" : "Tidak"}</td>
              <td>{u.phone_verified_at ? "Ya" : "Tidak"}</td>
              <td><span className={`badge ${badgeClass(u.ktp_status)}`}>{ktpStatusLabel(u.ktp_status)}</span></td>
              <td>{u.created_at ? new Date(u.created_at).toLocaleDateString("id-ID") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
