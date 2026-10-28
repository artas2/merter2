"use strict";
/* Uçtan uca: "Merter Çınar Evleri" kur-site.js ile geçici veritabanında kurulur, sunucu başlatılır;
   yönetici davetle katılır, sakin C blok 5. kat 12 numarayı seçer, Özet'te 1/60 doluluk görünür.
   Ekran görüntüleri: docs/screenshots/merter-*.png (390 px, açık ve koyu). Geçici veritabanı sonunda silinir. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..");
const SS = path.join(KOK, "docs", "screenshots");
const PORT = 4000 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
let sunucu, log = "", browser, tmp, yonKod;
const bekle = ms => new Promise(r => setTimeout(r, ms));
const e164 = t => "+90" + t.replace(/\D/g, "").replace(/^0/, "");

before(async () => {
  fs.mkdirSync(SS, { recursive: true });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-merter-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "merter.sqlite") };
  const k = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/kur-site.js", "--ad", "Merter Çınar Evleri", "--bloklar", "A,B,C,D,E", "--daire", "12", "--kat", "0-5", "--plan", "tam"], { cwd: KOK, env, encoding: "utf8" });
  assert.equal(k.status, 0, k.stderr);
  yonKod = /Yönetici davet : ([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(k.stdout)[1];
  sunucu = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], {
    cwd: KOK, env: { ...env, PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "merter".repeat(8) }
  });
  sunucu.stdout.on("data", d => { log += d; }); sunucu.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 100 && !log.includes("çalışıyor"); i++) await bekle(50);
  assert.ok(log.includes("çalışıyor"), log);
  browser = await chromium.launch();
});
after(async () => {
  if (browser) await browser.close();
  if (sunucu) { sunucu.kill("SIGTERM"); await new Promise(r => sunucu.once("exit", r)); }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

async function kullanici() {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, colorScheme: "light", deviceScaleFactor: 1 });
  const page = await context.newPage();
  const hatalar = [];
  page.on("console", m => { if (m.type() === "error") hatalar.push(m.text()); });
  page.on("pageerror", e => hatalar.push("pageerror: " + e.message));
  return { context, page, hatalar };
}
async function girisYap(page, telefon, davet) {
  const t = e164(telefon);
  await page.goto(BASE + "/");
  await page.fill("#g-tel", telefon);
  await page.click('button:text-is("Kod gönder")');
  await page.waitForSelector("#g-kod");
  let kod = null;
  for (let i = 0; i < 100 && !kod; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === t).pop(); kod = m && m[2]; if (!kod) await bekle(50); }
  await page.fill("#g-kod", kod);
  await page.click('button:text-is("Giriş yap")');
  await page.waitForSelector("#d-kod");
  await page.fill("#d-kod", davet);
  await page.click('button:text-is("Katıl")');
  await page.waitForSelector("#pf-blok");
}
async function git(page, hash) { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(150); }
async function kaymaYok(page, ad) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(r.sw <= r.iw, `${ad}: yatay kayma (${r.sw} > ${r.iw})`);
}
const ss = (page, ad) => page.screenshot({ path: path.join(SS, `merter-${ad}.png`), fullPage: true });

test("Merter Çınar Evleri: kurulum → yönetici → sakin C/5/12 → Özet 1/60 (390 px, açık ve koyu)", { timeout: 120000 }, async () => {
  // Yönetici
  const Y = await kullanici();
  await girisYap(Y.page, "0502 000 00 01", yonKod);
  assert.match(await Y.page.textContent(".brand h1"), /Merter Çınar Evleri/);
  assert.match(await Y.page.textContent("#sync"), /Site yöneticisi/);
  await git(Y.page, "#uyeler");
  await Y.page.waitForSelector("#dv-max");
  await Y.page.click('button:text-is("Kod üret")');
  await Y.page.waitForSelector("#yeniKod");
  const sakinKod = (await Y.page.textContent("#yeniKod")).trim();
  await git(Y.page, "#sepet");
  await Y.page.waitForSelector(".bos-durum");
  assert.match(await Y.page.textContent("main"), /Henüz açık bir alışveriş turu yok/);

  // Sakin: C blok, 5. kat, 12 numara
  const S = await kullanici();
  await girisYap(S.page, "0502 000 00 02", sakinKod);
  await S.page.selectOption("#pf-blok", "C");
  assert.equal(await S.page.$eval("#pf-daire", el => el.tagName), "SELECT", "daire sayısı tanımlı blokta seçim listesi");
  assert.deepEqual(await S.page.$$eval("#pf-kat option", o => o.map(x => x.textContent)), ["Seç", "Zemin kat", "1. kat", "2. kat", "3. kat", "4. kat", "5. kat"]);
  assert.equal(await S.page.$$eval("#pf-daire option", o => o.length), 13);
  await S.page.selectOption("#pf-kat", "5");
  await S.page.selectOption("#pf-daire", "12");
  await S.page.selectOption("#pf-blok", "A");
  assert.equal(await S.page.inputValue("#pf-kat"), "", "blok değişince kat sıfırlanır");
  assert.equal(await S.page.inputValue("#pf-daire"), "", "blok değişince daire sıfırlanır");
  await S.page.selectOption("#pf-blok", "C");
  await S.page.selectOption("#pf-kat", "5");
  await S.page.selectOption("#pf-daire", "12");
  await S.page.selectOption("#pf-durum", "Kiracı");
  await S.page.check("#pf-kvkk");
  await S.page.click('button:text-is("Profili kaydet")');
  await S.page.waitForFunction(() => /Kaydedildi/.test(document.getElementById("pStatus").textContent));
  assert.match(await S.page.textContent("main"), /C Blok · 5\. kat · Daire 12/);
  await kaymaYok(S.page, "sakin profil");
  await ss(S.page, "390-sakin-profil");
  await git(S.page, "#harita");
  await kaymaYok(S.page, "sakin harita");
  await ss(S.page, "390-sakin-harita");

  // Özet: 1/60
  await git(Y.page, "#ozet");
  await Y.page.waitForSelector("#ozetKart");
  const ozet = await Y.page.textContent("#ozetKart");
  assert.match(ozet, /%1,7/); assert.match(ozet, /1\/60 daire/);
  assert.match(await Y.page.textContent("main"), /C\s*1\s*12\s*%8,3/);
  await kaymaYok(Y.page, "özet");
  await ss(Y.page, "390-ozet");

  // Koyu mod
  await Y.page.emulateMedia({ colorScheme: "dark" });
  await S.page.emulateMedia({ colorScheme: "dark" });
  assert.equal(await Y.page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(15, 21, 19)");
  await ss(Y.page, "390-koyu-ozet");
  await git(S.page, "#profil");
  await S.page.waitForSelector("#pf-daire");
  await ss(S.page, "390-koyu-sakin-profil");

  assert.deepEqual(Y.hatalar, []); assert.deepEqual(S.hatalar, []);
  await Y.context.close(); await S.context.close();
});
