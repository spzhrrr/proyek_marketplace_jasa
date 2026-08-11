import { useEffect } from "react";
import { createPortal } from "react-dom";

function Icon({ tone }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (tone === "logout") {
    return (
      <svg {...common}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    );
  }
  if (tone === "danger") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (tone === "success") {
    return (
      <svg {...common}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default function ConfirmModal({
  isOpen,
  title = "Konfirmasi",
  message = "Lanjutkan tindakan ini?",
  confirmText = "Lanjutkan",
  cancelText = "Batal",
  confirmTone = "primary",
  onConfirm,
  onCancel,
  onClose,
  loading = false,
  identity,
  note,
}) {
  const close = () => {
    if (loading) return;
    (onCancel || onClose)?.();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, loading]);

  if (!isOpen) return null;

  const node = (
    <div className="confirm-backdrop" onClick={close} role="presentation">
      <div
        className={`confirm-card is-${confirmTone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`confirm-ico is-${confirmTone}`}>
          <Icon tone={confirmTone} />
        </div>

        <h3 id="confirm-title">{title}</h3>
        <p className="confirm-msg">{message}</p>

        {identity ? (
          <div className="confirm-who">
            {identity.photo ? (
              <img src={identity.photo} alt="" />
            ) : (
              <span>{identity.initial || "?"}</span>
            )}
            <div>
              <strong>{identity.name}</strong>
              <small>{identity.caption || "Sesi aktif di perangkat ini"}</small>
            </div>
          </div>
        ) : null}

        {note ? <p className="confirm-note">{note}</p> : null}

        <div className="confirm-actions">
          <button type="button" className="confirm-btn is-ghost" onClick={close} disabled={loading}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-btn is-${confirmTone}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Memproses…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
