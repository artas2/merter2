"use strict";
/* Arena ses efektleri: her ses 48 kHz'de işlenip ölçülür. Hedef: true peak ≤ -3 dBTP, anlık yükseklik ≤ -18 LUFS
   (arayüz sesi müzik/yayın referansı -14 LUFS'tan sessiz kalır) ve hiçbir ses sessiz değildir. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { olc, HEDEF, gercekTepe, anlikEnYuksek } = require("../scripts/ses-olc");

test("Ölçüm araçları: 997 Hz -20 dBFS sinüsün tepe ve yüksekliği beklenen aralıkta", () => {
  const x = new Float64Array(48000); for (let i = 0; i < x.length; i++) x[i] = 0.1 * Math.sin(2 * Math.PI * 997 * i / 48000);
  const tp = 20 * Math.log10(gercekTepe(x.subarray(0, 4800)));
  assert.ok(Math.abs(tp - -20) < 0.2, "true peak " + tp);
  const lu = anlikEnYuksek(x); // BS.1770: 997 Hz sinüs, tepe -20 dBFS → yaklaşık -23 LUFS (tek kanal, K-ağırlık ~ +0,7 dB)
  assert.ok(lu > -24 && lu < -22, "LUFS " + lu);
});

test("Her ses efekti hedef seviyede", { timeout: 120000 }, async () => {
  const l = await olc();
  assert.ok(l.length >= 12);
  for (const s of l) {
    assert.ok(s.truePeak <= HEDEF.truePeak, `${s.ad} true peak ${s.truePeak.toFixed(1)} dBTP`);
    assert.ok(s.anlikLufs <= HEDEF.anlikLufs, `${s.ad} ${s.anlikLufs.toFixed(1)} LUFS`);
    assert.ok(s.anlikLufs > -45, `${s.ad} duyulmayacak kadar kısık`);
  }
});
