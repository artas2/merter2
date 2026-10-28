"use strict";
/* Yeni site kurulumu (gerçek kişi verisi olmadan).
   npm run kur:site -- --ad "Merter Çınar Evleri" --bloklar A,B,C,D,E --daire 12 --kat 0-5 --plan tam [--deneme-gun 30]
   - Sakin, fiyat ve tur oluşturmaz; katalog fiyatsız ORNEK_KATALOG ile yüklenir.
   - toplamDaire = blok sayısı × daire.
   - Tek kullanımlık, 7 gün geçerli bir site_yonetici davet kodu üretir ve konsola yazar.
   - Aynı adlı site varsa tekrar oluşturmaz. */
const path = require("node:path");
const crypto = require("node:crypto");
const O = require("../public/shared.js");
const V = require("../src/validate");

const KULLANIM = `Kullanım: npm run kur:site -- --ad "Site adı" --bloklar A,B,C --daire 12 --kat 0-5 [--plan temel|alisveris|tam] [--deneme-gun 30]`;
class ArgHata extends Error {}

function argumanlariOku(argv) {
  const izinli = new Set(["ad", "bloklar", "daire", "kat", "plan", "deneme-gun"]);
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (!m) throw new ArgHata(`Beklenmeyen argüman: ${a}`);
    if (!izinli.has(m[1])) throw new ArgHata(`Bilinmeyen seçenek: --${m[1]}`);
    let v = m[2];
    if (v === undefined) { v = argv[i + 1]; i++; }
    if (v === undefined || (v.startsWith("--") && !/^--?\d/.test(v))) throw new ArgHata(`--${m[1]} için değer eksik.`);
    if (m[1] in o) throw new ArgHata(`--${m[1]} iki kez verilmiş.`);
    o[m[1]] = v;
  }
  for (const z of ["ad", "bloklar", "daire", "kat"]) if (!(z in o)) throw new ArgHata(`--${z} zorunlu.`);

  const ad = o.ad.trim();
  if (!ad || ad.length > 50) throw new ArgHata("--ad 1–50 karakter olmalı.");
  const bloklar = o.bloklar.split(",").map(b => b.trim().toLocaleUpperCase("tr"));
  if (!bloklar.length || bloklar.some(b => !b || b.length > 10)) throw new ArgHata("--bloklar virgülle ayrılmış, her biri 1–10 karakterlik adlar olmalı (ör. A,B,C).");
  if (bloklar.length > 30) throw new ArgHata("En fazla 30 blok tanımlanabilir.");
  if (new Set(bloklar).size !== bloklar.length) throw new ArgHata("--bloklar içinde aynı blok iki kez var.");
  if (!/^\d+$/.test(o.daire) || +o.daire < 1 || +o.daire > 1000) throw new ArgHata("--daire 1 ile 1000 arasında bir tam sayı olmalı (blok başına daire).");
  const daire = +o.daire;
  if (bloklar.length * daire > 5000) throw new ArgHata("Toplam daire (blok × daire) en fazla 5000 olabilir.");
  const km = /^(-?\d+)-(-?\d+)$/.exec(o.kat.trim());
  if (!km) throw new ArgHata("--kat 'en alt-en üst' biçiminde olmalı (ör. 0-5 veya -1-8).");
  const minKat = +km[1], maxKat = +km[2];
  if (minKat < -5 || maxKat > 80 || minKat > maxKat) throw new ArgHata("--kat -5 ile 80 arasında olmalı ve en alt kat en üst kattan büyük olamaz.");
  const plan = o.plan === undefined ? "tam" : o.plan;
  if (!O.PLANLAR[plan]) throw new ArgHata(`--plan şunlardan biri olmalı: ${Object.keys(O.PLANLAR).join(", ")}.`);
  const dg = o["deneme-gun"] === undefined ? "30" : o["deneme-gun"];
  if (!/^\d+$/.test(dg) || +dg > 365) throw new ArgHata("--deneme-gun 0 ile 365 arasında bir tam sayı olmalı.");
  return { ad, bloklar, daire, minKat, maxKat, plan, denemeGun: +dg };
}

function davetKodu() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 8; i++) s += A[crypto.randomInt(A.length)]; return s; }

function kur(argv, { db, now = Date.now() } = {}) {
  const a = argumanlariOku(argv);
  const { tx } = require("../src/db");
  if (db.prepare("SELECT id FROM sites WHERE ad = ?").get(a.ad)) return { varOlan: true, ad: a.ad };
  // Ayar ve katalog uygulamanın kendi doğrulamasından geçer.
  const ayar = V.ayarDogrula({ ...O.varsayilanAyar(), siteAdi: a.ad, toplamDaire: a.bloklar.length * a.daire,
    bloklar: a.bloklar.map(ad => ({ ad, minKat: a.minKat, maxKat: a.maxKat, daire: a.daire })) });
  const k = V.katalogDogrula({ urunler: O.ORNEK_KATALOG.map(u => ({ ...u, fiyat: "" })), tur: { ad: "", sonTarih: "", teslim: "", acik: false } });
  const katalog = { urunler: k.urunler, tur: { id: "", ...k.tur } };
  const bitis = new Date(now + a.denemeGun * 864e5 + 3 * 3600e3).toISOString().slice(0, 10);
  let siteId, kod;
  tx(db, () => {
    const r = db.prepare("INSERT INTO sites (ad, plan, durum, deneme_bitis, ayarlar, katalog, olusturma) VALUES (?, ?, 'deneme', ?, ?, ?, ?)")
      .run(a.ad, a.plan, bitis, JSON.stringify(ayar), JSON.stringify(katalog), now);
    siteId = Number(r.lastInsertRowid);
    // Merter arayüzü (telefon uygulaması) ayarları belge deposundan okur: aynı ayar ve katalog oraya da yazılır.
    const ekle = db.prepare("INSERT INTO belgeler (site_id, koleksiyon, belge_id, veri, sira, guncelleme) VALUES (?, 'ayarlar', ?, ?, ?, ?)");
    ekle.run(siteId, "site", JSON.stringify({ ...ayar, hikmet: true }), 1, now);
    ekle.run(siteId, "katalog", JSON.stringify(katalog), 2, now);
    db.prepare("INSERT INTO belge_sira (site_id, sira) VALUES (?, 2)").run(siteId);
    for (let i = 0; i < 5; i++) {
      kod = davetKodu();
      if (!db.prepare("SELECT 1 FROM davetler WHERE kod = ?").get(kod)) break;
    }
    db.prepare("INSERT INTO davetler (kod, site_id, rol, max_kullanim, bitis, aciklama, olusturan, olusturma) VALUES (?, ?, 'site_yonetici', 1, ?, 'Kurulum: ilk yönetici', NULL, ?)")
      .run(kod, siteId, now + 7 * 864e5, now);
  });
  return { varOlan: false, siteId, ad: a.ad, plan: a.plan, denemeBitis: bitis, bloklar: a.bloklar, daire: a.daire, kat: [a.minKat, a.maxKat], toplamDaire: ayar.toplamDaire,
    urunSayisi: katalog.urunler.length, davetKodu: kod.slice(0, 4) + "-" + kod.slice(4) };
}

if (require.main === module) {
  const { envYukle } = require("../src/server");
  envYukle();
  const { openDb } = require("../src/db");
  let sonuc;
  try {
    const argv = process.argv.slice(2);
    argumanlariOku(argv); // veritabanını açmadan önce argümanları doğrula
    const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "site-app.sqlite");
    require("../src/db").yetkiDusur(dbPath);
    const db = openDb(dbPath);
    sonuc = kur(argv, { db });
    db.close();
    if (sonuc.varOlan) { console.log(`"${sonuc.ad}" adlı site zaten var; tekrar oluşturulmadı. (veritabanı: ${dbPath})`); process.exit(0); }
    console.log(`Site kuruldu: ${sonuc.ad} (#${sonuc.siteId})
  Paket          : ${O.PLANLAR[sonuc.plan]} · deneme bitiş ${sonuc.denemeBitis}
  Bloklar        : ${sonuc.bloklar.join(", ")} · blok başına ${sonuc.daire} daire · katlar ${O.katAd(sonuc.kat[0])}–${O.katAd(sonuc.kat[1])}
  Toplam daire   : ${sonuc.toplamDaire}
  Katalog        : ${sonuc.urunSayisi} ürün (fiyatsız), tur açılmadı
  Yönetici davet : ${sonuc.davetKodu} (tek kullanım, 7 gün)
Veritabanı: ${dbPath}
Bu kodu site yöneticisine güvenli bir kanaldan iletin.`);
  } catch (e) {
    if (e instanceof ArgHata || e instanceof V.Hata) { console.error(`Hata: ${e.message}\n${KULLANIM}`); process.exit(1); }
    throw e;
  }
}

module.exports = { argumanlariOku, kur, ArgHata };
