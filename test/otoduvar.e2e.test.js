"use strict";
/* Uçtan uca (telefon uygulaması kipi): otomatik Hikmet duvar kâğıdı.
   Yerel köprü taklit edilir; uygulamanın ürettiği görsel havuzu (ana-<i>.jpg, kilit-<i>.jpg) ve seçilen mod doğrulanır.
   Yerel tarafın (Android canlı duvar kâğıdı ve günlük alarm, iOS Kestirmeler eylemi) gerçek cihazda denenmesi gerekir. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..");
const PORT = 4800 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const MOB = "http://localhost";
let sunucu, log = "", browser, tmp, yonDavet, www, sakinDavet;
const bekle = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-otoduvar-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "a.sqlite"), PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "otoduvar".repeat(6) };
  const k = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/kur-site.js", "--ad", "Merter Çınar Evleri", "--bloklar", "A,B,C", "--daire", "12", "--kat", "0-5"], { cwd: KOK, env, encoding: "utf8" });
  yonDavet = /Yönetici davet : ([A-Z0-9-]+)/.exec(k.stdout)[1];
  www = path.join(tmp, "www");
  const h = spawnSync(process.execPath, ["-e", `const m=require(${JSON.stringify(path.join(KOK, "mobile", "scripts", "hazirla.js"))});m.hazirla({API_TABAN:${JSON.stringify(BASE)},GELISTIRME:"1"}).then(()=>{require("fs").cpSync(${JSON.stringify(path.join(KOK, "mobile", "www"))},${JSON.stringify(www)},{recursive:true})}).catch(e=>{console.error(e);process.exit(1)})`], { encoding: "utf8" });
  assert.equal(h.status, 0, h.stderr);
  sunucu = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], { cwd: KOK, env });
  sunucu.stdout.on("data", d => { log += d; }); sunucu.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 100 && !log.includes("çalışıyor"); i++) await bekle(50);
  browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests"] });
});
after(async () => {
  if (browser) await browser.close();
  if (sunucu) { sunucu.kill("SIGTERM"); await new Promise(r => sunucu.once("exit", r)); }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});
const otp = async tel => {
  const e = "+90" + tel.replace(/\D/g, "").slice(1);
  for (let i = 0; i < 100; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === e).pop(); if (m) return m[2]; await bekle(50); }
  throw new Error("OTP yok");
};

/* Yerel köprü taklidi: havuz dosyaları ve mod bellekte (localStorage) tutulur, sayfa yenilense de kalır */
const kopru = plat => `
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => ${JSON.stringify(plat)} };
  const L = k => JSON.parse(localStorage.getItem(k) || "null"), Y = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const durum = () => ({ platform: ${JSON.stringify(plat)}, mod: L("od-mod") || "kapali", n: L("od-n") || 0, surum: L("od-surum") || "", canli: !!L("od-canli") });
  window.__havuz = window.__havuz || {};
  window.BSNative = { tokenOku: async () => localStorage.getItem("t"), tokenYaz: async t => localStorage.setItem("t", t), tokenSil: async () => localStorage.removeItem("t"), magaza: null, paylasDosya: async () => {},
    duvar: { ayarla: null, kaydet: async () => {},
      havuzYaz: async ({ ad, base64 }) => { Y("od-yazim", (L("od-yazim") || 0) + 1); window.__havuz[ad] = base64.length; window.__son = { ad, base64 }; if (!window.__ilk) window.__ilk = { ad, base64 }; },
      havuzBitir: async ({ n, surum }) => { Y("od-n", n); Y("od-surum", surum); return durum(); },
      otomatikAyarla: async ({ mod }) => { Y("od-mod", mod); if (mod === "acilis") Y("od-canli", true); Y("od-cagri", [...(L("od-cagri") || []), mod]); return { ...durum(), uygulandi: true }; },
      otomatikDurum: async () => durum() } };`;
async function uygulama(plat) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); const hatalar = [];
  page.on("pageerror", e => hatalar.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  await context.route(MOB + "/**", async r => {
    let u = new URL(r.request().url()).pathname; if (u === "/") u = "/index.html";
    if (u === "/kopru.js") return r.fulfill({ contentType: "text/javascript", body: kopru(plat) });
    const f = path.join(www, u); if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ contentType: { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".md": "text/markdown" }[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
  });
  await page.goto(MOB + "/");
  return { context, page, hatalar };
}
async function gir(p, tel, davet) {
  await p.waitForSelector("#bsTel"); await p.fill("#bsTel", tel); await p.click('[data-bskapi="kodIste"]');
  await p.waitForSelector("#bsKod"); await p.fill("#bsKod", await otp(tel)); await p.click('[data-bskapi="kodDogrula"]');
  if (davet) { await p.waitForSelector("#bsDavet"); await p.fill("#bsDavet", davet); await p.click('[data-bskapi="katil"]'); }
  await p.waitForSelector("#bsKapi", { state: "hidden" }); await p.waitForTimeout(500);
}
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };

test("Android: Hikmet'te otomatik duvar kâğıdı; 'Her açılışta yeni' tüm görselleri üretir ve canlı duvar kâğıdını açar", { timeout: 180000 }, async () => {
  const { page: p, hatalar, context } = await uygulama("android");
  await gir(p, "0532 200 00 01", yonDavet);
  sakinDavet = (await p.evaluate(() => BS_API("POST", "/api/yonetim/davetler", { rol: "sakin", maxKullanim: 5, gun: 7 }))).kod;
  await git(p, "#hikmet");
  await p.waitForSelector(".od");
  const secenekler = await p.$$eval(".od-sec b", b => b.map(x => x.textContent));
  assert.deepEqual(secenekler, ["Her açılışta yeni", "Her gün yeni", "Kapalı"]);
  assert.equal(await p.$eval('.od-sec[data-od="kapali"]', e => e.classList.contains("on")), true, "varsayılan kapalı");
  await p.screenshot({ path: path.join(KOK, "docs/screenshots/otomatik-duvar-kagidi.png") });
  const n = await p.evaluate(() => HK.length);
  await p.click('.od-sec[data-od="acilis"]');
  await p.waitForSelector(".od-uret");
  await p.waitForFunction(() => document.querySelector('.od-sec[data-od="acilis"]')?.classList.contains("on"), null, { timeout: 150000 });
  const havuz = await p.evaluate(() => Object.keys(window.__havuz).sort());
  const bekl = []; for (let i = 0; i < n; i++) bekl.push(`ana-${i}.jpg`, `kilit-${i}.jpg`);
  assert.deepEqual(havuz, bekl.sort(), "her metin için ana ve kilit görseli");
  // Görseller gerçek JPEG ve telefon boyutunda
  const boyut = await p.evaluate(async () => { const im = new Image(); im.src = "data:image/jpeg;base64," + window.__son.base64; await im.decode(); return [im.naturalWidth, im.naturalHeight, window.__son.base64.slice(0, 4)]; });
  assert.deepEqual(boyut, [1080, 1920, "/9j/"]);
  const d = await p.evaluate(() => ({ n: JSON.parse(localStorage.getItem("od-n")), cagri: JSON.parse(localStorage.getItem("od-cagri")), surum: JSON.parse(localStorage.getItem("od-surum")), beklenen: BS_OTODUVAR._surum() }));
  assert.equal(d.n, n); assert.deepEqual(d.cagri, ["acilis"]); assert.equal(d.surum, d.beklenen);
  assert.match(await p.textContent(".od"), /telefonu her açtığınızda yeni bir ayet ya da hadis/);
  // "Her gün yeni"ye geçiş: görseller yeniden üretilmez
  const once = await p.evaluate(() => JSON.parse(localStorage.getItem("od-yazim")));
  await p.click('.od-sec[data-od="gunluk"]');
  await p.waitForFunction(() => document.querySelector('.od-sec[data-od="gunluk"]')?.classList.contains("on"));
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("od-yazim"))), once, "aynı sürümde görsel yeniden yazılmaz");
  assert.match(await p.textContent(".od"), /her gün günün ayeti\/hadisi/);
  // Uygulama yeniden açılınca sürüm aynıysa yeniden üretmez
  await p.reload(); await p.waitForSelector("#bsKapi", { state: "hidden" }); await p.waitForTimeout(4500);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem("od-yazim"))), once, "açılışta gereksiz üretim yok");
  // Site adı değişince sürüm değişir → açılışta görseller yenilenir
  const s1 = await p.evaluate(() => BS_OTODUVAR._surum());
  const s2 = await p.evaluate(() => { const eski = AYAR.siteAdi; AYAR.siteAdi = "Başka Site"; const v = BS_OTODUVAR._surum(); AYAR.siteAdi = eski; return v; });
  assert.notEqual(s1, s2, "site adı görsele yazıldığı için sürüm değişir");
  // Duvar kâğıdı penceresinde otomatik bağlantısı
  await git(p, "#hikmet"); await p.click(".hkk [data-hk-duvar]"); await p.waitForSelector("#hkdv:not([hidden])");
  assert.match(await p.textContent("#hkdv"), /kendiliğinden değişsin/);
  await p.click('#hkdv a[href="#hikmet"]'); await p.waitForTimeout(300);
  assert.equal(await p.isHidden("#hkdv"), true);
  // Kapat
  await p.click('.od-sec[data-od="kapali"]'); await p.waitForFunction(() => document.querySelector('.od-sec[data-od="kapali"]')?.classList.contains("on"));
  const kucuk = await p.$$eval(".od button", a => a.map(e => e.getBoundingClientRect()).filter(r => r.height < 44).length);
  assert.equal(kucuk, 0, "dokunma hedefleri en az 44 px");
  assert.deepEqual(hatalar, []); await context.close();
});

test("iPhone: 'Her açılışta' seçeneği yok; 'Her gün yeni' görselleri üretir ve Kestirmeler adımlarını gösterir", { timeout: 180000 }, async () => {
  const { page: p, hatalar, context } = await uygulama("ios");
  await gir(p, "0532 200 00 02", sakinDavet);
  await git(p, "#hikmet"); await p.waitForSelector(".od");
  assert.deepEqual(await p.$$eval(".od-sec b", b => b.map(x => x.textContent)), ["Her gün yeni", "Kapalı"]);
  await p.click('.od-sec[data-od="gunluk"]');
  await p.waitForSelector(".od-ios", { timeout: 150000 });
  const t = await p.textContent(".od-ios");
  assert.match(t, /Günün Hikmet görseli/); assert.match(t, /duvar kâğıdını ayarlama eylemini/); assert.match(t, /Otomasyon/);
  assert.equal(await p.evaluate(() => Object.keys(window.__havuz).length), 2 * await p.evaluate(() => HK.length));
  await p.screenshot({ path: path.join(KOK, "docs/screenshots/otomatik-duvar-kagidi-ios.png") });
  assert.deepEqual(hatalar, []); await context.close();
});
