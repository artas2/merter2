"use strict";
/* Uçtan uca: Merter Çınar Evleri arayüzü gerçek sunucuda.
   - Yönetici tarayıcıdan (/m/), sakin telefon uygulaması modunda (Capacitor gibi ayrı kaynak, Bearer jeton).
   - Giriş kapısı, profil, sepet, Premium satın alma (sahte RevenueCat), Gündem paylaşımı ve canlı güncelleme,
     yönetici sakin listesi, duvar kâğıdı (yerel köprü), hesap silme. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..");
const PORT = 4500 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const MOB = "http://localhost";
let sunucu, log = "", browser, tmp, yonDavet, rc, www;
const RC = new Map();
const bekle = ms => new Promise(r => setTimeout(r, ms));
const gun = n => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10); };

before(async () => {
  rc = http.createServer((req, res) => {
    const id = decodeURIComponent(req.url.split("/").pop());
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ subscriber: RC.get(id) || { entitlements: {}, subscriptions: {} } }));
  });
  await new Promise(r => rc.listen(0, "127.0.0.1", r));
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-merter-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "a.sqlite"), PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "merter".repeat(8),
    REVENUECAT_API_ANAHTARI: "sk_e2e", REVENUECAT_API_TABAN: `http://127.0.0.1:${rc.address().port}`, PLATFORM_ADMIN_TELEFONLARI: "05000000999" };
  const k = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/kur-site.js", "--ad", "Merter Çınar Evleri", "--bloklar", "A,B,C,D,E", "--daire", "12", "--kat", "0-5"], { cwd: KOK, env, encoding: "utf8" });
  yonDavet = /Yönetici davet : ([A-Z0-9-]+)/.exec(k.stdout)[1];
  // Telefon uygulamasının dosyaları (mobile/www) bu test sunucusunu gösterecek şekilde üretilir
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
  if (rc) rc.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

const otp = async tel => {
  const e = "+90" + tel.replace(/\D/g, "").slice(1);
  for (let i = 0; i < 100; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === e).pop(); if (m) return m[2]; await bekle(50); }
  throw new Error("OTP yok: " + tel);
};
async function sayfa() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); const hatalar = [];
  page.on("pageerror", e => hatalar.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|401/.test(m.text())) hatalar.push(m.text()); });
  page.on("dialog", d => d.accept());
  return { context, page, hatalar };
}
async function kapidanGir(p, tel, davet) {
  await p.waitForSelector("#bsTel");
  await p.fill("#bsTel", tel); await p.click('[data-bskapi="kodIste"]');
  await p.waitForSelector("#bsKod"); await p.fill("#bsKod", await otp(tel)); await p.click('[data-bskapi="kodDogrula"]');
  if (davet) { await p.waitForSelector("#bsDavet"); await p.fill("#bsDavet", davet); await p.click('[data-bskapi="katil"]'); }
  try { await p.waitForSelector("#bsKapi", { state: "hidden", timeout: 15000 }); }
  catch (e) { throw new Error("Giriş kapısı kapanmadı: " + (await p.textContent("#bsKapi")).replace(/\s+/g, " ").slice(0, 300)); }
  await p.waitForTimeout(600);
}
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
const webApi = (p, method, yol, body) => p.evaluate(async ([m, y, b]) => {
  const me = await (await fetch("/api/me")).json();
  const r = await fetch(y, { method: m, headers: { "content-type": "application/json", "x-csrf-token": me.csrf }, body: m === "GET" ? undefined : JSON.stringify(b || {}) });
  return r.json();
}, [method, yol, body]);

let Y, S, davet;
test("Yönetici: tarayıcıdan /m/ giriş kapısı, Merter arayüzü, yönetim yetkisi", { timeout: 90000 }, async () => {
  Y = await sayfa();
  await Y.page.goto(BASE + "/m/");
  assert.match(await Y.page.textContent("#bsKapi h2"), /Merter Çınar Evleri/);
  await kapidanGir(Y.page, "0532 000 00 01", yonDavet);
  assert.match(await Y.page.textContent(".brand h1"), /Merter/);
  assert.equal(await Y.page.isVisible("#hYon"), true, "yönetici düğmesi görünür (canEdit)");
  const fontlar = await Y.page.evaluate(async () => Promise.all(["Bricolage Grotesque", "Atkinson Hyperlegible"].map(async f => { await document.fonts.load(`16px "${f}"`, "Çınar ğüşiöç"); return document.fonts.check(`16px "${f}"`, "Çınar ğüşiöç"); })));
  assert.deepEqual(fontlar, [true, true], "yerel yazı tipleri");
  davet = (await webApi(Y.page, "POST", "/api/yonetim/davetler", { rol: "sakin", maxKullanim: 50, gun: 14 })).kod;
  assert.ok(davet);
  // Sipariş turunu yönetici açar (Merter ayarları belge deposunda)
  const kat = await Y.page.evaluate(async () => { const db = await claude.use("db"); const s = await db.doc("ayarlar/katalog").get(); return s.data(); });
  assert.ok(kat.urunler.length > 10, "kurulumdaki örnek katalog belge deposunda");
  await Y.page.evaluate(async ([g1, g2]) => { const db = await claude.use("db"); await db.doc("ayarlar/katalog").update({ tur: { id: "t1", ad: "Cumartesi pazarı", sonTarih: g1, teslim: g2, acik: true } }); }, [gun(3), gun(4)]);
  assert.deepEqual(Y.hatalar, []);
});

test("Sakin: telefon uygulaması modu (ayrı kaynak, jeton), profil, sepet, Premium, Gündem, duvar kâğıdı", { timeout: 150000 }, async () => {
  S = await sayfa();
  const P = S.page, yerel = { ayar: [], kayit: [], satin: 0 };
  await P.exposeFunction("__yerel", (t, v) => { if (t === "satin") yerel.satin++; else yerel[t].push(v); });
  await S.context.route(MOB + "/**", async r => {
    let u = new URL(r.request().url()).pathname; if (u === "/") u = "/index.html";
    if (u === "/kopru.js") return r.fulfill({ contentType: "text/javascript", body: `
      window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" };
      let aid = null;
      window.BSNative = { tokenOku: async () => localStorage.getItem("t"), tokenYaz: async t => localStorage.setItem("t", t), tokenSil: async () => localStorage.removeItem("t"),
        magaza: { hazirla: async id => { aid = id; }, satinAl: async () => { await window.__yerel("satin"); return "tamam"; }, geriYukle: async () => {} },
        duvar: { ayarla: async o => window.__yerel("ayar", o.hedef), kaydet: async o => window.__yerel("kayit", o.ad) }, paylasDosya: async () => {} };` });
    const f = path.join(www, u);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    const tip = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".md": "text/markdown" }[path.extname(f)] || "application/octet-stream";
    r.fulfill({ contentType: tip, body: fs.readFileSync(f) });
  });
  await P.goto(MOB + "/");
  await kapidanGir(P, "0533 000 00 02", davet);
  assert.ok((await P.evaluate(() => localStorage.getItem("t"))).length > 30, "jeton saklandı");
  // Profil
  await git(P, "#profil");
  await P.fill("#pf-ad", "Ayşe"); await P.selectOption("#pf-blok", "C"); await P.waitForTimeout(150);
  await P.selectOption("#pf-kat", "5"); await P.selectOption("#pf-daire", "12"); await P.selectOption("#pf-durum", "Malik"); await P.check("#pf-kvkk");
  await P.click('[data-pact="save"]'); await P.waitForTimeout(800);
  await git(P, "#anasayfa");
  assert.match(await P.textContent("main"), /Hoş geldiniz, Ayşe/);
  // Sepet
  await git(P, "#sepet");
  await P.click('[data-sp="q:u1:1"]'); await P.waitForTimeout(1500);
  // Premium: Gündem'de kart, satın alma, sonra paylaşım
  await git(P, "#gundem");
  assert.match(await P.textContent("main"), /Premium Gündem/);
  const aboneId = await P.evaluate(async b => (await (await fetch(b + "/api/abonelik", { headers: { Authorization: "Bearer " + localStorage.getItem("t"), "X-Istemci": "mobil" } })).json()).aboneId, BASE);
  RC.set(aboneId, { entitlements: { premium: { expires_date: new Date(Date.now() + 30 * 864e5).toISOString(), product_identifier: "bs_premium_aylik" } }, subscriptions: { bs_premium_aylik: { store: "play_store" } } });
  await P.click('[data-bshesap="premium"]'); await P.waitForSelector('[data-bshesap="abone"]');
  assert.match(await P.textContent("#bsPremium"), /24 saat/);
  await P.click('[data-bshesap="abone"]'); await P.waitForFunction(() => /Premium etkin/.test(document.getElementById("bsPremium").textContent), null, { timeout: 10000 });
  assert.equal(yerel.satin, 1);
  await P.click('[data-bshesap="kapat"]');
  await P.waitForSelector("#gnMetin", { timeout: 10000 });
  await P.fill("#gnMetin", "Bahçedeki erikler çiçek açtı"); await P.click('[data-gn="paylas"]'); await P.waitForTimeout(800);
  assert.match(await P.textContent("main"), /erikler çiçek açtı/);
  // Duvar kâğıdı (Android'de doğrudan)
  await git(P, "#hikmet"); await P.click(".hkk [data-hk-duvar]");
  await P.waitForSelector("#hkdva:not([disabled])", { timeout: 10000 });
  await P.click("#hkdva"); await P.click("#hkdvs"); await P.waitForTimeout(500);
  assert.deepEqual(yerel.ayar, ["ana"]); assert.match(yerel.kayit[0], /^hikmet-.*\.png$/);
  await P.keyboard.press("Escape");
  await P.screenshot({ path: path.join(KOK, "docs/screenshots/merter-mobil-gundem.png") });
  assert.deepEqual(S.hatalar, []);
});

test("Yönetici: sakini ve siparişini görür; site öder modunda gönderi canlı gelir", { timeout: 90000 }, async () => {
  const p = Y.page;
  await git(p, "#sakinler");
  const t = await p.textContent("main");
  assert.match(t, /C Blok/); assert.match(t, /Ayşe/);
  const sepetler = await p.evaluate(async () => { const db = await claude.use("db"); return new Promise(r => db.collection("sepetler").onSnapshot(s => r(s.docs.map(d => d.data())))); });
  assert.equal(sepetler.length, 1); assert.equal(sepetler[0].blok, "C");
  // Site öder → yönetici de Premium; gönderiyi görür, sakin yeni gönderi atınca sayfa yenilemeden gelir
  const A = await sayfa(); await A.page.goto(BASE + "/");
  await A.page.fill("#g-tel", "0500 000 09 99"); await A.page.click('button:text-is("Kod gönder")'); await A.page.waitForSelector("#g-kod");
  await A.page.fill("#g-kod", await otp("0500 000 09 99")); await A.page.click('button:text-is("Giriş yap")'); await A.page.waitForSelector('body[data-oturum="1"]');
  const siteler = await webApi(A.page, "GET", "/api/platform/siteler");
  const m = siteler.siteler.find(s => s.ad === "Merter Çınar Evleri");
  await webApi(A.page, "PATCH", "/api/platform/siteler/" + m.id, { odemeModeli: "site" });
  await A.context.close();
  await p.reload(); await p.waitForSelector("#bsKapi", { state: "hidden" }); await p.waitForTimeout(600);
  await git(p, "#gundem");
  assert.match(await p.textContent("main"), /erikler çiçek açtı/);
  await S.page.evaluate(() => { location.hash = "#gundem"; });
  await S.page.waitForSelector("#gnMetin"); await S.page.fill("#gnMetin", "Akşam çay bahçede"); await S.page.click('[data-gn="paylas"]');
  await p.waitForFunction(() => /Akşam çay bahçede/.test(document.querySelector("main").textContent), null, { timeout: 30000 });
  assert.deepEqual(Y.hatalar, []);
});

test("Sakin: hesabını uygulamadan siler; veriler gider, giriş kapısı döner", { timeout: 60000 }, async () => {
  const P = S.page;
  await git(P, "#profil");
  await P.click('[data-bshesap="silSor"]'); await P.click('[data-bshesap="silEvet"]');
  await P.waitForSelector("#bsTel", { timeout: 15000 });
  assert.equal(await P.evaluate(() => localStorage.getItem("t")), null);
  await git(Y.page, "#sakinler");
  assert.doesNotMatch(await Y.page.textContent("main"), /Ayşe/);
  assert.deepEqual(S.hatalar, []);
  await S.context.close(); await Y.context.close();
});
