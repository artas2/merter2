"use strict";
/* Uçtan uca: Hikmet (günün ayeti/hadisi, arşiv, duvar kâğıdı) ve mobil uygulama modu.
   Mobil mod, Capacitor'ın yaptığı gibi web dosyalarını ayrı bir kaynaktan (https://localhost) sunar; API'ye Bearer jetonla gidilir.
   Google Play (OAuth + Developer API) sahte bir yerel sunucuyla taklit edilir. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");
const { sahteGoogle } = require("./sahte-google");

const KOK = path.join(__dirname, "..");
const PORT = 4400 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let sunucu, log = "", browser, tmp, davet, gp;
const bekle = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  gp = await sahteGoogle();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-mobil-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "a.sqlite"), PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "mobil".repeat(10),
    ...gp.env };
  const s = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/seed-demo.js"], { cwd: KOK, env, encoding: "utf8" });
  davet = /Sakin davet kodu: ([A-Z0-9-]+)/.exec(s.stdout)[1];
  sunucu = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], { cwd: KOK, env });
  sunucu.stdout.on("data", d => { log += d; }); sunucu.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 100 && !log.includes("çalışıyor"); i++) await bekle(50);
  // Test sunucusu 127.0.0.1'de; Chrome'un yerel ağ erişimi kontrolü yönlendirilmiş "uygulama" sayfasından buna izin vermez (gerçek API internettedir).
  browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests"] });
});
after(async () => {
  if (browser) await browser.close();
  if (sunucu) { sunucu.kill("SIGTERM"); await new Promise(r => sunucu.once("exit", r)); }
  if (gp) gp.kapat();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

const otpBul = async tel => {
  const e = "+90" + tel.replace(/\D/g, "").slice(1);
  for (let i = 0; i < 100; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === e).pop(); if (m) return m[2]; await bekle(50); }
  throw new Error("OTP yok");
};
async function giris(page, kok, tel, kod) {
  await page.goto(kok + "/");
  await page.fill("#g-tel", tel); await page.click('button:text-is("Kod gönder")'); await page.waitForSelector("#g-kod");
  await page.fill("#g-kod", await otpBul(tel)); await page.click('button:text-is("Giriş yap")');
  if (kod) { await page.waitForSelector("#d-kod"); await page.fill("#d-kod", kod); await page.click('button:text-is("Katıl")'); await page.waitForSelector("#pf-blok"); }
  await page.waitForSelector('body[data-oturum="1"]');
}
async function sayfa(ek = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...ek });
  const page = await context.newPage(); const hatalar = [];
  page.on("pageerror", e => hatalar.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/401|Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  return { context, page, hatalar };
}
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(250); };

test("Web: ana sayfada günün ayeti/hadisi, arşiv, premium kilidi", { timeout: 90000 }, async () => {
  const { page: P, hatalar, context } = await sayfa();
  await giris(P, BASE, "0500 000 00 01");
  assert.equal(await P.$eval("main", m => m.firstElementChild.classList.contains("hkhero")), true, "kart en üstte");
  assert.equal(await P.$eval(".hkar", e => e.dir === "rtl" && e.lang === "ar"), true);
  const fontOk = await P.evaluate(async () => { await document.fonts.ready; return document.fonts.check('32px "Amiri"', "بِسْمِ"); });
  assert.equal(fontOk, true, "Amiri yerel yazı tipi yüklendi");
  const t0 = await P.textContent(".hktr"); await P.click('[data-hk-gez="1"]'); assert.notEqual(await P.textContent(".hktr"), t0);
  await P.click('[data-hk-gez="0"]'); assert.equal(await P.textContent(".hktr"), t0);
  const wa = decodeURIComponent(await P.getAttribute(".hkhero .hk-wa", "href")); assert.match(wa, /^https:\/\/wa\.me\/\?text=/); assert.match(wa, /—/);
  await git(P, "#hikmet");
  const n = await P.$$eval(".hkk", x => x.length); assert.equal(n, 23);
  await P.click('[data-hk-tema="sabir"]'); const n2 = await P.$$eval(".hkk", x => x.length); assert.ok(n2 > 0 && n2 < n);
  // Ücretsiz kullanıcı: duvar kâğıdı Premium'a yönlendirir, zorlamaz
  await P.click(".hkk [data-hk-duvar]"); await P.waitForSelector("#hkdv:not([hidden])");
  assert.match(await P.textContent("#hkdv"), /Premium aboneliğe dahildir/); assert.match(await P.textContent("#hkdv"), /her zaman ücretsizdir/);
  await P.keyboard.press("Escape"); assert.equal(await P.isHidden("#hkdv"), true);
  // Abonelik sayfası (web): satın alma düğmesi yok, telefona yönlendirir
  await git(P, "#abonelik");
  assert.match(await P.textContent("main"), /telefon uygulamasından/); assert.equal(await P.$$eval('[data-act="abone"]', x => x.length), 0);
  assert.match(await P.textContent("main"), /100 TL \/ ay/);
  const kayma = await P.evaluate(() => document.documentElement.scrollWidth <= innerWidth); assert.equal(kayma, true);
  await P.screenshot({ path: path.join(KOK, "docs/screenshots/hikmet-390.png") });
  assert.deepEqual(hatalar, []); await context.close();
});

test("Mobil mod: ayrı kaynaktan açılır, jetonla giriş, mağazadan satın alma, duvar kâğıdı ayarlama", { timeout: 120000 }, async () => {
  const MOB = "http://localhost"; // Capacitor https://localhost kullanır; test sunucusu http olduğundan karışık içerik engeline takılmamak için http
  const { page: P, hatalar, context } = await sayfa();
  const yerel = { ayarlanan: [], kaydedilen: [], paylasilan: [] };
  await P.exposeFunction("__yerel", (tur, v) => { yerel[tur].push(v); });
  // Capacitor gibi: web dosyaları uygulamanın içinden (https://localhost) gelir
  await context.route(MOB + "/**", async r => {
    let p = new URL(r.request().url()).pathname; if (p === "/" || !path.extname(p)) p = "/index.html";
    const dosya = p === "/vendor/marked.min.js" ? path.join(KOK, "node_modules/marked/marked.min.js") : p === "/config.js" ? null : path.join(KOK, "public", p);
    if (dosya === null) return r.fulfill({ contentType: "text/javascript", body: `window.BS_AYAR={apiTaban:${JSON.stringify(BASE)}};` });
    if (!fs.existsSync(dosya)) return r.fulfill({ status: 404, body: "" });
    const tip = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" }[path.extname(dosya)] || "application/octet-stream";
    r.fulfill({ contentType: tip, body: fs.readFileSync(dosya) });
  });
  await context.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
    window.BSNative = {
      tokenOku: async () => localStorage.getItem("t"), tokenYaz: async t => localStorage.setItem("t", t), tokenSil: async () => localStorage.removeItem("t"),
      magaza: { satinAl: async g => { await window.__yerel("paylasilan", "satin:" + g.hesapUuid); return { platform: "android", token: "tok-" + g.hesapUuid }; }, geriYukle: async () => [] },
      duvar: { ayarla: async o => window.__yerel("ayarlanan", o.hedef + ":" + o.base64.length), kaydet: async o => window.__yerel("kaydedilen", o.ad) },
      paylasDosya: async o => window.__yerel("paylasilan", o.ad + ":" + o.metin.length)
    };
  });
  await giris(P, MOB, "0500 000 00 77", davet);
  const tok = await P.evaluate(() => localStorage.getItem("t")); assert.ok(tok && tok.length > 30, "jeton güvenli depoya yazıldı");
  assert.equal(await P.evaluate(() => document.cookie), "", "mobilde çerez yok");
  assert.equal(await P.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length)), 0, "mobilde servis çalışanı yok");
  await git(P, "#diger"); assert.equal(await P.$$eval("#kurulum", x => x.length), 0, "ana ekrana ekle ipucu yok");
  // Abonelik: mağaza düğmeleri ve yasal bilgiler
  await git(P, "#abonelik");
  assert.equal(await P.$$eval('[data-act="abone"]', x => x.length), 1); assert.equal(await P.$$eval('[data-act="geriYukle"]', x => x.length), 1);
  const yasal = await P.textContent(".ab-yasal"); assert.match(yasal, /otomatik yenilenen/); assert.match(yasal, /24 saat/); assert.match(yasal, /Google Play/);
  assert.equal(await P.$$eval(".ab-yasal a", a => a.map(x => x.textContent).join("|")), "Kullanım koşulları|Gizlilik politikası");
  // Satın alma: cihaz Google Play jetonunu gönderir, sunucu Google'dan doğrular
  const { hesapUuid } = await P.evaluate(async b => (await fetch(b + "/api/abonelik", { headers: { Authorization: "Bearer " + localStorage.getItem("t"), "X-Istemci": "mobil" } })).json(), BASE);
  await P.click('[data-act="abone"]'); await P.waitForSelector(".ab-kart.on");
  assert.match(await P.textContent("main"), /Premium etkin/); assert.deepEqual(yerel.paylasilan, ["satin:" + hesapUuid]);
  assert.match(await P.getAttribute('a[href*="play.google.com"]', "href"), /subscriptions/);
  // Duvar kâğıdı: önizleme, Android'de doğrudan ayarla, galeriye kaydet
  await git(P, "#hikmet"); await P.click(".hkk [data-hk-duvar]");
  await P.waitForSelector("#hkdvr img", { timeout: 10000 });
  await P.waitForSelector('#hkdv [data-hkdv="ayarla"]:not([disabled])');
  assert.equal(await P.textContent('#hkdv [data-hkdv="ayarla"]'), "Ana ekran yap");
  await P.click('#hkdv [data-hkdv="ayarla"]'); await P.waitForTimeout(300);
  await P.click('[data-hkdv="mod:kilit"]'); await P.waitForSelector('#hkdv [data-hkdv="ayarla"]:not([disabled])');
  assert.equal(await P.textContent('#hkdv [data-hkdv="ayarla"]'), "Kilit ekranı yap");
  await P.click('#hkdv [data-hkdv="ayarla"]'); await P.click('#hkdv [data-hkdv="kaydet"]'); await P.waitForTimeout(300);
  assert.equal(yerel.ayarlanan.length, 2); assert.match(yerel.ayarlanan[0], /^ana:\d{5,}/); assert.match(yerel.ayarlanan[1], /^kilit:/);
  assert.match(yerel.kaydedilen[0], /^hikmet-.*-kilit\.png$/);
  const boyut = await P.evaluate(async () => { const c = await hkDuvarCiz(HK[0], "kilit"); return [c.width, c.height]; }); assert.deepEqual(boyut, [1080, 1920]);
  await P.screenshot({ path: path.join(KOK, "docs/screenshots/mobil-duvar-kagidi.png") });
  await P.keyboard.press("Escape");
  // Veri indirme mobilde paylaşım üzerinden
  await git(P, "#hesap"); await P.click('[data-act="veriPaylas"]'); await P.waitForTimeout(400);
  assert.match(yerel.paylasilan[1], /^bilincli-sakin-verilerim\.json:\d+/);
  // Çıkış jetonu siler ve sunucuda geçersiz kılar
  await git(P, "#diger"); await P.click('[data-act="cikis"]'); await P.waitForSelector("#g-tel");
  assert.equal(await P.evaluate(() => localStorage.getItem("t")), null);
  const me = await (await fetch(BASE + "/api/me", { headers: { Authorization: "Bearer " + tok, "X-Istemci": "mobil", Origin: MOB } })).json();
  assert.equal(me.user, null);
  assert.deepEqual(hatalar, []); await context.close();
});
