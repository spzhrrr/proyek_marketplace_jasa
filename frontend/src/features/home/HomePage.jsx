import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout.jsx";
import { api } from "../../services/api.js";

function Ico({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const CATS = [
  { name: "Web & Apps", code: "DIGITAL", sub: "web-development", tone: "jasa", kind: "Digital", d: <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></> },
  { name: "Desain Grafis", code: "DIGITAL", sub: "desain-logo", tone: "jasa", kind: "Digital", d: <><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></> },
  { name: "Penulisan", code: "DIGITAL", sub: "penulisan-artikel", tone: "jasa", kind: "Digital", d: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></> },
  { name: "Video", code: "DIGITAL", sub: "video-editing", tone: "jasa", kind: "Digital", d: <><rect x="2" y="2" width="20" height="20" rx="2" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /></> },
  { name: "Event & Catering", code: "PHYSICAL", sub: "event-organizer", tone: "kerja", kind: "Fisik", d: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
  { name: "Pertukangan", code: "PHYSICAL", sub: "servis-elektronik", tone: "kerja", kind: "Fisik", d: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /> },
];

const FEATURES = [
  { title: "Escrow aman", text: "Dana ditahan sampai hasil disetujui, baru cair ke penyedia.", d: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /> },
  { title: "Terverifikasi", text: "Kontak dan KTP dicek sebelum transaksi penuh.", d: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></> },
  { title: "Jasa & kerja", text: "Sewa jasa atau pasang lowongan dari satu akun.", d: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></> },
  { title: "Chat per listing", text: "Revisi dan progres tetap di thread yang sama.", d: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
];

const STEPS = [
  { n: "1", title: "Daftar & verifikasi", text: "Profil, OTP, lalu KTP sebelum transaksi." },
  { n: "2", title: "Cari atau pasang", text: "Pesan jasa, atau buka lowongan dan pilih pelamar." },
  { n: "3", title: "Bayar lewat escrow", text: "Dana tertahan sampai pekerjaan disetujui." },
];

function nfmt(n) {
  return Number(n || 0).toLocaleString("id-ID");
}

export default function HomePage() {
  const nav = useNavigate();
  const [stats, setStats] = useState({ totalJasa: 0, totalLowongan: 0 });
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("jasa");

  useEffect(() => {
    api.home()
      .then((d) => setStats({ totalJasa: d.totalJasa || 0, totalLowongan: d.totalLowongan || 0 }))
      .catch(() => {});
  }, []);

  function onSearch(e) {
    e.preventDefault();
    const path = mode === "kerja" ? "/lowongan" : "/jasa";
    const query = q.trim();
    nav(query ? `${path}?q=${encodeURIComponent(query)}` : path);
  }

  return (
    <Layout wide compact bgClass="app-dash-bg">
      <div className="home-page">
        <div className="home-stage">
          <section className="home-hero">
            <div className="home-hero-copy">
              <p className="home-kicker">Marketplace jasa &amp; kerja · Indonesia</p>
              <h1>
                Cari jasa. Cari kerja.<br />
                Tolong<span>in</span> aja.
              </h1>
              <p className="home-lead">
                Desain remote sampai servis AC di kotamu. Escrow aman, penyedia terverifikasi, chat per listing.
              </p>

              <form onSubmit={onSearch} className={`home-search is-${mode}`}>
                <div className="home-mode" role="group" aria-label="Mode pencarian">
                  <button type="button" className={mode === "jasa" ? "is-on" : ""} onClick={() => setMode("jasa")}>Jasa</button>
                  <button type="button" className={mode === "kerja" ? "is-on" : ""} onClick={() => setMode("kerja")}>Kerja</button>
                </div>
                <div className="home-search-row">
                  <span className="home-search-ico">
                    <Ico d={<><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>} />
                  </span>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={mode === "kerja" ? "Contoh: editor video, barista..." : "Contoh: desain logo, servis AC..."}
                    aria-label="Cari"
                  />
                  <button type="submit" className="home-search-go">Cari</button>
                </div>
              </form>

              <div className="home-ctas">
                <Link to="/jasa" className="home-cta-jasa">Cari Jasa</Link>
                <Link to="/lowongan" className="home-cta-kerja">Cari Kerja</Link>
              </div>

              <ul className="home-trust">
                <li><Ico d={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />} /> Escrow aman</li>
                <li><Ico d={<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} /> Terverifikasi</li>
                <li><Ico d={<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>} /> Digital &amp; fisik</li>
              </ul>
            </div>

            <aside className="home-hero-side" aria-hidden="true">
              <article className="home-preview is-jasa">
                <span>Desain grafis</span>
                <strong>Desain logo + brand guideline</strong>
                <em>Rp 250.000</em>
                <small>Terverifikasi</small>
              </article>
              <article className="home-preview is-kerja">
                <span>Lowongan</span>
                <strong>Editor video untuk kampanye brand</strong>
                <em>Remote · Rp 1.200.000</em>
                <small>Budget terbuka</small>
              </article>
              <p className="home-cities">Jakarta · Bandung · Surabaya · Malang</p>
            </aside>
          </section>

          <p className="home-live">
            <span>{nfmt(stats.totalJasa)} jasa aktif</span>
            <span>{nfmt(stats.totalLowongan)} lowongan terbuka</span>
            <span>Escrow menahan dana sampai pekerjaan selesai</span>
          </p>
        </div>

        <div className="home-rest">
          <section className="home-block">
            <header className="home-block-head">
              <div>
                <h2>Kategori populer</h2>
                <p>Jasa digital dan layanan fisik, satu tempat.</p>
              </div>
              <Link to="/jasa" className="home-more">Lihat semua jasa</Link>
            </header>
            <div className="home-cats">
              {CATS.map((c) => (
                <Link key={c.name} to={`/jasa?tipe=${c.code}&sub=${c.sub}`} className={`home-cat is-${c.tone}`}>
                  <span className="home-cat-ico"><Ico d={c.d} size={18} /></span>
                  <strong>{c.name}</strong>
                  <small>{c.kind}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className="home-block">
            <header className="home-block-head is-center">
              <div>
                <h2>Mengapa Tolongin</h2>
                <p>Transaksi jelas, peran ganda, percakapan tetap di listing.</p>
              </div>
            </header>
            <div className="home-feats">
              {FEATURES.map((f) => (
                <article key={f.title} className="home-feat">
                  <span className="home-feat-ico"><Ico d={f.d} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="home-block">
            <header className="home-block-head is-center">
              <div>
                <h2>Tiga langkah</h2>
                <p>Dari daftar sampai dana cair, alurnya sama untuk jasa dan kerja.</p>
              </div>
            </header>
            <ol className="home-steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span>{s.n}</span>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="home-split">
            <Link to="/jasa" className="home-split-card is-jasa">
              <small>Jasa</small>
              <strong>Butuh dikerjakan?</strong>
              <p>Temukan freelancer terverifikasi untuk pekerjaan digital atau fisik.</p>
              <em>Cari jasa</em>
            </Link>
            <Link to="/lowongan" className="home-split-card is-kerja">
              <small>Kerja</small>
              <strong>Cari proyek?</strong>
              <p>Lamar lowongan dengan penawaran jelas, lalu chat langsung dengan pemberi kerja.</p>
              <em>Cari kerja</em>
            </Link>
          </section>

          <p className="home-end">Tolongin · Marketplace jasa &amp; kerja</p>
        </div>
      </div>
    </Layout>
  );
}
