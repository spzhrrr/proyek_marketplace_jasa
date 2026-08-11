import { useState } from "react";
import { resolveUploadUrl } from "../utils/media.js";

export default function AvatarImage({ src, name = "U", className = "", style = {}, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.[0] || "U").toUpperCase();

  if (!src || failed) {
    return (
      <span
        className={`avatar-fallback ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.38, ...style }}
        aria-hidden
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={resolveUploadUrl(src)}
      alt=""
      className={className}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", ...style }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
