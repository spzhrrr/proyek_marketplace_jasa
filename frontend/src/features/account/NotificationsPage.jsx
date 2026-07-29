import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";

function NotifContent() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [list, setList] = useState(null);

  useEffect(() => {
    api.notifikasi().then((d) => setList(d.notifications));
  }, []);

  async function openNotif(id) {
    const res = await api.notifikasiBaca(id);
    await refresh();
    if (res.link_url) nav(res.link_url);
    else api.notifikasi().then((d) => setList(d.notifications));
  }

  async function markAll() {
    await api.notifikasiBacaSemua();
    await refresh();
    api.notifikasi().then((d) => setList(d.notifications));
  }

  if (!list) return <Loading />;

  const unread = list.filter((n) => !n.is_read).length;

  return (
    <>
      <PageHeader
        title="Notifikasi"
        subtitle={unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
        action={unread > 0 ? (
          <button type="button" className="btn btn-sm" onClick={markAll}>Tandai semua dibaca</button>
        ) : null}
      />
      {list.length === 0 ? (
        <EmptyState icon="🔔" title="Belum ada notifikasi" hint="Notifikasi transaksi dan lamaran akan muncul di sini" />
      ) : (
        <div className="panel page-panel notif-list-in-panel">
          <ul className="notif-list">
          {list.map((n) => (
            <li key={n.id} className={n.is_read ? "read" : "unread"}>
              <button type="button" className="notif-item" onClick={() => openNotif(n.id)}>
                <strong>{n.title}</strong>
                <span>{n.message}</span>
                <small>{new Date(n.created_at).toLocaleString("id-ID")}</small>
              </button>
            </li>
          ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <Layout narrow>
      <ProtectedRoute><NotifContent /></ProtectedRoute>
    </Layout>
  );
}
