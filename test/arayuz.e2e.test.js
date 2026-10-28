"use strict";
/* Uçtan uca: yeni sakin arayüzü (ana sayfa, alt çubuk, dokunma hedefleri, yazı büyütme, odak, hareket azaltma, PWA/çevrimdışı).
   DEMO verisi geçici bir veritabanına kurulur; test sonunda silinir. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..");
const PORT = 4300 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let sunucu, log = "", browser, tmp, davet;
const bekle = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-arayuz-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "a.sqlite"), PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "arayuz".repeat(8) };
  const s = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/seed-demo.js"], { cwd: KOK, env, encoding: "utf8" });
  davet = /Sakin davet kodu: ([A-Z0-9-]+)/.exec(s.stdout)[1];
  sunucu = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], { cwd: KOK, env });
  sunucu.stdout.on("data", d => { log += d; }); sunucu.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 100 && !log.includes("çalışıyor"); i++) await bekle(50);
  browser = await chromium.launch();
});
after(async () => {
  if (browser) await browser.close();
  if (sunucu) { sunucu.kill("SIGTERM"); await new Promise(r => sunucu.once("exit", r)); }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

async function kullanici(width, ek = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, ...ek });
  const page = await context.newPage();
  const hatalar = [];
  page.on("console", m => { if (m.type() === "error") hatalar.push(m.text()); });
  page.on("pageerror", e => hatalar.push("pageerror: " + e.message));
  return { context, page, hatalar };
}
async function girisYap(page, tel, kod) {
  const e = "+90" + tel.replace(/\D/g, "").slice(1);
  await page.goto(BASE + "/");
  await page.fill("#g-tel", tel);
  await page.click('button:text-is("Kod gönder")');
  await page.waitForSelector("#g-kod");
  let otp = null;
  for (let i = 0; i < 100 && !otp; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === e).pop(); otp = m && m[2]; if (!otp) await bekle(50); }
  await page.fill("#g-kod", otp);
  await page.click('button:text-is("Giriş yap")');
  if (kod) { await page.waitForSelector("#d-kod"); await page.fill("#d-kod", kod); await page.click('button:text-is("Katıl")'); await page.waitForSelector("#pf-blok"); }
  await page.waitForSelector('body[data-oturum="1"]');
}
async function git(page, hash) { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(200); }
async function kaymaYok(page, ad) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth }));
  assert.ok(r.sw <= r.iw && r.bw <= r.iw, `${ad}: yatay kayma (${r.sw}/${r.bw} > ${r.iw})`);
}
/* Görünür dokunma hedefleri en az 44×44 px (metin içi bağlantılar ve küçük etiketler hariç) */
async function dokunmaHedefleri(page, ad) {
  const kucuk = await page.evaluate(() => [...document.querySelectorAll("main button, main .btn, main input:not([type=checkbox]), main select, main textarea, #altbar a, main .mrow, main .bkart")]
    .filter(el => el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden")
    .map(el => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.id || el.tagName).trim().slice(0, 30), h: r.height, w: r.width }; })
    .filter(x => x.h < 43.5 || x.w < 43.5));
  assert.deepEqual(kucuk, [], `${ad}: 44 px altı dokunma hedefi`);
}

test("390 px sakin: ana sayfa, alt çubuk, sepet geri bildirimi, yazı büyütme, odak, Diğer", { timeout: 90000 }, async () => {
  const K = await kullanici(390);
  await K.context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const P = K.page;
  await girisYap(P, "0500 000 00 01");
  // Alt çubuk telefonda görünür, üst menü gizli
  assert.equal(await P.isVisible("#altbar"), true); assert.equal(await P.isVisible("nav.tabs"), false);
  assert.equal(await P.getAttribute("#altbar", "aria-label"), "Ana menü");
  assert.deepEqual(await P.$$eval("#altbar a", a => a.map(x => x.querySelector("span").textContent)), ["Ana sayfa", "Sepet", "Profil", "Diğer"]);
  assert.equal(await P.getAttribute('#altbar a[data-v="ana"]', "aria-current"), "page");
  assert.equal((await P.textContent("#altbar .rozet")).trim(), "4");
  const pad = await P.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom));
  assert.ok(pad >= 64, "içerik alt çubuğun altında kalmaz");
  // Ana sayfa kartları
  assert.equal((await P.textContent("#selam")).trim(), "Merhaba, A Blok 2. kat 5");
  assert.match(await P.textContent("#kartSepet"), /Sipariş açık · 2 gün \d+ saat kaldı/);
  assert.match(await P.textContent("#kartSepet"), /4 ürün/);
  assert.match(await P.textContent("main"), /Duyuru/);
  assert.match(await P.textContent("main"), /Öğrenme haritası/);
  assert.equal(await P.locator(".karsilama").count(), 0, "profili olan sakine karşılama gösterilmez");
  await P.click('[data-kopya]');
  await P.waitForFunction(() => /kopyalandı/.test(document.getElementById("bildirim").textContent));
  assert.equal(await P.evaluate(() => navigator.clipboard.readText()), "0500 000 00 99");
  // Gövde yazısı ≥ 16 px
  assert.equal(await P.evaluate(() => getComputedStyle(document.body).fontSize), "16px");
  for (const sel of [".bkart p", ".lead"]) assert.ok(await P.$eval(sel, el => parseFloat(getComputedStyle(el).fontSize)) >= 16, sel);
  await dokunmaHedefleri(P, "ana");
  await kaymaYok(P, "ana");
  // Sepet: "eklendi" geri bildirimi ve rozet
  await P.click('#altbar a[data-v="sepet"]');
  await P.waitForSelector(".pcard");
  assert.equal(await P.getAttribute('#altbar a[data-v="sepet"]', "aria-current"), "page");
  await P.click('.pcard[data-name="salatalık"] .addb');
  await P.waitForFunction(() => /Salatalık sepete eklendi/.test(document.getElementById("bildirim").textContent));
  assert.equal(await P.isVisible("#bildirim"), true);
  assert.equal((await P.textContent("#altbar .rozet")).trim(), "5");
  await dokunmaHedefleri(P, "sepet");
  // Profil ve Diğer
  await git(P, "#profil"); await P.waitForSelector("#pf-daire");
  await dokunmaHedefleri(P, "profil");
  await git(P, "#diger");
  await P.waitForSelector(".mrow");
  assert.equal(await P.locator('.mrow[href="#yonetim"]').count(), 0, "sakin yönetim menüsü görmez");
  assert.ok(await P.locator('.mrow[href="#hesap"]').count() === 1 && await P.locator("#kurulum").count() === 1);
  assert.equal(await P.getAttribute('#altbar a[data-v="diger"]', "aria-current"), "page");
  await dokunmaHedefleri(P, "diğer");
  // Tarayıcı yazı boyutu %200: yatay kayma yok
  await P.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  for (const h of ["#ana", "#sepet", "#profil", "#diger", "#kart"]) { await git(P, h); await kaymaYok(P, "%200 yazı " + h); }
  await P.evaluate(() => { document.documentElement.style.fontSize = ""; });
  // 1280 px'te %200 yakınlaştırma = 640 CSS px
  await P.setViewportSize({ width: 640, height: 800 });
  for (const h of ["#ana", "#sepet", "#profil"]) { await git(P, h); await kaymaYok(P, "640 px " + h); }
  await P.setViewportSize({ width: 390, height: 800 });
  // Klavye odağı görünür
  await git(P, "#ana");
  await P.keyboard.press("Tab"); await P.keyboard.press("Tab");
  const odak = await P.evaluate(() => { const s = getComputedStyle(document.activeElement); return { tag: document.activeElement.tagName, w: parseFloat(s.outlineWidth), st: s.outlineStyle }; });
  assert.ok(odak.st !== "none" && odak.w >= 2, JSON.stringify(odak));
  assert.deepEqual(K.hatalar, []);

  // PWA: servis çalışanı yalnızca statik dosyaları önbelleğe alır; çevrimdışıyken "bağlantı yok"
  await P.evaluate(() => navigator.serviceWorker.ready);
  await P.reload(); await P.waitForSelector('body[data-oturum="1"]');
  await git(P, "#sepet"); await git(P, "#profil");
  const onbellek = await P.evaluate(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) out.push(new URL(r.url).pathname); } return out; });
  assert.ok(onbellek.includes("/app.js") && onbellek.includes("/cevrimdisi.html"), onbellek.join(","));
  assert.ok(onbellek.every(u => !u.startsWith("/api/") && !u.startsWith("/md/") && u !== "/manifest.webmanifest" && u !== "/"), "API/kişisel veri önbellekte olmamalı: " + onbellek.join(","));
  await K.context.setOffline(true);
  await P.goto(BASE + "/?yenile=1").catch(() => {});
  await P.waitForSelector("text=Bağlantı yok");
  assert.match(await P.textContent("body"), /İnternete bağlı değilsin/);
  assert.equal(await P.title(), "Bağlantı yok · Bilinçli Sakin", "çevrimdışı sayfayı servis çalışanı sundu");
  await K.context.setOffline(false);
  await K.context.close();
});

test("Yeni sakin: karşılama (3 adım) ve eksik profil uyarısı; 320 px", { timeout: 60000 }, async () => {
  const K = await kullanici(320);
  await girisYap(K.page, "0504 000 00 01", davet);
  await git(K.page, "#ana");
  await K.page.waitForSelector(".karsilama");
  assert.equal(await K.page.locator(".karsilama li").count(), 3);
  assert.match(await K.page.textContent("#kartProfil"), /2 dakikada tamamla/);
  assert.equal((await K.page.textContent("#selam")).trim(), "Merhaba");
  await dokunmaHedefleri(K.page, "320 ana");
  for (const h of ["#ana", "#sepet", "#profil", "#diger"]) { await git(K.page, h); await kaymaYok(K.page, "320 " + h); }
  await K.page.click('.karsilama a.btn, a.btn:text-is("Profilimi oluştur")').catch(async () => { await git(K.page, "#profil"); });
  assert.deepEqual(K.hatalar, []);
  await K.context.close();
});

test("1280 px yönetici: üst menü, alt çubuk gizli, Yönetim paneli", { timeout: 60000 }, async () => {
  const K = await kullanici(1280);
  await girisYap(K.page, "0500 000 00 00");
  assert.equal(await K.page.isVisible("nav.tabs"), true); assert.equal(await K.page.isVisible("#altbar"), false);
  const sekme = await K.page.$$eval("nav.tabs a", a => a.map(x => x.textContent));
  assert.deepEqual(sekme, ["Ana sayfa", "Sepet", "Profilim", "Öğren", "Puan Kartım", "Yönetim", "Diğer"]);
  await git(K.page, "#yonetim");
  assert.deepEqual(await K.page.$$eval(".mrow", a => a.map(x => x.getAttribute("href"))), ["#ozet", "#sakinler", "#siparis", "#katalog", "#ayarlar", "#uyeler"]);
  assert.equal(await K.page.getAttribute('nav.tabs a[data-v="yonetim"]', "aria-current"), "page");
  await K.page.click('.mrow[href="#siparis"]');
  await K.page.waitForSelector(".summary");
  assert.equal(await K.page.getAttribute('button[data-sp="mode:siparis"]', "aria-pressed"), "true");
  await kaymaYok(K.page, "1280 sipariş");
  assert.deepEqual(K.hatalar, []);
  await K.context.close();
});

test("Hareket azaltma tercihi animasyonları kapatır", { timeout: 60000 }, async () => {
  const K = await kullanici(390, { reducedMotion: "reduce", colorScheme: "dark" });
  await girisYap(K.page, "0500 000 00 09");
  const r = await K.page.evaluate(() => {
    const d = document.createElement("div"); d.className = "iskelet"; document.body.appendChild(d);
    const out = { iskelet: getComputedStyle(d).animationName, bildirim: getComputedStyle(document.getElementById("bildirim")).transitionDuration };
    d.remove(); return out;
  });
  assert.equal(r.iskelet, "none"); assert.equal(r.bildirim, "0s");
  assert.equal(await K.page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(15, 21, 19)");
  assert.deepEqual(K.hatalar, []);
  await K.context.close();
});
