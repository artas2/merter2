"use strict";
/* Satranç kuralları (saf fonksiyonlar, sunucuda hamle doğrulaması için).
   Tahta: 64 hücre, 0 = a8 ... 63 = h1 (FEN sırası). Taşlar: büyük harf = beyaz (PNBRQK), küçük harf = siyah, null = boş.
   Desteklenen: rok, geçerken alma, terfi, şah, mat, pat, yetersiz materyal, 50 hamle, üç tekrar. */

const BASLANGIC_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const sq = (dosya, sira) => (8 - sira) * 8 + dosya; // dosya 0..7 (a..h), sira 1..8
const dosya = i => i & 7, sira = i => 8 - (i >> 3);
const ad = i => "abcdefgh"[dosya(i)] + sira(i);
const adSq = s => sq("abcdefgh".indexOf(s[0]), Number(s[1]));
const beyazMi = p => p !== null && p === p.toUpperCase();

function fenOku(fen = BASLANGIC_FEN) {
  const [yer, tur, rok, ep, yari, tam] = fen.split(" ");
  const tahta = [];
  for (const c of yer) { if (c === "/") continue; if (/\d/.test(c)) for (let i = 0; i < Number(c); i++) tahta.push(null); else tahta.push(c); }
  const d = { tahta, tur: tur === "w" ? "b" : "s", rok: { K: rok.includes("K"), Q: rok.includes("Q"), k: rok.includes("k"), q: rok.includes("q") },
    ep: ep === "-" ? null : adSq(ep), yari: Number(yari), tam: Number(tam), gecmis: [] };
  d.gecmis.push(konumAnahtari(d));
  return d;
}
function konumAnahtari(d) {
  return d.tahta.map(p => p || "1").join("") + d.tur + (d.rok.K ? "K" : "") + (d.rok.Q ? "Q" : "") + (d.rok.k ? "k" : "") + (d.rok.q ? "q" : "") + (d.ep === null ? "-" : d.ep);
}
const kopya = d => ({ tahta: d.tahta.slice(), tur: d.tur, rok: { ...d.rok }, ep: d.ep, yari: d.yari, tam: d.tam, gecmis: d.gecmis.slice() });

const AT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const SAH = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const CAPRAZ = [[1, 1], [-1, 1], [-1, -1], [1, -1]], DUZ = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* Kare k, "renk" (b/s) taraflarından saldırı altında mı? */
function saldiriAltinda(tahta, k, renk) {
  const f = dosya(k), r = sira(k), beyaz = renk === "b";
  const al = (df, dr) => { const nf = f + df, nr = r + dr; return nf >= 0 && nf < 8 && nr >= 1 && nr <= 8 ? tahta[sq(nf, nr)] : undefined; };
  const piyon = beyaz ? "P" : "p", at = beyaz ? "N" : "n", sah = beyaz ? "K" : "k", fil = beyaz ? "B" : "b", kale = beyaz ? "R" : "r", vezir = beyaz ? "Q" : "q";
  const yon = beyaz ? -1 : 1; // saldıran piyon k'nin altında (beyaz için sira-1)
  for (const df of [-1, 1]) if (al(df, yon) === piyon) return true;
  for (const [a, b] of AT) if (al(a, b) === at) return true;
  for (const [a, b] of SAH) if (al(a, b) === sah) return true;
  for (const [a, b] of CAPRAZ) for (let i = 1; i < 8; i++) { const p = al(a * i, b * i); if (p === undefined) break; if (p !== null) { if (p === fil || p === vezir) return true; break; } }
  for (const [a, b] of DUZ) for (let i = 1; i < 8; i++) { const p = al(a * i, b * i); if (p === undefined) break; if (p !== null) { if (p === kale || p === vezir) return true; break; } }
  return false;
}
const sahKare = (tahta, renk) => tahta.indexOf(renk === "b" ? "K" : "k");
const sahta = (d, renk = d.tur) => saldiriAltinda(d.tahta, sahKare(d.tahta, renk), renk === "b" ? "s" : "b");

/* Sahte-yasal hamleler (şah güvenliği sonra süzülür). Hamle: { k: kaynak, h: hedef, t?: terfi(Q/R/B/N), ozel?: 'rok'|'ep'|'cift' } */
function sahteHamleler(d) {
  const out = [], renk = d.tur, ben = p => p !== null && beyazMi(p) === (renk === "b"), dusman = p => p !== null && beyazMi(p) !== (renk === "b");
  for (let k = 0; k < 64; k++) {
    const p = d.tahta[k]; if (!ben(p)) continue;
    const f = dosya(k), r = sira(k), tip = p.toUpperCase();
    const ekle = (h, o = {}) => out.push({ k, h, ...o });
    if (tip === "P") {
      const yon = renk === "b" ? 1 : -1, basSira = renk === "b" ? 2 : 7, sonSira = renk === "b" ? 8 : 1;
      const bir = sq(f, r + yon);
      const terfili = (h, o) => { if (sira(h) === sonSira) for (const t of "QRBN") ekle(h, { ...o, t }); else ekle(h, o); };
      if (r + yon >= 1 && r + yon <= 8 && d.tahta[bir] === null) {
        terfili(bir, {});
        if (r === basSira && d.tahta[sq(f, r + 2 * yon)] === null) ekle(sq(f, r + 2 * yon), { ozel: "cift" });
      }
      for (const df of [-1, 1]) {
        const nf = f + df; if (nf < 0 || nf > 7) continue; const h = sq(nf, r + yon);
        if (dusman(d.tahta[h])) terfili(h, {}); else if (d.ep === h) ekle(h, { ozel: "ep" });
      }
    } else if (tip === "N" || tip === "K") {
      for (const [a, b] of (tip === "N" ? AT : SAH)) { const nf = f + a, nr = r + b; if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue; const h = sq(nf, nr); if (!ben(d.tahta[h])) ekle(h); }
      if (tip === "K") {
        const ev = renk === "b" ? 1 : 8, dusmanRenk = renk === "b" ? "s" : "b";
        if (r === ev && f === 4 && !saldiriAltinda(d.tahta, k, dusmanRenk)) {
          const kisa = renk === "b" ? d.rok.K : d.rok.k, uzun = renk === "b" ? d.rok.Q : d.rok.q, kale = renk === "b" ? "R" : "r";
          if (kisa && d.tahta[sq(7, ev)] === kale && d.tahta[sq(5, ev)] === null && d.tahta[sq(6, ev)] === null && !saldiriAltinda(d.tahta, sq(5, ev), dusmanRenk) && !saldiriAltinda(d.tahta, sq(6, ev), dusmanRenk)) ekle(sq(6, ev), { ozel: "rok" });
          if (uzun && d.tahta[sq(0, ev)] === kale && d.tahta[sq(1, ev)] === null && d.tahta[sq(2, ev)] === null && d.tahta[sq(3, ev)] === null && !saldiriAltinda(d.tahta, sq(3, ev), dusmanRenk) && !saldiriAltinda(d.tahta, sq(2, ev), dusmanRenk)) ekle(sq(2, ev), { ozel: "rok" });
        }
      }
    } else {
      const yonler = tip === "B" ? CAPRAZ : tip === "R" ? DUZ : CAPRAZ.concat(DUZ);
      for (const [a, b] of yonler) for (let i = 1; i < 8; i++) {
        const nf = f + a * i, nr = r + b * i; if (nf < 0 || nf > 7 || nr < 1 || nr > 8) break;
        const h = sq(nf, nr), q = d.tahta[h]; if (ben(q)) break; ekle(h); if (q !== null) break;
      }
    }
  }
  return out;
}

/* Hamleyi uygular (yeni durum döner); yasallık denetlemez. */
function uygula(d, m) {
  const y = kopya(d), p = y.tahta[m.k], renk = d.tur, tip = p.toUpperCase();
  const yakalama = y.tahta[m.h] !== null || m.ozel === "ep";
  y.tahta[m.h] = m.t ? (renk === "b" ? m.t : m.t.toLowerCase()) : p; y.tahta[m.k] = null;
  if (m.ozel === "ep") y.tahta[sq(dosya(m.h), sira(m.k))] = null;
  if (m.ozel === "rok") { const ev = sira(m.k); if (dosya(m.h) === 6) { y.tahta[sq(5, ev)] = y.tahta[sq(7, ev)]; y.tahta[sq(7, ev)] = null; } else { y.tahta[sq(3, ev)] = y.tahta[sq(0, ev)]; y.tahta[sq(0, ev)] = null; } }
  y.ep = m.ozel === "cift" ? sq(dosya(m.k), (sira(m.k) + sira(m.h)) / 2) : null;
  if (tip === "K") { if (renk === "b") { y.rok.K = false; y.rok.Q = false; } else { y.rok.k = false; y.rok.q = false; } }
  for (const [kare, hak] of [[sq(0, 1), "Q"], [sq(7, 1), "K"], [sq(0, 8), "q"], [sq(7, 8), "k"]]) if (m.k === kare || m.h === kare) y.rok[hak] = false;
  y.yari = tip === "P" || yakalama ? 0 : y.yari + 1;
  if (renk === "s") y.tam += 1;
  y.tur = renk === "b" ? "s" : "b";
  y.gecmis.push(konumAnahtari(y));
  return y;
}
function yasalHamleler(d) { return sahteHamleler(d).filter(m => !sahta(uygula(d, m), d.tur)); }

function yetersizMateryal(d) {
  const p = d.tahta.filter(x => x !== null && x.toUpperCase() !== "K");
  if (!p.length) return true;
  if (p.length === 1 && "NBnb".includes(p[0])) return true;
  if (p.every(x => "Bb".includes(x))) { // yalnızca filler: hepsi aynı renkli karelerde
    const renkler = new Set(d.tahta.map((x, i) => x && "Bb".includes(x) ? (dosya(i) + sira(i)) % 2 : null).filter(x => x !== null)); return renkler.size === 1;
  }
  return false;
}
/* Durum: { bitti, sonuc: 'beyaz'|'siyah'|'berabere', neden } ya da { bitti: false, sah } */
function durum(d) {
  const h = yasalHamleler(d), sah = sahta(d);
  if (!h.length) return sah ? { bitti: true, sonuc: d.tur === "b" ? "siyah" : "beyaz", neden: "şah mat" } : { bitti: true, sonuc: "berabere", neden: "pat" };
  if (yetersizMateryal(d)) return { bitti: true, sonuc: "berabere", neden: "yetersiz materyal" };
  if (d.yari >= 100) return { bitti: true, sonuc: "berabere", neden: "50 hamle kuralı" };
  const son = d.gecmis[d.gecmis.length - 1]; if (d.gecmis.filter(x => x === son).length >= 3) return { bitti: true, sonuc: "berabere", neden: "üç kez tekrar" };
  return { bitti: false, sah };
}
/* İstemciden gelen { k:"e2", h:"e4", t:"Q" } hamlesini yasal listeyle eşler; yoksa null */
function hamleBul(d, g) {
  if (!g || typeof g.k !== "string" || typeof g.h !== "string" || !/^[a-h][1-8]$/.test(g.k) || !/^[a-h][1-8]$/.test(g.h)) return null;
  const k = adSq(g.k), h = adSq(g.h), t = typeof g.t === "string" && /^[QRBN]$/.test(g.t) ? g.t : null;
  const aday = yasalHamleler(d).filter(m => m.k === k && m.h === h);
  if (!aday.length) return null;
  if (aday.some(m => m.t)) return aday.find(m => m.t === (t || "Q")) || null;
  return aday[0];
}
/* Dışa verilen durum (istemci gösterimi): tahta 64 karakterlik dizi, yasal hedefler */
function gorunum(d) {
  const hedefler = {}; for (const m of yasalHamleler(d)) (hedefler[ad(m.k)] = hedefler[ad(m.k)] || []).push(ad(m.h));
  for (const k in hedefler) hedefler[k] = [...new Set(hedefler[k])];
  return { tahta: d.tahta.map(p => p || ".").join(""), tur: d.tur, hedefler, sah: sahta(d), yari: d.yari, tam: d.tam };
}
function serilestir(d) { return JSON.stringify({ ...d, gecmis: d.gecmis.slice(-110) }); }
const yukle = s => JSON.parse(s);

module.exports = { BASLANGIC_FEN, fenOku, yasalHamleler, uygula, durum, hamleBul, gorunum, serilestir, yukle, sahta, ad, adSq, sq, saldiriAltinda };
