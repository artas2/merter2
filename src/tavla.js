"use strict";
/* Tavla (standart tavla kuralları; sunucuda hamle doğrulaması için saf fonksiyonlar).
   Tahta: 24 nokta, pts[i] > 0 beyaz ("b"), < 0 siyah ("s") pul sayısı. Beyaz 23 → 0 yönünde, siyah 0 → 23 yönünde ilerler.
   Beyazın evi 0–5, siyahın evi 18–23. Çift zar dört hamle. Mümkün olan en çok zar oynanmak zorundadır; yalnız bir zar
   oynanabiliyorsa ve ikisi de oynanabilir tek hamle veriyorsa büyük zar oynanır. Katlama zarı ve mars puanı yoktur (eleme maçı). */

const PUL = 15;
const yon = renk => (renk === "b" ? -1 : 1);

function yeni(rng, baslayan) {
  const pts = new Array(24).fill(0);
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5; // beyaz
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5; // siyah
  const d = { pts, bar: { b: 0, s: 0 }, off: { b: 0, s: 0 }, tur: baslayan, zar: null, kalan: [], son: null };
  // Açılış atışı: çift olmaz (iki oyuncu birer zar atar, yüksek olan iki sayıyla başlar)
  let a, b; do { a = rng(); b = rng(); } while (a === b);
  d.zar = [a, b]; d.kalan = [a, b];
  return d;
}
const kopya = d => ({ pts: d.pts.slice(), bar: { ...d.bar }, off: { ...d.off }, tur: d.tur, zar: d.zar && d.zar.slice(), kalan: d.kalan.slice(), son: d.son });
const benimMi = (n, renk) => (renk === "b" ? n > 0 : n < 0);
const sayi = (d, i, renk) => (benimMi(d.pts[i], renk) ? Math.abs(d.pts[i]) : 0);

function evdeHepsi(d, renk) {
  if (d.bar[renk]) return false;
  for (let i = 0; i < 24; i++) if (benimMi(d.pts[i], renk) && (renk === "b" ? i > 5 : i < 18)) return false;
  return true;
}
/* Tek zar için yasal hamleler: { k: 'bar' | nokta, h: nokta | 'off', z: zar } */
function tekZar(d, z, renk = d.tur) {
  const out = [], dr = yon(renk), rakip = renk === "b" ? "s" : "b";
  const kapali = i => sayi(d, i, rakip) >= 2;
  if (d.bar[renk]) {
    const h = renk === "b" ? 24 - z : z - 1;
    if (!kapali(h)) out.push({ k: "bar", h, z });
    return out;
  }
  const evde = evdeHepsi(d, renk);
  for (let i = 0; i < 24; i++) {
    if (!sayi(d, i, renk)) continue;
    const h = i + dr * z;
    if (h >= 0 && h <= 23) { if (!kapali(h)) out.push({ k: i, h, z }); continue; }
    if (!evde) continue;
    const mesafe = renk === "b" ? i + 1 : 24 - i; // topla için gereken zar
    if (z === mesafe) out.push({ k: i, h: "off", z });
    else if (z > mesafe) { // daha uzak pul yoksa büyük zarla da toplanır
      let uzak = false; for (let j = 0; j < 24; j++) if (sayi(d, j, renk) && (renk === "b" ? j > i : j < i)) { uzak = true; break; }
      if (!uzak) out.push({ k: i, h: "off", z });
    }
  }
  return out;
}
function oyna(d, m) {
  const y = kopya(d), renk = d.tur, rakip = renk === "b" ? "s" : "b", e = renk === "b" ? 1 : -1;
  if (m.k === "bar") y.bar[renk]--; else y.pts[m.k] -= e;
  if (m.h === "off") y.off[renk]++;
  else {
    if (sayi(y, m.h, rakip) === 1) { y.pts[m.h] = 0; y.bar[rakip]++; }
    y.pts[m.h] += e;
  }
  const i = y.kalan.indexOf(m.z); y.kalan.splice(i, 1);
  return y;
}
/* En uzun oynanabilir dizinin uzunluğu (notlu) */
function enUzun(d, hafiza) {
  if (!d.kalan.length) return 0;
  const anahtar = JSON.stringify([d.pts, d.bar, d.kalan.slice().sort(), d.tur]);
  if (hafiza.has(anahtar)) return hafiza.get(anahtar);
  let en = 0;
  for (const z of new Set(d.kalan)) for (const m of tekZar(d, z)) { en = Math.max(en, 1 + enUzun(oyna(d, m), hafiza)); if (en === d.kalan.length) break; if (en === d.kalan.length) break; }
  hafiza.set(anahtar, en); return en;
}
/* Şimdi oynanabilecek yasal ilk hamleler (en çok zar ve büyük zar kuralları uygulanmış) */
function yasal(d) {
  if (!d.kalan.length) return [];
  const hafiza = new Map(), en = enUzun(d, hafiza); if (!en) return [];
  let adaylar = [];
  for (const z of new Set(d.kalan)) for (const m of tekZar(d, z)) if (1 + enUzun(oyna(d, m), hafiza) === en) adaylar.push(m);
  if (en === 1 && d.zar && d.zar[0] !== d.zar[1]) { const buyuk = Math.max(...d.zar); if (adaylar.some(m => m.z === buyuk)) adaylar = adaylar.filter(m => m.z === buyuk); }
  return adaylar;
}
const bitti = d => (d.off.b === PUL ? "b" : d.off.s === PUL ? "s" : null);

/* Sıra bitince: kazanan yoksa sırayı karşıya geçirip zarı atar; oynayacak hamlesi yoksa kendiliğinden pas (en çok 4 ardışık). */
function sirayiBitir(d, rng) {
  d.son = null; const paslar = [];
  for (let n = 0; n < 6; n++) {
    d.tur = d.tur === "b" ? "s" : "b";
    const a = rng(), b = rng(); d.zar = [a, b]; d.kalan = a === b ? [a, a, a, a] : [a, b];
    if (yasal(d).length) { if (paslar.length) d.son = { pas: paslar }; return d; }
    paslar.push({ renk: d.tur, zar: [a, b] });
  }
  d.son = { pas: paslar }; return d;
}
/* Hamleyi uygular. g: { k: 'bar'|nokta, h: nokta|'off', z?: zar } → { durum: yeni durum, hata?, bitti?: renk } */
function hamle(d, g, rng) {
  if (!g || !(g.k === "bar" || (Number.isInteger(g.k) && g.k >= 0 && g.k <= 23)) || !(g.h === "off" || (Number.isInteger(g.h) && g.h >= 0 && g.h <= 23))) return { hata: "Geçersiz hamle." };
  const adaylar = yasal(d).filter(m => m.k === g.k && m.h === g.h && (g.z === undefined || m.z === g.z));
  if (!adaylar.length) return { hata: "Bu hamle yapılamaz." };
  const m = adaylar.sort((a, b) => a.z - b.z)[0];
  let y = oyna(d, m); y.son = null;
  const kazanan = bitti(y); if (kazanan) { y.kalan = []; return { durum: y, bitti: kazanan }; }
  if (!y.kalan.length || !yasal(y).length) y = sirayiBitir(y, rng);
  return { durum: y };
}
function gorunum(d) {
  const hedefler = {}; for (const m of yasal(d)) (hedefler[m.k] = hedefler[m.k] || []).push(m.h);
  for (const k in hedefler) hedefler[k] = [...new Set(hedefler[k])];
  return { pts: d.pts, bar: d.bar, off: d.off, tur: d.tur, zar: d.zar, kalan: d.kalan, hedefler, son: d.son };
}
const serilestir = d => JSON.stringify(d), yukle = s => JSON.parse(s);

module.exports = { yeni, yasal, hamle, oyna, tekZar, sirayiBitir, gorunum, serilestir, yukle, bitti, evdeHepsi, PUL };
