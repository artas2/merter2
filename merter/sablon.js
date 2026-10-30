"use strict";
/* Merter Çınar Evleri arayüzünü tam bir HTML belgesine çevirir. Kaynak (merter/index.html) claude.ai artifact biçimindedir
   (gövde parçası); burada belge iskeleti, artifact'in sağladığı küçük CSS sıfırlaması, yerel yazı tipleri ve
   uyum katmanı eklenir. Hem sunucu (/m/, tarayıcı) hem mobil derleme (mobile/scripts/hazirla.js) bunu kullanır. */
const fs = require("node:fs");
const path = require("node:path");
const KAYNAK = path.join(__dirname, "index.html");

/* claude.ai artifact görüntüleyicisinin her sayfaya eklediği sıfırlama (arayüz buna göre yazıldı). */
const SIFIRLAMA = ":root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}";

function merterSayfasi({ kok = "/", csp = "", ayarJs = null, mobil = true } = {}) {
  let g = fs.readFileSync(KAYNAK, "utf8");
  const n0 = g.length;
  g = g.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n?/, "")
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/, `<link rel="stylesheet" href="${kok}fonts.css">`)
    .replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>', `<script src="${kok}vendor/marked.min.js"></script>`);
  if (/fonts\.googleapis|cdnjs\.cloudflare/.test(g) || g.length === n0) throw new Error("Merter şablonu: dış kaynak bağlantıları değiştirilemedi (kaynak biçimi değişmiş olabilir).");
  const ayar = ayarJs !== null ? `<script>${ayarJs}</script>` : `<script src="${kok}config.js"></script>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${csp ? `<meta http-equiv="Content-Security-Policy" content="${csp}">\n` : ""}<meta name="color-scheme" content="light dark">
<style>${SIFIRLAMA}</style>
<link rel="stylesheet" href="${kok}claude-uyum.css">
<link rel="stylesheet" href="${kok}yonetim.css">
<link rel="stylesheet" href="${kok}arena.css">
${ayar}
${mobil ? `<script src="${kok}kopru.js"></script>\n` : ""}<script src="${kok}native.js"></script>
<script src="${kok}claude-uyum.js"></script>
<script src="${kok}yonetim.js"></script>
<script src="${kok}arena.js"></script>
</head><body>
${g}
</body></html>
`;
}

/* Sayfanın ihtiyaç duyduğu ek dosyalar: yayınlanan yol -> kaynak dosya */
function merterDosyalari(depoKoku) {
  const m = __dirname, d = {};
  for (const f of ["claude-uyum.js", "claude-uyum.css", "yonetim.js", "yonetim.css", "arena.js", "arena.css", "fonts.css"]) d[f] = path.join(m, f);
  for (const f of fs.readdirSync(path.join(m, "fonts"))) d["fonts/" + f] = path.join(m, "fonts", f);
  for (const f of fs.readdirSync(path.join(m, "md"))) d["md/" + f] = path.join(m, "md", f);
  d["native.js"] = path.join(depoKoku, "public", "native.js");
  d["vendor/marked.min.js"] = require.resolve("marked/marked.min.js", { paths: [depoKoku] });
  return d;
}

module.exports = { merterSayfasi, merterDosyalari };
