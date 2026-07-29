import { useEffect, useRef } from "react";
import PagePanel from "./PagePanel.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function ChatPanel({ title, backTo, backLabel, messages, onSend, placeholder = "Tulis pesan..." }) {
  const { user } = useAuth();
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    const input = e.target.elements.message;
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = "";
  }

  return (
    <PagePanel title={title} subtitle="Tanya langsung sebelum transaksi" backTo={backTo} backLabel={backLabel} compact>
      <div className="chat-box" ref={boxRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">Belum ada pesan. Mulai percakapan!</p>
        ) : (
          messages.map((m, i) => {
            const mine = i % 2 === 1 && user;
            return (
              <div key={m.id} className={`chat-bubble ${mine ? "mine" : "theirs"}`}>
                <p className="chat-bubble-text">{m.pesan}</p>
                <small>{new Date(m.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={submit} className="chat-form">
        <input name="message" placeholder={placeholder} autoComplete="off" />
        <button type="submit" className="btn btn-primary">Kirim</button>
      </form>
    </PagePanel>
  );
}
