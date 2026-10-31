"use strict";
/* Arena ses efektlerinin seviye ölçümü: her ses tarayıcıda 48 kHz OfflineAudioContext ile işlenir, sonra burada ölçülür.
   - Örnek tepe (dBFS) ve true peak (dBTP, 4 kat aşırı örnekleme, pencereli sinc ara değerleme; ITU-R BS.1770-4 Ek 2 yaklaşımı)
   - Anlık yükseklik (LUFS, 400 ms pencere, 100 ms adım, K-ağırlıklı; BS.1770-4 48 kHz katsayıları). Ses 400 ms'den kısa
     olduğundan bütünleşik (gated) yükseklik yerine en yüksek anlık değer verilir.
   Kullanım: node scripts/ses-olc.js   (hedef dışıysa çıkış kodu 1) */
const fs = require("node:fs");
const path = require("node:path");

const HEDEF = { truePeak: -3, anlikLufs: -18 };
const FS = 48000;

function biquad(x, b, a) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}
function kAgirlik(x) {
  const s1 = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
  return biquad(s1, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
}
const db = v => v > 0 ? 20 * Math.log10(v) : -Infinity;
function ornekTepe(x) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return m; }
function gercekTepe(x, kat = 4, yari = 16) {
  let m = ornekTepe(x);
  for (let i = 0; i < x.length; i++) for (let k = 1; k < kat; k++) {
    const t = i + k / kat; let s = 0;
    for (let j = Math.floor(t) - yari + 1; j <= Math.floor(t) + yari; j++) {
      if (j < 0 || j >= x.length) continue;
      const d = t - j, sinc = d === 0 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d), w = 0.5 * (1 + Math.cos(Math.PI * d / yari));
      s += x[j] * sinc * w;
    }
    m = Math.max(m, Math.abs(s));
  }
  return m;
}
function anlikEnYuksek(x) {
  const k = kAgirlik(x), pencere = Math.round(0.4 * FS), adim = Math.round(0.1 * FS); let enYuksek = -Infinity;
  for (let bas = 0; bas + pencere <= k.length; bas += adim) {
    let t = 0; for (let i = bas; i < bas + pencere; i++) t += k[i] * k[i];
    const ms = t / pencere; if (ms > 0) enYuksek = Math.max(enYuksek, -0.691 + 10 * Math.log10(ms));
  }
  return enYuksek;
}

async function olc() {
  const { chromium } = require("playwright");
  const kod = fs.readFileSync(path.join(__dirname, "..", "merter", "ses.js"), "utf8");
  const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent("<!doctype html><html><body></body></html>");
  await p.addScriptTag({ content: kod });
  const sonuc = await p.evaluate(async fs => {
    const out = {};
    for (const ad of BS_SES.SESLER) {
      const sure = Math.max(0.5, BS_SES.SURE[ad] + 0.1), c = new OfflineAudioContext(1, Math.ceil(sure * fs), fs);
      BS_SES.uret(c, ad, 0, c.destination);
      out[ad] = Array.from((await c.startRendering()).getChannelData(0));
    }
    return out;
  }, FS);
  await b.close();
  return Object.entries(sonuc).map(([ad, veri]) => {
    const x = Float64Array.from(veri);
    return { ad, ornekTepe: db(ornekTepe(x)), truePeak: db(gercekTepe(x)), anlikLufs: anlikEnYuksek(x) };
  });
}

if (require.main === module) {
  olc().then(l => {
    const r = v => (Number.isFinite(v) ? v.toFixed(1) : "-inf").padStart(7);
    console.log("ses        örnek tepe  true peak  anlık en yüksek\n           (dBFS)      (dBTP)     (LUFS, 400 ms)");
    for (const s of l) console.log(`${s.ad.padEnd(10)} ${r(s.ornekTepe)}     ${r(s.truePeak)}    ${r(s.anlikLufs)}`);
    const tp = Math.max(...l.map(s => s.truePeak)), lu = Math.max(...l.map(s => s.anlikLufs));
    console.log(`\nEn yüksek true peak ${tp.toFixed(1)} dBTP (hedef ≤ ${HEDEF.truePeak}); en yüksek anlık ${lu.toFixed(1)} LUFS (hedef ≤ ${HEDEF.anlikLufs}).`);
    process.exit(tp <= HEDEF.truePeak && lu <= HEDEF.anlikLufs ? 0 : 1);
  }).catch(e => { console.error(e); process.exit(2); });
}
module.exports = { olc, HEDEF, gercekTepe, anlikEnYuksek, kAgirlik };
