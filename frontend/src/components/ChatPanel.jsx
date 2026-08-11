import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import PagePanel from "./PagePanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ChatPanel({
  title,
  backTo,
  backLabel,
  listingTo,
  listingLabel,
  messages,
  onSend,
  placeholder = "Tulis pesan...",
  sendDisabled = false,
  sendDisabledHint = "",
}) {
  const { user } = useAuth();
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    if (sendDisabled) return;
    const input = e.target.elements.message;
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = "";
  }

  return (
    <PagePanel
      title={title}
      subtitle={listingTo ? undefined : "Satu thread per jasa atau lowongan"}
      backTo={backTo}
      backLabel={backLabel}
      compact
      actions={listingTo ? <Link to={listingTo} className="back-link-sm">{listingLabel || "Lihat listing"}</Link> : null}
    >
      <div className="chat-box" ref={boxRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">Belum ada pesan. Mulai percakapan!</p>
        ) : (
          messages.map((m) => {
            const mine = user && Number(m.sender_id) === Number(user.id);
            return (
              <div key={m.id} className={`chat-bubble ${mine ? "mine" : "theirs"}`}>
                <p className="chat-bubble-text">{m.pesan}</p>
                <small>{new Date(m.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
              </div>
            );
          })
        )}
      </div>
      {sendDisabled && sendDisabledHint ? (
        <p className="chat-empty" style={{ marginTop: 12 }}>{sendDisabledHint}</p>
      ) : (
        <form onSubmit={submit} className="chat-form">
          <input name="message" placeholder={placeholder} autoComplete="off" disabled={sendDisabled} />
          <button type="submit" className="btn btn-primary" disabled={sendDisabled}>Kirim</button>
        </form>
      )}
    </PagePanel>
  );
}
