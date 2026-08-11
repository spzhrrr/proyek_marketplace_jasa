import { resolveUploadUrl } from "../utils/media.js";
import { portfolioDisplayName } from "../utils/format.js";

function fileKind(url) {
  if (!url) return "none";
  const lower = url.split("?")[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp)$/.test(lower)) return "image";
  if (/\.pdf$/.test(lower)) return "pdf";
  if (/\.(doc|docx)$/.test(lower)) return "doc";
  if (/\.(zip|rar|7z)$/.test(lower)) return "archive";
  return "file";
}

function fileTypeLabel(kind) {
  const map = {
    image: "Gambar",
    pdf: "PDF",
    doc: "Dokumen Word",
    archive: "Arsip",
    file: "File",
  };
  return map[kind] || "File";
}

export default function PortfolioFileView({
  url,
  fileUrl,
  title = "Berkas portofolio",
}) {
  const raw = url || fileUrl;
  const href = resolveUploadUrl(raw);
  if (!href) return null;

  const kind = fileKind(href);
  const name = portfolioDisplayName(raw);
  const typeLabel = fileTypeLabel(kind);

  return (
    <div className="pfv-card">
      <div className="pfv-main">
        {kind === "image" ? (
          <img src={href} alt="" className="pfv-thumb" />
        ) : (
          <div className="pfv-icon" aria-hidden>📄</div>
        )}
        <div className="pfv-copy">
          <h4>{name}</h4>
          <span>{title} · {typeLabel}</span>
        </div>
      </div>
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
        Buka berkas
      </a>
    </div>
  );
}
