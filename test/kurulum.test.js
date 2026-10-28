"use strict";
/* Daire seçimi doğrulaması ve scripts/kur-site.js kurulum betiği (geçici veritabanıyla). */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { sunucuBaslat, Istemci, ortam, tel, profilOrnek } = require("./yardimci");
const { openDb } = require("../src/db");
const { argumanlariOku, kur, ArgHata } = require("../scripts/kur-site.js");
const O = require("../public/shared.js");

const KOK = path.join(__dirname, "..");
const MERTER = ["--ad", "Merter Çınar Evleri", "--bloklar", "A,B,C,D,E", "--daire", "12", "--kat", "0-5", "--plan", "tam"];

describe("Daire seçimi (blokta daire sayısı tanımlıysa)", () => {
  let c, e;
  before(async () => {
    c = await sunucuBaslat(); e = await ortam(c);
    await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), bloklar: [{ ad: "C", minKat: 0, maxKat: 5, daire: 12 }, { ad: "D", minKat: 0, maxKat: 5 }] });
  });
  after(async () => { await c.kapat(); });

  test("1..N dışında ya da sayı olmayan daire 400 ve Türkçe mesaj alır", async () => {
    for (const daire of ["0", "13", "12a", "A-3", "-1", "1.5", "99999"]) {
      const r = await e.sakinA1.put("/api/profil", profilOrnek({ blok: "C", kat: 5, daire }));
      assert.equal(r.status, 400, daire);
      assert.match(r.body.hata, /C Blok için daire numarası 1 ile 12 arasında bir sayı olmalı/, daire);
    }
  });
  test("Geçerli daire kabul edilir ve sayı biçimine getirilir", async () => {
    let r = await e.sakinA1.put("/api/profil", profilOrnek({ blok: "C", kat: 5, daire: "12" }));
    assert.equal(r.status, 200); assert.equal(r.body.profil.daire, "12");
    r = await e.sakinA1.put("/api/profil", profilOrnek({ blok: "C", kat: 0, daire: "01" }));
    assert.equal(r.status, 200); assert.equal(r.body.profil.daire, "1");
  });
  test("Daire sayısı tanımsız blokta serbest metin geçerli kalır", async () => {
    const r = await e.sakinA1.put("/api/profil", profilOrnek({ blok: "D", kat: 1, daire: "3B" }));
    assert.equal(r.status, 200); assert.equal(r.body.profil.daire, "3B");
  });
});

describe("Kurulum betiği: argüman doğrulama", () => {
  test("Geçerli argümanlar ve varsayılanlar", () => {
    const a = argumanlariOku(MERTER);
    assert.deepEqual(a, { ad: "Merter Çınar Evleri", bloklar: ["A", "B", "C", "D", "E"], daire: 12, minKat: 0, maxKat: 5, plan: "tam", denemeGun: 30 });
    const b = argumanlariOku(["--ad=Lale", "--bloklar", "a, b", "--daire", "4", "--kat", "-1-8", "--deneme-gun", "0"]);
    assert.deepEqual([b.bloklar, b.minKat, b.maxKat, b.plan, b.denemeGun], [["A", "B"], -1, 8, "tam", 0]);
  });
  test("Hatalı argümanlar açıklayıcı mesajla reddedilir", () => {
    const hatali = [
      [[], /--ad zorunlu/], [["--ad", "X", "--bloklar", "A", "--daire", "3"], /--kat zorunlu/],
      [[...MERTER, "--fazla", "1"], /Bilinmeyen seçenek/], [["--ad", "X", "--bloklar", "A,,B", "--daire", "3", "--kat", "0-5"], /--bloklar/],
      [["--ad", "X", "--bloklar", "A,a", "--daire", "3", "--kat", "0-5"], /iki kez/], [["--ad", "X", "--bloklar", "A", "--daire", "0", "--kat", "0-5"], /--daire/],
      [["--ad", "X", "--bloklar", "A", "--daire", "on", "--kat", "0-5"], /--daire/], [["--ad", "X", "--bloklar", "A", "--daire", "3", "--kat", "5"], /--kat/],
      [["--ad", "X", "--bloklar", "A", "--daire", "3", "--kat", "5-1"], /en alt kat/], [["--ad", "X", "--bloklar", "A", "--daire", "3", "--kat", "0-81"], /--kat/],
      [["--ad", "X", "--bloklar", "A", "--daire", "3", "--kat", "0-5", "--plan", "kurumsal"], /--plan/],
      [["--ad", "X", "--bloklar", "A", "--daire", "3", "--kat", "0-5", "--deneme-gun", "400"], /--deneme-gun/],
      [["--ad", "X", "--bloklar", "A,B,C,D,E,F", "--daire", "1000", "--kat", "0-5"], /5000/], [["--ad", "X".repeat(51), "--bloklar", "A", "--daire", "3", "--kat", "0-5"], /--ad/],
      [["--ad", "--bloklar", "A"], /değer eksik/], [["serbest"], /Beklenmeyen/]
    ];
    for (const [argv, re] of hatali) assert.throws(() => argumanlariOku(argv), e => e instanceof ArgHata && re.test(e.message), argv.join(" "));
  });
});

describe("Kurulum betiği: site oluşturma", () => {
  let dir, dbPath;
  before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-kur-")); dbPath = path.join(dir, "kur.sqlite"); });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("Gerçek veri olmadan kurar: sakin, fiyat, tur yok; toplamDaire = blok × daire; tek kullanımlık yönetici daveti", () => {
    const db = openDb(dbPath);
    const now = Date.parse("2026-10-24T09:00:00Z");
    const r = kur(MERTER, { db, now });
    assert.equal(r.varOlan, false); assert.equal(r.toplamDaire, 60); assert.match(r.davetKodu, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const s = db.prepare("SELECT * FROM sites WHERE id = ?").get(r.siteId);
    assert.equal(s.plan, "tam"); assert.equal(s.durum, "deneme"); assert.equal(s.deneme_bitis, "2026-11-23");
    const ayar = JSON.parse(s.ayarlar), kat = JSON.parse(s.katalog);
    assert.equal(ayar.siteAdi, "Merter Çınar Evleri"); assert.equal(ayar.toplamDaire, 60);
    assert.deepEqual(ayar.bloklar, ["A", "B", "C", "D", "E"].map(ad => ({ ad, minKat: 0, maxKat: 5, daire: 12 })));
    assert.equal(kat.urunler.length, O.ORNEK_KATALOG.length);
    assert.ok(kat.urunler.every(u => u.fiyat === ""), "fiyat yok");
    assert.deepEqual(kat.tur, { id: "", ad: "", sonTarih: "", teslim: "", acik: false }, "tur yok");
    for (const t of ["users", "uyelikler", "profiller", "sepetler", "puanlar", "turlar"]) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n, 0, t);
    const d = db.prepare("SELECT * FROM davetler").all();
    assert.equal(d.length, 1); assert.equal(d[0].rol, "site_yonetici"); assert.equal(d[0].max_kullanim, 1); assert.equal(d[0].bitis, now + 7 * 864e5);
    assert.equal(kur(MERTER, { db, now }).varOlan, true, "aynı adlı site ikinci kez kurulmaz");
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sites").get().n, 1);
    db.close();
  });
  test("Komut satırı: başarı, tekrar ve hata çıkış kodları", () => {
    const calistir = argv => spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/kur-site.js", ...argv], { cwd: KOK, encoding: "utf8", env: { ...process.env, DB_PATH: path.join(dir, "cli.sqlite") } });
    let r = calistir(MERTER);
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Site kuruldu: Merter Çınar Evleri/); assert.match(r.stdout, /Toplam daire\s+: 60/); assert.match(r.stdout, /Yönetici davet : [A-Z0-9]{4}-[A-Z0-9]{4}/);
    r = calistir(MERTER);
    assert.equal(r.status, 0); assert.match(r.stdout, /zaten var; tekrar oluşturulmadı/);
    r = calistir(["--ad", "Y", "--bloklar", "A", "--daire", "12", "--kat", "abc"]);
    assert.equal(r.status, 1); assert.match(r.stderr, /Hata: --kat/); assert.match(r.stderr, /Kullanım:/);
    r = calistir(["--ad", "Z", "--bloklar", "A", "--daire", "12", "--kat", "0-5"]);
    assert.equal(r.status, 0, "--plan verilmezse tam");
  });
  test("Kurulan siteye yönetici davetle katılır ve sakin 60 dairelik özeti görür", async () => {
    const c = await sunucuBaslat();
    try {
      const r = kur(MERTER, { db: c.db });
      const y = await new Istemci(c).giris(tel()); await y.katil(r.davetKodu);
      assert.equal(y.me.aktifSite.rol, "site_yonetici"); assert.equal(y.me.aktifSite.ad, "Merter Çınar Evleri");
      const ikinci = await new Istemci(c).giris(tel());
      assert.equal((await ikinci.post("/api/davet/kullan", { kod: r.davetKodu })).status, 400, "yönetici daveti tek kullanımlık");
      const kod = (await y.post("/api/yonetim/davetler", { maxKullanim: 10 })).body.kod;
      const s = await new Istemci(c).giris(tel()); await s.katil(kod);
      assert.equal((await s.put("/api/profil", profilOrnek({ blok: "C", kat: 5, daire: "12" }))).status, 200);
      assert.equal((await s.put("/api/profil", profilOrnek({ blok: "C", kat: 6, daire: "12" }))).status, 400, "kat aralığı 0-5");
      const o = (await y.get("/api/yonetim/ozet")).body;
      assert.equal(o.toplamDaire, 60); assert.equal(o.profilHane, 1); assert.equal(o.doluluk, 1.7);
      assert.deepEqual(o.bloklar.find(b => b.blok === "C"), { blok: "C", hane: 1, daire: 12, doluluk: 8.3 });
      assert.equal((await s.get("/api/katalog")).body.katalog.tur.id, "");
    } finally { await c.kapat(); }
  });
});
