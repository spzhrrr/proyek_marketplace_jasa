import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Alert from "../../components/Alert.jsx";
import { api } from "../../services/api.js";
import { rupiah } from "../../utils/format.js";

export default function AdminWithdrawalsPage() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function load() {
    api.adminWithdrawals().then((d) => setList(d.data || [])).catch((e) => setErr(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id) {
    const note = window.prompt("Catatan persetujuan transfer (Opsional):", "Transfer berhasil");
    if (note === null) return;
    try {
      await api.adminApproveWithdrawal(id, note);
      setMsg("Penarikan saldo disetujui & ditransfer");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function reject(id) {
    const note = window.prompt("Alasan penolakan (saldo akan dikembalikan ke dompet user):");
    if (!note || !note.trim()) return;
    try {
      await api.adminRejectWithdrawal(id, note.trim());
      setMsg("Penarikan saldo ditolak & dana dikembalikan ke dompet user");
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!list && !err) return <Loading />;

  return (
    <>
      <AdminPageHeader
        title="Penarikan saldo"
        subtitle="Setujui transfer ke rekening penjual atau tolak dan kembalikan dana ke wallet."
      />

      <Alert type="success">{msg}</Alert>
      <Alert>{err}</Alert>

      {list?.length === 0 ? (
        <EmptyState title="Tidak ada antrian penarikan" hint="Pengajuan penarikan saldo baru dari penjual akan muncul di sini." />
      ) : (
        <div className="admin-table-wrap">
          <table className="table admin-table" style={{ margin: 0 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th>Pengguna</th>
                <th>Nominal Penarikan</th>
                <th>Bank & Nomor Rekening</th>
                <th>Nama Pemilik Rekening</th>
                <th>Status</th>
                <th>Tanggal Diajukan</th>
                <th style={{ textAlign: "right" }}>Aksi Transfer</th>
              </tr>
            </thead>
            <tbody>
              {list?.map((w) => (
                <tr key={w.id}>
                  <td>
                    <strong>{w.user_name}</strong>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{w.email}</div>
                  </td>
                  <td><strong style={{ color: "#166534", fontSize: "1.05rem" }}>{rupiah(w.amount)}</strong></td>
                  <td><span className="badge badge-ok">{w.bank_name}</span> <span className="mono" style={{ marginLeft: "4px", letterSpacing: "1px" }}>{w.bank_account_number}</span></td>
                  <td>{w.bank_account_holder}</td>
                  <td>
                    <span className={`pill ${w.status === "PENDING" ? "pill-PENDING" : w.status === "APPROVED" ? "pill-ACCEPTED" : "pill-REJECTED"}`}>
                      {w.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{new Date(w.created_at).toLocaleString("id-ID")}</td>
                  <td style={{ textAlign: "right" }}>
                    {w.status === "PENDING" ? (
                      <div className="btn-row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => approve(w.id)}>Setujui</button>
                        <button type="button" className="btn btn-sm btn-cta-danger" onClick={() => reject(w.id)}>Tolak</button>
                      </div>
                    ) : (
                      <small className="muted">{w.note || "-"}</small>
                    )}
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
