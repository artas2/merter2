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
    PLATFORM_ADMIN_TELEFONLARI: "05000000999", ARENA_SORU_MS: "3500", ARENA_ARA_MS: "1200", ARENA_GERI_SAYIM_MS: "2500", ARENA_ESLESME_MS: "8000", ARENA_KABUL_MS: "5000" };
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
  await git(a, "#arena"); await a.click('[data-ar="sekme:duello"]');
  // Ses efektleri: hangi anda hangi sesin çalındığını kaydet
  for (const p of [a, b]) await p.evaluate(() => { window.__sesler = []; const o = BS_SES.cal; BS_SES.cal = ad => { window.__sesler.push(ad); o(ad); }; });
  await a.click('[data-ar="esles"]');
  await a.waitForFunction(() => /Rakip aranıyor/.test(document.body.textContent));
  await a.waitForSelector(".ar-halka.arama #arEsSn"); assert.equal(await a.isVisible(".ar-sekme"), false, "eşleştirme tam ekran");
  assert.ok(Number(await a.textContent("#arEsSn")) <= 8, "süre sınırı geri sayılır");
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-esles-arama.png") });
  await git(b, "#arena"); await b.click('[data-ar="sekme:duello"]'); await b.click('[data-ar="esles"]');
  // Rakip bulundu: iki taraf da süre içinde "Kabul et" der
  await Promise.all([a.waitForSelector(".ar-esekran.teklif .ar-kabul"), b.waitForSelector(".ar-esekran.teklif .ar-kabul")]);
  assert.match(await a.textContent(".ar-vsmini .rakip"), /Ali K\./); assert.match(await b.textContent(".ar-vsmini .rakip"), /Ayşe Y\./);
  assert.ok(await a.$(".ar-vsmini .rakip .bsk-av svg"), "rakibin simgesi ve çerçevesi");
  assert.deepEqual(await dokunma(a, ".ar-esekran button"), []);
  await a.waitForTimeout(700); await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-esles-onay.png") });
  await a.click('[data-ar="kabul"]');
  await a.waitForFunction(() => /Kabul ettin/.test(document.querySelector(".ar-durumlar").textContent));
  await b.waitForFunction(() => /Rakip kabul etti/.test(document.querySelector(".ar-durumlar").textContent), null, { timeout: 5000 });
  await b.click('[data-ar="kabul"]');
  // VS karşılaşma, ardından sorular
  await a.waitForSelector(".ar-vssahne", { timeout: 5000 }); assert.match(await a.textContent(".ar-vssahne"), /Ali K\..*VS|VS.*Ali K\./s);
  await a.waitForTimeout(900); await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-vs.png") });
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
  await a.waitForTimeout(1700);
  const sesA = await a.evaluate(() => window.__sesler);
  for (const ad of ["bulundu", "kabul", "tik", "basla", "oz"]) assert.ok(sesA.includes(ad), "ses: " + ad + " / " + sesA.join(","));
  assert.ok(sesA.some(x => x === "dogru" || x === "yanlis"), "cevap sesi"); assert.ok(sesA.some(x => ["galibiyet", "yenilgi", "berabere"].includes(x)), "sonuç sesi");
  const ta = await a.textContent(".ar-son h3"), tb = await b.textContent(".ar-son h3");
  assert.ok(["Kazandın!", "Bu sefer olmadı", "Berabere"].includes(ta)); assert.ok(["Kazandın!", "Bu sefer olmadı", "Berabere"].includes(tb));
  assert.notEqual(ta === "Kazandın!" && tb === "Kazandın!", true, "ikisi birden kazanamaz");
  assert.equal(await a.$$eval(".ar-ozet li", l => l.length), 5);
  // İlk düello: iki taraf da "İlk Adım" sembolünü kazanır; kazanan "Hilal" simgesini de
  for (const [p, t] of [[a, ta], [b, tb]]) {
    await p.waitForSelector(".ar-ozkazanc"); assert.match(await p.textContent(".ar-ozkazanc"), t === "Kazandın!" ? /\+30/ : t === "Berabere" ? /\+20/ : /\+15/, "Mavi Öz");
    await p.waitForSelector(".ar-odul"); assert.match(await p.textContent(".ar-odul"), /İlk Adım/);
    if (t === "Kazandın!") assert.match(await p.textContent(".ar-odul"), /Hilal/);
  }
  await a.waitForTimeout(1200); await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-sonuc.png") });
  const kazananSayfa = ta === "Kazandın!" ? a : tb === "Kazandın!" ? b : null;
  if (kazananSayfa) { await kazananSayfa.click('.ar-odul [data-ar="sec:s-hilal"]'); await kazananSayfa.waitForFunction(() => /Hilal kullanılıyor/.test(document.body.textContent)); }
  await a.click('[data-ar="macKapat"]'); await a.click('[data-ar="sekme:sezon"]');
  await a.waitForSelector(".ar-bloklar");
  assert.match(await a.textContent(".ar-bloklar"), /C/); assert.ok((await a.$$(".ar-liste .ar-satir")).length >= 2);
  assert.ok((await a.$$(".ar-liste .ar-satir .bsk-av")).length >= 2, "sıralamada arena simgeleri");
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-sezon.png") });
  // Komşu kartı: sıralamadan dokununca simge, çerçeve, unvan ve semboller
  await a.click('.ar-satirbtn:not(.ben)'); await a.waitForSelector(".ar-kisikart");
  assert.match(await a.textContent(".ar-kisikart"), /Ali K\./); assert.ok(await a.$(".ar-kisikart .bsk-av svg"), "komşunun simgesi ve çerçevesi"); assert.match(await a.textContent(".ar-kisikart .ar-unvan"), /Komşu/);
  assert.doesNotMatch(await a.textContent(".ar-kisikart"), /Kat|Daire/, "kat ve daire gösterilmez");
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-komsu-karti.png") });
  await a.keyboard.press("Escape"); await a.waitForSelector(".ar-kisikart", { state: "detached" });
});

test("Kimlik: simge, çerçeve, sembol ve unvan seçimi; profil kartında görünür", { timeout: 60000 }, async () => {
  const a = S1.page;
  // Ses efektleri düğmesi: kapat/aç, tercih bu cihazda saklanır
  assert.equal(await a.getAttribute('[data-ar="ses"]', "aria-pressed"), "true");
  await a.click('[data-ar="ses"]'); await a.waitForFunction(() => document.querySelector('[data-ar="ses"]').getAttribute("aria-pressed") === "false");
  assert.equal(await a.evaluate(() => localStorage.getItem("bs-ses-acik")), "0");
  await a.click('[data-ar="ses"]'); await a.waitForFunction(() => document.querySelector('[data-ar="ses"]').getAttribute("aria-pressed") === "true");
  await a.click('[data-ar="sekme:kimlik"]'); await a.waitForSelector(".ar-kgrid.simge");
  assert.equal(await a.$$eval(".ar-kgrid.simge:not(.kol) .ar-kog", l => l.length), 10);
  assert.equal(await a.$$eval(".ar-kgrid.kol .ar-kog.kilitli", l => l.length), 15, "turnuva koleksiyonu kilitli");
  assert.ok((await a.$$(".ar-kog.kilitli")).length >= 7, "kazanılmayanlar kilitli");
  assert.match(await a.textContent(".ar-kog.kilitli >> nth=0"), /galibiyet|şampiyon|kart|seri|sezon|blok|doğru/i, "kilitli ödülde koşul yazılı");
  for (const t of ["cerceve", "unvan", "sembol"]) { await a.click(`[data-ar="ktur:${t}"]`); await a.waitForSelector(`.ar-kgrid.${t}`); }
  await a.click('[data-ar="sec:y-ilk"]'); await a.waitForFunction(() => document.querySelectorAll(".ar-kimlikon .bsk-y").length === 1);
  assert.equal(await a.getAttribute('[data-ar="sec:y-ilk"]', "aria-pressed"), "true");
  await a.click('[data-ar="ktur:simge"]'); await a.waitForSelector(".ar-kgrid.simge");
  // Mavi Öz: kartımda göster
  assert.match(await a.textContent(".ar-ozsatir"), /\d/); await a.check("[data-ar-oz]");
  await a.waitForFunction(() => /kartında görünecek/.test(document.body.textContent));
  assert.deepEqual(await dokunma(a, ".ar-kgrid button, .ar-kt button"), []);
  assert.equal(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await a.waitForTimeout(2500); // bildirim kaybolsun
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-kimlik.png") });
  await a.evaluate(() => document.querySelector(".ar-kt").scrollIntoView()); await a.waitForTimeout(900);
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-kimlik-simgeler.png") });
  // Kilitli ödül seçilemez (sunucu reddeder)
  const r = await webApi(a, "PUT", "/api/arena/kimlik", { simge: "s-tac" }); assert.match(r.hata || r.error || JSON.stringify(r), /sahip/);
  // Profil kartı (Kartım)
  await git(a, "#profil"); await a.waitForSelector(".ok-av-arena .bsk-av");
  await a.waitForSelector(".ok-arena .bsk-y"); assert.match(await a.textContent(".ok-arena"), /Arena/);
  assert.ok(await a.$(".ok-arena .bsk-ozcip"), "Mavi Öz profil kartında (isteğe bağlı)");
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/profil-arena-kimlik.png") });
  await a.click('.ok-arena [data-ar="kimlikAc"]'); await a.waitForSelector(".ar-kgrid");
  assert.equal(await a.getAttribute('[data-ar="sekme:kimlik"]', "aria-selected"), "true");
  // Görevler: kart öğrenme görevi tamam → ödülü al
  assert.match(await a.textContent('[data-ar="sekme:gorevler"]'), /Görevler\s*\d/, "alınabilir ödül rozeti");
  await a.click('[data-ar="sekme:gorevler"]'); await a.waitForSelector(".ar-gorevler");
  assert.equal(await a.$$eval(".ar-gorev", l => l.length), 8);
  await a.click('[data-ar="gorevAl:g-kart"]'); await a.waitForFunction(() => /\+10 Mavi Öz/.test(document.body.textContent));
  await a.waitForSelector(".ar-gorev.alindi");
  assert.deepEqual(await dokunma(a, ".ar-gorevler button"), []);
  await a.waitForTimeout(2500); await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-gorevler.png") });
});

test("Eşleşme süreleri: onay verilmezse düşer, kabul eden yeniden aranır; arama süresi dolar", { timeout: 60000 }, async () => {
  const a = S1.page, y = Y.page;
  await a.click('[data-ar="sekme:duello"]'); await a.click('[data-ar="esles"]'); await a.waitForSelector(".ar-halka.arama");
  await git(y, "#arena"); await y.click('[data-ar="sekme:duello"]'); await y.click('[data-ar="esles"]');
  await Promise.all([a.waitForSelector(".ar-kabul"), y.waitForSelector(".ar-kabul")]);
  await a.click('[data-ar="kabul"]'); // Yusuf yanıt vermez
  await y.waitForSelector(".ar-esekran.bitti", { timeout: 9000 }); assert.match(await y.textContent(".ar-esekran.bitti h2"), /Eşleşmeyi kaçırdın/);
  await y.screenshot({ path: path.join(KOK, "docs/screenshots/arena-esles-kacirdi.png") });
  await a.waitForFunction(() => /süresinde yanıt vermedi/.test(document.body.textContent) && document.querySelector(".ar-halka.arama"), null, { timeout: 5000 });
  await a.waitForSelector(".ar-esekran.bitti", { timeout: 15000 });
  assert.match(await a.textContent(".ar-esekran.bitti h2"), /Süre doldu/); assert.ok(await a.$('.ar-esekran.bitti [data-ar="esles"]'), "tekrar dene düğmesi");
  await a.screenshot({ path: path.join(KOK, "docs/screenshots/arena-esles-sure.png") });
  await a.click('[data-ar="eslesKapat"]'); await a.waitForSelector(".ar-sekme");
  await y.click('[data-ar="eslesKapat"]');
});

test("Sohbet: mesaj anında gelir, numara gizlenir; şikâyet penceresi", { timeout: 60000 }, async () => {
  const a = S1.page, b = S2.page;
  if (await b.$('[data-ar="macKapat"]')) await b.click('[data-ar="macKapat"]');
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

test("Bekçi: küfürlü mesaj gönderilmez ve uyarı çıkar; yönetim Bekçi sekmesinde görür, yanlış alarm işaretler", { timeout: 60000 }, async () => {
  const a = S2.page; // S1 önceki testte susturuldu
  await git(a, "#arena"); if (await a.$('[data-ar="macKapat"]')) await a.click('[data-ar="macKapat"]');
  await a.click('[data-ar="sekme:sohbet"]'); await a.waitForSelector("#arGiris");
  await a.fill("#arGiris", "siktir git amk"); await a.press("#arGiris", "Enter");
  await a.waitForFunction(() => /gönderilmedi/.test(document.body.textContent), null, { timeout: 5000 });
  assert.doesNotMatch(await a.textContent("#arMesajlar"), /siktir/, "mesaj odaya düşmedi");
  assert.equal(await a.inputValue("#arGiris"), "siktir git amk", "yazı silinmez, kişi düzeltebilir");
  await a.waitForTimeout(1700); await a.fill("#arGiris", "Özür dilerim, sık sık böyle olmasın"); await a.press("#arGiris", "Enter");
  await a.waitForFunction(() => /sık sık böyle/.test(document.getElementById("arMesajlar").textContent), null, { timeout: 8000 });
  // Yönetim: Bekçi sekmesi
  const y = Y.page; await git(y, "#davetler"); await y.waitForSelector(".dm-sekme"); await y.click('[data-dm="sekme:bekci"]');
  await y.waitForSelector(".dm-kabarcik"); assert.match(await y.textContent(".dm"), /Engellendi · küfür/); assert.match(await y.textContent(".dm-ozet"), /engellendi/);
  assert.match(await y.textContent(".dm-alinti"), /siktir/);
  await y.click('[data-dm^="bekciGeri:"][data-dm$=":0"]'); await y.waitForFunction(() => /yanlış alarm/.test(document.querySelector(".dm").textContent), null, { timeout: 5000 });
  assert.deepEqual(await dokunma(y, ".dm-kabarcik button"), [], "44 px altı dokunma hedefi yok");
  await y.screenshot({ path: path.join(KOK, "docs/screenshots/yonetim-bekci.png") });
});

test("Bekleme: veri gelene kadar Minnoş yere uzanmış kartı ve fırsat ipucu görünür, sonra arena açılır", { timeout: 60000 }, async () => {
  const p = S2.page;
  await p.route("**/api/arena/ozet", async r => { await new Promise(x => setTimeout(x, 1800)); r.continue(); });
  await p.reload(); await p.waitForSelector("#bsKapi", { state: "hidden" }); await p.waitForTimeout(300);
  await git(p, "#arena");
  await p.waitForSelector(".ar .bk-kart", { timeout: 5000 });
  assert.ok(await p.$(".bk-kart .bk-svg"), "yere uzanmış Minnoş"); assert.match(await p.textContent(".bk-baslik"), /Arena hazırlanıyor/); assert.ok(await p.$(".bk-ilerleme i")); assert.ok(await p.$(".bk-ipucu span"), "fırsat ipucu");
  await p.screenshot({ path: path.join(KOK, "docs/screenshots/minnos-bekleme.png") });
  await p.waitForSelector(".ar-sekme", { timeout: 8000 }); assert.equal(await p.$(".bk-kart"), null, "veri gelince bekleme kartı kalkar");
  await p.unroute("**/api/arena/ozet");
});

test("Minnoş: gerçek uygulamada tanıtım turu Arena ve Bekçi adımlarını da anlatır", { timeout: 60000 }, async () => {
  const p = S2.page; await git(p, "#anasayfa");
  await p.evaluate(() => BS_KEDI.tanit()); await p.waitForSelector(".kt");
  const basliklar = [await p.textContent("#ktBaslik")];
  for (let i = 0; i < 15 && (await p.$eval("#ktIleri", e => e.dataset.kt)) !== "bitir"; i++) { await p.click("#ktIleri"); await p.waitForTimeout(60); basliklar.push(await p.textContent("#ktBaslik")); }
  assert.equal(basliklar.length, 10, basliklar.join(" | ")); assert.ok(basliklar.some(b => /Bana sor/.test(b)), "soru ve fal adımı"); assert.ok(basliklar.some(b => /oyun/.test(b)), "Arena adımı"); assert.ok(basliklar.some(b => /Sohbette gözüm/.test(b)), "Bekçi adımı");
  assert.match(await p.textContent(".kt-alt"), /gizleyebilirsin/); await p.click("#ktIleri"); await p.waitForSelector(".kt", { state: "detached" });
  assert.ok(await p.$(".kedi:not(.gizli)"), "tur bitince kedi köşede");
  assert.deepEqual(S2.hatalar, [], "sayfa hatası yok");
});

test("Turnuva: yönetici formdan oluşturur, sakin kayıt olur", { timeout: 60000 }, async () => {
  const p = Y.page;
  await git(p, "#arena"); await p.click('[data-ar="sekme:turnuva"]'); await p.click('[data-ar="turForm"]');
  await p.fill("#arTurAd", "Cuma Akşamı Kupası"); assert.equal(await p.$$eval("#arTurOdul option", o => o.length), 16, "ödül seçimi: otomatik + 15 koleksiyon simgesi");
  await p.selectOption("#arTurOdul", "t-kizkulesi"); await p.click('[data-ar="turOlustur"]');
  try { await p.waitForFunction(() => /Cuma Akşamı Kupası/.test(document.querySelector(".ar").textContent), null, { timeout: 8000 }); }
  catch (e) { throw new Error("Turnuva görünmedi: " + (await p.textContent(".ar")).replace(/\s+/g, " ").slice(0, 400)); }
  const b = S2.page; await git(b, "#arena"); await b.click('[data-ar="sekme:turnuva"]');
  await b.waitForSelector(".ar-turkart"); await b.click(".ar-turkart"); await b.click('[data-ar^="turKatil:"]');
  await b.waitForFunction(() => /Kayıtlısınız/.test(document.querySelector(".ar").textContent));
  assert.match(await b.textContent(".ar-turbas"), /1\/16 kişi/);
  assert.match(await b.textContent(".ar-turodul"), /Kız Kulesi/); assert.ok(await b.$(".ar-turodul .bsk-kol svg"), "ödül simgesi çizili");
  await b.screenshot({ path: path.join(KOK, "docs/screenshots/arena-turnuva.png") });
  for (const k of [Y, S1, S2]) assert.deepEqual(k.hatalar, [], "sayfa hatası yok");
  for (const k of [Y, S1, S2]) await k.context.close();
});
