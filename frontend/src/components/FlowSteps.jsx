export default function FlowSteps({ steps }) {
  if (!steps?.length) return null;
  return (
    <ol className="flow-steps" aria-label="Tahapan pesanan">
      {steps.map((step) => (
        <li
          key={step.key}
          className={`flow-step ${step.done ? "done" : ""} ${step.current ? "current" : ""}`}
        >
          <span className="flow-step-dot" aria-hidden />
          <span className="flow-step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
