import { useEffect, useState } from "react";
import Loading from "../../components/Loading.jsx";
import Alert from "../../components/Alert.jsx";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { api } from "../../services/api.js";
import { formatDate } from "../../utils/format.js";

export default function AdminReportsPage() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [actionErr, setActionErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetchReports();
  }, []);

  function fetchReports() {
    setErr("");
    api.adminReports()
      .then((d) => setList(d.data || []))
      .catch((e) => {
        setErr(e.message || "Gagal memuat laporan user");
        setList([]);
      });
  }

  async function handleAction(report, action) {
    let note = "";
    if (action === "WARNING") {
      const input = window.prompt(`Kirim Peringatan resmi ke user "${report.reported_name}":`, "Harap patuhi aturan dan panduan komunitas Tolongin.");
      if (input === null) return;
      note = input;
    } else if (action === "BANNED") {
      if (!confirm(`SANKSI BERAT: Apakah Anda yakin ingin memblokir/membekukan akun "${report.reported_name}"?`)) return;
      const input = window.prompt(`Alasan pembekuan akun "${report.reported_name}":`, "Pelanggaran serius aturan platform.");
      if (input === null) return;
      note = input;
    } else if (action === "DISMISS") {
      const input = window.prompt(`Alasan mengabaikan/menolak laporan ini:`, "Laporan tidak terbukti atau tidak melanggar aturan.");
      if (input === null) return;
      note = input;
    }

    setActionErr("");
    setSuccessMsg("");
    try {
      await api.adminActionReport(report.id, {
        action,
        admin_note: note,
        reported_user_id: report.reported_user_id,
      });
      setSuccessMsg(`Tindakan ${action} berhasil diterapkan pada laporan #${report.id}`);
      fetchReports();
    } catch (e) {
      setActionErr(e.message || "Gagal memproses tindakan");
    }
  }

  if (err && !list) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Alert>{err}</Alert>
        <button type="button" className="btn btn-primary" onClick={fetchReports}>Coba lagi</button>
      </div>
    );
  }

  if (!list) return <Loading />;

  const filtered = list.filter((r) => {
    if (filterStatus === "pending") return r.status === "PENDING";
    if (filterStatus === "resolved") return r.status === "RESOLVED";
    if (filterStatus === "dismissed") return r.status === "DISMISSED";
    return true;
  });

  return (
    <>
      <AdminPageHeader
        title="Laporan user"
        subtitle="Tinjau pengaduan dan terapkan peringatan, ban, atau abaikan."
      />

      {actionErr && <Alert>{actionErr}</Alert>}
      {successMsg && <Alert variant="success">{successMsg}</Alert>}

      <div className="admin-toolbar">
        <div className="admin-toolbar-left">
          {[
            { id: "all", label: "Semua" },
            { id: "pending", label: "Perlu ditinjau" },
            { id: "resolved", label: "Selesai" },
            { id: "dismissed", label: "Diabaikan" },
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
      </div>

      <div className="admin-table-wrap">
        {filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            <span>Tidak ada laporan pada filter ini.</span>
          </div>
        ) : (
          <table className="table admin-table" style={{ margin: 0 }}>
            <thead style={{ background: "#f8fafc" }}>
              <tr>
                <th>Pelapor</th>
                <th>User Dilaporkan</th>
                <th>Alasan & Detail</th>
                <th>Status</th>
                <th>Tindakan Sanksi</th>
                <th>Aksi Admin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong style={{ color: "#0f172a", display: "block" }}>{r.reporter_name}</strong>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.reporter_email}</span>
                  </td>
                  <td>
                    <strong style={{ color: "#0f172a", display: "block" }}>{r.reported_name}</strong>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.reported_email}</span>
                    {r.reported_is_banned === 1 && (
                      <span className="badge badge-danger" style={{ display: "inline-block", marginTop: "4px" }}>
                        Dibanned
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: "300px" }}>
                    <span style={{ fontWeight: 800, color: "#dc2626", display: "block" }}>{r.reason}</span>
                    <p style={{ fontSize: "0.8rem", color: "#475569", margin: "4px 0 0" }}>{r.description || "-"}</p>
                    <span style={{ fontSize: "0.725rem", color: "#94a3b8" }}>{formatDate(r.created_at)}</span>
                  </td>
                  <td>
                    {r.status === "PENDING" && <span className="badge badge-warn">Pending</span>}
                    {r.status === "RESOLVED" && <span className="badge badge-ok">Selesai</span>}
                    {r.status === "DISMISSED" && <span className="badge badge-muted">Diabaikan</span>}
                  </td>
                  <td>
                    {r.action_taken === "WARNING" && <span style={{ color: "#d97706", fontWeight: 800 }}>Peringatan</span>}
                    {r.action_taken === "BANNED" && <span style={{ color: "#dc2626", fontWeight: 800 }}>Banned</span>}
                    {r.action_taken === "NONE" && <span style={{ color: "#64748b" }}>-</span>}
                    {r.admin_note && (
                      <div style={{ fontSize: "0.75rem", color: "#475569", fontStyle: "italic", marginTop: "2px" }}>
                        Catatan: "{r.admin_note}"
                      </div>
                    )}
                  </td>
                  <td>
                    {r.status === "PENDING" && r.reported_role === "ADMIN" ? (
                      <span style={{ fontSize: "0.775rem", color: "#94a3b8" }}>Akun operasional — tidak dapat disanksi</span>
                    ) : r.status === "PENDING" ? (
                      <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                          onClick={() => handleAction(r, "WARNING")}
                        >
                          Peringatan
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-cta-danger"
                          onClick={() => handleAction(r, "BANNED")}
                        >
                          Ban akun
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: "#f1f5f9", color: "#475569" }}
                          onClick={() => handleAction(r, "DISMISS")}
                        >
                          Abaikan
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.775rem", color: "#94a3b8" }}>Selesai ditinjau</span>
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
