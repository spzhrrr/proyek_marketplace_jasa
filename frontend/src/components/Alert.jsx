import React from "react";

export default function Alert({ type = "error", style, children }) {
  if (!children) return null;
  const isDanger = type === "error" || type === "danger";
  const isSuccess = type === "success";
  const isWarn = type === "warn" || type === "warning";

  const icon = isSuccess ? "✅" : isWarn ? "⚠️" : "❌";
  const alertClass = isSuccess ? "alert-success" : isWarn ? "alert-warn" : "alert-danger";

  return (
    <div className={`alert ${alertClass}`} style={style}>
      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      <div style={{ flex: 1, lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}
