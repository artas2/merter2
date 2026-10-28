"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { sunucuBaslat, Istemci, ortam, tel, profilOrnek } = require("./yardimci");
const O = require("../public/shared.js");

const yerel = ms => new Date(ms + 3 * 3600e3).toISOString().slice(0, 16);
const katalog = (ek = {}) => ({
  urunler: [
    { id: "u1", ad: "Domates", kat: "pazar", alt: "Sebze", birim: "kg", fiyat: 30, aktif: true },
    { id: "u2", ad: "Ekmek", kat: "market", alt: "Temel gıda", birim: "adet", fiyat: 12.5, aktif: true },
    { id: "u3", ad: "Maydanoz", kat: "pazar", alt: "Yeşillik", birim: "demet", fiyat: "", aktif: true }
  ],
  tur: { ad: "Cumartesi pazarı", sonTarih: yerel(Date.now() + 2 * 864e5), teslim: "Cumartesi 14:00", acik: true }, yeniTur: true, ...ek
});

let ctx, E;
before(async () => { ctx = await sunucuBaslat(); E = await ortam(ctx); });
after(async () => { await ctx.kapat(); });

describe("Kiracı izolasyonu", () => {
  test("A yöneticisi B sitesine geçemez, B verisini göremez", async () => {
    await E.sakinB1.put("/api/profil", profilOrnek({ ad: "B Sakini Gizli" }));
    const sec = await E.yonA.post("/api/site-sec", { siteId: E.siteB.id });
    assert.equal(sec.status, 403);
    const list = await E.yonA.get("/api/yonetim/sakinler");
    assert.equal(list.status, 200);
    assert.ok(!JSON.stringify(list.body).includes("B Sakini Gizli"));
    const csv = await E.yonA.get("/api/yonetim/sakinler.csv");
    assert.ok(!csv.text.includes("B Sakini Gizli"));
  });
  test("A yöneticisi B'nin üyesini ve davetini değiştiremez", async () => {
    const bId = E.sakinB1.me.user.id;
    assert.equal((await E.yonA.patch("/api/yonetim/uyeler/" + bId, { rol: "site_yonetici" })).status, 404);
    assert.equal((await E.yonA.del("/api/yonetim/uyeler/" + bId)).status, 404);
    assert.equal((await E.yonA.del("/api/yonetim/davetler/" + E.davetB)).status, 404);
    const uyeler = await E.yonB.get("/api/yonetim/uyeler");
    assert.ok(uyeler.body.uyeler.some(u => u.userId === bId && u.rol === "sakin"));
    const davetler = await E.yonB.get("/api/yonetim/davetler");
    assert.ok(davetler.body.davetler.find(d => d.kod === E.davetB).gecerli);
  });
  test("A'nın ayar ve katalog yazması B'yi etkilemez", async () => {
    await E.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), siteAdi: "A Sitesi Yeni", bloklar: [{ ad: "a", minKat: 0, maxKat: 5 }] });
    await E.yonA.put("/api/katalog", katalog());
    const bAyar = await E.sakinB1.get("/api/site/ayarlar");
    assert.notEqual(bAyar.body.ayarlar.siteAdi, "A Sitesi Yeni");
    const bKat = await E.sakinB1.get("/api/katalog");
    assert.equal(bKat.body.katalog.urunler.length, 0);
    const aAyar = await E.sakinA1.get("/api/site/ayarlar");
    assert.equal(aAyar.body.ayarlar.bloklar[0].ad, "A"); // büyük harfe çevrildi
  });
  test("B sakininin sepeti A'nın toplu siparişine girmez", async () => {
    await E.yonB.put("/api/katalog", katalog());
    await E.sakinB1.put("/api/sepet", { kalemler: { u1: 3 } });
    const s = await E.yonA.get("/api/yonetim/siparis");
    assert.equal(s.status, 200);
    assert.equal(s.body.hane, 0);
    const sb = await E.yonB.get("/api/yonetim/siparis");
    assert.equal(sb.body.hane, 1);
  });
  test("Bir sitenin davet kodu kullanıcıyı yalnızca o siteye ekler", async () => {
    const c = await new Istemci(ctx).giris(tel());
    await c.katil(E.davetA);
    assert.deepEqual(c.me.uyelikler.map(u => u.siteId), [E.siteA.id]);
    assert.equal((await c.post("/api/site-sec", { siteId: E.siteB.id })).status, 403);
  });
});

describe("Rol yetkileri", () => {
  test("Sakin yönetici uçlarına 403 alır", async () => {
    const s = E.sakinA1;
    for (const [m, y, b] of [["get", "/api/yonetim/sakinler"], ["get", "/api/yonetim/siparis"], ["get", "/api/yonetim/sakinler.csv"], ["get", "/api/yonetim/siparis.csv"],
      ["put", "/api/site/ayarlar", O.varsayilanAyar()], ["put", "/api/katalog", katalog()], ["post", "/api/yonetim/davetler", {}], ["get", "/api/yonetim/uyeler"],
      ["get", "/api/platform/siteler"], ["post", "/api/platform/siteler", { ad: "X" }]]) {
      const r = await s[m](y, b);
      assert.equal(r.status, 403, `${m} ${y}`);
    }
  });
  test("Denetçi sakin listesini ve siparişleri okur ama yazamaz", async () => {
    const d = E.denetciA;
    assert.equal(d.me.aktifSite.rol, "site_denetci");
    assert.equal((await d.get("/api/yonetim/sakinler")).status, 200);
    assert.equal((await d.get("/api/yonetim/siparis")).status, 200);
    assert.equal((await d.put("/api/site/ayarlar", O.varsayilanAyar())).status, 403);
    assert.equal((await d.put("/api/katalog", katalog())).status, 403);
    assert.equal((await d.post("/api/yonetim/davetler", {})).status, 403);
    assert.equal((await d.get("/api/yonetim/uyeler")).status, 403);
    assert.equal((await d.get("/api/yonetim/sakinler.csv")).status, 403);
  });
  test("Platform yöneticisi sakin verisini göremez ve siteye katılamaz", async () => {
    const a = E.admin;
    for (const y of ["/api/profil", "/api/yonetim/sakinler", "/api/yonetim/siparis", "/api/yonetim/sakinler.csv", "/api/sepet", "/api/site/ayarlar", "/api/yonetim/uyeler"]) {
      assert.equal((await a.get(y)).status, 403, y);
    }
    assert.equal((await a.post("/api/davet/kullan", { kod: E.davetA })).status, 403);
    assert.equal((await a.post("/api/site-sec", { siteId: E.siteA.id })).status, 403);
    const siteler = await a.get("/api/platform/siteler");
    assert.equal(siteler.status, 200);
    const t = JSON.stringify(siteler.body);
    assert.ok(!/telefon|profil|\+90/.test(t), "platform yanıtı kişisel veri içermemeli");
    assert.ok(siteler.body.siteler.every(s => "uyeSayisi" in s && "plan" in s && "durum" in s));
  });
  test("Yalnızca platform yöneticisi abonelik alanlarını değiştirebilir", async () => {
    assert.equal((await E.yonA.patch("/api/platform/siteler/" + E.siteA.id, { durum: "aktif" })).status, 403);
    const r = await E.admin.patch("/api/platform/siteler/" + E.siteA.id, { durum: "aktif", plan: "alisveris" });
    assert.equal(r.status, 200);
    assert.equal(r.body.site.plan, "alisveris");
    await E.admin.patch("/api/platform/siteler/" + E.siteA.id, { plan: "tam" });
    assert.equal((await E.admin.patch("/api/platform/siteler/" + E.siteA.id, { durum: "bilinmeyen" })).status, 400);
  });
  test("Oturumsuz istekler 401 alır", async () => {
    const c = new Istemci(ctx);
    assert.equal((await c.get("/api/me")).body.user, null);
    assert.equal((await c.get("/api/profil")).status, 401);
  });
});

describe("OTP", () => {
  test("Deneme sınırı: 5 hatalı denemeden sonra kod geçersiz olur", async () => {
    const c = new Istemci(ctx); const t = tel();
    await c.post("/api/auth/otp-iste", { telefon: t });
    const dogru = ctx.sms.sonKod(t);
    const yanlis = dogru === "000000" ? "111111" : "000000";
    const sonuc = [];
    for (let i = 0; i < 5; i++) sonuc.push((await c.post("/api/auth/otp-dogrula", { telefon: t, kod: yanlis })).status);
    assert.deepEqual(sonuc, [400, 400, 400, 400, 429]);
    const r = await c.post("/api/auth/otp-dogrula", { telefon: t, kod: dogru });
    assert.equal(r.status, 400, "doğru kod da artık reddedilmeli");
    assert.equal((await c.get("/api/me")).body.user, null);
  });
  test("Süre sınırı: 5 dakikadan eski kod reddedilir", async () => {
    const c = new Istemci(ctx); const t = tel();
    await c.post("/api/auth/otp-iste", { telefon: t });
    const kod = ctx.sms.sonKod(t);
    ctx.saat.kayma = 6 * 60000;
    try {
      const r = await c.post("/api/auth/otp-dogrula", { telefon: t, kod });
      assert.equal(r.status, 400); assert.match(r.body.hata, /süresi doldu/);
    } finally { ctx.saat.kayma = 0; }
  });
  test("Aynı numaraya dakikada bir kod; geçersiz numara 400", async () => {
    const c = new Istemci(ctx); const t = tel();
    assert.equal((await c.post("/api/auth/otp-iste", { telefon: t })).status, 200);
    assert.equal((await c.post("/api/auth/otp-iste", { telefon: t })).status, 429);
    assert.equal((await c.post("/api/auth/otp-iste", { telefon: "12345" })).status, 400);
  });
  test("Giriş ucu IP bazında hız sınırlıdır", async () => {
    const c2 = await sunucuBaslat({ limitler: {} }); // varsayılan sınırlar
    try {
      const c = new Istemci(c2); const st = [];
      for (let i = 0; i < 12; i++) st.push((await c.post("/api/auth/otp-iste", { telefon: tel() })).status);
      assert.equal(st.filter(s => s === 200).length, 10);
      assert.equal(st.at(-1), 429);
    } finally { await c2.kapat(); }
  });
  test("Oturum çerezi httpOnly ve SameSite=Lax", async () => {
    const t = tel();
    const r1 = await fetch(ctx.base + "/api/auth/otp-iste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ telefon: t }) });
    assert.equal(r1.status, 200);
    const r = await fetch(ctx.base + "/api/auth/otp-dogrula", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ telefon: t, kod: ctx.sms.sonKod(t) }) });
    const sc = r.headers.get("set-cookie");
    assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Lax/);
  });
});

describe("Girdi doğrulama", () => {
  test("Profil sınırları sunucuda zorlanır", async () => {
    const s = E.sakinA2;
    const kotu = [
      profilOrnek({ kat: 81, blok: "X" }), profilOrnek({ kat: 9 }), profilOrnek({ blok: "Z" }), profilOrnek({ kvkk: false }), profilOrnek({ durum: "Patron" }),
      profilOrnek({ bireyler: Array.from({ length: 13 }, () => ({ yakinlik: "Diğer", yas: "18–64" })) }), profilOrnek({ bireyler: [] }),
      profilOrnek({ bireyler: [{ yakinlik: "Kendisi", yas: "99+" }] }), profilOrnek({ tasinma: 1900 }), profilOrnek({ ad: "x".repeat(61) }),
      profilOrnek({ daire: "" }), profilOrnek({ telefon: "<script>" }), profilOrnek({ yardim: true, yardimNot: "y".repeat(121) })
    ];
    for (const p of kotu) { const r = await s.put("/api/profil", p); assert.equal(r.status, 400, JSON.stringify(p).slice(0, 80) + " → " + r.text); }
    const ok = await s.put("/api/profil", profilOrnek({ blok: "a", kat: "3", bireyler: Array.from({ length: 12 }, () => ({ yakinlik: "Diğer", yas: "18–64", is: "" })) }));
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.profil.blok, "A"); assert.equal(ok.body.profil.kat, 3);
  });
  test("Ek alanlar yalnızca site ayarındaki sorulardan kabul edilir", async () => {
    await E.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), bloklar: [{ ad: "A", minKat: 0, maxKat: 5 }], hazir: ["evcil", "arac"], ozel: [{ k: "bisiklet", label: "Bisiklet", tip: "secim", secenekler: "Yok, 1, 2+" }] });
    assert.equal((await E.sakinA2.put("/api/profil", profilOrnek({ ek: { evcil: "Belki" } }))).status, 400);
    assert.equal((await E.sakinA2.put("/api/profil", profilOrnek({ ek: { arac: "iki" } }))).status, 400);
    assert.equal((await E.sakinA2.put("/api/profil", profilOrnek({ ek: { bisiklet: "3" } }))).status, 400);
    const r = await E.sakinA2.put("/api/profil", profilOrnek({ ek: { evcil: "Evet", arac: "2", bisiklet: "2+", tcKimlik: "12345678901" } }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.profil.ek, { evcil: "Evet", arac: "2", bisiklet: "2+" });
    assert.ok(!("tcKimlik" in r.body.profil));
  });
  test("Telefon zorunluluğu ve iş durumu ayarı uygulanır", async () => {
    await E.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), telefonZorunlu: true, isDurumuSor: false });
    assert.equal((await E.sakinA2.put("/api/profil", profilOrnek({ telefon: "" }))).status, 400);
    const r = await E.sakinA2.put("/api/profil", profilOrnek());
    assert.equal(r.status, 200); assert.equal(r.body.profil.bireyler[0].is, "");
    await E.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), bloklar: [{ ad: "A", minKat: 0, maxKat: 5 }] });
  });
  test("Site ayarı sınırları", async () => {
    const y = E.yonA, v = O.varsayilanAyar();
    for (const a of [{ ...v, bloklar: [{ ad: "A", minKat: 3, maxKat: 1 }] }, { ...v, bloklar: [{ ad: "A", minKat: -6, maxKat: 1 }] }, { ...v, bloklar: [{ ad: "A", minKat: 0, maxKat: 81 }] },
      { ...v, bloklar: [{ ad: "A", minKat: 0, maxKat: 1 }, { ad: "a", minKat: 0, maxKat: 2 }] }, { ...v, siteAdi: "x".repeat(51) }, { ...v, duyuru: "x".repeat(241) },
      { ...v, bloklar: Array.from({ length: 31 }, (_, i) => ({ ad: "B" + i, minKat: 0, maxKat: 1 })) }, { ...v, iletisim: Array.from({ length: 9 }, () => ({ ad: "a", tel: "1" })) },
      { ...v, ozel: [{ k: "a b", label: "x", tip: "metin" }] }]) {
      assert.equal((await y.put("/api/site/ayarlar", a)).status, 400, JSON.stringify(a).slice(0, 120));
    }
    const r = await y.put("/api/site/ayarlar", { ...v, tema: "yokboyle", gizliModul: ["Y99", "Y13"], hazir: ["arac", "tc"] });
    assert.equal(r.status, 200); assert.equal(r.body.ayarlar.tema, "yesil"); assert.deepEqual(r.body.ayarlar.gizliModul, ["Y13"]); assert.deepEqual(r.body.ayarlar.hazir, ["arac"]);
    await y.put("/api/site/ayarlar", { ...O.varsayilanAyar(), bloklar: [{ ad: "A", minKat: 0, maxKat: 5 }] });
  });
  test("Katalog ve sepet sınırları", async () => {
    const y = E.yonA;
    assert.equal((await y.put("/api/katalog", { urunler: Array.from({ length: 301 }, (_, i) => ({ id: "u" + i, ad: "Ü" + i, kat: "pazar", alt: "Sebze", birim: "kg" })) })).status, 400);
    assert.equal((await y.put("/api/katalog", { urunler: [{ id: "u1", ad: "A" }, { id: "u1", ad: "B" }] })).status, 400);
    assert.equal((await y.put("/api/katalog", { urunler: [{ id: "u1", ad: "A", fiyat: "abc" }] })).status, 400);
    assert.equal((await y.put("/api/katalog", { urunler: [], tur: { sonTarih: "yarın" } })).status, 400);
  });
  test("Bozuk gövde ve içerik türü reddedilir", async () => {
    assert.equal((await E.sakinA1.istek("PUT", "/api/profil", null, { ham: "{bozuk" })).status, 400);
    assert.equal((await E.sakinA1.istek("PUT", "/api/profil", null, { ham: "a=b", basliklar: { "content-type": "application/x-www-form-urlencoded" } })).status, 415);
    assert.equal((await E.sakinA1.istek("PUT", "/api/profil", null, { ham: "[1,2]" })).status, 400);
  });
});

describe("CSRF", () => {
  test("Token başlığı olmadan veya yanlışken yazma reddedilir", async () => {
    const s = E.sakinA1;
    assert.equal((await s.put("/api/profil", profilOrnek(), { csrf: false })).status, 403);
    assert.equal((await s.put("/api/profil", profilOrnek(), { csrf: false, basliklar: { "x-csrf-token": "yanlis" } })).status, 403);
    assert.equal((await s.put("/api/profil", profilOrnek(), { basliklar: { origin: "https://kotu.example" } })).status, 403);
    assert.equal((await s.put("/api/profil", profilOrnek(), { basliklar: { "sec-fetch-site": "cross-site" } })).status, 403);
    assert.equal((await s.put("/api/profil", profilOrnek(), { basliklar: { origin: ctx.base } })).status, 200);
  });
  test("Başka bir oturumun tokenı işe yaramaz", async () => {
    const r = await E.sakinA1.put("/api/profil", profilOrnek(), { csrf: false, basliklar: { "x-csrf-token": E.sakinA2.csrf } });
    assert.equal(r.status, 403);
  });
});

describe("Askıdaki site", () => {
  test("Askıdaki sitede sakin okur ama yazamaz; KVKK silme açık kalır", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.yonA.put("/api/katalog", katalog());
      assert.equal((await e.sakinA1.put("/api/profil", profilOrnek())).status, 200);
      await e.admin.patch("/api/platform/siteler/" + e.siteA.id, { durum: "askida" });
      await e.sakinA1.yenile();
      assert.equal(e.sakinA1.me.aktifSite.saltOkur, true);
      assert.equal((await e.sakinA1.get("/api/profil")).status, 200);
      assert.equal((await e.sakinA1.get("/api/katalog")).status, 200);
      for (const [m, y, b] of [["put", "/api/profil", profilOrnek()], ["put", "/api/sepet", { kalemler: { u1: 1 } }], ["put", "/api/puan", { scores: { Y01: 3 } }]]) {
        const r = await e.sakinA1[m](y, b); assert.equal(r.status, 403, y); assert.match(r.body.hata, /askıda/);
      }
      assert.equal((await e.yonA.put("/api/site/ayarlar", O.varsayilanAyar())).status, 403);
      assert.equal((await e.yonA.get("/api/yonetim/sakinler")).status, 200);
      assert.equal((await e.sakinB1.put("/api/profil", profilOrnek())).status, 200, "diğer site etkilenmez");
      assert.equal((await e.sakinA1.del("/api/profil")).status, 200, "KVKK: silme askıda da çalışır");
      const yeni = await new Istemci(c).giris(tel());
      assert.equal((await yeni.post("/api/davet/kullan", { kod: e.davetA })).status, 403);
    } finally { await c.kapat(); }
  });
  test("Deneme süresi dolan site otomatik salt-okur olur", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.admin.patch("/api/platform/siteler/" + e.siteA.id, { durum: "deneme", denemeBitis: "2020-01-01" });
      const r = await e.sakinA1.put("/api/puan", { scores: { Y01: 3 } });
      assert.equal(r.status, 403);
      const s = (await e.admin.get("/api/platform/siteler")).body.siteler.find(x => x.id === e.siteA.id);
      assert.equal(s.etkinDurum, "askida");
    } finally { await c.kapat(); }
  });
});

describe("KVKK", () => {
  test("Sakin verisini JSON indirir ve hesabını siler", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.yonA.put("/api/katalog", katalog());
      await e.sakinA1.put("/api/profil", profilOrnek({ ad: "Silinecek Sakin" }));
      await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1.5 }, not: "kapıya" });
      await e.sakinA1.put("/api/puan", { scores: { Y01: 4 }, kanit: { Y01: "R1 raporu" } });
      const v = await e.sakinA1.get("/api/hesap/veri");
      assert.equal(v.status, 200);
      assert.match(v.headers.get("content-disposition"), /attachment/);
      assert.equal(v.body.siteler[0].profil.ad, "Silinecek Sakin");
      assert.equal(v.body.siteler[0].sepet.kalemler.u1, 1.5);
      assert.equal(v.body.siteler[0].puanKarti.scores.Y01, 4);
      assert.equal(v.body.hesap.telefon, e.sakinA1.me.user.telefon);
      assert.equal((await e.sakinA1.del("/api/hesap", {})).status, 400, "onaysız silme reddedilir");
      const id = e.sakinA1.me.user.id;
      assert.equal((await e.sakinA1.del("/api/hesap", { onay: true })).status, 200);
      assert.equal((await e.sakinA1.get("/api/me")).body.user, null);
      for (const t of ["users WHERE id", "profiller WHERE user_id", "sepetler WHERE user_id", "puanlar WHERE user_id", "uyelikler WHERE user_id", "sessions WHERE user_id"]) {
        assert.equal(c.db.prepare(`SELECT COUNT(*) n FROM ${t} = ?`).get(id).n, 0, t);
      }
      const liste = await e.yonA.get("/api/yonetim/sakinler");
      assert.ok(!JSON.stringify(liste.body).includes("Silinecek Sakin"));
    } finally { await c.kapat(); }
  });
  test("Profil silme profili ve sepeti kaldırır", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.yonA.put("/api/katalog", katalog());
      await e.sakinA1.put("/api/profil", profilOrnek());
      await e.sakinA1.put("/api/sepet", { kalemler: { u2: 2 } });
      assert.equal((await e.sakinA1.del("/api/profil")).status, 200);
      assert.equal((await e.sakinA1.get("/api/profil")).body.profil, null);
      assert.deepEqual((await e.sakinA1.get("/api/sepet")).body.sepet.kalemler, {});
      assert.equal((await e.yonA.get("/api/yonetim/siparis")).body.hane, 0);
    } finally { await c.kapat(); }
  });
  test("Şemada TC kimlik, tanı veya gelir alanı yoktur", () => {
    const kolonlar = ctx.db.prepare("SELECT sql FROM sqlite_master WHERE type='table'").all().map(r => r.sql).join(" ").toLowerCase();
    for (const k of ["tc", "kimlik", "tani", "gelir", "maas"]) assert.ok(!new RegExp("\\b" + k).test(kolonlar), k);
  });
});

describe("Sepet ve tur mantığı", () => {
  let c, e;
  before(async () => {
    c = await sunucuBaslat(); e = await ortam(c);
    await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), bloklar: [{ ad: "A", minKat: 0, maxKat: 5 }, { ad: "B", minKat: -1, maxKat: 8 }] });
  });
  after(async () => { await c.kapat(); });

  test("Tur başlatılmadan açılamaz; tur yoksa sepet kapalı; profil olmadan sipariş verilemez", async () => {
    assert.equal((await e.yonA.put("/api/katalog", { ...katalog(), yeniTur: false })).status, 400, "tur başlatılmadan açık olamaz");
    assert.equal((await e.yonA.put("/api/katalog", { ...katalog(), yeniTur: false, tur: { ad: "x", acik: false } })).status, 200);
    let r = await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1 } });
    assert.equal(r.status, 409); assert.match(r.body.hata, /Açık bir alışveriş turu yok/);
    await e.yonA.put("/api/katalog", katalog());
    r = await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1 } });
    assert.equal(r.status, 409); assert.match(r.body.hata, /profil/);
    assert.equal((await e.sakinA1.put("/api/profil", profilOrnek({ blok: "B", kat: 3, daire: "12" }))).status, 200);
  });
  test("kg ürünleri 0,5 adımla, diğerleri tam sayıyla; sınırlar", async () => {
    await e.yonA.put("/api/katalog", katalog());
    await e.sakinA2.put("/api/profil", profilOrnek({ blok: "A", kat: 1, daire: "2" }));
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: { u2: 1.5 } })).status, 400);
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1.25 } })).status, 400);
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: { u1: 100 } })).status, 400);
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: { u1: -1 } })).status, 400);
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: { u1: "2" } })).status, 400);
    assert.equal((await e.sakinA1.put("/api/sepet", { kalemler: {}, not: "x".repeat(201) })).status, 400);
    const r = await e.sakinA1.put("/api/sepet", { kalemler: { u1: 1.5, u2: 2, yok: 3, u3: 0 }, not: "olgun olmasın" });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.body.sepet.kalemler, { u1: 1.5, u2: 2 }, "katalogda olmayan ve 0 miktarlı kalem düşer");
  });
  test("Toplu sipariş ürünleri toplar, haneleri blok-kat-daire sırasıyla listeler", async () => {
    await e.sakinA2.put("/api/sepet", { kalemler: { u1: 2, u3: 1 } });
    const s = await e.yonA.get("/api/yonetim/siparis");
    assert.equal(s.status, 200);
    assert.equal(s.body.hane, 2);
    const dom = s.body.urunler.find(u => u.id === "u1");
    assert.equal(dom.q, 3.5); assert.equal(dom.h, 2);
    assert.deepEqual(s.body.urunler.map(u => u.ad), ["Ekmek", "Domates", "Maydanoz"], "market önce, sonra pazar; alt tür (Sebze < Yeşillik) ve ad sırası");
    assert.deepEqual(s.body.teslimat.map(d => d.blok + d.kat + "/" + d.daire), ["A1/2", "B3/12"]);
    assert.equal(s.body.toplam, 3.5 * 30 + 2 * 12.5);
    assert.equal(s.body.teslimat[1].not, "olgun olmasın");
  });
  test("Yeni tur: eski sepet siparişe sayılmaz, taşınınca sayılır", async () => {
    const eskiTur = (await e.sakinA1.get("/api/katalog")).body.katalog.tur.id;
    const k = await e.yonA.put("/api/katalog", katalog());
    const yeniTur = k.body.katalog.tur.id;
    assert.notEqual(yeniTur, eskiTur);
    assert.equal((await e.yonA.get("/api/yonetim/siparis")).body.hane, 0);
    const sp = (await e.sakinA1.get("/api/sepet")).body.sepet;
    assert.equal(sp.tur, eskiTur, "istemci eski turu görür");
    const t = await e.sakinA1.put("/api/sepet", { kalemler: sp.kalemler, not: sp.not });
    assert.equal(t.status, 200); assert.equal(t.body.sepet.tur, yeniTur);
    const s = await e.yonA.get("/api/yonetim/siparis");
    assert.equal(s.body.hane, 1); assert.equal(s.body.urunler.find(u => u.id === "u1").q, 1.5);
  });
  test("Kapalı tur ve süresi dolmuş turda sipariş reddedilir; boşaltma serbest", async () => {
    const kat = (await e.yonA.get("/api/katalog")).body.katalog;
    await e.yonA.put("/api/katalog", { urunler: kat.urunler, tur: { ...kat.tur, acik: false } });
    let r = await e.sakinA2.put("/api/sepet", { kalemler: { u1: 1 } });
    assert.equal(r.status, 409); assert.match(r.body.hata, /kapalı/);
    await e.yonA.put("/api/katalog", { urunler: kat.urunler, tur: { ...kat.tur, acik: true, sonTarih: yerel(Date.now() - 60000) } });
    r = await e.sakinA2.put("/api/sepet", { kalemler: { u1: 1 } });
    assert.equal(r.status, 409, "süre dolmuş tur");
    assert.equal((await e.sakinA2.put("/api/sepet", { kalemler: {} })).status, 200, "boşaltma kapalı turda da yapılabilir");
    // Sunucu saati ileri: açık tur süresi dolunca reddedilir
    await e.yonA.put("/api/katalog", { urunler: kat.urunler, tur: { ...kat.tur, acik: true, sonTarih: yerel(Date.now() + 3600e3) } });
    assert.equal((await e.sakinA2.put("/api/sepet", { kalemler: { u1: 1 } })).status, 200);
    c.saat.kayma = 2 * 3600e3;
    try { assert.equal((await e.sakinA2.put("/api/sepet", { kalemler: { u1: 2 } })).status, 409); } finally { c.saat.kayma = 0; }
  });
  test("Ortak tur kuralları (shared.js)", () => {
    const n = Date.parse("2026-10-24T12:00:00+03:00");
    assert.equal(O.turAcik({ id: "t1", acik: true, sonTarih: "2026-10-24T12:30" }, n), true);
    assert.equal(O.turAcik({ id: "t1", acik: true, sonTarih: "2026-10-24T11:59" }, n), false);
    assert.equal(O.turAcik({ id: "t1", acik: false, sonTarih: "" }, n), false);
    assert.equal(O.turAcik({ id: "", acik: true, sonTarih: "" }, n), false);
    assert.equal(O.turAcik({ id: "t1", acik: true, sonTarih: "" }, n), true);
    assert.equal(O.kalanSure({ sonTarih: "2026-10-26T15:00" }, n), "2 gün 3 saat kaldı");
    assert.equal(O.kalanSure({ sonTarih: "2026-10-24T11:00" }, n), "Süre doldu");
  });
});

describe("CSV dışa aktarım", () => {
  test("Sakin listesi CSV: UTF-8 BOM, noktalı virgül, Türkçe karakter, formül koruması", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), hazir: ["evcil"] });
      await e.sakinA1.put("/api/profil", profilOrnek({ ad: "=HYPERLINK(\"x\")", blok: "Ç", daire: "3;4", yardim: true, yardimNot: "Yürüteç; \"merdiven\"", ek: { evcil: "Evet" } }));
      const r = await e.yonA.get("/api/yonetim/sakinler.csv");
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type"), /text\/csv; charset=utf-8/);
      assert.match(r.headers.get("content-disposition"), /attachment; filename="sakinler.csv"/);
      const buf = Buffer.from(await (await fetch(c.base + "/api/yonetim/sakinler.csv", { headers: { cookie: e.yonA.cerez } })).arrayBuffer());
      assert.deepEqual([...buf.subarray(0, 3)], [0xEF, 0xBB, 0xBF], "UTF-8 BOM");
      const satirlar = r.text.replace(/^﻿/, "").trim().split("\r\n");
      assert.equal(satirlar[0], "Blok;Kat;Daire;Oturma durumu;Kişi sayısı;Kategoriler;Evcil hayvan var;Ad;Telefon;Acil durumda yardım;Yardım notu;Taşınma yılı");
      assert.ok(satirlar[1].startsWith("Ç;2. kat;\"3;4\";Malik;1;"), satirlar[1]);
      assert.ok(satirlar[1].includes("\"'=HYPERLINK(\"\"x\"\")\""), "formül tek tırnakla etkisizleştirilmeli: " + satirlar[1]);
      assert.ok(satirlar[1].includes("\"Yürüteç; \"\"merdiven\"\"\""));
    } finally { await c.kapat(); }
  });
  test("Toplu sipariş CSV (ürün ve teslimat)", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.yonA.put("/api/katalog", katalog());
      await e.sakinA1.put("/api/profil", profilOrnek({ blok: "A", kat: 0, daire: "1" }));
      await e.sakinA1.put("/api/sepet", { kalemler: { u1: 2.5, u2: 3 }, not: "Kapıya bırakın" });
      const u = await e.yonA.get("/api/yonetim/siparis.csv?liste=urun");
      const us = u.text.replace(/^﻿/, "").trim().split("\r\n");
      assert.equal(us[0], "Bölüm;Tür;Ürün;Miktar;Birim;Hane;Tahmini TL");
      assert.ok(us.includes("Pazar;Sebze;Domates;2,5;kg;1;75"), us.join("|"));
      assert.ok(us.includes("Market;Temel gıda;Ekmek;3;adet;1;37,5"));
      const t = await e.yonA.get("/api/yonetim/siparis.csv?liste=teslimat");
      const ts = t.text.replace(/^﻿/, "").trim().split("\r\n");
      assert.equal(ts[1], "A;Zemin kat;1;Domates 2,5 kg · Ekmek 3 adet;2;112,5;Kapıya bırakın");
      assert.match(t.headers.get("content-disposition"), /siparis-teslimat\.csv/);
    } finally { await c.kapat(); }
  });
});

describe("Davet ve üyelik", () => {
  test("Davet kodu kullanım sınırı, iptal ve rol", async () => {
    const kod = (await E.yonA.post("/api/yonetim/davetler", { rol: "site_denetci", maxKullanim: 1, gun: 1 })).body.kod;
    const a = await new Istemci(ctx).giris(tel()); await a.katil(kod);
    assert.equal(a.me.aktifSite.rol, "site_denetci");
    const b = await new Istemci(ctx).giris(tel());
    assert.equal((await b.post("/api/davet/kullan", { kod })).status, 400, "tek kullanımlık");
    const kod2 = (await E.yonA.post("/api/yonetim/davetler", {})).body.kod;
    assert.equal((await E.yonA.del("/api/yonetim/davetler/" + kod2)).status, 200);
    assert.equal((await b.post("/api/davet/kullan", { kod: kod2 })).status, 400, "iptal edilen kod");
    assert.equal((await E.yonA.post("/api/yonetim/davetler", { rol: "platform_admin" })).status, 400);
    assert.equal((await E.yonA.post("/api/yonetim/davetler", { maxKullanim: 501 })).status, 400);
  });
  test("Süresi dolan davet kodu reddedilir", async () => {
    const kod = (await E.yonA.post("/api/yonetim/davetler", { gun: 1 })).body.kod;
    const b = await new Istemci(ctx).giris(tel());
    ctx.saat.kayma = 2 * 864e5;
    try { assert.equal((await b.post("/api/davet/kullan", { kod })).status, 400); } finally { ctx.saat.kayma = 0; }
  });
  test("Yönetici üyeyi çıkarınca o sitedeki verisi silinir", async () => {
    const c = await sunucuBaslat(); const e = await ortam(c);
    try {
      await e.sakinA2.put("/api/profil", profilOrnek({ ad: "Taşınan" }));
      const id = e.sakinA2.me.user.id;
      assert.equal((await e.yonA.del("/api/yonetim/uyeler/" + e.yonA.me.user.id)).status, 400, "kendini çıkaramaz");
      assert.equal((await e.yonA.del("/api/yonetim/uyeler/" + id)).status, 200);
      assert.equal((await e.sakinA2.get("/api/profil")).status, 403);
      assert.equal(c.db.prepare("SELECT COUNT(*) n FROM profiller WHERE user_id = ?").get(id).n, 0);
    } finally { await c.kapat(); }
  });
});

describe("HTTP güvenliği ve statik dosyalar", () => {
  test("Güvenlik başlıkları", async () => {
    for (const y of ["/", "/api/me"]) {
      const r = await fetch(ctx.base + y);
      assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
      assert.match(r.headers.get("content-security-policy"), /script-src 'self'(;|$)/);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.equal(r.headers.get("referrer-policy"), "same-origin");
      assert.equal(r.headers.get("x-frame-options"), "DENY");
    }
  });
  test("Statik dosyalar ve dizin dışına çıkma engeli", async () => {
    assert.equal((await fetch(ctx.base + "/vendor/marked.min.js")).status, 200);
    assert.equal((await fetch(ctx.base + "/md/00-ana-cerceve.md", { headers: { cookie: E.sakinA1.cerez } })).status, 200);
    assert.equal((await fetch(ctx.base + "/aydinlatma.html")).status, 200);
    const port = new URL(ctx.base).port;
    for (const yol of ["/../src/app.js", "/%2e%2e/src/app.js", "/..%2fpackage.json", "/md/..%2f..%2fsrc%2fapp.js"]) {
      const st = await new Promise(res => http.get({ host: "127.0.0.1", port, path: yol }, r => { r.resume(); res(r.statusCode); }));
      assert.ok(st === 404 || (yol.startsWith("/md/") && st === 403), yol + " " + st); // dosya asla servis edilmez
    }
  });
  test("Çıktı kaçışı: HTML içeren profil verisi JSON olarak döner, sunucu HTML üretmez", async () => {
    const r = await E.sakinA1.put("/api/profil", profilOrnek({ ad: "<img src=x onerror=alert(1)>" }));
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /application\/json/);
  });
});
