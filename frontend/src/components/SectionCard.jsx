export default function SectionCard({ title, action, children, id }) {
  return (
    <section className="section-card" id={id}>
      <div className="section-card-head">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
