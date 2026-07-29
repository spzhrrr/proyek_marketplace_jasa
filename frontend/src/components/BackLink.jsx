import { Link } from "react-router-dom";

export default function BackLink({ to, children = "← Kembali" }) {
  return (
    <Link to={to} className="page-back">
      {children}
    </Link>
  );
}
