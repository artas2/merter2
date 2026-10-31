"use strict";
/* Arena ses efektleri: dosya yok, hepsi cihazda Web Audio ile sentezlenir (lisans gerektirmez, indirme yok).
   Seviye: her ses 48 kHz'de ölçülür (scripts/ses-olc.js); hedef true peak ≤ -3 dBTP, ses başına yükseklik ≤ -18 LUFS
   (arayüz sesi müzikten sessiz kalsın diye; -14 LUFS müzik/yayın akışı referansıdır).
   Kullanım: BS_SES.cal("bulundu"), BS_SES.acik(), BS_SES.ayarla(false). Tercih bu cihazda saklanır. */
(function (kok) {
  const ANAHTAR = "bs-ses-acik";
  const ANA_KAZANC = 1.5; // ölçümle ayarlandı (scripts/ses-olc.js): en yüksek ses ≤ -3 dBTP ve ≤ -18 LUFS
  let ctx = null, acikMi = true;
  try { acikMi = kok.localStorage.getItem(ANAHTAR) !== "0"; } catch (e) { /* depolama yok: açık */ }

  /* Yapı taşları: zarflı ton, gürültü patlaması, perde kaydırma */
  function ton(c, hedef, t, frekans, sure, o = {}) {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.dalga || "sine"; osc.frequency.setValueAtTime(frekans, t);
    if (o.bitis) osc.frequency.exponentialRampToValueAtTime(o.bitis, t + sure);
    const tepe = o.seviye || 0.3, atak = o.atak || 0.006;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(tepe, t + atak);
    g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    osc.connect(g).connect(hedef); osc.start(t); osc.stop(t + sure + 0.02);
  }
  function gurultu(c, hedef, t, sure, o = {}) {
    const n = Math.max(1, Math.floor(c.sampleRate * sure)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let x = 12345; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; d[i] = (x / 0x3fffffff - 1) * (1 - i / n); }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = o.filtre || "bandpass"; f.frequency.value = o.frekans || 1800; f.Q.value = o.q || 1.2; g.gain.value = o.seviye || 0.2;
    s.connect(f).connect(g).connect(hedef); s.start(t);
  }
  const notalar = (c, h, t, l, ara, o) => l.forEach((f, i) => ton(c, h, t + i * ara, f, o.sure || 0.25, o));

  /* Sesler (t: başlangıç zamanı, h: çıkış düğümü) */
  const SESLER = {
    bulundu: (c, h, t) => { notalar(c, h, t, [784, 1175], 0.11, { sure: 0.32, seviye: 0.28, dalga: "triangle" }); ton(c, h, t + 0.22, 2350, 0.25, { seviye: 0.06 }); }, // rakip bulundu: yükselen iki nota
    kabul: (c, h, t) => { ton(c, h, t, 660, 0.09, { seviye: 0.36, bitis: 990 }); },
    tik: (c, h, t) => { gurultu(c, h, t, 0.035, { frekans: 2600, q: 4, seviye: 0.8 }); ton(c, h, t, 1400, 0.04, { seviye: 0.2 }); },
    basla: (c, h, t) => { gurultu(c, h, t, 0.35, { filtre: "lowpass", frekans: 900, seviye: 0.12 }); ton(c, h, t, 220, 0.4, { bitis: 880, seviye: 0.16, dalga: "triangle" }); },
    dogru: (c, h, t) => { notalar(c, h, t, [880, 1320], 0.07, { sure: 0.28, seviye: 0.24 }); },
    yanlis: (c, h, t) => { ton(c, h, t, 196, 0.22, { bitis: 147, seviye: 0.34, dalga: "triangle" }); },
    galibiyet: (c, h, t) => { notalar(c, h, t, [523, 659, 784, 1047], 0.1, { sure: 0.4, seviye: 0.22, dalga: "triangle" }); ton(c, h, t + 0.3, 2093, 0.5, { seviye: 0.05 }); },
    yenilgi: (c, h, t) => { notalar(c, h, t, [440, 330], 0.16, { sure: 0.35, seviye: 0.18, dalga: "triangle" }); },
    berabere: (c, h, t) => { notalar(c, h, t, [587, 587], 0.14, { sure: 0.25, seviye: 0.18, dalga: "triangle" }); },
    odul: (c, h, t) => { notalar(c, h, t, [1047, 1319, 1568, 2093], 0.06, { sure: 0.3, seviye: 0.16 }); gurultu(c, h, t + 0.05, 0.3, { filtre: "highpass", frekans: 6000, seviye: 0.05 }); },
    oz: (c, h, t) => { ton(c, h, t, 520, 0.16, { bitis: 1250, seviye: 0.26 }); ton(c, h, t + 0.09, 1600, 0.18, { seviye: 0.07 }); }, // Mavi Öz: damla sesi
    sure: (c, h, t) => { notalar(c, h, t, [392, 294], 0.13, { sure: 0.3, seviye: 0.16, dalga: "triangle" }); }
  };
  const SURE = { bulundu: 0.6, kabul: 0.15, tik: 0.1, basla: 0.5, dogru: 0.4, yanlis: 0.3, galibiyet: 0.9, yenilgi: 0.6, berabere: 0.45, odul: 0.6, oz: 0.35, sure: 0.5 };

  /* Ölçüm ve çalma için ortak: sesi verilen bağlamda kurar */
  function uret(c, ad, t = c.currentTime, cikis = c.destination) {
    const ana = c.createGain(); ana.gain.value = ANA_KAZANC; ana.connect(cikis);
    SESLER[ad](c, ana, t);
  }
  function baglam() {
    if (ctx) return ctx;
    const AC = kok.AudioContext || kok.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC({ latencyHint: "interactive" }); } catch (e) { ctx = null; }
    return ctx;
  }
  function cal(ad) {
    if (!acikMi || !SESLER[ad]) return;
    try { if (typeof document !== "undefined" && document.hidden) return; } catch (e) { /* yok */ }
    const c = baglam(); if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    try { uret(c, ad, c.currentTime + 0.01); } catch (e) { /* ses çalınamazsa sessiz geç */ }
  }
  /* Tarayıcılar sesi ilk dokunuştan sonra açar: bağlamı ilk dokunuşta hazırla */
  if (typeof document !== "undefined") {
    const ac = () => { const c = acikMi && baglam(); if (c && c.state === "suspended") c.resume().catch(() => {}); };
    document.addEventListener("pointerdown", ac, { once: true, capture: true });
  }
  function ayarla(v) { acikMi = !!v; try { kok.localStorage.setItem(ANAHTAR, acikMi ? "1" : "0"); } catch (e) { /* yok */ } if (acikMi) cal("kabul"); }
  kok.BS_SES = { cal, uret, ayarla, acik: () => acikMi, SESLER: Object.keys(SESLER), SURE, ANA_KAZANC };
})(typeof window !== "undefined" ? window : globalThis);
