"use strict";
/* Bekçi: sohbet denetim botu. Yerel çalışır (dış servis yok, mesaj dışarı gitmez).
   Katmanlar:
   1) Kurallar: küfür, hakaret, tehdit, spam/bağlantı, bağırma, tekrar (flood); kişisel bilgi (IBAN, TC kimlik, e-posta) maskelenir.
      Yazım oyunlarına dayanıklıdır: büyük/küçük, Türkçe harfsiz yazım, rakamla harf (s1kt1r), harf arası boşluk/nokta (s i k t i r),
      uzatma (aptaaal), yıldızlı yazım (s*ktir). "sık sık", "şikâyet", "malzeme" gibi masum sözcükleri yanlış yakalamaz.
   2) Eğitilen model: karakter n-gram Naive Bayes (data/bekci-model.json, scripts/bekci-egit.js ile eğitilir). Model tek başına
      mesajı engelleyemez; en çok "izle" (yönetime işaretle) kararı verir. Kesin kararı kurallar verir.
   Karar: "izin" | "izle" (gönderilir, yönetime işaretlenir) | "engelle" (gönderilmez, kişiye sebebi söylenir).
   Tekrarlayan engelde otomatik susturma: 24 saatte 3 engel → 1 saat, 6 engel → 24 saat (yönetim kaldırabilir).
   Yönetici olayları görür, "doğru/yanlış alarm" geri bildirimi verir; geri bildirim bir sonraki eğitime girer. */
const fs = require("node:fs");
const path = require("node:path");

const MODEL_YOLU = path.join(__dirname, "..", "data", "bekci-model.json");
const SEBEP_AD = { kufur: "küfür", hakaret: "hakaret", tehdit: "tehdit", spam: "reklam ya da bağlantı", bagirma: "bağırma", tekrar: "tekrarlanan mesaj", kisisel: "kişisel bilgi" };

/* ---------- Normalleştirme ---------- */
const KATLA = { "ç": "c", "ğ": "g", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "€": "e", "£": "l" };
const kucuk = s => String(s).toLocaleLowerCase("tr");
const katla = s => s.replace(/[çğöşüâîû]/g, c => KATLA[c]);
const ascii = s => katla(s).replace(/ı/g, "i");
/* Kök + yaygın ekler */
const EK = "(?:lar|ler|i|in|im|u|un|e|a|dan|den|da|de|la|le|si|ci|cu|sin|siniz|sun)?";
const kokRe = k => new RegExp("^" + k + EK + "$");

/* Sözlük: k = kök (ASCII), mod: tam (kök + ek) ya da onek (uzun, güvenli kökler); ayirt: ı/i ayrımı korunur (sık ≠ sik) */
const SOZLUK = [
  // küfür (kesin)
  ...["siktir", "sikeyim", "sikerim", "sikik", "sikim", "orospu", "orospunun", "pezevenk", "yarrak", "yarak", "gotveren", "amina", "amini", "aminakoyim", "ananisikeyim", "ananisikerim", "serefsiz", "ibne", "kahpe", "kancik", "oc"].map(k => ({ k, mod: k === "oc" ? "tam" : "onek", tur: "kufur", puan: 90 })),
  ...["amk", "amq", "aq", "mk", "got", "pic", "amcik"].map(k => ({ k, mod: "tam", tur: "kufur", puan: k === "mk" ? 35 : k === "amcik" ? 80 : 88, ayirt: k === "amcik" })),
  { k: "sik", mod: "tam", tur: "kufur", puan: 55, ayirt: true }, // "sik" ile "sık" yazımı karışabildiği için tek başına şüpheli, bağlam olursa engel
  // hakaret
  ...["aptal", "salak", "gerizekali", "ahmak", "dangalak", "budala", "enayi", "embesil", "rezil", "pislik", "alcak", "kaltak", "sapik", "ucube", "mankafa", "gavat", "yavsak", "hergele", "serseri", "ezik", "bunak", "gerzek", "denyo", "avanak"].map(k => ({ k, mod: "tam", tur: "hakaret", puan: k === "serseri" ? 20 : 60 })),
  { k: "mal", mod: "tam", tur: "hakaret", puan: 25 }, { k: "cirkin", mod: "tam", tur: "hakaret", puan: 40 }, { k: "hayvan", mod: "tam", tur: "hakaret", puan: 30 }
];
for (const s of SOZLUK) s.re = s.mod === "onek" ? new RegExp("^" + s.k) : kokRe(s.k);
const HEDEF = new Set(["sen", "senin", "seni", "sana", "sende", "senden", "siz", "sizin", "sizi", "size", "bunu", "bu", "su", "o", "herif", "adam", "kadin", "komsu", "yonetici", "yonetim", "kapici", "dairesi"]);
const SEN = new Set(["sen", "senin", "seni", "sana", "senden", "siz", "sizin", "sizi", "size", "sizden"]);
const TEHDIT = [/\b(?:seni|sizi|hepinizi)\s+(?:oldur|geberti|dover|doge|mahvet|yakar|yakacag|bitir|pisman|bulur|parcala|gebertece|doveceg|ezece|ezer)\w*/, /\b(?:oldur|geberti|gebert)\w*/, /\bkafani\s+(?:kir|ez|patlat|parcala)\w*/, /\bevini\s+bilirim\b/, /\bpisman\s+edecegim\b|\bpisman\s+ederim\b/, /\bdisarida\s+(?:bekle|karsilas)\w*/, /\bseni\s+bulurum\b|\bsizi\s+bulurum\b/, /\bdov(?:erim|ecem|eceg\w*|ecek\w*)\b/];
const URL_RE = /(?:https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(?:com|net|org|info|xyz|tr|co|me|ly|io|ru|cc|app|shop|site|online|top)\b|\bt\.me\/|\bwa\.me\/|\bbit\.ly\/|\btelegram\b)/;
const REKLAM = ["bahis", "casino", "kumar", "bet", "bonus", "kripto", "yatirim", "kazanc", "tiklayin", "tikla", "whatsapp grubu", "ucretsiz", "kredi", "takipci", "indirim kodu", "cekilis", "hediye", "kazandiniz", "garantili", "dm at", "ozelden yaz", "ozele yaz", "sifresiz kredi", "kayit ol"];
const REKLAM_RE = REKLAM.map(k => new RegExp("(?:^|[^a-z0-9])" + k + "(?:[^a-z0-9]|$)"));
const IBAN_RE = /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi;
const EPOSTA_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TEL_RE = /(?:\+?9\s?0[\s.-]?)?\(?0?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}|\b\d{11}\b/g;
const TC_RE = /\b[1-9]\d{10}\b/g;
function tcGecerli(s) {
  const d = s.split("").map(Number); if (d.length !== 11 || d[0] === 0) return false;
  const t10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
  return t10 === d[9] && d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/* Metni jetonlara ayırır; her jeton { f: tam katlanmış, r: ı korunmuş } ve yazım oyunlarına karşı varyantlar üretir */
function jetonla(metin) {
  const r0 = kucuk(metin).replace(/ı/g, "ı"); // ı kalır
  // 1) harf arası ayraç: "s i k t i r", "s.i.k", "s-i-k" → birleştir (en az 3 tek harf)
  let g = r0.replace(/(?:^|(?<=[^\p{L}\p{N}]))((?:[\p{L}\p{N}][\s.\-_*]){2,}[\p{L}\p{N}])(?=$|[^\p{L}\p{N}])/gu, m => m.replace(/[\s.\-_*]/g, ""));
  const ham = g.split(/[^\p{L}\p{N}*@$]+/u).filter(Boolean), out = [];
  for (const t of ham) {
    const adaylar = new Set([t]);
    if (/\p{L}/u.test(t) && /[0-9@$]/.test(t)) adaylar.add(t.replace(/[0134578@$€£]/g, c => LEET[c] || c)); // rakamla harf: yalnızca harfli sözcüklerde
    for (const a of [...adaylar]) if (/(\p{L})\1{2,}/u.test(a)) adaylar.add(a.replace(/(\p{L})\1+/gu, "$1")); // uzatma: yalnızca 3+ tekrar varsa ("siiiktir"); "sikke" gibi çift harfler bozulmaz
    for (const a of adaylar) { out.push({ r: katla(a), f: ascii(a), t }); }
  }
  return out;
}
/* Yıldızlı yazım (s*ktir, am*na): aynı uzunluktaki köklerle eşle */
function yildizli(jeton) {
  if (!jeton.includes("*") || jeton.length < 3) return null;
  const re = new RegExp("^" + jeton.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".") + "$");
  return SOZLUK.find(s => s.puan >= 80 && s.k.length === jeton.length && re.test(s.k)) || null;
}

/* ---------- Model (karakter n-gram Naive Bayes) ---------- */
function ngramlar(metin) {
  const s = " " + metin.replace(/\s+/g, " ").trim() + " ", g = {};
  for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= s.length; i++) { const k = s.slice(i, i + n); g[k] = (g[k] || 0) + 1; }
  return g;
}
/* Eğitim ve çıkarımın ortak girdisi: jeton birleşimi (varyantlar katlanmış) */
function modelMetni(metin) { return jetonla(metin).filter((x, i, a) => a.findIndex(y => y.t === x.t) === i || true).map(x => x.f).filter((x, i, a) => a.indexOf(x) === i).join(" "); }
function modelTahmin(model, metin) {
  if (!model) return null;
  const g = ngramlar(modelMetni(metin)), sinif = Object.keys(model.sinif), lp = {};
  for (const c of sinif) {
    let p = Math.log(model.sinif[c].onsel);
    for (const k in g) { const n = model.sinif[c].say[k] || 0; p += g[k] * Math.log((n + model.alfa) / (model.sinif[c].toplam + model.alfa * model.sozluk)); }
    lp[c] = p;
  }
  const mx = Math.max(...Object.values(lp)), ex = {}; let z = 0;
  for (const c of sinif) { ex[c] = Math.exp(lp[c] - mx); z += ex[c]; }
  const o = {}; for (const c of sinif) o[c] = ex[c] / z;
  const en = sinif.filter(c => c !== "temiz").sort((a, b) => o[b] - o[a])[0];
  return { olasilik: o, sinif: en, zararli: 1 - (o.temiz || 0) };
}
function modelYukle(yol = MODEL_YOLU) { try { return JSON.parse(fs.readFileSync(yol, "utf8")); } catch (e) { return null; } }

/* ---------- Kurallar ---------- */
function kurallar(metin) {
  const nedenler = [], jt = jetonla(metin), tum = kucuk(metin), katli = ascii(tum);
  let hedefli = false;
  for (const j of jt) if (SEN.has(j.f)) hedefli = true;
  const hedefSay = jt.filter(j => HEDEF.has(j.f)).length;
  const gor = new Set();
  for (const j of jt) {
    for (const s of SOZLUK) {
      const t = s.ayirt ? j.r : j.f;
      if (!s.re.test(t)) continue;
      if (s.ayirt && /ı/.test(j.t.replace(/[^ı]/g, "")) ) continue; // "sık" gibi ı'lı yazım masum
      const anahtar = s.tur + ":" + s.k; if (gor.has(anahtar)) continue; gor.add(anahtar);
      let puan = s.puan; const bagl = s.tur === "kufur" ? 0 : 0;
      if ((s.tur === "hakaret" || s.k === "sik") && hedefli) puan += 20;
      nedenler.push({ tur: s.tur, puan: Math.min(100, puan + bagl), kelime: s.k });
    }
    const y = yildizli(j.t); if (y) nedenler.push({ tur: y.tur, puan: 85, kelime: y.k });
  }
  // birden fazla zayıf hakaret birleşir
  const hak = nedenler.filter(n => n.tur === "hakaret"); if (hak.length > 1) nedenler.push({ tur: "hakaret", puan: Math.min(85, Math.max(...hak.map(h => h.puan)) + 15 * (hak.length - 1)), kelime: "birleşik" });
  if (/\bgeri\s+zekal/.test(katli)) nedenler.push({ tur: "hakaret", puan: 65, kelime: "gerizekalı" });
  for (const re of TEHDIT) if (re.test(katli)) { nedenler.push({ tur: "tehdit", puan: 88 }); break; }
  // spam
  const reklamSay = REKLAM_RE.filter(re => re.test(katli)).length, url = URL_RE.test(katli);
  if (url || reklamSay) nedenler.push({ tur: "spam", puan: Math.min(95, (url ? 55 : 0) + reklamSay * 25 + (url && reklamSay ? 10 : 0)), kelime: url ? "bağlantı" : "reklam" });
  // bağırma
  const harf = metin.replace(/[^\p{L}]/gu, ""); if (harf.length >= 12 && harf.replace(/[^\p{Lu}]/gu, "").length / harf.length > 0.8) nedenler.push({ tur: "bagirma", puan: 30 });
  if (/(.)\1{7,}/u.test(metin)) nedenler.push({ tur: "bagirma", puan: 25 });
  const kelimeler = tum.split(/\s+/).filter(Boolean); if (kelimeler.length >= 6 && new Set(kelimeler).size <= kelimeler.length / 4) nedenler.push({ tur: "tekrar", puan: 55 });
  return { nedenler, hedefli, hedefSay };
}
/* Kişisel bilgiyi maskeler (IBAN, geçerli TC kimlik no, e-posta) */
function maskele(metin) {
  const bulunan = []; let m = metin;
  m = m.replace(IBAN_RE, () => { bulunan.push("IBAN"); return "[IBAN gizlendi]"; });
  m = m.replace(EPOSTA_RE, () => { bulunan.push("e-posta"); return "[e-posta gizlendi]"; });
  m = m.replace(TC_RE, s => { if (tcGecerli(s)) { bulunan.push("TC kimlik"); return "[kimlik no gizlendi]"; } return s; });
  m = m.replace(TEL_RE, () => { bulunan.push("telefon"); return "[numara gizlendi]"; });
  return { metin: m, bulunan };
}

const ESIK = { engelle: 75, izle: 45 };
function degerlendir(metin, model = null) {
  const m = maskele(String(metin || "")), k = kurallar(m.metin);
  let kural = k.nedenler.reduce((a, n) => Math.max(a, n.puan), 0);
  const tahmin = modelTahmin(model, m.metin);
  let skor = kural, modelPuan = 0;
  if (tahmin && tahmin.zararli > 0.6) { modelPuan = Math.round(tahmin.zararli * 70); skor = Math.max(skor, Math.min(modelPuan, ESIK.engelle - 1)); } // model tek başına engelleyemez
  const karar = skor >= ESIK.engelle ? "engelle" : skor >= ESIK.izle ? "izle" : "izin";
  const nedenler = k.nedenler.filter(n => n.puan >= ESIK.izle - 10).sort((a, b) => b.puan - a.puan);
  const turler = [...new Set(nedenler.map(n => n.tur))];
  if (!turler.length && tahmin && tahmin.zararli > 0.6) turler.push(tahmin.sinif);
  return { karar, skor, kural, model: tahmin ? { sinif: tahmin.sinif, zararli: Math.round(tahmin.zararli * 100) / 100, puan: modelPuan } : null, turler, nedenler, metin: m.metin, maskelenen: m.bulunan };
}

/* ---------- Sunucu bileşeni ---------- */
function createBekci({ db, now, model = modelYukle() }) {
  const q = {
    ekle: db.prepare("INSERT INTO bekci_olay (site_id, user_id, oda, zaman, karar, skor, turler, ozet, norm, mesaj_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    liste: db.prepare("SELECT * FROM bekci_olay WHERE site_id = ? ORDER BY id DESC LIMIT ?"),
    get: db.prepare("SELECT * FROM bekci_olay WHERE id = ? AND site_id = ?"),
    geri: db.prepare("UPDATE bekci_olay SET geri = ? WHERE id = ? AND site_id = ?"),
    ihlal: db.prepare("SELECT COUNT(*) n FROM bekci_olay WHERE site_id = ? AND user_id = ? AND karar = 'engelle' AND zaman >= ? AND (geri IS NULL OR geri = 1)"),
    sayim: db.prepare("SELECT karar, COUNT(*) n FROM bekci_olay WHERE site_id = ? AND zaman >= ? GROUP BY karar"),
    mesajBagla: db.prepare("UPDATE bekci_olay SET mesaj_id = ? WHERE id = ?"),
    temizle: db.prepare("DELETE FROM bekci_olay WHERE zaman < ?")
  };
  const son = new Map(); // flood: kullanıcı → [{norm, t}]
  const kisalt = (s, n = 140) => (s.length > n ? s.slice(0, n) + "…" : s);

  /* Mesajı değerlendirir ve olayı kaydeder. { karar, metin (maskeli), mesaj, olayId, susturSaat } */
  function kontrol(siteId, userId, oda, metin, mesajSonra) {
    const t = now(), d = degerlendir(metin, model);
    // Flood: aynı mesaj 60 sn içinde 3. kez
    const sk = siteId + ":" + userId, norm = ascii(kucuk(d.metin)).replace(/\s+/g, " ").trim();
    const l = (son.get(sk) || []).filter(x => t - x.t < 60000); l.push({ norm, t }); son.set(sk, l); if (son.size > 20000) son.clear();
    if (l.filter(x => x.norm === norm).length >= 3 && norm.length >= 3) { d.nedenler.push({ tur: "tekrar", puan: 80 }); d.turler.includes("tekrar") || d.turler.push("tekrar"); d.skor = Math.max(d.skor, 80); d.karar = "engelle"; }
    let karar = d.karar, mesaj = null, susturSaat = 0, olayId = null;
    if (karar !== "izin" || d.maskelenen.length) {
      const turler = d.turler.length ? d.turler : (d.maskelenen.length ? ["kisisel"] : []);
      if (karar === "izin" && d.maskelenen.length) { /* yalnızca maskelendi: olay kaydı tutulur */ }
      const gerekce = turler.map(x => SEBEP_AD[x] || x).join(", ");
      if (karar === "engelle") {
        const gecmis = q.ihlal.get(siteId, userId, t - 24 * 3600e3).n + 1; // bu ihlal dahil
        const susturSayi = gecmis >= 6 ? 24 : gecmis >= 3 ? 1 : 0; susturSaat = susturSayi;
        mesaj = `Minnoş uyarıyor: mesajınız gönderilmedi (${gerekce || "uygunsuz içerik"}). Lütfen komşularınıza saygılı olun.` + (susturSayi ? ` Tekrarlayan ihlal nedeniyle sohbete ${susturSayi === 24 ? "24 saat" : "1 saat"} yazamazsınız.` : gecmis === 2 ? " Bir ihlal daha olursa sohbete 1 saat yazamazsınız." : "");
      }
      if (karar !== "izin" || turler.length) {
        const r = q.ekle.run(siteId, userId, oda, t, karar === "izin" ? "maske" : karar, d.skor, JSON.stringify(turler), kisalt(d.metin), kisalt(norm, 300), null);
        olayId = Number(r.lastInsertRowid);
      }
    }
    return { karar, metin: d.metin, mesaj, olayId, susturSaat, turler: d.turler, skor: d.skor };
  }
  const baglaMesaj = (olayId, mesajId) => { if (olayId) q.mesajBagla.run(mesajId, olayId); };
  function olaylar(siteId, limit = 60) {
    const ad = (u => u);
    return { olaylar: q.liste.all(siteId, Math.min(200, limit)).map(r => ({ id: r.id, zaman: r.zaman, oda: r.oda, karar: r.karar, skor: r.skor, turler: JSON.parse(r.turler || "[]").map(x => SEBEP_AD[x] || x), ozet: r.ozet, kisi: r.user_id, geri: r.geri })),
      ozet: Object.fromEntries(q.sayim.all(siteId, now() - 24 * 3600e3).map(x => [x.karar, x.n])), esik: ESIK, modelVar: !!model };
  }
  function geriBildirim(siteId, id, dogru) {
    const o = q.get.get(Number(id), siteId); if (!o) return null;
    q.geri.run(dogru ? 1 : 0, o.id, siteId); return { ok: true };
  }
  function temizle() { return q.temizle.run(now() - 90 * 864e5).changes; }
  return { kontrol, baglaMesaj, olaylar, geriBildirim, temizle, degerlendir: m => degerlendir(m, model), modelVar: () => !!model };
}

module.exports = { createBekci, degerlendir, jetonla, maskele, ngramlar, modelMetni, modelTahmin, modelYukle, kucuk, ascii, ESIK, SEBEP_AD, MODEL_YOLU, tcGecerli };
