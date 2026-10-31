"use strict";
/* Bekçi'yi eğitir ve ölçer.
   Kullanım:
     node scripts/bekci-egit.js                    # data/bekci-egitim.json ile eğit, 5 katlı çapraz doğrulama + ayrı değerlendirme kümesi
     node scripts/bekci-egit.js --db sunucu.sqlite # yönetim geri bildirimlerini de ekle (doğru alarm: sınıf; yanlış alarm: temiz)
     node scripts/bekci-egit.js --yaz              # modeli data/bekci-model.json'a yaz (varsayılan: yalnızca ölç, yazma)
   Not: örnekler sentetik ve el yazımıdır; gerçek sohbet verisiyle ölçülmedi. Geri bildirim toplandıkça model iyileşir. */
const fs = require("node:fs");
const path = require("node:path");
const B = require("../src/bekci");

const KOK = path.join(__dirname, "..");
const bayrak = a => process.argv.includes(a), deger = a => { const i = process.argv.indexOf(a); return i >= 0 ? process.argv[i + 1] : null; };
const veri = JSON.parse(fs.readFileSync(path.join(KOK, "data", "bekci-egitim.json"), "utf8"));
const dev = JSON.parse(fs.readFileSync(path.join(KOK, "data", "bekci-degerlendirme.json"), "utf8"));
const SINIFLAR = ["temiz", "kufur", "hakaret", "tehdit", "spam"];

/* Yazım oyunlarıyla çoğaltma: harfsiz yazım, rakamla harf, uzatma */
const LEET = { a: "4", e: "3", i: "1", o: "0", s: "5" };
const varyantlar = m => {
  const asc = B.ascii(B.kucuk(m)), out = new Set([asc]);
  out.add(asc.replace(/[aeios]/g, c => (Math.random() < 0.5 ? LEET[c] : c)));
  out.add(asc.replace(/([aeiou])/g, (c, x, i) => (i % 5 === 0 ? x + x + x : x)));
  return [...out].filter(x => x !== m);
};
function ornekler(v, artir) {
  const l = [];
  for (const [sinif, liste] of Object.entries(v)) for (const m of liste) { l.push([m, sinif]); if (artir) for (const x of varyantlar(m)) l.push([x, sinif]); }
  return l;
}
function egit(liste, alfa = 0.5) {
  const say = {}, belge = {}; const sozluk = new Set();
  for (const c of SINIFLAR) { say[c] = {}; belge[c] = 0; }
  for (const [m, c] of liste) {
    belge[c]++; const g = B.ngramlar(B.modelMetni(m));
    for (const k in g) { say[c][k] = (say[c][k] || 0) + g[k]; sozluk.add(k); }
  }
  const toplamBelge = liste.length, model = { surum: 1, alfa, sozluk: sozluk.size, sinif: {} };
  for (const c of SINIFLAR) { model.sinif[c] = { onsel: belge[c] / toplamBelge, say: say[c], toplam: Object.values(say[c]).reduce((a, b) => a + b, 0) }; }
  return model;
}
function olc(tahminler) { // tahminler: [{gercek: 'zararli'|'temiz', tahmin: aynı}]
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const t of tahminler) { if (t.gercek && t.tahmin) tp++; else if (!t.gercek && t.tahmin) fp++; else if (t.gercek && !t.tahmin) fn++; else tn++; }
  const p = tp / Math.max(1, tp + fp), r = tp / Math.max(1, tp + fn);
  return { tp, fp, fn, tn, kesinlik: p, duyarlilik: r, f1: p + r ? 2 * p * r / (p + r) : 0 };
}
const yuzde = x => (100 * x).toFixed(1) + "%";
const yaz = (ad, o) => console.log(`${ad.padEnd(26)} kesinlik ${yuzde(o.kesinlik).padStart(6)}  duyarlılık ${yuzde(o.duyarlilik).padStart(6)}  F1 ${yuzde(o.f1).padStart(6)}   (doğru alarm ${o.tp}, yanlış alarm ${o.fp}, kaçan ${o.fn}, temiz ${o.tn})`);

/* Geri bildirim: yönetimin işaretlediği olaylar */
let geriBildirim = [];
if (deger("--db")) {
  const { DatabaseSync } = require("node:sqlite"); const db = new DatabaseSync(deger("--db"), { readOnly: true });
  for (const r of db.prepare("SELECT norm, turler, geri FROM bekci_olay WHERE geri IS NOT NULL AND norm != ''").all()) {
    const tur = JSON.parse(r.turler || "[]")[0], sinif = { "küfür": "kufur", hakaret: "hakaret", tehdit: "tehdit", "reklam ya da bağlantı": "spam" }[tur];
    if (r.geri === 0) geriBildirim.push([r.norm, "temiz"]); else if (sinif) geriBildirim.push([r.norm, sinif]);
  }
  console.log(`Geri bildirimden ${geriBildirim.length} örnek eklendi.`);
}

/* 1) Çapraz doğrulama (yalnızca model; kurallar yok) */
const hepsi = ornekler(veri, false).concat(geriBildirim);
const K = 5, katlar = Array.from({ length: K }, () => []);
hepsi.map((x, i) => [x, (i * 7919) % 1000]).sort((a, b) => a[1] - b[1]).forEach(([x], i) => katlar[i % K].push(x));
const cv = [];
for (let k = 0; k < K; k++) {
  const egitimK = []; katlar.forEach((f, i) => { if (i !== k) for (const [m, c] of f) { egitimK.push([m, c]); for (const x of varyantlar(m)) if (c !== "temiz" || Math.random() < 0.5) egitimK.push([x, c]); } });
  const model = egit(egitimK);
  for (const [m, c] of katlar[k]) { const t = B.modelTahmin(model, m); cv.push({ gercek: c !== "temiz", tahmin: t.zararli > 0.6 }); }
}
console.log(`Eğitim örneği: ${hepsi.length} (temiz ${hepsi.filter(x => x[1] === "temiz").length}, zararlı ${hepsi.filter(x => x[1] !== "temiz").length}); çoğaltma ile ~${ornekler(veri, true).length}`);
yaz("Model, 5 katlı çapraz doğ.", olc(cv));

/* 2) Son model ve ayrı değerlendirme kümesi (eğitimde yok) */
const model = egit(ornekler(veri, true).concat(geriBildirim.flatMap(([m, c]) => [[m, c], ...varyantlar(m).map(x => [x, c])])));
const dv = [...dev.temiz.map(m => [m, false]), ...dev.toksik.map(m => [m, true])];
const sonuc = (adi, f) => { const o = olc(dv.map(([m, g]) => ({ gercek: g, tahmin: f(m) }))); yaz(adi, o); return o; };
sonuc("Yalnız kurallar (engelle)", m => B.degerlendir(m, null).karar === "engelle");
sonuc("Yalnız kurallar (izle+)", m => B.degerlendir(m, null).karar !== "izin");
sonuc("Yalnız model", m => B.modelTahmin(model, m).zararli > 0.6);
const tam = sonuc("Kurallar + model (izle+)", m => B.degerlendir(m, model).karar !== "izin");
sonuc("Kurallar + model (engelle)", m => B.degerlendir(m, model).karar === "engelle");
const hatalar = dv.filter(([m, g]) => (B.degerlendir(m, model).karar !== "izin") !== g).map(([m, g]) => `${g ? "KAÇTI" : "YANLIŞ ALARM"}: ${m}`);
if (hatalar.length) console.log("\nHatalar (değerlendirme kümesi):\n  " + hatalar.join("\n  "));
if (bayrak("--yaz")) { fs.writeFileSync(B.MODEL_YOLU, JSON.stringify(model)); console.log(`\nModel yazıldı: ${B.MODEL_YOLU} (${(fs.statSync(B.MODEL_YOLU).size / 1024).toFixed(0)} KB)`); }
process.exitCode = tam.kesinlik >= 0.9 && tam.duyarlilik >= 0.9 ? 0 : 1;
