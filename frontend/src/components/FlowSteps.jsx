export default function FlowSteps({ steps }) {
  if (!steps?.length) return null;

  return (
    <div className="order-stepper-container" style={{ width: "100%", padding: "12px 0 4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isDone = step.done;
          const isCurrent = step.current;

          return (
            <div key={step.key} style={{ display: "flex", flex: isLast ? "0 0 auto" : 1, alignItems: "center", position: "relative" }}>
              {/* Step Node Icon & Label */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, minWidth: "64px" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "0.85rem",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: isDone
                      ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                      : isCurrent
                      ? "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)"
                      : "#f8fafc",
                    color: isDone || isCurrent ? "#ffffff" : "#94a3b8",
                    border: isDone
                      ? "2px solid #22c55e"
                      : isCurrent
                      ? "2px solid #38bdf8"
                      : "2px solid #cbd5e1",
                    boxShadow: isCurrent
                      ? "0 0 0 4px rgba(56, 189, 248, 0.2), 0 4px 14px rgba(2, 132, 199, 0.3)"
                      : isDone
                      ? "0 4px 10px rgba(22, 163, 74, 0.25)"
                      : "none",
                  }}
                >
                  {isDone ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isCurrent ? (
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ffffff", boxShadow: "0 0 8px #ffffff" }} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  style={{
                    fontSize: "0.775rem",
                    fontWeight: isCurrent ? 900 : isDone ? 750 : 600,
                    color: isCurrent ? "#0284c7" : isDone ? "#15803d" : "#64748b",
                    marginTop: "8px",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connecting Bar */}
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    height: "3px",
                    background: isDone
                      ? "linear-gradient(90deg, #16a34a, #22c55e)"
                      : "#e2e8f0",
                    margin: "0 6px",
                    marginBottom: "20px",
                    borderRadius: "999px",
                    transition: "all 0.3s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
