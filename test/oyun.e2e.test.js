"use strict";
/* Uçtan uca (tarayıcı, /m/): turnuvada Satranç (kısa mat, terfi penceresi) ve Tavla (zar, bar, toplama) iki sakin arasında oynanır.
   Sunucu süreç içindedir; turnuva saati test için ilerletilir. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");
const { sunucuBaslat, ortam } = require("./yardimci");
const S = require("../src/satranc");

const KOK = path.join(__dirname, "..");
let C, O, browser, A, B;
const simdi = () => Date.now() + C.saat.kayma;
const git = ms => { C.saat.kayma = ms - Date.now(); };
const bekle = ms => new Promise(r => setTimeout(r, ms));
const db = (k, op, yol, veri) => k.post("/api/db", { op, yol, veri });
async function profil(k, ad, blok) { await db(k, "set", "sakinler/" + k.me.aktifSite.kimlik, { ad, blok, kat: 1, daire: "3", durum: "Malik", bireyler: [], kvkk: true }); C.app.ortak.profilUnut(k.me.aktifSite.id, k.me.user.id); }

before(async () => {
  C = await sunucuBaslat({ config: { arenaTick: false, oyunGeriSayimMs: 600 } });
  O = await ortam(C);
  await profil(O.sakinA1, "Ayşe Yılmaz", "C"); await profil(O.sakinA2, "Ali Kaya", "A");
  await O.admin.patch(`/api/platform/siteler/${O.siteA.id}`, { odemeModeli: "site" });
  browser = await chromium.launch();
  const sayfa = async k => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(), hatalar = [];
    await context.addCookies([{ name: "sid", value: k.cerez.replace(/^sid=/, ""), url: C.base }]);
    page.on("pageerror", e => hatalar.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) hatalar.push(m.text()); });
    await page.goto(C.base + "/m/"); await page.waitForSelector("#bsKapi", { state: "hidden", timeout: 15000 }); await page.waitForTimeout(400);
    return { context, page, hatalar, k };
  };
  A = await sayfa(O.sakinA1); B = await sayfa(O.sakinA2);
});
after(async () => { if (browser) await browser.close(); await C.kapat(); });

async function dokunma(p, sec) {
  return p.$$eval(sec, a => a.filter(e => e.offsetParent && getComputedStyle(e).visibility !== "hidden").map(e => ({ t: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24), r: e.getBoundingClientRect() })).filter(x => x.r.height < 43.5 || x.r.width < 43.5).map(x => x.t));
}
/* Turnuvayı kurar, iki sakin arayüzden "Hazırım" der, saat ilerler, ikisi de oyuna girer. */
async function oyunBaslat(oyun, ad) {
  const bas = simdi() + 20 * 60000;
  const r = await O.yonA.post("/api/arena/turnuvalar", { ad, baslangic: bas, turAraligiDk: 10, maxKisi: 2, oyun }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const tid = r.body.id; for (const k of [O.sakinA1, O.sakinA2]) await k.post(`/api/arena/turnuva/${tid}/katil`, {});
  git(bas - 4 * 60000);
  for (const x of [A, B]) {
    await x.page.evaluate(() => { location.hash = "#anasayfa"; }); await x.page.evaluate(() => { location.hash = "#arena"; }); await x.page.waitForSelector(".ar-sekme");
    await x.page.click('[data-ar="sekme:turnuva"]'); if (await x.page.$('[data-ar="turKapat"]')) await x.page.click('[data-ar="turKapat"]'); await x.page.waitForSelector(".ar-turkart");
    await x.page.click(`.ar-turkart:has-text("${ad}")`); await x.page.waitForSelector('[data-ar^="hazir:"]');
    await x.page.click('[data-ar^="hazir:"]'); await x.page.waitForFunction(() => /Hazırsınız/.test(document.body.textContent));
  }
  git(bas + 1000);
  for (const x of [A, B]) await x.page.waitForSelector(".oy, [data-ar^='macAc:']", { timeout: 15000 });
  for (const x of [A, B]) { if (!(await x.page.$(".oy"))) await x.page.click('[data-ar^="macAc:"]'); await x.page.waitForSelector(".oy"); }
  git(simdi() + 1500); // geri sayım geçti
  for (const x of [A, B]) await x.page.waitForFunction(() => /Sıra sende|Rakip düşünüyor/.test(document.querySelector(".oy-sira").textContent), null, { timeout: 8000 });
  return { tid };
}
const renkBeyaz = async x => /Beyaz/.test(await x.page.textContent(".oy-oyuncu.ben .oy-ad small"));
const sirami = x => x.page.$eval(".oy-sira", e => e.classList.contains("ben"));
async function sirayiBekle(x) { await x.page.waitForFunction(() => document.querySelector(".oy-sira.ben"), null, { timeout: 10000 }); }
async function tasIt(x, k, h, terfi) {
  await sirayiBekle(x); await x.page.click(`[data-oy="kare:${k}"]`); await x.page.click(`[data-oy="kare:${h}"]`);
  if (terfi) { await x.page.waitForSelector(".oy-terfi"); await x.page.click(`[data-oy="terfi:${terfi}"]`); }
}
const sunucudaKur = (oyunId, fen) => C.db.prepare("UPDATE oyun_maclar SET durum = ? WHERE id = ?").run(JSON.stringify({ o: S.fenOku(fen), h: [] }), oyunId);
const aktifOyun = tid => C.db.prepare("SELECT mac_id FROM turnuva_mac WHERE turnuva_id = ?").get(tid).mac_id;

test("Satranç: iki sakin tarayıcıdan oynar; kısa mat, saat, sonuç ve şampiyon", { timeout: 120000 }, async () => {
  const { tid } = await oyunBaslat("satranc", "Cuma Satranç Kupası");
  assert.equal(await A.page.isVisible(".ar-sekme"), false, "oyun ekranı tam ekran");
  const beyaz = (await renkBeyaz(A)) ? A : B, siyah = beyaz === A ? B : A;
  assert.equal(await beyaz.page.$$eval(".oy-kare", l => l.length), 64); assert.ok(await beyaz.page.$(".oy-kare .oy-tas"), "taşlar çizili");
  assert.match(await beyaz.page.textContent(".oy-saat"), /\d:\d\d/); assert.deepEqual(await dokunma(beyaz.page, ".oy button"), [], "44 px altı dokunma hedefi yok");
  assert.equal(await beyaz.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  // yasal hedefler vurgulanır, sırası olmayan oynayamaz
  await beyaz.page.click('[data-oy="kare:e2"]'); assert.equal((await beyaz.page.$$(".oy-kare.hedef")).length, 2, "e3 ve e4");
  await beyaz.page.screenshot({ path: path.join(KOK, "docs/screenshots/satranc-tahta.png") });
  await beyaz.page.click('[data-oy="kare:e5"]'); // hedef değil → seçim kalkar
  await siyah.page.click('[data-oy="kare:e7"]', { force: true }); assert.equal((await siyah.page.$$(".oy-kare.hedef")).length, 0, "sıra beyazda");
  await tasIt(beyaz, "f2", "f3"); await tasIt(siyah, "e7", "e5"); await tasIt(beyaz, "g2", "g4");
  await beyaz.page.waitForFunction(() => /Rakip düşünüyor/.test(document.querySelector(".oy-sira").textContent));
  assert.match(await siyah.page.textContent(".oy-kural"), /g2g4/, "son hamle");
  await tasIt(siyah, "d8", "h4");
  for (const x of [A, B]) await x.page.waitForSelector(".oy-son", { timeout: 8000 });
  assert.equal(await siyah.page.textContent(".oy-son h3"), "Kazandın!"); assert.equal(await beyaz.page.textContent(".oy-son h3"), "Bu sefer olmadı"); assert.match(await siyah.page.textContent(".oy-son"), /şah mat/);
  await siyah.page.screenshot({ path: path.join(KOK, "docs/screenshots/satranc-sonuc.png") });
  await siyah.page.click('[data-oy="kapat"]'); await siyah.page.waitForSelector(".ar-turbas");
  assert.match(await siyah.page.textContent(".ar-turbas"), /Şampiyon/); await beyaz.page.click('[data-oy="kapat"]');
});

test("Satranç: piyon terfisinde taş seçme penceresi; teslim ol onayı", { timeout: 120000 }, async () => {
  const { tid } = await oyunBaslat("satranc", "Terfi Kupası");
  const beyaz = (await renkBeyaz(A)) ? A : B, siyah = beyaz === A ? B : A, id = aktifOyun(tid);
  sunucudaKur(id, "4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  await beyaz.page.evaluate(() => 0); await bekle(500);
  // sayfayı yenilemeden: yeni durum bir sonraki çekimde gelir; sürümü artırmak için küçük bir uyandırma
  C.db.prepare("UPDATE oyun_maclar SET ver = ver + 1 WHERE id = ?").run(id); C.app.hub.bildir("oyun:" + id);
  await beyaz.page.waitForFunction(() => document.querySelectorAll(".oy-tas").length === 3, null, { timeout: 8000 });
  await beyaz.page.click('[data-oy="kare:a7"]'); await beyaz.page.click('[data-oy="kare:a8"]');
  await beyaz.page.waitForSelector(".oy-terfi"); assert.equal(await beyaz.page.$$eval(".oy-terfiliste button", l => l.length), 4);
  assert.deepEqual(await dokunma(beyaz.page, ".oy-terfi button"), []);
  await beyaz.page.screenshot({ path: path.join(KOK, "docs/screenshots/satranc-terfi.png") });
  await beyaz.page.click('[data-oy="terfiIptal"]'); assert.equal(await beyaz.page.$(".oy-terfi"), null);
  await beyaz.page.click('[data-oy="kare:a7"]'); await beyaz.page.click('[data-oy="kare:a8"]'); await beyaz.page.click('[data-oy="terfi:N"]');
  await siyah.page.waitForFunction(() => /N|at/i.test(document.querySelector('[data-oy="kare:a8"]').getAttribute("aria-label")), null, { timeout: 8000 });
  assert.match(await siyah.page.getAttribute('[data-oy="kare:a8"]', "aria-label"), /beyaz at/);
  // teslim: önce onay sorulur
  await siyah.page.click('[data-oy="teslim"]'); assert.match(await siyah.page.textContent(".oy"), /Teslim olmak istiyor musun/); await siyah.page.click('[data-oy="teslimHayir"]');
  await siyah.page.click('[data-oy="teslim"]'); await siyah.page.click('[data-oy="teslimEvet"]');
  for (const x of [A, B]) await x.page.waitForSelector(".oy-son");
  assert.equal(await beyaz.page.textContent(".oy-son h3"), "Kazandın!"); assert.match(await beyaz.page.textContent(".oy-son"), /teslim oldu/);
  await siyah.page.click('[data-oy="kapat"]'); await beyaz.page.click('[data-oy="kapat"]');
});

test("Tavla: zar, yasal noktalar, vurma ve toplama; oyun sonuna kadar iki sakin oynar", { timeout: 240000 }, async () => {
  const { tid } = await oyunBaslat("tavla", "Tavla Kupası");
  const hepsi = [A, B];
  assert.equal(await A.page.$$eval(".oy-nokta", l => l.length), 24); assert.ok(await A.page.$(".oy-zar"), "zarlar"); assert.ok(await A.page.$(".oy-pul"), "pullar");
  assert.deepEqual(await dokunma(A.page, ".oy button"), [], "44 px altı dokunma hedefi yok");
  assert.equal(await A.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  let cekildi = false;
  for (let n = 0; n < 1500; n++) {
    if (await A.page.$(".oy-son")) break;
    let oynadi = false;
    for (const x of hepsi) {
      if (!(await sirami(x).catch(() => false))) continue;
      const kaynak = await x.page.$('.oy-bar.oynanir, .oy-nokta.oynanir');
      if (!kaynak) { await bekle(60); continue; }
      await kaynak.click();
      const hedef = await x.page.$('.oy-nokta.hedef, .oy-off.hedef'); if (!hedef) { await bekle(60); continue; }
      if (n === 40) assert.equal(await x.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "oyun ortasında yatay kayma yok");
      if (!cekildi && n > 6) { await x.page.screenshot({ path: path.join(KOK, "docs/screenshots/tavla-tahta.png"), fullPage: true }); cekildi = true; }
      await hedef.click(); oynadi = true; await x.page.waitForTimeout(40);
    }
    if (!oynadi) await bekle(80);
    if (n % 25 === 0) git(simdi() + 3000);
  }
  for (const x of hepsi) await x.page.waitForSelector(".oy-son", { timeout: 15000 });
  const basliklar = [await A.page.textContent(".oy-son h3"), await B.page.textContent(".oy-son h3")].sort();
  assert.deepEqual(basliklar, ["Bu sefer olmadı", "Kazandın!"]); assert.match(await A.page.textContent(".oy-son"), /tüm pulları topladı/);
  await A.page.screenshot({ path: path.join(KOK, "docs/screenshots/tavla-sonuc.png") });
  assert.equal(C.db.prepare("SELECT durum FROM turnuvalar WHERE id = ?").get(tid).durum, "bitti");
  for (const x of hepsi) assert.deepEqual(x.hatalar, [], "sayfa hatası yok");
});
