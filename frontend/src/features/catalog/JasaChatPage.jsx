import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import { api } from "../../services/api.js";

export default function JasaChatPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const withUser = searchParams.get("with");

  useEffect(() => {
    let cancelled = false;
    api.jasaChat(id, withUser || undefined)
      .then((data) => {
        if (cancelled) return;
        if (data.room) {
          nav(`/chat?room=${encodeURIComponent(data.room)}`, { replace: true });
        } else {
          nav(`/chat?kind=jasa&id=${id}`, { replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) nav(`/jasa/${id}`, { replace: true });
      });
    return () => { cancelled = true; };
  }, [id, withUser, nav]);

  return (
    <Layout wide compact bgClass="app-jasa-bg">
      <Loading />
    </Layout>
  );
}
