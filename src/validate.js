"use strict";
/* Sunucu tarafı doğrulama. Sınırlar prototipteki istemci kurallarıyla aynıdır;
   sunucu sınırı aşan veriyi kırpmaz, 400 ile reddeder. */
const O = require("../public/shared.js");

class Hata extends Error {
  constructor(status, mesaj, alan) { super(mesaj); this.status = status; this.alan = alan; }
}
const red = (mesaj, alan) => { throw new Hata(400, mesaj, alan); };

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function str(v, max, ad, { zorunlu = false } = {}) {
  if (v === undefined || v === null) v = "";
  if (typeof v === "number") v = String(v);
  if (typeof v !== "string") red(`${ad} metin olmalı.`, ad);
  v = v.trim();
  if (v.length > max) red(`${ad} en fazla ${max} karakter olabilir.`, ad);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v)) red(`${ad} geçersiz karakter içeriyor.`, ad);
  if (zorunlu && !v) red(`${ad} zorunlu.`, ad);
  return v;
}
function int(v, ad) {
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) v = parseInt(v, 10);
  if (typeof v !== "number" || !Number.isInteger(v)) red(`${ad} tam sayı olmalı.`, ad);
  return v;
}
function bool(v) { return v === true; }
function arr(v, max, ad) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) red(`${ad} liste olmalı.`, ad);
  if (v.length > max) red(`${ad} en fazla ${max} öğe olabilir.`, ad);
  return v;
}
const upTr = s => s.toLocaleUpperCase("tr");
const bosMu = v => v === undefined || v === null || (typeof v === "string" && !v.trim());
/* Siteye özel sorularda istenmeyecek hassas bilgiler (KVKK m.6 özel nitelikli veriler, kimlik, doğum tarihi, gelir). */
const HASSAS_SORU = /(^|[^a-zçğıöşü])(t\.?\s?c\.?|tckn)([^a-zçğıöşü]|$)|kimlik|doğum|dogum|yaşınız|(^|\s)(tanı|tani)($|\s|[?.,]|sı|si|ları|lari|nız|niz)|teşhis|teshis|hastalı|hastali|sağlık|saglik|ilaç|ilac|engell|gelir|maaş|maas|kazanç|kazanc|maaşı|din\b|dini|mezhep|(^|\s)ırk|(^|\s)irk\b|etnik|siyasi görüş|siyasi parti|sendika|sabıka|sabika|cinsel|biyometrik|kan grubu/;

/* Telefon: Türkiye cep numarası, E.164 biçimine çevrilir (+905xxxxxxxxx). */
function telefonNormalize(v) {
  if (typeof v !== "string") return null;
  let d = v.replace(/[\s()\-.]/g, "");
  if (d.startsWith("+90")) d = d.slice(3); else if (d.startsWith("0090")) d = d.slice(4); else if (d.startsWith("90") && d.length === 12) d = d.slice(2); else if (d.startsWith("0")) d = d.slice(1);
  if (!/^5\d{9}$/.test(d)) return null;
  return "+90" + d;
}

function ayarDogrula(a) {
  if (!isObj(a)) red("Geçersiz ayar verisi.");
  const bloklar = arr(a.bloklar, 30, "Bloklar").map((b, i) => {
    if (!isObj(b)) red("Geçersiz blok.");
    const ad = upTr(str(b.ad, 10, "Blok adı"));
    const minKat = b.minKat === "" || b.minKat === undefined || b.minKat === null ? 0 : int(b.minKat, "En alt kat");
    if (b.maxKat === "" || b.maxKat === undefined || b.maxKat === null) { if (!ad) return null; red("Her blok için en alt ve en üst katı doğru gir (-5 ile 80 arası).", "bloklar"); }
    const maxKat = int(b.maxKat, "En üst kat");
    const daire = bosMu(b.daire) ? null : int(b.daire, "Blok daire sayısı");
    if (daire !== null && (daire < 1 || daire > 5000)) red("Blok daire sayısı 1 ile 5000 arasında olmalı.", "bloklar");
    return { ad, minKat, maxKat, daire, i };
  }).filter(b => b && b.ad).map(({ ad, minKat, maxKat, daire }) => (daire === null ? { ad, minKat, maxKat } : { ad, minKat, maxKat, daire }));
  if (bloklar.some(b => b.maxKat < b.minKat || b.minKat < -5 || b.maxKat > 80)) red("Her blok için en alt ve en üst katı doğru gir (-5 ile 80 arası).", "bloklar");
  if (new Set(bloklar.map(b => b.ad)).size !== bloklar.length) red("Aynı blok adı iki kez girilmiş.", "bloklar");
  const iletisim = arr(a.iletisim, 8, "İletişim numaraları").map(c => {
    if (!isObj(c)) red("Geçersiz iletişim satırı.");
    const ad = str(c.ad, 40, "İletişim adı"), tel = str(c.tel, 20, "İletişim telefonu");
    if (tel && !/^[0-9+()\s-]+$/.test(tel)) red("Telefon yalnızca rakam, boşluk, +, (, ) ve - içerebilir.", "iletisim");
    return { ad, tel };
  }).filter(c => c.ad && c.tel);
  const hazir = arr(a.hazir, O.HAZIR_ALANLAR.length, "Hazır alanlar").filter(k => O.HAZIR_ALANLAR.some(h => h.k === k));
  const ozel = arr(a.ozel, 8, "Özel sorular").map(o => {
    if (!isObj(o)) red("Geçersiz özel soru.");
    const k = str(o.k, 20, "Soru anahtarı");
    if (!/^[a-z0-9_]{1,20}$/i.test(k)) red("Geçersiz soru anahtarı.", "ozel");
    if (O.HAZIR_ALANLAR.some(h => h.k === k)) red("Soru anahtarı hazır bir alanla çakışıyor.", "ozel");
    const tip = O.TIPLER[o.tip] ? o.tip : "metin";
    const label = str(o.label, 40, "Soru");
    if (label && HASSAS_SORU.test(label.toLocaleLowerCase("tr"))) red(`"${label}" sorulamaz: kimlik numarası, doğum tarihi, sağlık, gelir, din, etnik köken gibi hassas bilgiler istenmez.`, "ozel");
    const secenekler = tip === "secim" ? str(o.secenekler, 120, "Seçenekler") : "";
    return { k, label, tip, secenekler };
  }).filter(o => o.label);
  if (new Set(ozel.map(o => o.k)).size !== ozel.length) red("Aynı soru anahtarı iki kez kullanılmış.", "ozel");
  const toplamDaire = bosMu(a.toplamDaire) ? null : int(a.toplamDaire, "Toplam daire sayısı");
  if (toplamDaire !== null && (toplamDaire < 1 || toplamDaire > 5000)) red("Toplam daire sayısı 1 ile 5000 arasında olmalı.", "toplamDaire");
  return {
    siteAdi: str(a.siteAdi, 50, "Site adı"), toplamDaire,
    tema: O.TEMALAR[a.tema] ? a.tema : "yesil",
    karsilama: str(a.karsilama, 200, "Karşılama metni"),
    duyuru: str(a.duyuru, 240, "Duyuru"),
    bloklar, iletisim,
    isDurumuSor: a.isDurumuSor !== false,
    telefonZorunlu: bool(a.telefonZorunlu),
    hazir: [...new Set(hazir)], ozel,
    gizliModul: [...new Set(arr(a.gizliModul, O.M.length, "Gizli modüller").filter(c => O.BY[c]))]
  };
}

function profilDogrula(p, AYAR, buYil = new Date().getFullYear()) {
  if (!isObj(p)) red("Geçersiz profil verisi.");
  const blok = upTr(str(p.blok, 10, "Blok"));
  let daire = str(p.daire, 10, "Daire");
  const katRaw = typeof p.kat === "string" ? p.kat.trim() : p.kat;
  const kat = katRaw === "" || katRaw === undefined || katRaw === null ? NaN : (typeof katRaw === "number" ? katRaw : (/^-?\d+$/.test(katRaw) ? parseInt(katRaw, 10) : NaN));
  if (!blok || !Number.isInteger(kat) || !daire || !O.DURUM.includes(p.durum)) red("Blok, kat, daire ve oturma durumu zorunlu.");
  if (kat < -5 || kat > 80) red("Kat -5 ile 80 arasında olmalı.", "kat");
  let tasinma = "";
  if (p.tasinma !== "" && p.tasinma !== undefined && p.tasinma !== null) {
    const t = typeof p.tasinma === "number" ? p.tasinma : (/^\d{4}$/.test(String(p.tasinma).trim()) ? parseInt(p.tasinma, 10) : NaN);
    if (!Number.isInteger(t) || t < 1950 || t > buYil) red(`Taşınma yılı 1950–${buYil} arasında olmalı.`, "tasinma");
    tasinma = t;
  }
  const bireylerIn = arr(p.bireyler, 12, "Hanede yaşayanlar");
  if (!bireylerIn.length) red("Hanede en az bir birey olmalı.", "bireyler");
  const bireyler = bireylerIn.map(b => {
    if (!isObj(b) || !O.YAKINLIK.includes(b.yakinlik) || !O.YAS.includes(b.yas)) red("Her birey için yakınlık ve yaş grubu seç.", "bireyler");
    const is = AYAR.isDurumuSor ? (b.is ? b.is : "") : "";
    if (is && !O.IS.includes(is)) red("Geçersiz iş durumu.", "bireyler");
    return { yakinlik: b.yakinlik, yas: b.yas, is };
  });
  const telefon = str(p.telefon, 20, "Telefon");
  if (telefon && !/^[0-9+()\s-]+$/.test(telefon)) red("Telefon yalnızca rakam, boşluk, +, (, ) ve - içerebilir.", "telefon");
  if (AYAR.telefonZorunlu && !telefon) red("Bu sitede telefon zorunlu.", "telefon");
  if (AYAR.bloklar && AYAR.bloklar.length) {
    const bl = AYAR.bloklar.find(b => b.ad === blok);
    if (!bl || kat < bl.minKat || kat > bl.maxKat) red("Blok ve katı listeden seç.", "blok");
    if (Number.isInteger(bl.daire) && !(/^\d{1,4}$/.test(daire) && +daire >= 1 && +daire <= bl.daire))
      red(`${bl.ad} Blok için daire numarası 1 ile ${bl.daire} arasında bir sayı olmalı.`, "daire");
    if (Number.isInteger(bl.daire)) daire = String(+daire);
  }
  if (p.kvkk !== true) red("Kaydetmek için onay kutusunu işaretle.", "kvkk");
  const ekIn = isObj(p.ek) ? p.ek : {};
  const ek = {};
  for (const a of O.ekAlanlar(AYAR)) {
    const v = str(ekIn[a.k], 40, a.label);
    if (!v) continue;
    if (a.tip === "evethayir" && !["Evet", "Hayır"].includes(v)) red(`${a.label}: Evet veya Hayır seç.`, "ek");
    if (a.tip === "sayi" && !/^\d{1,6}$/.test(v)) red(`${a.label} sayı olmalı.`, "ek");
    if (a.tip === "secim" && !String(a.secenekler || "").split(",").map(x => x.trim()).filter(Boolean).includes(v)) red(`${a.label}: listeden seç.`, "ek");
    ek[a.k] = v;
  }
  const yardim = bool(p.yardim);
  return {
    ad: str(p.ad, 60, "Ad"), telefon, blok, kat, daire, durum: p.durum, tasinma, bireyler, ek,
    yardim, yardimNot: yardim ? str(p.yardimNot, 120, "Yardım notu") : "", kvkk: true
  };
}

function katalogDogrula(k) {
  if (!isObj(k)) red("Geçersiz katalog verisi.");
  const urunler = arr(k.urunler, 300, "Ürünler").map(u => {
    if (!isObj(u)) red("Geçersiz ürün.");
    const id = str(u.id, 24, "Ürün kimliği");
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) red("Geçersiz ürün kimliği.", "urunler");
    const kat = u.kat === "market" ? "market" : "pazar";
    let fiyat = "";
    if (u.fiyat !== "" && u.fiyat !== null && u.fiyat !== undefined) {
      const f = +String(u.fiyat).replace(",", ".");
      if (!Number.isFinite(f) || f < 0 || f > 1e6) red("Fiyat 0 ile 1.000.000 arasında bir sayı olmalı.", "fiyat");
      fiyat = Math.round(f * 100) / 100;
    }
    return { id, ad: str(u.ad, 40, "Ürün adı"), kat, alt: O.ALT[kat].includes(u.alt) ? u.alt : "Diğer", birim: O.BIRIMLER.includes(u.birim) ? u.birim : "adet", fiyat, aktif: u.aktif !== false };
  }).filter(u => u.ad);
  if (new Set(urunler.map(u => u.id)).size !== urunler.length) red("Aynı ürün kimliği iki kez kullanılmış.", "urunler");
  const t = isObj(k.tur) ? k.tur : {};
  const sonTarih = str(t.sonTarih, 16, "Son sipariş zamanı");
  if (sonTarih && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(sonTarih)) red("Son sipariş zamanı geçersiz.", "sonTarih");
  if (sonTarih && O.turBitisMs(sonTarih) === null) red("Son sipariş zamanı geçersiz.", "sonTarih");
  const tur = { ad: str(t.ad, 50, "Tur adı"), sonTarih, teslim: str(t.teslim, 80, "Teslim bilgisi"), acik: bool(t.acik) };
  return { urunler, tur, yeniTur: bool(k.yeniTur) };
}

function sepetDogrula(s, urunler) {
  if (!isObj(s)) red("Geçersiz sepet verisi.");
  const kalemIn = s.kalemler === undefined ? {} : s.kalemler;
  if (!isObj(kalemIn)) red("Kalemler nesne olmalı.");
  const ent = Object.entries(kalemIn);
  if (ent.length > 300) red("Sepette en fazla 300 ürün olabilir.");
  const kalemler = {};
  for (const [id, q] of ent) {
    const u = urunler.find(x => x.id === id);
    if (!u) continue; // katalogda olmayan ürün sessizce düşer (prototip davranışı)
    if (typeof q !== "number" || !Number.isFinite(q) || q < 0 || q > 99) red("Miktar 0 ile 99 arasında olmalı.", "kalemler");
    if (q === 0) continue;
    const adim = O.adimFor(u.birim);
    if (Math.abs(q / adim - Math.round(q / adim)) > 1e-9) red(`${u.ad} için miktar ${adim === 0.5 ? "0,5 kg adımlarla" : "tam sayı"} olmalı.`, "kalemler");
    kalemler[id] = q;
  }
  return { kalemler, not: str(s.not, 200, "Not") };
}

function puanDogrula(p) {
  if (!isObj(p)) red("Geçersiz puan verisi.");
  const scores = {}, kanit = {};
  for (const [c, v] of Object.entries(isObj(p.scores) ? p.scores : {})) {
    if (!O.BY[c]) red("Bilinmeyen modül: " + String(c).slice(0, 10));
    if (!Number.isInteger(v) || v < 0 || v > 10) red("Puan 1 ile 10 arasında olmalı.");
    if (v) scores[c] = v;
  }
  for (const [c, v] of Object.entries(isObj(p.kanit) ? p.kanit : {})) {
    if (!O.BY[c]) red("Bilinmeyen modül: " + String(c).slice(0, 10));
    const t = str(v, 300, "Kanıt");
    if (t) kanit[c] = t;
  }
  return { scores, kanit };
}

module.exports = { Hata, red, str, int, telefonNormalize, ayarDogrula, profilDogrula, katalogDogrula, sepetDogrula, puanDogrula, isObj };
