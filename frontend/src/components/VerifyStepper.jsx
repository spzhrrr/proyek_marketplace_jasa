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
  if (key === "bank") {
    if (steps.bank?.done) return "done";
    if (steps.bank?.status === "REJECTED") return "rejected";
    if (steps.bank?.pending) return "active";
    if (!steps.ktp.done) return "locked";
    return "active";
  }
  return "locked";
}

function stepHint(key, steps, state) {
  if (state === "locked") return "Selesaikan tahap sebelumnya";
  if (state === "done") return key === "bank" ? "Terverifikasi (post jasa)" : "Terverifikasi";
  if (key === "ktp" && steps.ktp.pending) return "Menunggu review admin";
  if (key === "ktp" && steps.ktp.status === "REJECTED") return "Ditolak — unggah ulang";
  if (key === "bank" && steps.bank?.pending) return "Menunggu review admin";
  if (key === "bank" && steps.bank?.status === "REJECTED") return "Ditolak — ajukan ulang";
  if (key === "bank") return "Wajib untuk post jasa";
  return null;
}

export default function VerifyStepper({ steps, current }) {
  return (
    <div className="horizontal-verify-stepper">
      {STEPS.map((step, i) => {
        const state = stepState(step.key, steps);
        const isCurrent = current === step.key;

        return (
          <div key={step.key} className={`stepper-horizontal-item ${state} ${isCurrent ? "active" : ""}`}>
            <div className="stepper-bubble">
              {state === "done" ? "✓" : i + 1}
            </div>
            <div className="stepper-label-wrap">
              <span className="stepper-label-text">{step.label}</span>
              <span className="stepper-sub-status">
                {state === "done" ? "Terverifikasi" : state === "active" ? "Tahap Ini" : state === "rejected" ? "Ditolak" : "Terkunci"}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="stepper-connector-line" />}
          </div>
        );
      })}
    </div>
  );
}
