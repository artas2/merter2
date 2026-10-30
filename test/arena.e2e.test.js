"use strict";
/* Uçtan uca (tarayıcı, /m/): Arena — bilgi kartı, iki sakin arasında canlı düello, sohbet, şikâyet penceresi,
   Gündem'de şikâyet/engelle, yönetimde Şikâyetler sekmesi ve susturma, turnuva oluşturma. Maç süreleri test için kısaltılır. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..");
const PORT = 4600 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let sunucu, log = "", browser, tmp, yonDavet;
const bekle = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-arena-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "a.sqlite"), PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "arena".repeat(10),
    PLATFORM_ADMIN_TELEFONLARI: "05000000999", ARENA_SORU_MS: "3500", ARENA_ARA_MS: "1200", ARENA_GERI_SAYIM_MS: "1500" };
  const k = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/kur-site.js", "--ad", "Merter Çınar Evleri", "--bloklar", "A,B,C,D,E", "--daire", "12", "--kat", "0-5"], { cwd: KOK, env, encoding: "utf8" });
  yonDavet = /Yönetici davet : ([A-Z0-9-]+)/.exec(k.stdout)[1];
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

const otp = async tel => {
  const e = "+90" + tel.replace(/\D/g, "").slice(1);
  for (let i = 0; i < 100; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === e).pop(); if (m) return m[2]; await bekle(50); }
  throw new Error("OTP yok: " + tel);
};
async function sayfa() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); const hatalar = [];
  page.on("pageerror", e => hatalar.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
  page.on("dialog", d => d.accept());
  return { context, page, hatalar };
}
async function gir(p, tel, davet) {
  await p.goto(BASE + "/m/"); await p.waitForSelector("#bsTel");
  await p.fill("#bsTel", tel); await p.click('[data-bskapi="kodIste"]');
  await p.waitForSelector("#bsKod"); await p.fill("#bsKod", await otp(tel)); await p.click('[data-bskapi="kodDogrula"]');
  if (davet) { await p.waitForSelector("#bsDavet"); await p.fill("#bsDavet", davet); await p.click('[data-bskapi="katil"]'); }
  await p.waitForSelector("#bsKapi", { state: "hidden" }); await p.waitForTimeout(500);
}
const git = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
const profil = (p, ad, blok) => p.evaluate(async ([ad, blok]) => { const db = await claude.use("db"), u = await claude.use("user"); await db.doc("sakinler/" + await u.id()).set({ ad, blok, kat: 1, daire: "3", durum: "Malik", bireyler: [], kvkk: true }); }, [ad, blok]);
const webApi = (p, method, yol, body) => p.evaluate(async ([m, y, b]) => {
  const me = await (await fetch("/api/me")).json();
  const r = await fetch(y, { method: m, headers: { "content-type": "application/json", "x-csrf-token": me.csrf }, body: m === "GET" ? undefined : JSON.stringify(b || {}) });
  return r.json();
}, [method, yol, body]);
async function dokunma(p, sec) {
  return p.$$eval(sec, a => a.filter(e => e.offsetParent && getComputedStyle(e).visibility !== "hidden").map(e => ({ t: (e.textContent || "").trim().slice(0, 20), r: e.getBoundingClientRect() })).filter(x => x.r.height < 43.5 || x.r.width < 43.5).map(x => x.t));
}

let Y, S1, S2, davet;
test("Kurulum: yönetici, iki sakin; site öder (Premium herkese)", { timeout: 90000 }, async () => {
  Y = await sayfa(); await gir(Y.page, "0532 100 00 01", yonDavet);
  davet = (await webApi(Y.page, "POST", "/api/yonetim/davetler", { rol: "sakin", maxKullanim: 50, gun: 14 })).kod;
  await profil(Y.page, "Yusuf Ak", "B");
  S1 = await sayfa(); await gir(S1.page, "0533 100 00 02", davet); await profil(S1.page, "Ayşe Yılmaz", "C");
  S2 = await sayfa(); await gir(S2.page, "0534 100 00 03", davet); await profil(S2.page, "Ali Kaya", "C");
  const A = await sayfa(); await A.page.goto(BASE + "/");
  await A.page.fill("#g-tel", "0500 000 09 99"); await A.page.click('button:text-is("Kod gönder")'); await A.page.waitForSelector("#g-kod");
  await A.page.fill("#g-kod", await otp("0500 000 09 99")); await A.page.click('button:text-is("Giriş yap")'); await A.page.waitForSelector('body[data-oturum="1"]');
  const m = (await webApi(A.page, "GET", "/api/platform/siteler")).siteler.find(s => s.ad === "Merter Çınar Evleri");
  await webApi(A.page, "PATCH", "/api/platform/siteler/" + m.id, { odemeModeli: "site" }); await A.context.close();
  for (const k of [Y, S1, S2]) { await k.page.reload(); await k.page.waitForSelector("#bsKapi", { state: "hidden" }); await k.page.waitForTimeout(400); }
});

test("Ana sayfada Arena kartı; bilgi kartı: kendini dene ve öğren", { timeout: 60000 }, async () => {
  const p = S1.page;
  await git(p, "#anasayfa"); assert.equal(await p.isVisible('a.ar-giriskart[href="#arena"]'), true);
  await p.click("a.ar-giriskart"); await p.waitForSelector(".ar-sekme");
  assert.match(await p.textContent(".ar-ust"), /Sezon 1/);
  await p.waitForSelector(".ar-kart:not(.kapali)");
  const dogru = await p.evaluate(async () => { const r = await fetch("/api/arena/kartlar").then(x => x.json()); const k = r.kartlar.find(z => z.id === r.gunun); return k.d; });
  await p.click(`.ar-kart:not(.kapali) .ar-sec button:nth-child(${dogru + 1})`);
  await p.waitForSelector(".ar-kart:not(.kapali) .ar-sec button.dogru");
  await p.waitForFunction(() => /\+2|Doğru/.test(document.body.textContent));
  await p.waitForFunction(() => /\b2\b/.test(document.querySelector(".ar-ben b").textContent), null, { timeout: 5000 });
  assert.deepEqual(await dokunma(p, ".ar button, .ar a"), [], "44 px altı dokunma hedefi yok");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test("Canlı düello: iki sakin eşleşir, soruları cevaplar, sonuç ve sezon puanı", { timeout: 120000 }, async () => {
  const a = S1.page, b = S2.page;
  await git(a, "#arena"); await a.click('[data-ar="sekme:duello"]'); await a.click('[data-ar="esles"]');
  await a.waitForFunction(() => /Rakip aranıyor/.test(document.body.textContent));
  await git(b, "#arena"); await b.click('[data-ar="sekme:duello"]'); await b.click('[data-ar="esles"]');
  await Promise.all([a.waitForSelector(".ar-skor"), b.waitForSelector(".ar-skor")]);
  assert.match(await a.textContent(".ar-skor .rakip"), /Ali K\./); assert.match(await b.textContent(".ar-skor .rakip"), /Ayşe Y\./);
  for (let n = 0; n < 5; n++) {
    await Promise.all([a.waitForFunction(i => { const x = document.querySelector(".ar-no"); return x && x.textContent.startsWith(`Soru ${i + 1}/`) && document.querySelector(".ar-sec button:not([disabled])"); }, n, { timeout: 15000 }),
      b.waitForFunction(i => { const x = document.querySelector(".ar-no"); return x && x.textContent.startsWith(`Soru ${i + 1}/`) && document.querySelector(".ar-sec button:not([disabled])"); }, n, { timeout: 15000 })]);
    if (n === 0) await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-duello.png") });
    await a.click(".ar-sec button >> nth=0"); await b.click(".ar-sec button >> nth=1");
    await a.waitForSelector(".ar-sec button.secili");
  }
  await Promise.all([a.waitForSelector(".ar-son", { timeout: 15000 }), b.waitForSelector(".ar-son", { timeout: 15000 })]);
  const ta = await a.textContent(".ar-son h3"), tb = await b.textContent(".ar-son h3");
  assert.ok(["Kazandın!", "Bu sefer olmadı", "Berabere"].includes(ta)); assert.ok(["Kazandın!", "Bu sefer olmadı", "Berabere"].includes(tb));
  assert.notEqual(ta === "Kazandın!" && tb === "Kazandın!", true, "ikisi birden kazanamaz");
  assert.equal(await a.$$eval(".ar-ozet li", l => l.length), 5);
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-sonuc.png") });
  await a.click('[data-ar="macKapat"]'); await a.click('[data-ar="sekme:sezon"]');
  await a.waitForSelector(".ar-bloklar");
  assert.match(await a.textContent(".ar-bloklar"), /C/); assert.ok((await a.$$(".ar-liste .ar-satir")).length >= 2);
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-sezon.png") });
});

test("Sohbet: mesaj anında gelir, numara gizlenir; şikâyet penceresi", { timeout: 60000 }, async () => {
  const a = S1.page, b = S2.page;
  await b.click('[data-ar="macKapat"]');
  const akisIstek = []; b.on("request", r => { if (/\/akis$/.test(r.url())) akisIstek.push(r.url()); });
  await a.click('[data-ar="sekme:sohbet"]'); await b.click('[data-ar="sekme:sohbet"]');
  await a.waitForSelector("#arGiris"); await b.waitForSelector("#arGiris");
  assert.match(await a.textContent(".ar-sohbet .ar-cip"), /C Blok/);
  await a.fill("#arGiris", "Merhaba komşular, numaram 0532 111 22 33"); await a.press("#arGiris", "Enter");
  await b.waitForFunction(() => /Merhaba komşular/.test(document.getElementById("arMesajlar").textContent), null, { timeout: 8000 });
  assert.match(await b.textContent("#arMesajlar"), /\[numara gizlendi\]/);
  assert.ok(akisIstek.length >= 1, "tarayıcı canlı akışı (SSE) kullandı"); assert.doesNotMatch(await b.textContent("#arMesajlar"), /111 22 33/);
  await b.click(".ar-balon:not(.ben) .ar-menu summary"); await b.click('.ar-balon:not(.ben) [data-sk^="ac:mesaj"]');
  await b.waitForSelector("#arSk:not([hidden])");
  await b.check('input[name="arSebep"][value="kisisel"]'); await b.fill("#arSkAciklama", "Numara paylaşıyor");
  await b.screenshot({ path: path.join(KOK, "docs/screenshots/arena-sikayet.png") });
  await b.click('[data-sk^="gonder:"]'); await b.waitForSelector("#arSk", { state: "hidden" });
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-sohbet.png") });
  assert.deepEqual(await dokunma(a, ".ar-sohbet button, .ar-sohbet summary"), []);
});

test("Gündem: başkasının gönderisinde şikâyet et ve engelle; engellenen görünmez", { timeout: 60000 }, async () => {
  const a = S1.page, b = S2.page;
  await git(a, "#gundem"); await a.waitForSelector("#gnMetin");
  await a.fill("#gnMetin", "Bahçede piknik var"); await a.click('[data-gn="paylas"]');
  await git(b, "#gundem"); await b.waitForFunction(() => /Bahçede piknik var/.test(document.querySelector("main").textContent), null, { timeout: 8000 });
  const kart = 'article.pk:has-text("Bahçede piknik var")';
  await b.click(`${kart} .pkm summary`);
  assert.equal(await b.isVisible(`${kart} [data-sk^="ac:gonderi"]`), true); assert.equal(await b.isVisible(`${kart} [data-gn^="sil:"]`), false, "başkasının gönderisini silemez");
  await b.click(`${kart} [data-sk^="engel:"]`);
  await b.waitForFunction(() => !/Bahçede piknik var/.test(document.querySelector("main").textContent), null, { timeout: 8000 });
  await git(a, "#gundem"); await a.click('article.pk:has-text("Bahçede piknik var") .pkm summary');
  assert.equal(await a.isVisible('article.pk:has-text("Bahçede piknik var") [data-sk^="ac:"]'), false, "kendi gönderisinde şikâyet yok");
});

test("Yönetim: Şikâyetler sekmesi, susturma; susturulan yazamaz", { timeout: 60000 }, async () => {
  const p = Y.page;
  await git(p, "#davetler"); await p.click('[data-dm="sekme:sikayet"]');
  await p.waitForFunction(() => /Sohbet mesajı/.test(document.querySelector(".dm").textContent), null, { timeout: 8000 });
  assert.match(await p.textContent(".dm"), /Numara paylaşıyor/); assert.match(await p.textContent(".dm"), /Ayşe Y\./);
  await p.screenshot({ path: path.join(KOK, "docs/screenshots/yonetim-sikayetler.png") });
  await p.click('.dm-kabarcik.sk [data-dm$=":sustur"]');
  await p.waitForFunction(() => /24 saat susturuldu/.test(document.querySelector(".dm").textContent));
  const a = S1.page; await a.waitForTimeout(1600);
  const r = await a.evaluate(async () => { const me = await (await fetch("/api/me")).json(); const x = await fetch("/api/sohbet/oda/site", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": me.csrf }, body: JSON.stringify({ metin: "deneme" }) }); return [x.status, (await x.json()).hata]; });
  assert.equal(r[0], 403); assert.match(r[1], /kapalı/);
  assert.doesNotMatch(await S2.page.textContent("#arMesajlar").catch(() => ""), /numara gizlendi\] *$/);
});

test("Turnuva: yönetici formdan oluşturur, sakin kayıt olur", { timeout: 60000 }, async () => {
  const p = Y.page;
  await git(p, "#arena"); await p.click('[data-ar="sekme:turnuva"]'); await p.click('[data-ar="turForm"]');
  await p.fill("#arTurAd", "Cuma Akşamı Kupası"); await p.click('[data-ar="turOlustur"]');
  try { await p.waitForFunction(() => /Cuma Akşamı Kupası/.test(document.querySelector(".ar").textContent), null, { timeout: 8000 }); }
  catch (e) { throw new Error("Turnuva görünmedi: " + (await p.textContent(".ar")).replace(/\s+/g, " ").slice(0, 400)); }
  const b = S2.page; await git(b, "#arena"); await b.click('[data-ar="sekme:turnuva"]');
  await b.waitForSelector(".ar-turkart"); await b.click(".ar-turkart"); await b.click('[data-ar^="turKatil:"]');
  await b.waitForFunction(() => /Kayıtlısınız/.test(document.querySelector(".ar").textContent));
  assert.match(await b.textContent(".ar-turbas"), /1\/16 kişi/);
  await b.screenshot({ path: path.join(KOK, "docs/screenshots/arena-turnuva.png") });
  for (const k of [Y, S1, S2]) assert.deepEqual(k.hatalar, [], "sayfa hatası yok");
  for (const k of [Y, S1, S2]) await k.context.close();
});
