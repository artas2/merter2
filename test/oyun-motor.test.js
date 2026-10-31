"use strict";
/* Satranç ve Tavla motorları: bilinen sayılarla (perft) ve rastgele tam oyunlarla doğrulanır. */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/satranc");
const T = require("../src/tavla");

const perft = (d, n) => { if (!n) return 1; let t = 0; for (const m of S.yasalHamleler(d)) t += perft(S.uygula(d, m), n - 1); return t; };

test("Satranç: standart perft sayıları (hamle üretimi, rok, geçerken alma, terfi)", () => {
  const L = [["r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862]],
    ["8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238]],
    ["r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467]],
    ["rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379]]];
  assert.deepEqual([1, 2, 3, 4].map(n => perft(S.fenOku(), n)), [20, 400, 8902, 197281]);
  for (const [fen, b] of L) b.forEach((v, i) => assert.equal(perft(S.fenOku(fen), i + 1), v, fen + " derinlik " + (i + 1)));
});

test("Satranç: kısa mat, pat, yetersiz materyal, üç tekrar, 50 hamle; hamle doğrulama", () => {
  const oyna = (d, ...l) => l.reduce((x, s) => { const m = S.hamleBul(x, { k: s.slice(0, 2), h: s.slice(2, 4), t: s[4] && s[4].toUpperCase() }); assert.ok(m, "yasal değil: " + s); return S.uygula(x, m); }, d);
  let d = oyna(S.fenOku(), "f2f3", "e7e5", "g2g4", "d8h4");
  assert.deepEqual(S.durum(d), { bitti: true, sonuc: "siyah", neden: "şah mat" });
  assert.equal(S.hamleBul(S.fenOku(), { k: "e2", h: "e5" }), null, "piyon üç kare gidemez");
  assert.equal(S.hamleBul(S.fenOku(), { k: "e7", h: "e5" }), null, "sıra beyazda");
  assert.equal(S.hamleBul(S.fenOku(), { k: "zz", h: "e4" }), null);
  assert.deepEqual(S.durum(S.fenOku("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")), { bitti: true, sonuc: "berabere", neden: "pat" });
  assert.equal(S.durum(S.fenOku("8/8/4k3/8/8/4K3/8/7B w - - 0 1")).neden, "yetersiz materyal");
  d = S.fenOku("4k3/8/8/8/8/8/8/R3K3 w - - 0 1"); d = oyna(d, "a1a2", "e8e7", "a2a1", "e7e8", "a1a2", "e8e7", "a2a1", "e7e8", "a1a2");
  assert.equal(S.durum(oyna(d, "e8e7", "a2a1", "e7e8")).neden, "üç kez tekrar");
  assert.equal(S.durum(S.fenOku("4k3/8/8/8/8/8/8/R3K3 w - - 100 80")).neden, "50 hamle kuralı");
  // terfi ve rok
  d = S.fenOku("4k3/P7/8/8/8/8/8/4K2R w K - 0 1"); const t = S.hamleBul(d, { k: "a7", h: "a8", t: "N" }); assert.equal(S.uygula(d, t).tahta[0], "N");
  assert.ok(S.hamleBul(d, { k: "e1", h: "g1" }), "kısa rok"); assert.equal(S.uygula(d, S.hamleBul(d, { k: "e1", h: "g1" })).tahta[61], "R");
});

function rastgele(tohum) { let x = tohum; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }

test("Satranç: rastgele oyunlar bitişe kadar tutarlı (şah güvenliği, taş sayısı)", () => {
  for (let tohum = 1; tohum <= 30; tohum++) {
    const r = rastgele(tohum); let d = S.fenOku(), n = 0, bitti = null;
    for (; n < 600; n++) {
      const st = S.durum(d); if (st.bitti) { bitti = st; break; }
      const l = S.yasalHamleler(d); d = S.uygula(d, l[Math.floor(r() * l.length)]);
      assert.equal(d.tahta.filter(p => p === "K").length, 1); assert.equal(d.tahta.filter(p => p === "k").length, 1);
      assert.equal(S.sahta(d, d.tur === "b" ? "s" : "b"), false, "hamle eden şahını açıkta bırakamaz");
    }
    assert.ok(bitti || n === 600);
  }
});

test("Tavla: başlangıç, pul sayısı, zar ve rastgele tam oyunlar", () => {
  for (let tohum = 1; tohum <= 40; tohum++) {
    const r = rastgele(tohum), zar = () => 1 + Math.floor(r() * 6);
    let d = T.yeni(zar, tohum % 2 ? "b" : "s"); assert.notEqual(d.zar[0], d.zar[1], "açılış atışı çift olmaz");
    assert.equal(d.pts.filter(x => x > 0).reduce((a, b) => a + b, 0), 15); assert.equal(-d.pts.filter(x => x < 0).reduce((a, b) => a + b, 0), 15);
    let kazanan = null, adim = 0;
    for (; adim < 4000 && !kazanan; adim++) {
      const l = T.yasal(d); assert.ok(l.length, "oynanacak hamle olmadan sıra beklemez");
      const m = l[Math.floor(r() * l.length)], s = T.hamle(d, { k: m.k, h: m.h, z: m.z }, zar); assert.ok(!s.hata, s.hata);
      d = s.durum; kazanan = s.bitti || null;
      for (const c of ["b", "s"]) {
        const tahtada = d.pts.reduce((a, x) => a + (c === "b" ? Math.max(x, 0) : Math.max(-x, 0)), 0);
        assert.equal(tahtada + d.bar[c] + d.off[c], 15, "pul kaybolmaz");
      }
      assert.ok(!d.pts.some((x, i) => x !== 0 && Math.abs(x) > 15), "yığın sınırı");
    }
    assert.ok(kazanan, "oyun biter (tohum " + tohum + ")"); assert.equal(d.off[kazanan], 15);
  }
});

test("Tavla: bardan giriş zorunlu, kapalı noktaya girilmez, toplama kuralları, zar kuralları", () => {
  const boş = (tur, kalan, zar = kalan) => ({ pts: new Array(24).fill(0), bar: { b: 0, s: 0 }, off: { b: 0, s: 0 }, tur, zar: zar.slice(), kalan: kalan.slice(), son: null });
  // bardaki pul varken başka hamle yapılamaz; kapalı noktaya girilemez
  let d = boş("b", [3, 5]); d.bar.b = 1; d.pts[10] = 2; d.pts[24 - 3] = -2; // beyaz 3 ile giriş noktası (idx 21) siyah tarafından kapalı
  let l = T.yasal(d); assert.ok(l.every(m => m.k === "bar" && m.z === 5), JSON.stringify(l)); assert.equal(T.hamle(d, { k: 10, h: 7 }, () => 1).hata, "Bu hamle yapılamaz.");
  // vurma
  d = boş("b", [2, 4]); d.pts[5] = 1; d.pts[3] = -1; const v = T.oyna(d, { k: 5, h: 3, z: 2 }); assert.equal(v.bar.s, 1); assert.equal(v.pts[3], 1);
  // evde değilken toplanmaz
  d = boş("b", [6, 5]); d.pts[0] = 14; d.pts[10] = 1; assert.ok(!T.yasal(d).some(m => m.h === "off"));
  // evde: tam zarla toplanır; büyük zar yalnız daha uzak pul yoksa
  d = boş("b", [6, 1]); d.pts[2] = 1; d.pts[0] = 14; assert.ok(T.yasal(d).some(m => m.h === "off" && m.k === 2), "6 ile 3. noktadan toplanır");
  d = boş("b", [6, 1]); d.pts[2] = 1; d.pts[4] = 1; d.pts[0] = 13; assert.ok(!T.yasal(d).some(m => m.k === 2 && m.h === "off"), "daha uzak pul varken küçük puldan büyük zarla toplanmaz");
  // büyük zar kuralı: yalnız bir zar oynanabiliyorsa büyüğü oynanır
  d = boş("b", [6, 1]); d.pts[8] = 1; d.pts[2] = -2; d.pts[1] = 0; // 6 ile 8→2 kapalı; 1 ile 8→7 açık; 7'den sonra 6 ile 7→1 açık → ikisi de oynanabilir
  assert.equal(T.yasal(d).length, 1, "yalnız 1→6 sırası geçerli: önce 1 sonra 6 (iki zar da oynanmalı)");
  assert.equal(T.yasal(d)[0].z, 1);
  // çift zar dört hamle
  d = boş("b", [4, 4, 4, 4], [4, 4]); d.pts[23] = 4; let s = d; for (let i = 0; i < 4; i++) { const m = T.yasal(s)[0]; s = T.oyna(s, m); }
  assert.equal(s.kalan.length, 0);
  // oynanacak hamle yoksa sıra kendiliğinden geçer
  d = boş("b", [6, 6], [6, 6]); d.pts[23] = 1; d.pts[17] = -2; d.pts[0] = -2; assert.equal(T.yasal(d).length, 0);
  // kazanan
  d = boş("b", [1, 2]); d.off.b = 14; d.pts[0] = 1; const k = T.hamle(d, { k: 0, h: "off" }, () => 1); assert.equal(k.bitti, "b");
});
