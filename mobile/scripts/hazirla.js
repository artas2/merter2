"use strict";
/* public/ klasöründen uygulama içine gömülecek www/ klasörünü üretir.
   Ortam değişkenleri (mobile/.env ya da kabuk):
     API_TABAN            zorunlu, ör. https://app.bilinclisakin.com  (https olmalı)
     REVENUECAT_IOS       RevenueCat "Apple" genel SDK anahtarı (appl_…)
     REVENUECAT_ANDROID   RevenueCat "Google" genel SDK anahtarı (goog_…)
     KOSULLAR_URL, GIZLILIK_URL   mağaza sayfasında da verilen yasal metin adresleri (varsayılan: API_TABAN/kosullar.html, /gizlilik.html)
     ARAYUZ               merter (varsayılan: Merter Çınar Evleri arayüzü, merter/) | sakin (genel Bilinçli Sakin arayüzü, public/)
     SITE_ADI             giriş ekranında görünen ad (varsayılan: Merter Çınar Evleri) */
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const KOK = path.join(__dirname, "..");
const PUB = path.join(KOK, "..", "public");
const WWW = path.join(KOK, "www");
const envDosya = path.join(KOK, ".env");
if (fs.existsSync(envDosya)) process.loadEnvFile(envDosya);

function ayarlar(env = process.env) {
  const taban = String(env.API_TABAN || "").replace(/\/$/, "");
  if (!/^https:\/\/[^/]+$/.test(taban) && env.GELISTIRME !== "1") throw new Error("API_TABAN https://alanadi biçiminde olmalı (ör. https://app.bilinclisakin.com).");
  return {
    apiTaban: taban, revenuecatIos: env.REVENUECAT_IOS || "", revenuecatAndroid: env.REVENUECAT_ANDROID || "",
    kosullarUrl: env.KOSULLAR_URL || taban + "/kosullar.html", gizlilikUrl: env.GIZLILIK_URL || taban + "/gizlilik.html",
    siteAdi: env.SITE_ADI || "Merter Çınar Evleri", arayuz: env.ARAYUZ || "merter"
  };
}

/* Yalnızca istemcinin gereksindiği dosyalar; servis çalışanı ve manifest mobilde kullanılmaz. */
const ATLA = new Set(["sw.js", "cevrimdisi.html", "config.js"]);

async function kopruPaketle() {
  await esbuild.build({ entryPoints: [path.join(KOK, "src", "kopru.js")], bundle: true, minify: true, format: "iife", target: ["es2020"], outfile: path.join(WWW, "kopru.js"), logLevel: "warning" });
}

/* Merter Çınar Evleri: claude.ai artifact arayüzü + uyum katmanı (merter/sablon.js) */
async function hazirlaMerter(a) {
  const { merterSayfasi, merterDosyalari } = require(path.join(KOK, "..", "merter", "sablon.js"));
  fs.rmSync(WWW, { recursive: true, force: true }); fs.mkdirSync(WWW, { recursive: true });
  for (const [hedef, kaynak] of Object.entries(merterDosyalari(path.join(KOK, "..")))) {
    fs.mkdirSync(path.dirname(path.join(WWW, hedef)), { recursive: true }); fs.copyFileSync(kaynak, path.join(WWW, hedef));
  }
  fs.writeFileSync(path.join(WWW, "config.js"), `window.BS_AYAR = ${JSON.stringify(a)};\n`);
  await kopruPaketle();
  const csp = `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${a.apiTaban}; font-src 'self'; connect-src 'self' ${a.apiTaban}; object-src 'none'; base-uri 'self'`;
  fs.writeFileSync(path.join(WWW, "index.html"), merterSayfasi({ kok: "/", csp }));
  return a;
}

async function hazirla(env) {
  const a = ayarlar(env);
  if (a.arayuz === "merter") return hazirlaMerter(a);
  if (a.arayuz !== "sakin") throw new Error("ARAYUZ 'merter' ya da 'sakin' olmalı.");
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.cpSync(PUB, WWW, { recursive: true, filter: s => !ATLA.has(path.basename(s)) && !s.startsWith(path.join(PUB, "md")) });
  fs.mkdirSync(path.join(WWW, "vendor"), { recursive: true });
  fs.copyFileSync(require.resolve("marked/marked.min.js", { paths: [path.join(KOK, "..")] }), path.join(WWW, "vendor", "marked.min.js"));
  fs.writeFileSync(path.join(WWW, "config.js"), `window.BS_AYAR = ${JSON.stringify(a)};\n`);
  await kopruPaketle();
  let html = fs.readFileSync(path.join(WWW, "index.html"), "utf8");
  html = html.replace(/<link rel="manifest"[^>]*>\n?/, "")
    .replace('<script src="/config.js"></script>', '<script src="/config.js"></script>\n<script src="/kopru.js"></script>')
    // Uygulama içinden dış bağlantılar (yasal metinler) sunucudan açılır
    .replace('href="/aydinlatma.html"', `href="${a.apiTaban}/aydinlatma.html"`)
    // CSP: yalnızca uygulamanın kendi dosyaları ve API sunucusu
    .replace("<head>", `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${a.apiTaban}; object-src 'none'; base-uri 'self'">`);
  if (!html.includes("/kopru.js")) throw new Error("index.html içine kopru.js eklenemedi.");
  fs.writeFileSync(path.join(WWW, "index.html"), html);
  return a;
}

if (require.main === module) hazirla().then(a => console.log(`www/ hazır (arayüz: ${a.arayuz}, API: ${a.apiTaban}, iOS mağaza: ${a.revenuecatIos ? "var" : "yok"}, Android mağaza: ${a.revenuecatAndroid ? "var" : "yok"})`)).catch(e => { console.error(e.message); process.exit(1); });
module.exports = { hazirla, ayarlar };
