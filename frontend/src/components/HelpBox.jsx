export default function HelpBox({ title, children, tone = "info" }) {
  return (
    <div className={`help-box help-box-${tone}`}>
      {title && <strong className="help-box-title">{title}</strong>}
      <div className="help-box-body">{children}</div>
    </div>
  );
}
