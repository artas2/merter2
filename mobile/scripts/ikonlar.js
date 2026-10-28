"use strict";
/* public/ikon.svg'den mağaza ikonlarını üretir (Playwright + Chromium ile çizim, Python Pillow ile boyutlandırma).
   iOS: 1024×1024, saydamlıksız, köşesiz (iOS köşeleri kendisi yuvarlar). Android: mipmap ikonları + uyarlanabilir ikon ön planı. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const KOK = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(KOK, "..", "public", "ikon.svg"), "utf8");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  const ciz = async (ic, dosya, arka = "transparent") => {
    await p.setContent(`<html><body style="margin:0;background:${arka}">${ic}</body></html>`);
    await p.screenshot({ path: dosya, omitBackground: arka === "transparent", clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  };
  const tam = svg.replace('<svg ', '<svg width="1024" height="1024" ').replace(/rx="112" /, "");
  await ciz(tam, path.join(KOK, "kaynak", "ikon-1024.png"), "#1F6B5A");
  // Uyarlanabilir ikon ön planı: güvenli alan için %66 ölçek, arka plan ayrı renk katmanı
  const on = svg.replace('<svg ', '<svg width="1024" height="1024" ').replace(/<rect width="512" height="512" rx="112" fill="#1F6B5A"\/>/, "")
    .replace('viewBox="0 0 512 512"', 'viewBox="-132 -132 776 776"');
  await ciz(on, path.join(KOK, "kaynak", "ikon-on-plan-1024.png"));
  await b.close();
  execFileSync("python3", ["-I", path.join(__dirname, "ikon_boyutla.py"), KOK], { stdio: "inherit" });
})();
