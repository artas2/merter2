"use strict";
/* public/ikon.svg'den PWA PNG ikonlarını üretir (Playwright/Chromium ile). Geliştirme aracıdır; çıktılar depoda tutulur.
   node scripts/ikon-uret.js */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const PUB = path.join(__dirname, "..", "public");
(async () => {
  const svg = fs.readFileSync(path.join(PUB, "ikon.svg"), "utf8");
  // Maskable: tam dolu arka plan, içerik %80 güvenli alanın içinde
  const maskable = svg.replace('<rect width="512" height="512" rx="112" fill="#1F6B5A"/>', '<rect width="512" height="512" fill="#1F6B5A"/><g transform="translate(51.2 51.2) scale(.8)">').replace("</svg>", "</g></svg>");
  const b = await chromium.launch();
  for (const [ad, kaynak, boyut] of [["ikon-192.png", svg, 192], ["ikon-512.png", svg, 512], ["ikon-maskable-512.png", maskable, 512], ["apple-touch-icon.png", maskable, 180]]) {
    const p = await b.newPage({ viewport: { width: boyut, height: boyut } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${kaynak.replace("<svg ", `<svg width="${boyut}" height="${boyut}" `)}</body></html>`);
    await p.screenshot({ path: path.join(PUB, ad), omitBackground: true, clip: { x: 0, y: 0, width: boyut, height: boyut } });
    await p.close();
    console.log("yazıldı:", ad);
  }
  await b.close();
})();
