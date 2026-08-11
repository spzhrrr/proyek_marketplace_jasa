import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "frontend", "package.json"));
const puppeteer = require("puppeteer");

const ORIGIN = process.env.APP_URL || "http://localhost:5173";
const SHOT = path.join(ROOT, "docs", "screenshots");
const DIAG = path.join(ROOT, "docs", "diagrams");
fs.mkdirSync(SHOT, { recursive: true });

async function waitForApp() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(ORIGIN);
      if (r.ok || r.status < 500) return;
    } catch {}
    await new Promise((x) => setTimeout(x, 500));
  }
  throw new Error("Frontend belum siap di " + ORIGIN);
}

async function renderMermaid(browser) {
  const files = fs.readdirSync(DIAG).filter((f) => {
    if (!f.endsWith(".mmd")) return false;
    if (["1", "true", "yes"].includes(String(process.env.FLOW_ONLY || "").toLowerCase())) {
      return f.startsWith("flow-");
    }
    return true;
  });
  for (const f of files) {
    const code = fs.readFileSync(path.join(DIAG, f), "utf8");
    const out = path.join(DIAG, f.replace(/\.mmd$/, ".png"));
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 3200, deviceScaleFactor: 2 });
    page.setDefaultTimeout(60000);
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>body{margin:32px;background:#fff;font-family:Segoe UI,sans-serif}</style>
      </head><body><div id="c"></div>
      <script type="module">
        import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
        window.go = async (src) => {
          const { svg } = await mermaid.render("mmd", src);
          document.getElementById("c").innerHTML = svg;
        };
      </script></body></html>`,
      { waitUntil: "networkidle0" },
    );
    await page.waitForFunction(() => typeof window.go === "function");
    await page.evaluate((src) => window.go(src), code);
    await page.waitForSelector("#c svg");
    const box = await page.$("#c");
    await box.screenshot({ path: out, type: "png" });
    await page.close();
    console.log("diagram", f, "->", path.basename(out));
  }
}

async function shot(page, name) {
  await new Promise((x) => setTimeout(x, 600));
  const dest = path.join(SHOT, `${name}.png`);
  await page.screenshot({ path: dest, type: "png" });
  console.log("shot", name);
}

async function goto(page, p) {
  await page.goto(ORIGIN + p, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(
    () => !document.body.innerText.includes("Memuat..."),
    { timeout: 15000 },
  ).catch(() => {});
}

async function captureApp(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.setDefaultTimeout(45000);

  await goto(page, "/");
  await shot(page, "01-beranda");

  await goto(page, "/login");
  await shot(page, "02-login");

  await page.type("#login-email", "salah@mail.com");
  await page.type("#login-password", "salah12345");
  await page.click("button.auth-submit-btn");
  await page.waitForSelector(".alert, [role='alert'], .auth-form-card");
  await new Promise((x) => setTimeout(x, 800));
  await shot(page, "03-login-gagal");

  await goto(page, "/register");
  await shot(page, "04-register");

  await page.type("#first_name", "Tes");
  await page.type("#last_name", "User");
  await page.type("#reg-email", "tes.gagal@mail.com");
  await page.type("#reg-phone", "081234567890");
  await page.type("#reg-password", "Rahasia123");
  await page.type("#reg-confirm-password", "BedaSekali");
  await page.click("button.auth-submit-btn");
  await page.waitForSelector(".alert", { timeout: 8000 }).catch(() => {});
  await shot(page, "05-register-validasi");

  await goto(page, "/jasa");
  await shot(page, "06-katalog-jasa");

  const jasaHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/jasa/"]');
    return a ? a.getAttribute("href") : null;
  });
  if (jasaHref && !jasaHref.includes("/baru")) {
    await goto(page, jasaHref);
    await shot(page, "07-detail-jasa");
  }

  await goto(page, "/lowongan");
  await shot(page, "08-katalog-kerja");

  const jobHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/lowongan/"]');
    return a ? a.getAttribute("href") : null;
  });
  if (jobHref && !jobHref.includes("/baru") && !jobHref.includes("/lamar")) {
    await goto(page, jobHref);
    await shot(page, "09-detail-lowongan");
  }

  await goto(page, "/login");
  await page.evaluate(() => {
    document.querySelector("#login-email").value = "";
    document.querySelector("#login-password").value = "";
  });
  await page.type("#login-email", "admin@mail.com");
  await page.type("#login-password", "admin123");
  await page.click("button.auth-submit-btn");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
  await new Promise((x) => setTimeout(x, 1200));
  await shot(page, "10-setelah-login");

  await goto(page, "/dashboard");
  await shot(page, "11-dashboard");

  await goto(page, "/verify");
  await shot(page, "12-verifikasi");

  await goto(page, "/verify/email");
  await shot(page, "13-verifikasi-email");

  await goto(page, "/notifikasi");
  await shot(page, "14-notifikasi");

  await goto(page, "/chat");
  await shot(page, "15-chat");

  await goto(page, "/admin");
  await shot(page, "16-admin");

  await goto(page, "/admin/users");
  await shot(page, "17-admin-users");

  await goto(page, "/admin/orders");
  await shot(page, "18-admin-orders");

  const profileHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/profile/"]');
    return a ? a.getAttribute("href") : null;
  });
  if (profileHref) {
    await goto(page, profileHref);
    await shot(page, "19-profil-publik");
  } else {
    await goto(page, "/profile/1");
    await shot(page, "19-profil-publik");
  }

  await goto(page, "/jasa/baru");
  await shot(page, "20-post-jasa");

  await goto(page, "/lowongan/baru");
  await shot(page, "21-post-lowongan");

  await page.close();
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

const chrome = findChrome();
if (!chrome) throw new Error("Chrome/Edge tidak ditemukan");
const browser = await puppeteer.launch({
  headless: true,
  executablePath: chrome,
  args: ["--no-sandbox", "--window-size=1440,900"],
});
const diagramsOnly = ["1", "true", "yes"].includes(String(process.env.DIAGRAMS_ONLY || "").toLowerCase());
try {
  await renderMermaid(browser);
  if (!diagramsOnly) {
    await waitForApp();
    await captureApp(browser);
  }
} finally {
  await browser.close();
}
console.log("selesai");
