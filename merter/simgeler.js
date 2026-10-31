"use strict";
/* Arena kimliği görselleri: simge (avatar), çerçeve, sembol ve unvan. Hepsi bu projeye özgü çizimlerdir
   (hiçbir oyundan görsel alınmadı). Kodlar ve adlar sunucudaki src/kazanim.js kataloğuyla aynıdır (test denetler).
   Kullanım: BS_SIMGE.avatar(kimlik, { boyut, harf }), BS_SIMGE.semboller(kodlar), BS_SIMGE.simge(kod), BS_SIMGE.sembol(kod). */
(function (kok) {
  const h = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* kod → [ad, nadirlik] */
  const META = {
    "s-damla": ["Damla", "siradan"], "s-hilal": ["Hilal", "siradan"], "s-yildiz": ["Sekiz Köşeli Yıldız", "nadir"], "s-cinar": ["Çınar Yaprağı", "nadir"],
    "s-kalkan": ["Kalkan", "nadir"], "s-simsek": ["Şimşek", "destansi"], "s-kandil": ["Kandil", "destansi"], "s-gul": ["Gül", "destansi"],
    "s-kule": ["Kule", "destansi"], "s-tac": ["Taç", "efsanevi"],
    "c-sade": ["Sade", "siradan"], "c-bronz": ["Bronz", "nadir"], "c-gumus": ["Gümüş", "destansi"], "c-altin": ["Altın", "efsanevi"],
    "c-zumrut": ["Zümrüt", "efsanevi"], "c-sezon": ["Sezon Defnesi", "efsanevi"],
    "y-ilk": ["İlk Adım", "siradan"], "y-ogrenci": ["Öğrenci", "siradan"], "y-kusursuz": ["Kusursuz", "nadir"], "y-seri5": ["Beşli Seri", "destansi"],
    "y-elli": ["Elli Maç", "nadir"], "y-turnuva": ["Turnuva Galibi", "nadir"], "y-alim": ["Âlim", "destansi"], "y-blok": ["Blok Zaferi", "destansi"],
    "y-podyum": ["Podyum", "efsanevi"],
    "u-komsu": ["Komşu", "siradan"], "u-merakli": ["Meraklı", "siradan"], "u-rakipsiz": ["Rakipsiz", "destansi"], "u-yildirim": ["Yıldırım", "destansi"],
    "u-bilge": ["Bilge", "destansi"], "u-usta": ["Arena Ustası", "destansi"], "u-blok": ["Blok Lideri", "efsanevi"], "u-sampiyon": ["Şampiyon", "efsanevi"],
    "u-sezon": ["Sezonun Yıldızı", "efsanevi"]
  };
  const NADIR = { siradan: "Sıradan", nadir: "Nadir", destansi: "Destansı", efsanevi: "Efsanevi" };

  /* Simgeler: 48×48, currentColor ile boyanır; açık ton katmanı (.a) hacim verir */
  const S = {
    "s-damla": `<path d="M24 5C24 5 38 21 38 30.5a14 14 0 0 1-28 0C10 21 24 5 24 5Z"/><path class="a" d="M18 27c0-4 3-9 5-12-1 5-1 9 1 13-2 2-6 2-6-1Z"/>`,
    "s-hilal": `<path d="M31 7.5A17 17 0 1 0 40.5 34 13.5 13.5 0 1 1 31 7.5Z"/><path class="a" d="M37 12l1.4 3 3.2.4-2.4 2.2.7 3.2-2.9-1.6-2.9 1.6.7-3.2-2.4-2.2 3.2-.4Z"/>`,
    "s-yildiz": `<path d="M24 4l5.9 8.6 10.2-2.6-2.6 10.2L46 24l-8.5 3.8 2.6 10.2-10.2-2.6L24 44l-5.9-8.6-10.2 2.6 2.6-10.2L2 24l8.5-3.8L7.9 10l10.2 2.6Z"/><circle class="a" cx="24" cy="24" r="7"/>`,
    "s-cinar": `<path d="M24 5l4 9 8-5-2 10 9 2-7 6 4 8-9-2-1 6h-12l-1-6-9 2 4-8-7-6 9-2-2-10 8 5Z"/><path class="a" d="M23 43V22l-7-6M24 26l8-7M24 31l-9-3M24 31l9-3" fill="none" stroke-width="1.8" stroke-linecap="round"/>`,
    "s-kalkan": `<path d="M24 4l16 6v12c0 10.5-6.6 18-16 22C14.6 40 8 32.5 8 22V10Z"/><path class="a" d="M24 9.5l11 4.2V22c0 7.6-4.5 13.5-11 16.6Z"/><path class="b" d="M17 21l7 6 7-6" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    "s-simsek": `<path d="M28 3L10 27h11l-4 18 21-27H27Z"/><path class="a" d="M26.5 7L15 23h6.5l2.5-3.8Z"/>`,
    "s-kandil": `<path d="M5 29c0 6 10 9 20 7.5 6-1 11-4 16-7.5-6-1.5-9-4-17-4-9 0-19 .5-19 4Z"/><path d="M18 36.5h12l3 5H15Z"/><path class="a" d="M38 25c-3.5-4-1.5-9 2-13 2.5 4.5 4 9 0 13Z"/><ellipse class="b" cx="17" cy="29" rx="7" ry="1.6"/>`,
    "s-gul": `<path d="M24 8c8 0 13 6 13 12.5S31.5 32 24 32s-13-5-13-11.5S16 8 24 8Z"/><path class="a" d="M24 13c4.5 0 7 3 7 6.5s-2.8 6-7 6c-3.6 0-5.6-2.3-5.6-5 0-2.4 1.8-4 4-4 1.8 0 3 1.1 3 2.6" fill="none" stroke-width="2.2" stroke-linecap="round"/><path d="M23 32v12M23 38c-5 0-9-2-11-6 5-.5 9 1.5 11 6ZM24 36c4-.2 7-2 8.5-5-4 0-7 1.7-8.5 5Z"/>`,
    "s-kule": `<path d="M12 44V17h4v-6h5v6h6v-6h5v6h4v27Z"/><path class="a" d="M20 44V35a4 4 0 0 1 8 0v9ZM16.5 22h4v5h-4ZM27.5 22h4v5h-4Z"/><path d="M23 4h6l-2 2.5L29 9h-6Z"/><path d="M23 4v7" stroke-width="1.6" fill="none"/>`,
    "s-tac": `<path d="M6 35L8 13l9 10 7-15 7 15 9-10 2 22Z"/><rect x="6" y="37" width="36" height="5" rx="2"/><circle class="a" cx="24" cy="27" r="3.4"/><circle class="a" cx="14.5" cy="29" r="2.3"/><circle class="a" cx="33.5" cy="29" r="2.3"/>`
  };
  /* Semboller: 24×24 rozet içi işaretler */
  const Y = {
    "y-ilk": `<path d="M7 21V4" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M7 4h11l-3 4 3 4H7Z"/>`,
    "y-ogrenci": `<path d="M3 6c3-1 6-1 9 1v13c-3-2-6-2-9-1ZM21 6c-3-1-6-1-9 1v13c3-2 6-2 9-1Z"/>`,
    "y-kusursuz": `<circle cx="12" cy="12" r="9" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke-width="2"/><circle cx="12" cy="12" r="1.8"/>`,
    "y-seri5": `<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9Z"/>`,
    "y-elli": `<circle cx="12" cy="12" r="10" fill="none" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="800" font-family="system-ui,sans-serif">50</text>`,
    "y-turnuva": `<path d="M7 3h10v5a5 5 0 0 1-10 0ZM7 5H3c0 3 1.5 5 4 5M17 5h4c0 3-1.5 5-4 5" stroke-width="1.6"/><path d="M11 13h2v4h3v3H8v-3h3Z"/>`,
    "y-alim": `<path d="M5 4h11a3 3 0 0 1 0 6H8v8a2 2 0 1 1-3 0Z"/><path d="M20 3c-4 2-7 6-8 11l1 1c5-1 8-5 7-12Z" opacity=".7"/>`,
    "y-blok": `<path d="M4 21V8l5-3v16M9 21V3h9v18M20 21H2" stroke-width="1.6"/><path d="M12 7h3v2h-3ZM12 11h3v2h-3ZM12 15h3v2h-3Z"/>`,
    "y-podyum": `<path d="M9 9h6v12H9ZM2 13h7v8H2ZM15 15h7v6h-7Z"/><path d="M12 2l1 2.2 2.4.3-1.8 1.6.5 2.4L12 7.3 9.9 8.5l.5-2.4-1.8-1.6 2.4-.3Z"/>`
  };

  const nadir = kod => (META[kod] || ["", "siradan"])[1];
  const ad = kod => (META[kod] || [kod])[0];
  const simge = kod => `<svg class="bsk-svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${S[kod] || S["s-damla"]}</svg>`;
  const sembol = kod => `<svg class="bsk-ysvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${Y[kod] || ""}</svg>`;
  const BAS = { simge: "s-damla", cerceve: "c-sade", semboller: [], unvan: "u-komsu" };
  const kimlikDuz = k => ({ ...BAS, ...(k || {}) });

  /* Çerçeveli avatar. harf verilirse simge yerine (ör. henüz yüklenmemişken) baş harf gösterilir. */
  function avatar(k, o = {}) {
    const x = kimlikDuz(k), b = o.boyut || 56;
    return `<span class="bsk-av bsk-${h(x.cerceve)} bsk-n-${nadir(x.simge)}${o.sinif ? " " + o.sinif : ""}" style="--b:${b}px" role="img" aria-label="${h(ad(x.simge))} simgesi, ${h(ad(x.cerceve))} çerçeve">
      <span class="bsk-ic">${o.harf ? `<b>${h(o.harf)}</b>` : simge(x.simge)}</span></span>`;
  }
  const semboller = (kodlar, o = {}) => (kodlar || []).length ? `<span class="bsk-yler${o.sinif ? " " + o.sinif : ""}">${kodlar.map(c => `<span class="bsk-y bsk-n-${nadir(c)}" title="${h(ad(c))}" aria-label="${h(ad(c))}">${sembol(c)}</span>`).join("")}</span>` : "";
  const unvan = k => { const x = kimlikDuz(k); return x.unvanAd || ad(x.unvan); };

  kok.BS_SIMGE = { META, NADIR, S, Y, avatar, semboller, simge, sembol, unvan, ad, nadir, BAS };
})(typeof window !== "undefined" ? window : globalThis);
