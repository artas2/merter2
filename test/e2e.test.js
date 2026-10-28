"use strict";
/* Uçtan uca test: gerçek sunucu (konsol SMS, geçici SQLite) + Playwright Chromium.
   390 px ve 320 px genişlikte: platform → yönetici (ayarlar, bloklar, katalog, tur, davet) → iki sakin (davet, OTP, profil, sepet) → toplu sipariş.
   Ekran görüntüleri docs/screenshots/ altına yazılır. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..");
const SS = path.join(KOK, "docs", "screenshots");
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_TELLER = ["05000000098", "05000000099"];
let sunucu, log = "", browser, tmp;

function bekle(ms) { return new Promise(r => setTimeout(r, ms)); }
async function kodBul(telE164, onceki) {
  for (let i = 0; i < 100; i++) {
    const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === telE164);
    if (m.length > onceki) return m[m.length - 1][2];
    await bekle(50);
  }
  throw new Error("OTP logda bulunamadı: " + telE164);
}
const e164 = t => "+90" + t.replace(/\D/g, "").replace(/^0/, "");

before(async () => {
  fs.mkdirSync(SS, { recursive: true });
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-e2e-"));
  sunucu = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], {
    cwd: KOK, env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DB_PATH: path.join(tmp, "e2e.sqlite"), SMS_PROVIDER: "konsol", NODE_ENV: "development",
      SESSION_SECRET: "e2e".repeat(16), PLATFORM_ADMIN_TELEFONLARI: ADMIN_TELLER.map(e164).join(",") }
  });
  sunucu.stdout.on("data", d => { log += d; }); sunucu.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 100 && !log.includes("çalışıyor"); i++) await bekle(50);
  assert.ok(log.includes("çalışıyor"), "sunucu başlamadı: " + log);
  browser = await chromium.launch();
});
after(async () => {
  if (browser) await browser.close();
  if (sunucu) sunucu.kill("SIGTERM");
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

/* Her kullanıcı için ayrı tarayıcı bağlamı; konsol hataları ve yatay kayma izlenir. */
async function kullanici(genislik, { koyu = false } = {}) {
  const context = await browser.newContext({ viewport: { width: genislik, height: 780 }, colorScheme: koyu ? "dark" : "light", deviceScaleFactor: 1 });
  const page = await context.newPage();
  const hatalar = [];
  page.on("console", m => { if (m.type() === "error") hatalar.push(m.text()); });
  page.on("pageerror", e => hatalar.push("pageerror: " + e.message));
  page.on("dialog", d => d.accept());
  return { context, page, hatalar };
}
async function yatayKaymaYok(page, ad) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));
  assert.ok(r.sw <= r.iw && r.bw <= r.iw, `${ad}: yatay kayma var (scrollWidth ${r.sw}/${r.bw} > ${r.iw})`);
}
const sayac = {};
async function girisYap(page, tel) {
  const t = e164(tel);
  const onceki = [...log.matchAll(/\[SMS:konsol\] (\+\d+) ->/g)].filter(x => x[1] === t).length;
  await page.goto(BASE + "/");
  await page.fill("#g-tel", tel);
  await page.click('button:text-is("Kod gönder")');
  await page.waitForSelector("#g-kod");
  const kod = await kodBul(t, onceki);
  await page.fill("#g-kod", kod);
  await page.click('button:text-is("Giriş yap")');
  await page.waitForSelector('body[data-oturum="1"]');
}
async function bekleMetin(page, sel, re) { await page.waitForFunction(([s, r]) => { const el = document.querySelector(s); return el && new RegExp(r).test(el.textContent); }, [sel, re.source], { timeout: 8000 }); }
async function git(page, hash) { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(150); }
async function ss(page, ad, tam = false) { await page.screenshot({ path: path.join(SS, ad + ".png"), fullPage: tam }); }

async function akis(G, telefonlar) {
  const etiket = `${G}px`;
  // 1) Platform yöneticisi siteyi oluşturur
  const A = await kullanici(G);
  await girisYap(A.page, telefonlar.admin);
  await A.page.waitForSelector("#ps-ad");
  await A.page.fill("#ps-ad", `E2E Sitesi ${G}`);
  await A.page.click('button:text-is("Site oluştur")');
  await A.page.waitForSelector("#platKod");
  const yonKod = (await A.page.textContent("#platKod")).trim();
  assert.match(yonKod, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await yatayKaymaYok(A.page, etiket + " platform");
  await ss(A.page, `${G}-01-platform`);

  // 2) Yönetici davetle katılır, site ayarlarını ve blokları girer
  const Y = await kullanici(G);
  await girisYap(Y.page, telefonlar.yon);
  await Y.page.waitForSelector("#d-kod");
  await Y.page.fill("#d-kod", yonKod);
  await Y.page.click('button:text-is("Katıl")');
  await Y.page.waitForSelector("#pf-daire");
  await git(Y.page, "#ayarlar");
  await Y.page.fill("#ay-ad", `Çınar Test ${G}`);
  await Y.page.selectOption("#ay-tema", "mavi");
  await Y.page.fill("#ay-duy", "Su kesintisi Salı 10:00–12:00.");
  await Y.page.fill("#ay-td", "20");
  await Y.page.click('button:text-is("+ Blok ekle")');
  await Y.page.fill("#bl-0", "a"); await Y.page.fill("#bmn-0", "0"); await Y.page.fill("#bmx-0", "4"); await Y.page.fill("#bd-0", "10");
  await Y.page.click('button:text-is("+ Blok ekle")');
  await Y.page.fill("#bl-1", "B"); await Y.page.fill("#bmn-1", "-1"); await Y.page.fill("#bmx-1", "6");
  await Y.page.check('input[data-ayh="evcil"]');
  await Y.page.click('button:text-is("+ Soru ekle")');
  await Y.page.fill("#oz-0", "Bisiklet var mı");
  await Y.page.uncheck('input[data-aym="Y13"]');
  await Y.page.click('button:text-is("Ayarları kaydet")');
  await bekleMetin(Y.page, "#ayStatus", /Kaydedildi/);
  assert.match(await Y.page.textContent(".brand h1"), new RegExp(`Çınar Test ${G}`));
  await yatayKaymaYok(Y.page, etiket + " ayarlar");
  await ss(Y.page, `${G}-02-site-ayarlari`, true);

  // 3) Katalog ve tur
  await git(Y.page, "#sepet");
  await Y.page.click('button[data-sp="mode:katalog"]');
  await Y.page.click('button:text-is("Örnek kataloğu yükle")');
  await Y.page.fill("#kf-0", "30");   // Domates
  await Y.page.fill("#kf-18", "12,5"); // Ekmek
  await Y.page.click('button[data-sp="yenitur:sor"]');
  await Y.page.click('button[data-sp="yenitur:evet"]');
  await Y.page.fill("#kt-ad", "Cumartesi pazarı");
  await Y.page.fill("#kt-tes", "Cumartesi 14:00, blok girişleri");
  await Y.page.click('button:text-is("Kataloğu ve turu kaydet")');
  await bekleMetin(Y.page, "#kdStatus", /Kaydedildi/);
  await yatayKaymaYok(Y.page, etiket + " katalog");
  await ss(Y.page, `${G}-03-katalog-tur`);

  // 4) Sakin davet kodu
  await git(Y.page, "#uyeler");
  await Y.page.waitForSelector("#dv-max");
  await Y.page.fill("#dv-max", "10");
  await Y.page.fill("#dv-ac", "Pano ilanı");
  await Y.page.click('button:text-is("Kod üret")');
  await Y.page.waitForSelector("#yeniKod");
  const sakinKod = (await Y.page.textContent("#yeniKod")).trim();
  await Y.page.click('button:text-is("Bağlantı ve kodu kopyala")');
  await Y.page.waitForSelector("#kopyaMetni");
  const kopya = await Y.page.textContent("#kopyaMetni");
  assert.ok(kopya.includes(`/s/${sakinKod}`) && kopya.includes(`Davet kodu: ${sakinKod}`), kopya);
  await yatayKaymaYok(Y.page, etiket + " üyeler");
  await ss(Y.page, `${G}-04-uyeler-davet`);
  // Denetçi daveti (koyu mod testinde kullanılır)
  await Y.page.selectOption("#dv-rol", "site_denetci");
  await Y.page.fill("#dv-max", "1");
  await Y.page.click('button:text-is("Kod üret")');
  await Y.page.waitForFunction(k => { const el = document.getElementById("yeniKod"); return el && el.textContent.trim() !== k; }, sakinKod);
  const denetciKod = (await Y.page.textContent("#yeniKod")).trim();
  assert.notEqual(denetciKod, sakinKod);

  // 5) İki sakin: davet, OTP, profil, sepet
  const sakinler = [
    { tel: telefonlar.s1, blok: "A", kat: "2", daire: "5", durum: "Malik", urunler: [["domates", "pazar", 2], ["ekmek", "market", 2]] },
    { tel: telefonlar.s2, blok: "B", kat: "-1", daire: "3", durum: "Kiracı", urunler: [["domates", "pazar", 2], ["maydanoz", "pazar", 1]] }
  ];
  const S = [];
  for (const [i, s] of sakinler.entries()) {
    const K = await kullanici(G); S.push(K);
    if (i === 0) {
      // Birinci sakin, yöneticinin paylaştığı "nasıl kullanılır" bağlantısından gelir
      await K.page.goto(`${BASE}/s/${sakinKod}`);
      await bekleMetin(K.page, "#nSite", new RegExp(`Çınar Test ${G}`));
      assert.equal((await K.page.textContent("#nKod")).trim(), sakinKod);
      await yatayKaymaYok(K.page, `${etiket} nasıl kullanılır`);
      await ss(K.page, `${G}-00-nasil-kullanilir`, true);
      await K.page.click("#nAc");
      await K.page.waitForSelector("#g-tel");
    }
    await girisYap(K.page, s.tel);
    if (i === 0) assert.equal(await K.page.inputValue("#d-kod"), sakinKod, "davet kodu bağlantıdan otomatik gelir");
    else await K.page.fill("#d-kod", sakinKod);
    await K.page.click('button:text-is("Katıl")');
    await K.page.waitForSelector("#pf-blok");
    await K.page.selectOption("#pf-blok", s.blok);
    await K.page.selectOption("#pf-kat", s.kat);
    // A blokta daire sayısı (10) tanımlı → seçim listesi; B blokta tanımsız → serbest metin
    if (s.blok === "A") { assert.equal(await K.page.$eval("#pf-daire", el => el.tagName), "SELECT"); await K.page.selectOption("#pf-daire", s.daire); }
    else { assert.equal(await K.page.$eval("#pf-daire", el => el.tagName), "INPUT"); await K.page.fill("#pf-daire", s.daire); }
    await K.page.selectOption("#pf-durum", s.durum);
    await K.page.click('button:text-is("+ Birey ekle")');
    await K.page.selectOption("#b-1-y", "Çocuk"); await K.page.selectOption("#b-1-a", i === 0 ? "0–6" : "65+");
    if (i === 0) await K.page.selectOption("#ek-evcil", "Evet");
    await K.page.check("#pf-kvkk");
    await K.page.click('button:text-is("Profili kaydet")');
    await bekleMetin(K.page, "#pStatus", /Kaydedildi/);
    await yatayKaymaYok(K.page, `${etiket} sakin${i + 1} profil`);
    if (i === 0) await ss(K.page, `${G}-05-sakin-profil`, true);
    await git(K.page, "#sepet");
    await K.page.waitForSelector(".pcard");
    for (const [ad, bolum, tik] of s.urunler) {
      await K.page.click(`button[data-sp="kat:${bolum}"]`);
      await K.page.click(`.pcard[data-name="${ad}"] .addb`);
      for (let t = 1; t < tik; t++) await K.page.click(`.pcard[data-name="${ad}"] .step button[aria-label$="artır"]`);
    }
    await bekleMetin(K.page, "#spStatus", /Sepet kaydedildi/);
    await K.page.click('button[data-sp="kat:pazar"]');
    assert.equal((await K.page.textContent('.pcard[data-name="domates"] output')).trim(), "1 kg", "kg 0,5 adımla artar (2 tık = 1 kg)");
    await yatayKaymaYok(K.page, `${etiket} sakin${i + 1} sepet`);
    if (i === 0) await ss(K.page, `${G}-06-sakin-sepet`);
    await K.page.click('.cartbar button');
    await K.page.waitForSelector(".citem");
    await K.page.fill("#spNot", "Kapıya bırakın");
    await bekleMetin(K.page, "#spStatus", /Sepet kaydedildi/);
    if (i === 0) await ss(K.page, `${G}-07-sakin-sepetim`);
  }

  // 6) Yönetici toplu siparişi görür
  await git(Y.page, "#sepet");
  await Y.page.click('button[data-sp="mode:siparis"]');
  await Y.page.waitForSelector(".summary b");
  await bekleMetin(Y.page, ".summary div:first-child b", /^2$/);
  const tablo = await Y.page.textContent(".tbl table");
  assert.match(tablo, /Domates\s*2 kg\s*2/);
  assert.match(tablo, /Ekmek\s*2 adet\s*1/);
  const teslim = await Y.page.$$eval(".row .head b", els => els.map(e => e.textContent));
  assert.deepEqual(teslim, ["A Blok · 2. kat · Daire 5", "B Blok · 1. bodrum kat · Daire 3"]);
  await Y.page.click('button[data-sp="kopyala"]');
  await bekleMetin(Y.page, "#kopyaDurum", /Kopyalandı|Domates: 2 kg/);
  const csv = await Y.page.evaluate(async () => { const r = await fetch("/api/yonetim/siparis.csv?liste=urun"); const b = new Uint8Array(await r.arrayBuffer()); return { bom: [...b.slice(0, 3)], t: new TextDecoder().decode(b) }; });
  assert.deepEqual(csv.bom, [0xEF, 0xBB, 0xBF]);
  assert.match(csv.t, /Pazar;Sebze;Domates;2;kg;2;60/);
  await yatayKaymaYok(Y.page, etiket + " toplu sipariş");
  await ss(Y.page, `${G}-08-toplu-siparis`, true);

  // 7) Sakinler listesi
  await git(Y.page, "#sakinler");
  await Y.page.waitForSelector(".summary");
  await bekleMetin(Y.page, ".summary div:first-child b", /^2$/);
  assert.match(await Y.page.textContent("main"), /Evcil hayvan var · 1/);
  await yatayKaymaYok(Y.page, etiket + " sakinler");
  await ss(Y.page, `${G}-09-sakinler`, true);

  // 7b) Özet kartı: toplam daire 20 → 2/20 = %10; A bloğu 10 dairede 1 hane = %10
  await git(Y.page, "#ozet");
  await Y.page.waitForSelector("#ozetKart");
  const ozet = await Y.page.textContent("#ozetKart");
  assert.match(ozet, /%10/); assert.match(ozet, /2\/20 daire/); assert.match(ozet, /2\s*son 7 günde katılan/); assert.match(ozet, /2\s*bu turda sipariş veren hane/);
  await yatayKaymaYok(Y.page, etiket + " özet");
  await ss(Y.page, `${G}-11-ozet`, true);

  // 8) Diğer sakin sayfaları: harita (gizli modül), puan kartı, modül, hesap
  const P = S[0].page;
  await git(P, "#ana");
  assert.match(await P.textContent("main"), /Su kesintisi/);
  assert.match(await P.textContent("#selam"), /Merhaba, A Blok 2\. kat 5/);
  await git(P, "#harita");
  assert.ok(!(await P.textContent("main")).includes("Y13"), "gizlenen modül haritada görünmemeli");
  await yatayKaymaYok(P, etiket + " harita");
  await ss(P, `${G}-10-harita`);
  await git(P, "#kart");
  await P.click('button[data-set="Y01"][data-v="4"]');
  await P.waitForFunction(() => /kaydedildi/.test(document.getElementById("sync").textContent), null, { timeout: 5000 });
  await yatayKaymaYok(P, etiket + " puan kartı");
  await git(P, "#Y04");
  await P.waitForSelector(".doc details");
  await yatayKaymaYok(P, etiket + " modül Y04");
  await git(P, "#hesap");
  await P.waitForSelector("text=Verilerimi indir (JSON)");
  await yatayKaymaYok(P, etiket + " hesap");

  if (G === 390) {
    // 9) Üye çıkarma: sayfa içi onay (Vazgeç, sonra Evet)
    await git(Y.page, "#uyeler");
    const satir = Y.page.locator(".row.uye", { hasText: telefonlar.s2 });
    await satir.locator('button:text-is("Siteden çıkar")').click();
    await Y.page.waitForSelector("[data-onay]");
    await ss(Y.page, `${G}-12-uye-cikar-onay`);
    await Y.page.click('button:text-is("Vazgeç")');
    assert.equal(await Y.page.locator("[data-onay]").count(), 0);
    assert.equal(await Y.page.locator(".row.uye", { hasText: telefonlar.s2 }).count(), 1);
    await satir.locator('button:text-is("Siteden çıkar")').click();
    await Y.page.click('button:text-is("Evet, çıkar")');
    await Y.page.waitForSelector("text=Üye siteden çıkarıldı.");
    assert.equal(await Y.page.locator(".row.uye", { hasText: telefonlar.s2 }).count(), 0);
    await S[1].page.reload();
    await S[1].page.waitForSelector("#d-kod");
  } else {
    // 9) Platform yöneticisi paketi "temel"e düşürür: sepet ve eğitim sekmeleri gizlenir, yerine paket kartı
    await A.page.reload();
    await A.page.waitForSelector('select[id^="pp-"]');
    const ilk = A.page.locator(".row", { hasText: `E2E Sitesi ${G}` });
    await ilk.locator('select[id^="pp-"]').selectOption("temel");
    await ilk.locator('button:text-is("Kaydet")').click();
    await A.page.waitForSelector("text=Kaydedildi.");
    for (const [ad, K] of [["yönetici", Y], ["sakin", S[0]]]) {
      await git(K.page, "#harita");
      await K.page.reload();
      await K.page.waitForSelector('body[data-oturum="1"]');
      const sekme = await K.page.$$eval("nav.tabs a", els => els.map(e => e.textContent));
      assert.ok(!sekme.includes("Sepet") && !sekme.includes("Puan Kartım") && !sekme.includes("Görevler") && !sekme.includes("Çerçeve"), ad + ": " + sekme.join(","));
      assert.ok(sekme.includes("Ana sayfa") && sekme.includes("Profilim"), ad);
      await git(K.page, "#ana");
      assert.match(await K.page.textContent("main"), /Bu özellik Alışveriş paketinde/);
      assert.match(await K.page.textContent("main"), /Bu özellik Tam paketinde/);
      assert.equal(await K.page.locator('#altbar a[data-v="sepet"]').count(), 0, "alt çubukta sepet yok");
      await git(K.page, "#sepet");
      await K.page.waitForSelector('[data-kilit="alisveris"]');
      await git(K.page, "#Y04");
      await K.page.waitForSelector('[data-kilit="egitim"]');
      await yatayKaymaYok(K.page, `${etiket} temel paket ${ad}`);
    }
    await git(S[0].page, "#harita");
    await ss(S[0].page, `${G}-12-temel-paket-ana-sayfa`, true);
    await git(Y.page, "#ozet");
    await Y.page.waitForSelector("#ozetKart");
    assert.match(await Y.page.textContent("main"), /alışveriş paketi yok/);
  }

  for (const [ad, K] of [["platform", A], ["yönetici", Y], ["sakin1", S[0]], ["sakin2", S[1]]]) assert.deepEqual(K.hatalar, [], `${etiket} ${ad} konsol hataları`);
  for (const K of [A, Y, ...S]) await K.context.close();
  return { sakinKod, denetciKod };
}

let davet390 = null, denetci390 = null;
test("390 px: yönetici + iki sakin + toplu sipariş", { timeout: 120000 }, async () => {
  const r = await akis(390, { admin: ADMIN_TELLER[0], yon: "0501 111 00 01", s1: "0501 111 00 02", s2: "0501 111 00 03" });
  davet390 = r.sakinKod; denetci390 = r.denetciKod;
});

test("320 px: yönetici + iki sakin + toplu sipariş", { timeout: 120000 }, async () => {
  await akis(320, { admin: ADMIN_TELLER[1], yon: "0501 222 00 01", s1: "0501 222 00 02", s2: "0501 222 00 03" });
});

test("Koyu mod: denetçi davetle katılır; özet salt-okur; ekran görüntüleri", { timeout: 60000 }, async () => {
  const K = await kullanici(390, { koyu: true });
  assert.ok(denetci390, "390 akışı denetçi davet kodu üretmiş olmalı");
  await K.page.goto(`${BASE}/s/${davet390}`);
  await K.page.waitForSelector("#nKodKutu:not([hidden])");
  await ss(K.page, "koyu-00-nasil-kullanilir", true);
  await girisYap(K.page, "0501 111 00 04");
  await K.page.fill("#d-kod", denetci390);
  await K.page.click('button:text-is("Katıl")');
  await K.page.waitForSelector("#pf-blok");
  await git(K.page, "#harita");
  const bg = await K.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, "rgb(15, 21, 19)", "koyu tema --paper");
  await ss(K.page, "koyu-01-harita");
  await git(K.page, "#sepet");
  await K.page.waitForSelector(".pcard");
  await ss(K.page, "koyu-02-sepet");
  await git(K.page, "#profil");
  await K.page.waitForSelector("#pf-daire");
  await ss(K.page, "koyu-03-profil");
  await yatayKaymaYok(K.page, "koyu profil");
  await git(K.page, "#ozet");
  await K.page.waitForSelector("#ozetKart");
  assert.match(await K.page.textContent("main"), /salt-okur/);
  assert.equal(await K.page.locator('nav.tabs a[data-v="ayarlar"], nav.tabs a[data-v="uyeler"]').count(), 0, "denetçi ayar/üye sekmesi görmez");
  await git(K.page, "#yonetim");
  await K.page.waitForSelector('.mrow[href="#ozet"]');
  assert.equal(await K.page.locator('.mrow[href="#ayarlar"], .mrow[href="#uyeler"], .mrow[href="#katalog"]').count(), 0, "denetçi yönetim panelinde yazma ekranlarını görmez");
  await git(K.page, "#ozet");
  await ss(K.page, "koyu-04-ozet", true);
  assert.deepEqual(K.hatalar, []);
  await K.context.close();
});
