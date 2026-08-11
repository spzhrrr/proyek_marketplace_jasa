import { useState } from "react";
import { resolveUploadUrl, JASA_COVER_FALLBACK } from "../utils/media.js";

export default function CoverImage({ src, alt = "", className = "", style = {}, fallback = JASA_COVER_FALLBACK }) {
  const [failed, setFailed] = useState(false);
  const resolved = failed ? fallback : resolveUploadUrl(src) || fallback;

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
