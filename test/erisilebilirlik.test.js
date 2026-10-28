"use strict";
/* Kontrast (WCAG AA), PWA manifest/ikonlar, servis çalışanı kuralları ve /saglik ucu. */
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sunucuBaslat, ortam } = require("./yardimci");
const O = require("../public/shared.js");

const PUB = path.join(__dirname, "..", "public");
const css = fs.readFileSync(path.join(PUB, "styles.css"), "utf8");
function tokenlar(blok) {
  const o = {};
  for (const m of blok.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)) o[m[1]] = m[2];
  return o;
}
const ACIK = tokenlar(css.slice(css.indexOf(":root{"), css.indexOf("}", css.indexOf(":root{"))));
const KOYU = tokenlar(css.slice(css.indexOf(':root[data-theme="dark"]{'), css.indexOf("}", css.indexOf(':root[data-theme="dark"]{'))));
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const oran = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

describe("Kontrast (WCAG AA, normal metin ≥ 4,5)", () => {
  test("Tema tokenları okunabildi", () => {
    for (const t of [ACIK, KOYU]) for (const k of ["paper", "sheet", "ink", "muted", "accent", "accent-soft", "ok", "ok-soft", "warn", "warn-soft", "weld-soft"]) assert.ok(t[k], k);
  });
  for (const [ad, t] of [["açık", ACIK], ["koyu", KOYU]]) {
    test(`${ad} tema: metin/arka plan çiftleri`, () => {
      const ciftler = [["ink", "paper"], ["ink", "sheet"], ["muted", "paper"], ["muted", "sheet"], ["muted", "accent-soft"], ["accent", "sheet"], ["accent", "paper"], ["accent", "accent-soft"],
        ["ok", "ok-soft"], ["warn", "warn-soft"], ["warn", "sheet"], ["warn", "paper"], ["ink", "weld-soft"], ["sheet", "accent"], ["paper", "ink"]];
      for (const [on, arka] of ciftler) assert.ok(oran(t[on], t[arka]) >= 4.5, `${ad}: ${on}/${arka} = ${oran(t[on], t[arka]).toFixed(2)}`);
    });
  }
  test("Site temaları (vurgu rengi) her iki modda AA", () => {
    for (const [k, t] of Object.entries(O.TEMALAR)) {
      for (const [on, arka] of [[t.l[0], ACIK.sheet], [t.l[0], ACIK.paper], [t.l[0], t.l[1]], [ACIK.ink, t.l[1]], [ACIK.muted, t.l[1]], [ACIK.sheet, t.l[0]]])
        assert.ok(oran(on, arka) >= 4.5, `${k} açık ${on}/${arka} ${oran(on, arka).toFixed(2)}`);
      for (const [on, arka] of [[t.d[0], KOYU.sheet], [t.d[0], KOYU.paper], [t.d[0], t.d[1]], [KOYU.ink, t.d[1]], [KOYU.muted, t.d[1]], [KOYU.sheet, t.d[0]]])
        assert.ok(oran(on, arka) >= 4.5, `${k} koyu ${on}/${arka} ${oran(on, arka).toFixed(2)}`);
    }
  });
  test("Ürün kutucuklarında beyaz harf okunur", () => {
    for (const [k, c] of Object.entries(O.ALT_RENK)) assert.ok(oran("#FFFFFF", c) >= 4.5, `${k} ${oran("#FFFFFF", c).toFixed(2)}`);
  });
  test("Hareket azaltma ve görünür odak kuralları stil dosyasında", () => {
    assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important/);
    assert.match(css, /:focus-visible\{outline:3px solid var\(--accent\)/);
    assert.match(css, /--dokun:44px/);
    assert.ok(!/font(-size)?:[^;}]*\b\d+px/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "yazı boyutları rem ile (tarayıcı yazı büyütmesine uyar)");
  });
});

describe("PWA", () => {
  let c, e;
  before(async () => { c = await sunucuBaslat(); e = await ortam(c); });
  after(async () => { await c.kapat(); });
  test("İkonlar doğru boyutta PNG", () => {
    for (const [f, n] of [["ikon-192.png", 192], ["ikon-512.png", 512], ["ikon-maskable-512.png", 512], ["apple-touch-icon.png", 180]]) {
      const b = fs.readFileSync(path.join(PUB, f));
      assert.equal(b.subarray(1, 4).toString(), "PNG", f);
      assert.equal(b.readUInt32BE(16), n, f); assert.equal(b.readUInt32BE(20), n, f);
    }
  });
  test("Manifest: oturumsuz genel ad; üye için site adı ve tema rengi", async () => {
    let r = await fetch(c.base + "/manifest.webmanifest");
    assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /application\/manifest\+json/);
    let m = await r.json();
    assert.equal(m.name, "Bilinçli Sakin"); assert.equal(m.display, "standalone"); assert.equal(m.start_url, "/");
    assert.ok(m.icons.some(i => i.purpose === "maskable" && i.sizes === "512x512"));
    assert.ok(m.icons.some(i => i.sizes === "192x192"));
    await e.yonA.put("/api/site/ayarlar", { ...O.varsayilanAyar(), siteAdi: "Merter Çınar Evleri", tema: "bordo" });
    m = await (await fetch(c.base + "/manifest.webmanifest", { headers: { cookie: e.sakinA1.cerez } })).json();
    assert.equal(m.name, "Merter Çınar Evleri · Bilinçli Sakin"); assert.equal(m.short_name, "Merter"); assert.ok(m.short_name.length <= 12);
    assert.equal(m.theme_color, O.TEMALAR.bordo.l[0]);
    m = await (await fetch(c.base + "/manifest.webmanifest", { headers: { cookie: e.admin.cerez } })).json();
    assert.equal(m.name, "Bilinçli Sakin", "platform yöneticisine site adı verilmez");
  });
  test("Servis çalışanı API'yi ve kişisel veriyi önbelleğe almaz", async () => {
    const sw = fs.readFileSync(path.join(PUB, "sw.js"), "utf8");
    const liste = JSON.parse(sw.match(/const STATIK = (\[[^\]]*\])/)[1]);
    assert.ok(liste.length > 5);
    for (const u of liste) assert.ok(!/^\/(api|md|saglik|manifest)/.test(u) && u !== "/" && u !== "/index.html", u);
    assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)[^\n]*return;/);
    assert.match(sw, /cevrimdisi\.html/);
    for (const u of liste) assert.equal((await fetch(c.base + u)).status, 200, u);
    const r = await fetch(c.base + "/sw.js");
    assert.match(r.headers.get("content-type"), /javascript/); assert.equal(r.headers.get("cache-control"), "no-cache");
  });
});

describe("Sağlık ucu", () => {
  test("/saglik 200 döner, kişisel veri içermez; veritabanı kapalıysa 503", async () => {
    const c = await sunucuBaslat();
    try {
      let r = await fetch(c.base + "/saglik");
      assert.equal(r.status, 200);
      const b = await r.json();
      assert.equal(b.durum, "ok"); assert.deepEqual(Object.keys(b).sort(), ["durum", "zaman"]);
      assert.equal(r.headers.get("cache-control"), "no-store");
      c.db.close();
      r = await fetch(c.base + "/saglik");
      assert.equal(r.status, 503); assert.equal((await r.json()).durum, "hata");
    } finally { await c.kapat(); }
  });
});
