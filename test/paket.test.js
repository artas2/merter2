"use strict";
/* Paketler, özet (pilot ölçümü), nasıl kullanılır sayfası, satış belgesi iddiaları ve şema migration'ı. */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { sunucuBaslat, Istemci, ortam, tel, profilOrnek } = require("./yardimci");
const { openDb, MIGRATIONS } = require("../src/db");
const O = require("../public/shared.js");

const yerel = ms => new Date(ms + 3 * 3600e3).toISOString().slice(0, 16);
const katalog = (ek = {}) => ({
  urunler: [{ id: "u1", ad: "Domates", kat: "pazar", alt: "Sebze", birim: "kg", fiyat: 30, aktif: true }],
  tur: { ad: "Tur", sonTarih: yerel(Date.now() + 864e5), teslim: "", acik: true }, yeniTur: true, ...ek
});

describe("Paketler", () => {
  let c, e;
  before(async () => { c = await sunucuBaslat(); e = await ortam(c); });
  after(async () => { await c.kapat(); });
  const paket = p => e.admin.patch("/api/platform/siteler/" + e.siteA.id, { plan: p });

  test("Paket özellik matrisi (shared.js)", () => {
    assert.equal(O.ozellikVar("temel", "alisveris"), false);
    assert.equal(O.ozellikVar("temel", "egitim"), false);
    assert.equal(O.ozellikVar("alisveris", "alisveris"), true);
    assert.equal(O.ozellikVar("alisveris", "egitim"), false);
    assert.equal(O.ozellikVar("tam", "alisveris"), true);
    assert.equal(O.ozellikVar("tam", "egitim"), true);
    assert.equal(O.ozellikVar("bilinmeyen", "alisveris"), false);
  });

  test("Yeni site varsayılan olarak 'tam'; geçersiz paket 400; yalnız platform değiştirir", async () => {
    const r = await e.admin.post("/api/platform/siteler", { ad: "Varsayılan" });
    assert.equal(r.body.site.plan, "tam");
    assert.equal((await e.admin.post("/api/platform/siteler", { ad: "X", plan: "kurumsal" })).status, 400);
    assert.equal((await paket("standart")).status, 400);
    assert.equal((await e.yonA.patch("/api/platform/siteler/" + e.siteA.id, { plan: "temel" })).status, 403);
  });

  test("Temel paket: alışveriş ve eğitim uçları 403 + Türkçe açıklama; temel özellikler açık", async () => {
    await e.yonA.put("/api/katalog", katalog());
    assert.equal((await paket("temel")).status, 200);
    await e.sakinA1.yenile();
    assert.deepEqual(e.sakinA1.me.aktifSite.ozellikler, { alisveris: false, egitim: false });
    for (const [k, m, y, b] of [[e.sakinA1, "get", "/api/katalog"], [e.sakinA1, "get", "/api/sepet"], [e.sakinA1, "put", "/api/sepet", { kalemler: {} }],
      [e.yonA, "put", "/api/katalog", katalog()], [e.yonA, "get", "/api/yonetim/siparis"], [e.yonA, "get", "/api/yonetim/siparis.csv"], [e.denetciA, "get", "/api/yonetim/siparis"]]) {
      const r = await k[m](y, b);
      assert.equal(r.status, 403, y); assert.match(r.body.hata, /Alışveriş paketinde/, y);
    }
    for (const [m, y, b] of [["get", "/api/puan"], ["put", "/api/puan", { scores: { Y01: 2 } }]]) {
      const r = await e.sakinA1[m](y, b); assert.equal(r.status, 403); assert.match(r.body.hata, /Tam paketinde/);
    }
    assert.equal((await e.sakinA1.put("/api/profil", profilOrnek())).status, 200);
    for (const [k, y] of [[e.sakinA1, "/api/profil"], [e.sakinA1, "/api/site/ayarlar"], [e.sakinA1, "/api/hesap/veri"], [e.yonA, "/api/yonetim/sakinler"], [e.yonA, "/api/yonetim/sakinler.csv"],
      [e.yonA, "/api/yonetim/davetler"], [e.yonA, "/api/yonetim/uyeler"], [e.yonA, "/api/yonetim/ozet"], [e.denetciA, "/api/yonetim/ozet"]]) {
      assert.equal((await k.get(y)).status, 200, y);
    }
    assert.equal((await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), duyuru: "Temel pakette duyuru" })).status, 200);
    assert.equal((await e.yonA.post("/api/yonetim/davetler", {})).status, 200);
    const md = await fetch(c.base + "/md/00-ana-cerceve.md", { headers: { cookie: e.sakinA1.cerez } });
    assert.equal(md.status, 403); assert.match(await md.text(), /Tam paketinde/);
  });

  test("Alışveriş paketi: sepet açık, eğitim kapalı", async () => {
    await paket("alisveris");
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1 } })).status, 200);
    assert.equal((await e.yonA.get("/api/yonetim/siparis")).status, 200);
    assert.equal((await e.yonA.get("/api/yonetim/siparis.csv")).status, 200);
    assert.equal((await e.sakinA1.get("/api/puan")).status, 403);
    assert.equal((await fetch(c.base + "/md/00-ana-cerceve.md", { headers: { cookie: e.sakinA1.cerez } })).status, 403);
  });

  test("Tam paket: eğitim modülleri ve puan kartı açık; B sitesi etkilenmez", async () => {
    await paket("temel");
    assert.equal((await e.sakinB1.get("/api/puan")).status, 200, "B sitesi tam pakette kalır");
    await paket("tam");
    assert.equal((await e.sakinA1.put("/api/puan", { scores: { Y01: 3 } })).status, 200);
    assert.equal((await fetch(c.base + "/md/00-ana-cerceve.md", { headers: { cookie: e.sakinA1.cerez } })).status, 200);
    assert.equal((await fetch(c.base + "/md/00-ana-cerceve.md")).status, 403, "oturumsuz eğitim içeriği yok");
    assert.equal((await fetch(c.base + "/md/00-ana-cerceve.md", { headers: { cookie: e.admin.cerez } })).status, 403, "platform yöneticisi içerik okuyucu değil");
  });

  test("Deneme sürecinde site seçilen paketin özelliklerini kullanır", async () => {
    const s = await e.admin.post("/api/platform/siteler", { ad: "Deneme Alışveriş", plan: "alisveris", denemeGun: 10 });
    assert.equal(s.body.site.durum, "deneme");
    const y = await new Istemci(c).giris(tel()); await y.katil(s.body.davetKodu);
    assert.deepEqual(y.me.aktifSite.ozellikler, { alisveris: true, egitim: false });
    assert.equal((await y.put("/api/katalog", katalog())).status, 200);
    assert.equal((await y.get("/api/puan")).status, 403);
  });
});

describe("Özet (pilot ölçümü)", () => {
  let c, e;
  before(async () => { c = await sunucuBaslat(); e = await ortam(c); });
  after(async () => { await c.kapat(); });

  test("Toplam daire yokken sayı, varken yüzde; blok bazında doluluk", async () => {
    await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), bloklar: [{ ad: "A", minKat: 0, maxKat: 5, daire: 4 }, { ad: "B", minKat: 0, maxKat: 5 }] });
    await e.sakinA1.put("/api/profil", profilOrnek({ blok: "A", daire: "1" }));
    await e.sakinA2.put("/api/profil", profilOrnek({ blok: "B", daire: "2" }));
    let o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.equal(o.toplamDaire, null); assert.equal(o.doluluk, null); assert.equal(o.profilHane, 2);
    assert.deepEqual(o.bloklar, [{ blok: "A", hane: 1, daire: 4, doluluk: 25 }, { blok: "B", hane: 1, daire: null, doluluk: null }]);
    const r = await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), toplamDaire: "8", bloklar: [{ ad: "A", minKat: 0, maxKat: 5, daire: 4 }, { ad: "B", minKat: 0, maxKat: 5 }] });
    assert.equal(r.body.ayarlar.toplamDaire, 8);
    o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.equal(o.doluluk, 25);
  });
  test("Toplam ve blok daire sayısı sınırları", async () => {
    for (const a of [{ toplamDaire: 0 }, { toplamDaire: 5001 }, { toplamDaire: "çok" }, { bloklar: [{ ad: "A", minKat: 0, maxKat: 1, daire: 0 }] }]) {
      assert.equal((await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), ...a })).status, 400, JSON.stringify(a));
    }
    assert.equal((await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), toplamDaire: 5000, bloklar: [{ ad: "A", minKat: 0, maxKat: 5 }, { ad: "B", minKat: 0, maxKat: 5 }] })).status, 200);
  });
  test("Son 7 günde katılan sakinler", async () => {
    const o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.equal(o.son7GunKatilan, 2, "yalnız sakin rolü sayılır (yönetici ve denetçi hariç)");
    c.saat.kayma = 8 * 864e5;
    try { assert.equal((await e.yonA.get("/api/yonetim/ozet")).body.son7GunKatilan, 0); } finally { c.saat.kayma = 0; }
  });
  test("Açık turda sipariş veren hane ve önceki 3 turun sayıları", async () => {
    await e.yonA.put("/api/katalog", katalog({ tur: { ad: "Tur 1", acik: true } }));
    await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1 } });
    await e.sakinA2.put("/api/sepet", { kalemler: { u1: 2 } });
    let o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.equal(o.acikTur.hane, 2); assert.equal(o.acikTur.ad, "Tur 1"); assert.deepEqual(o.oncekiTurlar, []);
    await e.yonA.put("/api/katalog", katalog({ tur: { ad: "Tur 2", acik: true } }));
    await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1 } }); // eski sepeti yeni tura taşır
    o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.equal(o.acikTur.hane, 1);
    assert.equal(o.oncekiTurlar[0].ad, "Tur 1"); assert.equal(o.oncekiTurlar[0].hane, 2, "taşımadan sonra da eski tur sayısı korunur");
    for (const ad of ["Tur 3", "Tur 4", "Tur 5"]) { c.saat.kayma += 1000; await e.yonA.put("/api/katalog", katalog({ tur: { ad, acik: true } })); }
    c.saat.kayma = 0;
    o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.deepEqual(o.oncekiTurlar.map(t => t.ad), ["Tur 4", "Tur 3", "Tur 2"]);
    assert.deepEqual(o.oncekiTurlar.map(t => t.hane), [0, 0, 1]);
    assert.equal(o.acikTur.ad, "Tur 5");
  });
  test("Denetçi okur, sakin göremez, başka site sayılmaz", async () => {
    assert.equal((await e.denetciA.get("/api/yonetim/ozet")).status, 200);
    assert.equal((await e.sakinA1.get("/api/yonetim/ozet")).status, 403);
    const b = (await e.yonB.get("/api/yonetim/ozet")).body;
    assert.equal(b.profilHane, 0); assert.equal(b.son7GunKatilan, 1);
  });
  test("Temel pakette özet alışveriş verisi içermez", async () => {
    await e.admin.patch("/api/platform/siteler/" + e.siteA.id, { plan: "temel" });
    const o = (await e.yonA.get("/api/yonetim/ozet")).body;
    assert.equal(o.alisveris, false); assert.ok(!("acikTur" in o)); assert.equal(o.profilHane, 2);
    await e.admin.patch("/api/platform/siteler/" + e.siteA.id, { plan: "tam" });
  });
});

describe("Nasıl kullanılır sayfası", () => {
  let c, e;
  before(async () => { c = await sunucuBaslat(); e = await ortam(c); });
  after(async () => { await c.kapat(); });
  test("/s/:kod sayfası, davet önizleme ve yazdırma CSS'i", async () => {
    await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), siteAdi: "Lale <Sitesi>" });
    const r = await fetch(c.base + "/s/" + e.davetA);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Uygulamayı 5 adımda kullan/);
    assert.equal((html.match(/<li>/g) || []).length, 5);
    const on = await (await fetch(c.base + "/api/davet/onizleme/" + e.davetA)).json();
    assert.deepEqual(on, { gecerli: true, site: "Lale <Sitesi>", kod: e.davetA });
    assert.deepEqual(await (await fetch(c.base + "/api/davet/onizleme/ZZZZ-ZZZZ")).json(), { gecerli: false });
    const kod2 = (await e.yonA.post("/api/yonetim/davetler", {})).body.kod;
    await e.yonA.del("/api/yonetim/davetler/" + kod2);
    assert.deepEqual(await (await fetch(c.base + "/api/davet/onizleme/" + kod2)).json(), { gecerli: false }, "iptal edilen kod");
    const css = await (await fetch(c.base + "/nasil.css")).text();
    assert.match(css, /@media print/);
    const js = await (await fetch(c.base + "/nasil.js")).text();
    assert.ok(!/innerHTML/.test(js), "site adı yalnızca textContent ile yazılır");
  });
  test("Önizleme ucu hız sınırlıdır", async () => {
    const c2 = await sunucuBaslat({ limitler: { davetIp: 3 } });
    try {
      const st = [];
      for (let i = 0; i < 4; i++) st.push((await fetch(c2.base + "/api/davet/onizleme/AAAA-AAAA")).status);
      assert.deepEqual(st, [200, 200, 200, 429]);
    } finally { await c2.kapat(); }
  });
});

describe("Satış belgesi iddiaları", () => {
  let c, e;
  before(async () => { c = await sunucuBaslat(); e = await ortam(c); });
  after(async () => { await c.kapat(); });

  test("TC kimlik, doğum tarihi, tanı, gelir sorulmuyor (özel sorularda da engelli)", async () => {
    for (const label of ["TC Kimlik No", "T.C. no", "Doğum tarihi", "Kronik hastalık tanısı", "Aylık gelir", "Maaşınız", "Kan grubu", "Dini inanç"]) {
      const r = await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), ozel: [{ k: "s1", label, tip: "metin" }] });
      assert.equal(r.status, 400, label); assert.match(r.body.hata, /sorulamaz/);
    }
    assert.equal((await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), ozel: [{ k: "s1", label: "Tanıdık bir usta önerir misiniz", tip: "metin" }, { k: "s2", label: "Bisiklet var mı", tip: "evethayir" }] })).status, 200);
    const p = await e.sakinA1.put("/api/profil", profilOrnek({ dogumTarihi: "1980-01-01", tcKimlik: "11111111111", gelir: "100000", tani: "x", bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "", dogum: "1980", ad: "Gizli Ad" }] }));
    assert.equal(p.status, 200);
    const t = JSON.stringify(p.body.profil);
    for (const k of ["dogumTarihi", "tcKimlik", "gelir", "tani", "1980", "Gizli Ad", "11111111111"]) assert.ok(!t.includes(k), k);
  });
  test("Siteye özel en fazla 8 soru", async () => {
    const soru = n => Array.from({ length: n }, (_, i) => ({ k: "s" + i, label: "Soru " + i, tip: "metin" }));
    assert.equal((await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), ozel: soru(8) })).status, 200);
    assert.equal((await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), ozel: soru(9) })).status, 400);
  });
  test("Sakin yalnızca kendi verisini görür", async () => {
    await e.sakinA1.put("/api/profil", profilOrnek({ ad: "Birinci" }));
    await e.sakinA2.put("/api/profil", profilOrnek({ ad: "İkinci" }));
    assert.equal((await e.sakinA1.get("/api/profil")).body.profil.ad, "Birinci");
    assert.equal((await e.sakinA2.get("/api/profil")).body.profil.ad, "İkinci");
    const v = JSON.stringify((await e.sakinA1.get("/api/hesap/veri")).body);
    assert.ok(!v.includes("İkinci"));
    for (const y of ["/api/yonetim/sakinler", "/api/yonetim/uyeler", "/api/yonetim/ozet", "/api/yonetim/siparis"]) assert.equal((await e.sakinA1.get(y)).status, 403, y);
  });
  test("Satıcı sakin verisini görmez; mevcut yönetici varken kendine yönetici daveti üretemez", async () => {
    const r = await e.admin.post(`/api/platform/siteler/${e.siteA.id}/yonetici-davet`);
    assert.equal(r.status, 409);
    const yeni = await e.admin.post("/api/platform/siteler", { ad: "Yöneticisiz" });
    const ilk = yeni.body.davetKodu;
    const d2 = await e.admin.post(`/api/platform/siteler/${yeni.body.site.id}/yonetici-davet`);
    assert.equal(d2.status, 200, "yöneticisi olmayan siteye yeni davet üretilebilir");
    const k = await new Istemci(c).giris(tel());
    assert.equal((await k.post("/api/davet/kullan", { kod: ilk })).status, 400, "yeni davet üretilince eski yönetici daveti iptal olur");
    await k.katil(d2.body.davetKodu);
    assert.equal(k.me.aktifSite.rol, "site_yonetici");
  });
  test("Sakin verisini indirir ve siler (hesap ve profil)", async () => {
    const v = await e.sakinA2.get("/api/hesap/veri");
    assert.equal(v.status, 200); assert.equal(v.body.siteler[0].profil.ad, "İkinci");
    assert.equal((await e.sakinA2.del("/api/hesap", { onay: true })).status, 200);
    assert.ok(!JSON.stringify((await e.yonA.get("/api/yonetim/sakinler")).body).includes("İkinci"));
  });
});

describe("Şema migration'ı", () => {
  test("v1 veritabanı v2'ye geçer: eski planlar 'tam' olur, veriler ve yabancı anahtarlar korunur", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-mig-"));
    const f = path.join(dir, "eski.sqlite");
    try {
      const eski = new DatabaseSync(f);
      eski.exec("PRAGMA foreign_keys = ON; CREATE TABLE schema_surum (surum INTEGER NOT NULL); INSERT INTO schema_surum VALUES (1);");
      eski.exec(MIGRATIONS[0]);
      eski.exec(`INSERT INTO sites (id, ad, plan, durum, olusturma) VALUES (1, 'Eski', 'standart', 'aktif', 1), (2, 'Eski2', 'kurumsal', 'deneme', 1);
        INSERT INTO users (id, telefon, olusturma) VALUES (7, '+905010000001', 1);
        INSERT INTO uyelikler VALUES (7, 1, 'sakin', 1);
        INSERT INTO profiller VALUES (1, 7, '{"blok":"A"}', 1);`);
      eski.close();
      const db = openDb(f);
      assert.equal(db.prepare("SELECT surum FROM schema_surum").get().surum, MIGRATIONS.length);
      assert.deepEqual(db.prepare("SELECT plan FROM sites ORDER BY id").all().map(r => r.plan), ["tam", "tam"]);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM profiller").get().n, 1);
      assert.throws(() => db.prepare("UPDATE sites SET plan = 'standart' WHERE id = 1").run());
      db.prepare("DELETE FROM sites WHERE id = 1").run();
      assert.equal(db.prepare("SELECT COUNT(*) n FROM profiller").get().n, 0, "ON DELETE CASCADE yeni tabloda da çalışır");
      db.close();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
