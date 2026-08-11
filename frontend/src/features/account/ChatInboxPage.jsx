import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import ProtectedRoute from "../../components/ProtectedRoute.jsx";
import { api } from "../../services/api.js";
import { timeAgo } from "../../utils/format.js";
import { useAuth } from "../../context/AuthContext.jsx";

function matchesFilter(t, kind, listingId) {
  if (kind && t.listingKind !== kind) return false;
  if (listingId && Number(t.listingId) !== Number(listingId)) return false;
  return true;
}

function sortThreads(list) {
  return [...list].sort((a, b) => {
    if (Boolean(b.unread) !== Boolean(a.unread)) return b.unread ? 1 : -1;
    return new Date(b.last_at || 0) - new Date(a.last_at || 0);
  });
}

function relationHint(thread) {
  if (!thread) return "Pesan terikat ke listing ini, bukan ke orangnya.";
  if (thread.listingKind === "lowongan") {
    if (thread.relationKind === "application") {
      return thread.isOwner
        ? "Pelamar menanyakan lowongan ini. Balas di thread yang sama."
        : "Follow up lamaran kamu tanpa membuat thread baru.";
    }
    if (thread.relationKind === "order") return "Proyek sudah berjalan. Pakai thread ini untuk koordinasi.";
    return "Inquiry lowongan — belum tentu ada lamaran.";
  }
  if (thread.relationKind === "order") return "Pesanan jasa terkait. Chat tetap di listing ini.";
  return "Inquiry jasa. Satu thread per listing.";
}

function Inbox() {
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const room = params.get("room") || "";
  const kind = params.get("kind") || "";
  const listingId = params.get("id") || "";
  const [threads, setThreads] = useState([]);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const openedOnce = useRef(false);

  const visible = useMemo(
    () => sortThreads(threads.filter((t) => matchesFilter(t, kind, listingId))),
    [threads, kind, listingId],
  );

  async function loadInbox() {
    const data = await api.chats();
    setThreads(data.threads || []);
    await refresh();
    return data.threads || [];
  }

  useEffect(() => {
    setLoading(true);
    loadInbox()
      .catch((e) => setError(e.message || "Gagal memuat chat"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || openedOnce.current || room || !visible.length) return;
    openedOnce.current = true;
    const next = new URLSearchParams(params);
    next.set("room", visible[0].room);
    setParams(next, { replace: true });
  }, [loading, visible, room, params, setParams]);

  useEffect(() => {
    if (!room) {
      setThread(null);
      return;
    }
    let cancelled = false;
    setThreadLoading(true);
    api.chatThread(room)
      .then((d) => {
        if (!cancelled) {
          setThread(d);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Gagal membuka percakapan");
      })
      .finally(() => {
        if (!cancelled) setThreadLoading(false);
      });
    return () => { cancelled = true; };
  }, [room]);

  useEffect(() => {
    if (!room) return undefined;
    const timer = setInterval(() => {
      api.chatThread(room).then((d) => setThread(d)).catch(() => {});
      loadInbox().catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [room]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [thread?.messages?.length, room]);

  useEffect(() => {
    if (room && inputRef.current) inputRef.current.focus();
  }, [room, threadLoading]);

  function openRoom(nextRoom) {
    const next = new URLSearchParams(params);
    next.set("room", nextRoom);
    setParams(next, { replace: true });
    setDraft("");
  }

  function closeThread() {
    const next = new URLSearchParams(params);
    next.delete("room");
    setParams(next, { replace: true });
  }

  async function send(e) {
    e?.preventDefault();
    if (!room || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setDraft("");
    try {
      const res = await api.chatSend(room, text);
      setThread((prev) => prev ? { ...prev, messages: res.messages || [] } : prev);
      await loadInbox();
    } catch (err) {
      setDraft(text);
      setError(err.message || "Gagal mengirim");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onComposerKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const filterLabel = kind === "jasa" ? "Jasa ini" : kind === "lowongan" ? "Lowongan ini" : null;
  const isJobThread = thread?.listingKind === "lowongan";

  return (
    <div className="inbox-page">
      {error ? <p className="inbox-error">{error}</p> : null}

      {loading ? (
        <Loading />
      ) : (
        <div className={`inbox-shell ${room ? "has-thread" : ""}`}>
          <aside className="inbox-list">
            <div className="inbox-list-head">
              <h1>Chat</h1>
              <p>{visible.length} percakapan</p>
            </div>
            {filterLabel && (
              <div className="inbox-filter">
                <span>{filterLabel}</span>
                <Link to="/chat">Lihat semua</Link>
              </div>
            )}
            {visible.length === 0 ? (
              <div className="inbox-empty">
                <strong>Belum ada percakapan</strong>
                <p>Buka jasa atau lowongan, lalu ketuk chat untuk memulai thread.</p>
              </div>
            ) : (
              visible.map((t) => (
                <div
                  key={t.room}
                  className={`inbox-item ${t.room === room ? "is-on" : ""} ${t.unread ? "is-unread" : ""}`}
                >
                  {t.counterpartId ? (
                    <Link to={`/profile/${t.counterpartId}`} className="inbox-avatar-link">
                      {t.counterpartAvatar ? (
                        <img src={t.counterpartAvatar} alt="" className="inbox-avatar" />
                      ) : (
                        <span className={`inbox-avatar ph ${t.listingKind}`}>{ (t.counterpartName?.[0] || "?").toUpperCase() }</span>
                      )}
                    </Link>
                  ) : t.counterpartAvatar ? (
                    <img src={t.counterpartAvatar} alt="" className="inbox-avatar" />
                  ) : (
                    <span className={`inbox-avatar ph ${t.listingKind}`}>{ (t.counterpartName?.[0] || "?").toUpperCase() }</span>
                  )}
                  <button type="button" className="inbox-item-open" onClick={() => openRoom(t.room)}>
                    <span className="inbox-item-body">
                      <span className="inbox-item-top">
                        <strong>{t.counterpartName}</strong>
                        <small>{timeAgo(t.last_at)}</small>
                      </span>
                      <span className="inbox-listing">{t.listingTitle}</span>
                      <span className="inbox-preview">{t.last_sender_id === Number(user?.id) ? "Kamu: " : ""}{t.last_message}</span>
                      <span className="inbox-chips">
                        <span className={`inbox-kind ${t.listingKind}`}>{t.listingKind === "jasa" ? "Jasa" : "Lowongan"}</span>
                        {t.relationLabel ? <span className="inbox-rel">{t.relationLabel}</span> : null}
                      </span>
                    </span>
                    {t.unread ? <span className="inbox-unread" /> : null}
                  </button>
                </div>
              ))
            )}
          </aside>

          <section className={`inbox-thread ${isJobThread ? "is-job" : "is-jasa"}`}>
            {!room ? (
              <div className="inbox-placeholder">
                <strong>Pilih percakapan</strong>
                <p>Satu orang bisa punya beberapa thread jika listing-nya berbeda.</p>
              </div>
            ) : threadLoading && !thread ? (
              <Loading />
            ) : thread ? (
              <>
                <header className="inbox-thread-head">
                  <button type="button" className="inbox-back" onClick={closeThread}>Semua chat</button>
                  <div className="inbox-thread-who">
                    {thread.counterpartId ? (
                      <Link to={`/profile/${thread.counterpartId}`} className="inbox-who-link">
                        {thread.counterpartAvatar ? (
                          <img src={thread.counterpartAvatar} alt="" className="inbox-avatar" />
                        ) : (
                          <span className={`inbox-avatar ph ${thread.listingKind}`}>{(thread.counterpartName?.[0] || "?").toUpperCase()}</span>
                        )}
                        <div className="inbox-thread-meta">
                          <strong>{thread.counterpartName}</strong>
                          <span>{thread.listingKind === "jasa" ? "Jasa" : "Lowongan"}{thread.relationLabel ? ` · ${thread.relationLabel}` : ""}</span>
                        </div>
                      </Link>
                    ) : (
                      <>
                        {thread.counterpartAvatar ? (
                          <img src={thread.counterpartAvatar} alt="" className="inbox-avatar" />
                        ) : (
                          <span className={`inbox-avatar ph ${thread.listingKind}`}>{(thread.counterpartName?.[0] || "?").toUpperCase()}</span>
                        )}
                        <div className="inbox-thread-meta">
                          <strong>{thread.counterpartName}</strong>
                          <span>{thread.listingKind === "jasa" ? "Jasa" : "Lowongan"}{thread.relationLabel ? ` · ${thread.relationLabel}` : ""}</span>
                        </div>
                      </>
                    )}
                    <Link to={thread.listingPath} className="inbox-open-listing">
                      Buka listing
                    </Link>
                  </div>
                  <p className="inbox-context">{thread.listingTitle}</p>
                </header>

                <div className="inbox-messages" ref={boxRef}>
                  {(thread.messages || []).length === 0 ? (
                    <div className="inbox-empty-thread">
                      <p>{relationHint(thread)}</p>
                    </div>
                  ) : (
                    thread.messages.map((m) => {
                      const mine = user && Number(m.sender_id) === Number(user.id);
                      return (
                        <div key={m.id} className={`chat-bubble ${mine ? "mine" : "theirs"}`}>
                          <p className="chat-bubble-text">{m.pesan}</p>
                          <small>
                            {new Date(m.created_at).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={send} className="inbox-compose">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onComposerKey}
                    placeholder="Tulis pesan…"
                    disabled={sending}
                  />
                  <button type="submit" className="inbox-send" disabled={sending || !draft.trim()} aria-label="Kirim">
                    Kirim
                  </button>
                </form>
              </>
            ) : (
              <div className="inbox-placeholder">
                <strong>Percakapan tidak ditemukan</strong>
                <p>Thread mungkin sudah tidak valid. Pilih percakapan lain.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default function ChatInboxPage() {
  return (
    <Layout wide compact bgClass="app-dash-bg">
      <ProtectedRoute>
        <Inbox />
      </ProtectedRoute>
    </Layout>
  );
}
