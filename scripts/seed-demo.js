"use strict";
/* DEMO verisi: "Çınar Evleri DEMO" sitesi, örnek katalog ve birkaç örnek hane.
   Gerçek kişi verisi değildir. Telefonlar +90 500 000 00 0X biçiminde kurmacadır. */
const path = require("node:path");
const crypto = require("node:crypto");
const { envYukle } = require("../src/server");
envYukle();
const { openDb, tx } = require("../src/db");
const O = require("../public/shared.js");

const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "site-app.sqlite");
require("../src/db").yetkiDusur(dbPath);
const db = openDb(dbPath);
const SITE_AD = "Çınar Evleri DEMO";
const now = Date.now();

if (db.prepare("SELECT id FROM sites WHERE ad = ?").get(SITE_AD)) {
  console.log(`"${SITE_AD}" zaten var; tekrar oluşturulmadı. Silmek için veritabanı dosyasını kaldırın: ${dbPath}`);
  process.exit(0);
}

const yerel = d => new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 16); // UTC+3 datetime-local
const fiyatlar = { "Domates": 30, "Salatalık": 25, "Patates": 18, "Soğan": 15, "Elma": 35, "Muz": 60, "Limon": 40, "Maydanoz": 10, "Ekmek": 12.5, "Süt": 35, "Yumurta (30'lu)": 140, "Su (5 L)": 30 };
const urunler = O.ORNEK_KATALOG.map(u => ({ ...u, fiyat: fiyatlar[u.ad] ?? "" }));
const turId = "t" + now.toString(36);
const katalog = { urunler, tur: { id: turId, ad: "Cumartesi pazarı (DEMO)", sonTarih: yerel(new Date(now + 3 * 864e5)), teslim: "Cumartesi 14:00, blok girişleri", acik: true } };
const ayar = { ...O.varsayilanAyar(), siteAdi: SITE_AD, tema: "yesil", karsilama: "Bu bir DEMO sitesidir. Veriler örnektir.",
  duyuru: "DEMO: Asansör bakımı örnek duyurusu – Salı 10:00–12:00.", iletisim: [{ ad: "Yönetim ofisi (DEMO)", tel: "0500 000 00 99" }],
  toplamDaire: 40, bloklar: [{ ad: "A", minKat: 0, maxKat: 5, daire: 16 }, { ad: "B", minKat: -1, maxKat: 8, daire: 24 }], hazir: ["arac", "evcil"], ozel: [{ k: "bisiklet", label: "Bisiklet var mı", tip: "evethayir", secenekler: "" }] };

const kod = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 8; i++) s += A[crypto.randomInt(A.length)]; return s; };
const sakinler = [
  { tel: "+905000000001", p: { ad: "Örnek Sakin 1", telefon: "0500 000 00 01", blok: "A", kat: 2, daire: "5", durum: "Malik", tasinma: 2015, bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "Çalışıyor" }, { yakinlik: "Eş", yas: "18–64", is: "Çalışıyor" }, { yakinlik: "Çocuk", yas: "0–6", is: "" }], ek: { arac: "1", evcil: "Hayır" }, yardim: false, yardimNot: "" },
    sepet: { u1: 2, u9: 1.5, u19: 2, u25: 3 } },
  { tel: "+905000000002", p: { ad: "Örnek Sakin 2", telefon: "", blok: "A", kat: 0, daire: "1", durum: "Kiracı", tasinma: new Date().getFullYear(), bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "Öğrenci" }], ek: {}, yardim: false, yardimNot: "" },
    sepet: { u1: 1, u15: 2 } },
  { tel: "+905000000003", p: { ad: "Örnek Sakin 3", telefon: "0500 000 00 03", blok: "B", kat: 4, daire: "12", durum: "Malik", tasinma: 1998, bireyler: [{ yakinlik: "Kendisi", yas: "65+", is: "Emekli" }, { yakinlik: "Eş", yas: "65+", is: "Emekli" }], ek: { evcil: "Evet" }, yardim: true, yardimNot: "Yürüteçle hareket ediyor (DEMO)" },
    sepet: { u5: 2.5, u28: 1, u32: 2 } },
  { tel: "+905000000004", p: { ad: "Örnek Sakin 4", telefon: "", blok: "B", kat: -1, daire: "2", durum: "Malik yakını", tasinma: "", bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "İş arıyor" }, { yakinlik: "Ebeveyn", yas: "65+", is: "Emekli" }, { yakinlik: "Çocuk", yas: "7–17", is: "Öğrenci" }], ek: {}, yardim: false, yardimNot: "" },
    sepet: null }
];

let sakinDavet;
tx(db, () => {
  const r = db.prepare("INSERT INTO sites (ad, plan, durum, deneme_bitis, ayarlar, katalog, olusturma) VALUES (?, 'tam', 'deneme', ?, ?, ?, ?)")
    .run(SITE_AD, new Date(now + 30 * 864e5).toISOString().slice(0, 10), JSON.stringify(ayar), JSON.stringify(katalog), now);
  const siteId = Number(r.lastInsertRowid);
  const user = tel => { const u = db.prepare("SELECT id FROM users WHERE telefon = ?").get(tel); if (u) return u.id; return Number(db.prepare("INSERT INTO users (telefon, platform_admin, olusturma) VALUES (?, 0, ?)").run(tel, now).lastInsertRowid); };
  const yon = user("+905000000000");
  db.prepare("INSERT INTO uyelikler (user_id, site_id, rol, olusturma) VALUES (?, ?, 'site_yonetici', ?)").run(yon, siteId, now);
  const den = user("+905000000009");
  db.prepare("INSERT INTO uyelikler (user_id, site_id, rol, olusturma) VALUES (?, ?, 'site_denetci', ?)").run(den, siteId, now);
  for (const s of sakinler) {
    const id = user(s.tel);
    db.prepare("INSERT INTO uyelikler (user_id, site_id, rol, olusturma) VALUES (?, ?, 'sakin', ?)").run(id, siteId, now);
    db.prepare("INSERT INTO profiller (site_id, user_id, veri, guncelleme) VALUES (?, ?, ?, ?)").run(siteId, id, JSON.stringify({ ...s.p, kvkk: true, guncelleme: now }), now);
    if (s.sepet) db.prepare("INSERT INTO sepetler (site_id, user_id, tur, blok, kat, daire, kalemler, notu, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(siteId, id, turId, s.p.blok, s.p.kat, s.p.daire, JSON.stringify(s.sepet), "", now);
  }
  // DEMO tur geçmişi (Özet kartındaki "önceki turlar" için)
  const tr = db.prepare("INSERT INTO turlar (site_id, tur_id, ad, baslangic, kapanis, hane) VALUES (?, ?, ?, ?, ?, ?)");
  tr.run(siteId, "tdemo1", "Cumartesi pazarı (DEMO, 2 hafta önce)", now - 16 * 864e5, now - 14 * 864e5, 2);
  tr.run(siteId, "tdemo2", "Cumartesi pazarı (DEMO, geçen hafta)", now - 9 * 864e5, now - 7 * 864e5, 3);
  tr.run(siteId, turId, katalog.tur.ad, now, null, null);
  sakinDavet = kod();
  db.prepare("INSERT INTO davetler (kod, site_id, rol, max_kullanim, bitis, aciklama, olusturan, olusturma) VALUES (?, ?, 'sakin', 100, ?, 'DEMO sakin daveti', ?, ?)").run(sakinDavet, siteId, now + 30 * 864e5, yon, now);
});

console.log(`DEMO site oluşturuldu: ${SITE_AD}
  Yönetici girişi : 0500 000 00 00
  Denetçi girişi  : 0500 000 00 09
  Örnek sakinler  : 0500 000 00 01 … 0500 000 00 04
  Sakin davet kodu: ${sakinDavet.slice(0, 4)}-${sakinDavet.slice(4)} (100 kullanım, 30 gün)
Giriş kodu (OTP) geliştirme modunda sunucu loguna yazılır.`);
