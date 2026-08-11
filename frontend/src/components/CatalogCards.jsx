import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { rupiah, timeAgo, applyWindowLabel, isJobUrgent, parseJasaSkills, stripJasaSkills, stripJobSkills, jobStatusLabel } from "../utils/format.js";
import { getFirstCoverUrl, JASA_COVER_FALLBACK, resolveUploadUrl } from "../utils/media.js";

export function VerifiedMark({ tone = "jasa" }) {
  return (
    <svg
      className="catalog-verified"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-label="Terverifikasi"
      style={tone === "kerja" ? { color: "#7c3aed" } : undefined}
    >
      <path fill="currentColor" d="M12 2l2.4 2.1 3.2-.4.9 3.1 2.9 1.5-1.3 3L22 14l-2 2.7.4 3.2-3.1.9-1.5 2.9-3-.9L12 22l-1.8-2.2-3 .9-1.5-2.9-3.1-.9.4-3.2L1 14l1.9-2.7-1.3-3 2.9-1.5.9-3.1 3.2.4L12 2zm-1.2 13.3l5.7-5.7-1.4-1.4-4.3 4.3-2.1-2.1-1.4 1.4 3.5 3.5z" />
    </svg>
  );
}

export function CatalogJasaCard({ item }) {
  const { user } = useAuth() || {};
  const isMine = user && Number(item.seller_id) === Number(user.id);
  const sellerName = item.seller_name || item.name || "Freelancer";
  const coverSrc = getFirstCoverUrl(item.cover_image_url) || JASA_COVER_FALLBACK;
  const rating = Number(item.seller_rating);
  const reviewCount = Number(item.seller_review_count) || 0;
  const doneCount = Number(item.completed_count) || 0;
  const location = item.seller_city || item.city || (item.parent_type === "DIGITAL" ? "Remote" : "Indonesia");
  const verified = item.seller_ktp_status === "APPROVED";
  const snippet = stripJasaSkills(item.description || "").replace(/\s+/g, " ").trim();
  const skills = parseJasaSkills(item.description, item.skills).slice(0, 2);

  return (
    <div className="catalog-card-link">
      <article className="jasa-card-futuristic catalog-card-shell">
        <Link to={`/jasa/${item.id}`} className="catalog-card-stretch" aria-label={item.title} />
        <div className="jasa-card-thumb-wrap">
          <img src={coverSrc} alt="" />
          <span className={`card-type-overlay ${item.parent_type === "DIGITAL" ? "overlay-digital" : "overlay-physical"}`}>
            {item.parent_type === "DIGITAL" ? "Digital" : "Fisik"}
          </span>
          {item.is_active === false || item.is_active === 0 ? (
            <span className="catalog-inactive-overlay">Disembunyikan</span>
          ) : null}
        </div>
        <div className="catalog-card-body">
          <div className="catalog-card-topline">
            {item.category_name ? <span>{item.category_name}</span> : null}
            <span>{item.delivery_days || 1} hari pengerjaan</span>
          </div>
          <h3 className="catalog-card-title">{item.title}</h3>
          {snippet ? <p className="catalog-snippet">{snippet}</p> : null}
          {skills.length > 0 ? (
            <div className="catalog-tags">
              {skills.map((sk) => (
                <span key={sk} className="catalog-skill-chip">{sk}</span>
              ))}
            </div>
          ) : null}
          <Link to={`/profile/${item.seller_id}`} className="catalog-seller-row catalog-seller-link">
            {item.seller_avatar ? (
              <img src={resolveUploadUrl(item.seller_avatar)} alt="" className="catalog-avatar" />
            ) : (
              <span className="catalog-avatar-fallback is-jasa">{sellerName[0]?.toUpperCase() || "F"}</span>
            )}
            <span className="catalog-seller-name">{sellerName}</span>
            {verified && <VerifiedMark />}
            {isMine && <span className="catalog-mine-pill is-jasa">Jasa saya</span>}
          </Link>
          <div className="catalog-meta-row">
            <span className="catalog-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {location}
            </span>
            <span className="catalog-meta-item">{timeAgo(item.created_at)}</span>
          </div>
        </div>
        <div className="catalog-card-footer">
          <div className="catalog-rating">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#eab308" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {rating > 0 ? rating.toFixed(1) : "Baru"}
            {reviewCount > 0 ? <em>({reviewCount})</em> : null}
            {doneCount > 0 ? <em>· {doneCount} selesai</em> : null}
          </div>
          <div className="catalog-price-block">
            <span className="catalog-price-label">Mulai</span>
            <strong className="catalog-price">{rupiah(item.price)}</strong>
          </div>
        </div>
      </article>
    </div>
  );
}

export function CatalogKerjaCard({ item }) {
  const { user } = useAuth() || {};
  const isMine = user && Number(item.buyer_id) === Number(user.id);
  const posterName = item.buyer_name || item.poster_name || "Klien";
  const location = item.city || item.buyer_city || (item.parent_type === "DIGITAL" ? "Remote" : "Indonesia");
  const verified = item.poster_ktp_status === "APPROVED";
  const snippet = stripJobSkills(item.description || "").replace(/\s+/g, " ").trim();
  const jobClosed = item.status && item.status !== "OPEN";
  const hidden = item.is_active === false || item.is_active === 0;

  return (
    <div className="catalog-card-link">
      <article className="kerja-card-futuristic catalog-card-shell">
        <Link to={`/lowongan/${item.id}`} className="catalog-card-stretch" aria-label={item.title} />
        <div className="catalog-card-body">
          <Link to={`/profile/${item.buyer_id}`} className="catalog-seller-row catalog-seller-link">
            {item.poster_avatar ? (
              <img src={resolveUploadUrl(item.poster_avatar)} alt="" className="catalog-avatar" />
            ) : (
              <span className="catalog-avatar-fallback is-kerja">{posterName[0]?.toUpperCase() || "K"}</span>
            )}
            <span className="catalog-seller-name">{posterName}</span>
            {verified && <VerifiedMark tone="kerja" />}
            {isMine && <span className="catalog-mine-pill is-kerja">Lowongan saya</span>}
          </Link>
          <h3 className="catalog-card-title">{item.title}</h3>
          <div className="catalog-tags">
            <span className={item.parent_type === "DIGITAL" ? "tag-pill-type-digital" : "tag-pill-type-physical"}>
              {item.parent_type === "DIGITAL" ? "Digital" : "Fisik"}
            </span>
            {item.category_name ? <span className="tag-pill-sub">{item.category_name}</span> : null}
            {isJobUrgent(item) ? <span className="tag-pill-urgent">Urgent</span> : null}
            {hidden ? <span className="tag-pill-sub">Disembunyikan</span> : null}
            {jobClosed ? <span className="tag-pill-sub">{jobStatusLabel(item.status)}</span> : null}
          </div>
          {snippet ? <p className="catalog-snippet">{snippet}</p> : null}
          <div className="catalog-meta-row">
            <span className="catalog-meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {location}
            </span>
            <span className="catalog-meta-item">{timeAgo(item.created_at)}</span>
          </div>
        </div>
        <div className="catalog-card-footer is-kerja">
          <div className="catalog-price-block">
            <span className="catalog-price-label">Budget</span>
            <strong className="catalog-price is-kerja">{rupiah(item.budget)}</strong>
          </div>
          <div className="catalog-kerja-meta">
            {applyWindowLabel(item.deadline, isJobUrgent(item)) ? (
              <span className={isJobUrgent(item) ? "is-urgent" : ""}>
                {applyWindowLabel(item.deadline, isJobUrgent(item))}
              </span>
            ) : null}
            <span>{Number(item.applicant_count) || 0} pelamar</span>
          </div>
        </div>
      </article>
    </div>
  );
}
