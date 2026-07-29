import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import Loading from "../../components/Loading.jsx";
import ChatPanel from "../../components/ChatPanel.jsx";
import { api } from "../../services/api.js";

export default function LowonganChatPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  async function load() {
    setData(await api.lowonganChat(id));
  }

  useEffect(() => { load(); }, [id]);

  if (!data) return <Layout wide compact><Loading /></Layout>;

  return (
    <Layout wide compact>
      <ChatPanel
        title={`Chat — ${data.data.title}`}
        backTo={`/lowongan/${id}`}
        backLabel="← Kembali ke lowongan"
        messages={data.messages}
        onSend={async (text) => {
          await api.lowonganChatSend(id, text);
          load();
        }}
      />
    </Layout>
  );
}
