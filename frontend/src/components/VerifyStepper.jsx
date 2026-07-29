import { Link } from "react-router-dom";

const STEPS = [
  { key: "email", label: "Email", path: "/verify/email" },
  { key: "phone", label: "Nomor HP", path: "/verify/phone" },
  { key: "ktp", label: "KTP", path: "/verify/ktp" },
  { key: "bank", label: "Rekening Bank", path: "/verify/bank" },
];

function stepState(key, steps) {
  if (key === "email") {
    return steps.email.done ? "done" : "active";
  }
  if (key === "phone") {
    if (steps.phone.done) return "done";
    if (!steps.email.done) return "locked";
    return "active";
  }
  if (key === "ktp") {
    if (steps.ktp.done) return "done";
    if (steps.ktp.status === "REJECTED") return "rejected";
    if (steps.ktp.pending) return "active";
    if (steps.email.done && steps.phone.done) return "active";
    return "locked";
  }
  if (steps.bank?.done) return "done";
  if (!steps.ktp.done) return "locked";
  return "active";
}

function stepHint(key, steps, state) {
  if (state === "locked") return "Selesaikan tahap sebelumnya";
  if (state === "done") return key === "bank" ? "Terverifikasi (post jasa)" : "Terverifikasi";
  if (key === "ktp" && steps.ktp.pending) return "Menunggu review admin";
  if (key === "ktp" && steps.ktp.status === "REJECTED") return "Ditolak — unggah ulang";
  if (key === "bank") return "Wajib untuk post jasa";
  return null;
}

export default function VerifyStepper({ steps, current }) {
  return (
    <div className="verify-stepper">
      {STEPS.map((step, i) => {
        const state = stepState(step.key, steps);
        const isCurrent = current === step.key;
        const hint = stepHint(step.key, steps, state);
        const showLink = state !== "locked" && state !== "done" && !(step.key === "ktp" && steps.ktp.pending);

        return (
          <div key={step.key} className={`verify-stepper-item ${state} ${isCurrent ? "current" : ""}`}>
            <div className="verify-stepper-marker">
              {state === "done" ? "✓" : i + 1}
            </div>
            <div className="verify-stepper-body">
              <strong>{step.label}</strong>
              {hint && (
                <span className={state === "done" ? "text-ok" : state === "rejected" ? "text-danger" : "muted"}>
                  {hint}
                </span>
              )}
              {showLink && (
                <Link to={step.path} className="verify-stepper-link">
                  {isCurrent ? "Sedang di sini" : "Lanjutkan →"}
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
