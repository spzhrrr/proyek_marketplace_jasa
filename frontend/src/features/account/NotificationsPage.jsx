import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { BellIcon, ChatIcon } from "../../components/BellIcon.jsx";
import { api } from "../../services/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { timeAgo } from "../../utils/format.js";

function cleanTitle(title) {
  return String(title || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
}

function toneOf(type) {
  const t = String(type || "");
  if (/CHAT/.test(t)) return "chat";
  if (/REJECT|CANCEL|BANNED|WARNING|DISPUTE/.test(t)) return "warn";
  if (/APPROVED|ACCEPTED|SUCCESS|COMPLETED|CONFIRMED|SENT|CREATED/.test(t)) return "ok";
  if (/JOB|APPLICATION|LOWONGAN/.test(t)) return "job";
  if (/PAYMENT|WITHDRAWAL|REFUND/.test(t)) return "money";
  return "info";
}

function ctaOf(n) {
  const url = n.link_url || "";
  if (url.includes("/chat")) return "Buka chat";
  if (url.includes("/lamaran") || url.includes("/lamar")) return "Lihat lamaran";
  if (url.includes("/orders")) return "Lihat pesanan";
  if (url.includes("/jasa")) return "Buka jasa";
  if (url.includes("/lowongan")) return "Buka lowongan";
  if (url.includes("/verify")) return "Lanjut verifikasi";
  if (url.includes("/dashboard")) return "Buka beranda";
  if (url) return "Buka";
  return null;
}

function NotifIcon({ tone }) {
  if (tone === "chat") return <ChatIcon size={16} />;
  return <BellIcon size={16} />;
}

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
    <div className="notif-page">
      <header className="dash-head">
        <div>
          <h1>Notifikasi</h1>
          <p className="dash-lead">
            {unread > 0 ? `${unread} belum dibaca` : "Semua sudah dibaca"}
          </p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn-sm" onClick={markAll}>
            Tandai semua dibaca
          </button>
        )}
      </header>

      {list.length === 0 ? (
        <div className="dash-workspace">
          <EmptyState
            icon={<BellIcon size={28} />}
            title="Belum ada notifikasi"
            hint="Lamaran, pesanan, chat, dan verifikasi akan muncul di sini."
          />
        </div>
      ) : (
        <div className="notif-stack">
          {list.map((n) => {
            const tone = toneOf(n.type);
            const cta = ctaOf(n);
            return (
              <button
                key={n.id}
                type="button"
                className={`notif-row ${n.is_read ? "is-read" : "is-unread"} is-${tone}`}
                onClick={() => openNotif(n.id)}
              >
                <span className={`notif-ico is-${tone}`}>
                  <NotifIcon tone={tone} />
                </span>
                <span className="notif-body">
                  <span className="notif-top">
                    <strong>{cleanTitle(n.title)}</strong>
                    <small>{timeAgo(n.created_at)}</small>
                  </span>
                  <span className="notif-msg">{n.message}</span>
                  {cta ? <span className="notif-cta">{cta}</span> : null}
                </span>
                {!n.is_read ? <span className="inbox-unread" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute><NotifContent /></ProtectedRoute>
    </Layout>
  );
}
