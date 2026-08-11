import { jasaStatusLabel, isJasaActive, isLowonganOpen } from "../utils/listing.js";
import { jobStatusLabel } from "../utils/format.js";

export default function OwnerPinnedBar({ type = "jasa", data, onManage }) {
  const isJasa = type === "jasa";
  const active = isJasa ? isJasaActive(data) : isLowonganOpen(data);
  const statusText = isJasa ? jasaStatusLabel(data) : (active ? "Aktif di katalog" : "Nonaktif");

  return (
    <div className={`owner-pinned-bar ${isJasa ? "owner-pinned-jasa" : "owner-pinned-kerja"} ${active ? "is-active" : "is-inactive"}`}>
      <div className="owner-pinned-info">
        <span className="owner-pinned-pin" aria-hidden>📌</span>
        <div className="owner-pinned-text">
          <strong>{isJasa ? "Jasa Anda" : "Lowongan Anda"}</strong>
          <span className="owner-pinned-status">
            {active ? "▶" : "⏸"} {statusText}
          </span>
        </div>
      </div>
      <button type="button" className="owner-pinned-manage-btn" onClick={onManage}>
        ⚙️ Kelola {isJasa ? "Jasa" : "Lowongan"}
      </button>
    </div>
  );
}
