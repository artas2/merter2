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
    "u-sezon": ["Sezonun Yıldızı", "efsanevi"],
    // Turnuva koleksiyonu (İstanbul ve Anadolu): yalnızca turnuva şampiyonlarına
    "t-galata": ["Galata Kulesi", "efsanevi"], "t-kizkulesi": ["Kız Kulesi", "efsanevi"], "t-ayasofya": ["Ayasofya", "efsanevi"], "t-bogaz": ["Boğaz Köprüsü", "efsanevi"],
    "t-bayrak": ["Al Bayrak ve Lale", "efsanevi"], "t-karadeniz": ["Karadeniz Çayı", "efsanevi"], "t-taskopru": ["Taş Köprü", "efsanevi"], "t-fistik": ["Antep Fıstığı", "efsanevi"],
    "t-baklava": ["Baklava", "efsanevi"], "t-zeugma": ["Zeugma Mozaiği", "efsanevi"], "t-demli": ["Demli Çay", "efsanevi"], "t-nazar": ["Nazar Boncuğu", "efsanevi"],
    "t-vapur": ["Vapur", "efsanevi"], "t-siluet": ["İstanbul Silueti", "efsanevi"], "t-lale": ["Lale", "efsanevi"]
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
  /* Turnuva koleksiyonu: gece mavisi zemin üzerinde çok renkli çizimler (48×48). Altın kurdele (G) koleksiyonun imzasıdır. */
  const G = `<path d="M7 40c6 4 28 4 34 0-6 1.5-28 1.5-34 0Z" fill="#E8B54A"/>`;
  const SU = y => `<path d="M4 ${y}c4-2 6-2 10 0s6 2 10 0 6-2 10 0 6 2 10 0v${44 - y}H4Z" fill="#2F6DB5"/><path d="M4 ${y + 3}c4-2 6-2 10 0s6 2 10 0 6-2 10 0 6 2 10 0" fill="none" stroke="#9CC9F0" stroke-width="1"/>`;
  const KOL = {
    "t-galata": `<circle cx="36" cy="11" r="4" fill="#F4D58A"/><path d="M17 40V19h14v21Z" fill="#D9C39A"/><path d="M15 19L24 5l9 14Z" fill="#7F93AE"/><path d="M15.5 19h17v2.5h-17Z" fill="#B49A6E"/>
      <path d="M19 24h2.4v4H19ZM22.8 24h2.4v4h-2.4ZM26.6 24h2.4v4h-2.4ZM20.5 31h2.4v4h-2.4ZM25 31h2.4v4H25Z" fill="#3B2A1A"/><path d="M24 2v4" stroke="#E8B54A" stroke-width="1.4"/>${G}`,
    "t-kizkulesi": `<circle cx="14" cy="13" r="7" fill="#F4C26B" opacity=".9"/>${SU(33)}<path d="M13 33h22v-6H13Z" fill="#D9C39A"/><path d="M15 27h6v-4h-6Z" fill="#C2554A"/><path d="M24 33V15h6v18Z" fill="#E6D6B2"/>
      <path d="M23 15l4-6 4 6Z" fill="#6E8299"/><path d="M27 9V3" stroke="#E8E8E8" stroke-width="1"/><path d="M27 3h5l-1.2 1.5L32 6h-5Z" fill="#E30A17"/><path d="M26 19h2v3h-2Z" fill="#3B2A1A"/>`,
    "t-ayasofya": `<path d="M30 6a6 6 0 1 0 4 10 5 5 0 1 1-4-10Z" fill="#F4D58A"/><path d="M11 38v-8h26v8Z" fill="#C98E6B"/><path d="M14 30a10 10 0 0 1 20 0Z" fill="#B87A5A"/><path d="M18 22a6 6 0 0 1 12 0Z" fill="#8FA0B4"/>
      <path d="M6 38V16l1-3 1 3v22ZM40 38V16l1-3 1 3v22ZM9.5 38V20l.8-2.5.8 2.5v18ZM36.5 38V20l.8-2.5.8 2.5v18Z" fill="#E6D6B2"/><path d="M15 33h3v5h-3ZM22.5 32h3v6h-3ZM30 33h3v5h-3Z" fill="#5A3622"/>${G}`,
    "t-bogaz": `${SU(34)}<path d="M4 29h40v2H4Z" fill="#C9CED6"/><path d="M14 34V10h2.5v24ZM31.5 34V10H34v24Z" fill="#E3E7EC"/><path d="M4 22Q15 30 15 11Q24 30 33 11Q33 30 44 22" fill="none" stroke="#E8B54A" stroke-width="1.3"/>
      <path d="M8 31h3v3H8ZM37 31h3v3h-3Z" fill="#8995A3"/><path d="M20 38h9l-1.5 2H21.5Z" fill="#fff"/>`,
    "t-bayrak": `<path d="M6 8c10-3 18 3 30 0 3 6 3 14 0 22-12 3-20-3-30 0Z" fill="#E30A17"/><circle cx="17" cy="19" r="6" fill="#fff"/><circle cx="18.6" cy="19" r="4.8" fill="#E30A17"/>
      <path d="M25 19l-3.4 1.1 2.1-2.9v3.6l-2.1-2.9Z" fill="#fff"/><path d="M33 44V32" stroke="#4E9A5B" stroke-width="1.6"/><path d="M33 40c-4 0-6-3-6-6 4 0 6 3 6 6ZM33 38c3 0 5-2 5-5-3 0-5 2-5 5Z" fill="#4E9A5B"/>
      <path d="M29 26c0 4 2 6 4 6s4-2 4-6l-2 2-2-4-2 4Z" fill="#D7263D"/>`,
    "t-karadeniz": `<path d="M2 26l9-12 6 7 7-11 9 12 6-5 7 9v18H2Z" fill="#3E8E57"/><path d="M24 10l3 4-3-1-3 1Z" fill="#fff"/><path d="M8 40c3 3 29 3 32 0Z" fill="#E7E2DA"/><path d="M8 40h32" stroke="#C8102E" stroke-width="1"/>
      <path d="M17 18h14l-1.5 6c-.8 3-.8 6 0 9l1.5 6H17l1.5-6c.8-3 .8-6 0-9Z" fill="#fff" opacity=".85"/><path d="M18.5 23h11l-.4 1.7c-.6 2.6-.6 5.6 0 8.3l1 5H18l1-5c.6-2.7.6-5.7 0-8.3Z" fill="#B3341F"/>`,
    "t-taskopru": `<path d="M4 28L18 8l7 9 5-5 14 16Z" fill="#7C8EA6"/><path d="M14 13.5L18 8l4 5-2-1-2 2-2-1Z" fill="#fff"/>${SU(36)}
      <path d="M2 30h44v4c-3 0-4 2-4 6h-4c0-5-3-7-6-7s-6 2-6 7h-4c0-5-3-7-6-7s-6 2-6 7H6c0-4-1-6-4-6Z" fill="#C9A77C"/><path d="M2 30h44" stroke="#8D7051" stroke-width="1"/>`,
    "t-fistik": `<path d="M10 16c6-8 18-10 26-4-8-1-18 1-26 4Z" fill="#3E8E57"/><path d="M30 10c6 2 10 6 12 12-6-3-10-6-12-12Z" fill="#5BAF6E"/>
      <path d="M8 30c0-8 7-12 13-10 4 2 6 8 2 14-5 6-15 4-15-4Z" fill="#E5CFA6"/><path d="M12 30c1-5 5-7 8-6 2 1 3 5 0 8-3 3-8 2-8-2Z" fill="#7CB342"/>
      <path d="M24 32c2-7 9-10 14-7 4 3 4 9-1 13-6 4-15 2-13-6Z" fill="#E5CFA6"/><path d="M28 32c1.5-4 5-5.5 7.5-4 2 1.6 2 5-.5 7-3.5 2.4-8 1-7-3Z" fill="#8BC34A"/><path d="M30 33c1.5-2 3-2.5 4.5-2" stroke="#C2185B" stroke-width="1" fill="none"/>`,
    "t-baklava": `<path d="M6 30l18-9 18 9-18 9Z" fill="#B6862E"/><path d="M6 30v4l18 9v-4ZM42 30v4l-18 9v-4Z" fill="#8A5E1C"/>
      <path d="M15 25.5l9 4.5 9-4.5M10.5 27.8l18 9M19.5 23.3l18 9M28.5 23.3l-18 9M37.5 27.8l-18 9" stroke="#F4D58A" stroke-width="1" fill="none"/>
      <circle cx="15" cy="30" r="1" fill="#7CB342"/><circle cx="24" cy="25.5" r="1" fill="#7CB342"/><circle cx="24" cy="34.5" r="1" fill="#7CB342"/><circle cx="33" cy="30" r="1" fill="#7CB342"/>
      <path d="M14 18v-7h4v2h3v-2h6v2h3v-2h4v7Z" fill="#B49A6E"/><path d="M22 18v-3h4v3Z" fill="#5A3622"/>`,
    "t-zeugma": `<path d="M8 8h32v32H8Z" fill="#C79B67"/><path d="M8 8h32v32H8Z" fill="none" stroke="#7A4E2A" stroke-width="2" stroke-dasharray="2 1.2"/>
      <path d="M24 13c6 0 9 5 9 10s-3 11-9 11-9-6-9-11 3-10 9-10Z" fill="#E8C9A0"/><path d="M15 21c0-7 4-10 9-10s9 3 9 10c-2-4-5-5-9-5s-7 1-9 5Z" fill="#6B3E1E"/>
      <path d="M19 22.5h3.6M25.4 22.5H29" stroke="#3B2A1A" stroke-width="1.6" stroke-linecap="round"/><path d="M24 24v4M21.5 30.5c1.6 1 3.4 1 5 0" stroke="#8D5A36" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M12 12h2v2h-2ZM34 12h2v2h-2ZM12 34h2v2h-2ZM34 34h2v2h-2Z" fill="#7A4E2A"/>`,
    "t-demli": `<path d="M24 44c-10 0-16-6-14-15 1 6 5 8 7 8-3-5-1-12 4-15-1 5 2 8 3 9 1-4 4-7 8-8-2 4-1 8 2 10 1-2 1-4 0-6 5 4 6 9 4 12-2 3-6 5-14 5Z" fill="#E8701A" opacity=".85"/>
      <path d="M17 14h14l-1.5 6c-.8 3-.8 6 0 9l1.5 6H17l1.5-6c.8-3 .8-6 0-9Z" fill="#fff" opacity=".9"/><path d="M18.5 19h11l-.4 1.7c-.6 2.6-.6 5.6 0 8.3l1 5H18l1-5c.6-2.7.6-5.7 0-8.3Z" fill="#9E2A17"/>
      <path d="M20 10c-1.5-2 1.5-3 0-5M24 10c-1.5-2 1.5-3 0-5M28 10c-1.5-2 1.5-3 0-5" stroke="#E6EEF5" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M12 38c3 2 21 2 24 0Z" fill="#E7E2DA"/>`,
    "t-nazar": `<path d="M24 3v6" stroke="#B08D57" stroke-width="1.6"/><circle cx="24" cy="5" r="2.4" fill="none" stroke="#B08D57" stroke-width="1.4"/><circle cx="24" cy="26" r="16" fill="#1B4FA8"/>
      <circle cx="24" cy="26" r="10.5" fill="#fff"/><circle cx="24" cy="26" r="7" fill="#6FB2EA"/><circle cx="24" cy="26" r="3.8" fill="#0B1426"/><circle cx="20" cy="21" r="2.6" fill="#fff" opacity=".55"/>`,
    "t-vapur": `<circle cx="34" cy="12" r="6" fill="#F4C26B" opacity=".9"/>${SU(35)}<path d="M5 29h38l-5 8H10Z" fill="#fff"/><path d="M6 31h36.5l-1.2 2H7.2Z" fill="#1B1B1B"/>
      <path d="M11 29v-6h24v6Z" fill="#F2F2F2"/><path d="M14 23v-4h16v4Z" fill="#E6E6E6"/><path d="M13 25h2.5v2H13ZM17.5 25H20v2h-2.5ZM22 25h2.5v2H22ZM26.5 25H29v2h-2.5ZM31 25h2.5v2H31Z" fill="#2F6DB5"/>
      <path d="M21 19v-6h4v6Z" fill="#E8B54A"/><path d="M21 13h4v2h-4Z" fill="#1B1B1B"/>`,
    "t-siluet": `<path d="M2 30h44v14H2Z" fill="#E98A3A" opacity=".35"/><circle cx="24" cy="24" r="12" fill="#F3B04B" opacity=".55"/>
      <path d="M8 34V14l1-3 1 3v20ZM38 34V14l1-3 1 3v20ZM13 34V18l.8-2.5.8 2.5v16ZM34 34V18l.8-2.5.8 2.5v16ZM15 34v-6h18v6ZM17 28a7 7 0 0 1 14 0Z" fill="#26304A"/><path d="M6 34h36v2H6Z" fill="#26304A"/>
      <path d="M14 44V38M34 44V38" stroke="#4E9A5B" stroke-width="1.4"/><path d="M11 38c0 3 1.5 4 3 4s3-1 3-4l-1.5 1.5L14 36.5l-1.5 3ZM31 38c0 3 1.5 4 3 4s3-1 3-4l-1.5 1.5L34 36.5l-1.5 3Z" fill="#D7263D"/>`,
    "t-lale": `<path d="M24 44V24" stroke="#3E8E57" stroke-width="2"/><path d="M24 42C14 42 9 33 9 26c8 1 13 7 15 16ZM24 42c10 0 15-9 15-16-8 1-13 7-15 16Z" fill="#4E9A5B"/>
      <path d="M15 12c0 9 4 14 9 14s9-5 9-14l-4.5 4L24 6l-4.5 10Z" fill="#D7263D"/><path d="M24 6l-4.5 10L24 26l4.5-10Z" fill="#F0525F"/><path d="M8 40c6 4 26 4 32 0" fill="none" stroke="#E8B54A" stroke-width="1.6"/>`
  };
  Object.assign(S, KOL);
  /* Mavi Öz simgesi: yontulmuş mavi damla */
  const OZ_SVG = `<svg class="bsk-oz" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1.5L19.5 11 12 22.5 4.5 11Z" fill="#2F7FD8"/><path d="M12 1.5L19.5 11H12ZM4.5 11H12v11.5Z" fill="#7CC0FF"/><path d="M12 1.5V11H4.5Z" fill="#B9E0FF"/><path d="M12 11h7.5L12 22.5Z" fill="#1B5FAE"/></svg>`;
  const oz = (miktar, o = {}) => `<span class="bsk-ozcip${o.sinif ? " " + o.sinif : ""}" title="Mavi Öz">${OZ_SVG}<b>${Number(miktar || 0).toLocaleString("tr-TR")}</b>${o.etiket === false ? "" : `<small>Mavi Öz</small>`}</span>`;

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
    return `<span class="bsk-av bsk-${h(x.cerceve)} bsk-n-${nadir(x.simge)}${KOL[x.simge] ? " bsk-kol" : ""}${o.sinif ? " " + o.sinif : ""}" style="--b:${b}px" role="img" aria-label="${h(ad(x.simge))} simgesi, ${h(ad(x.cerceve))} çerçeve">
      <span class="bsk-ic">${o.harf ? `<b>${h(o.harf)}</b>` : simge(x.simge)}</span></span>`;
  }
  const semboller = (kodlar, o = {}) => (kodlar || []).length ? `<span class="bsk-yler${o.sinif ? " " + o.sinif : ""}">${kodlar.map(c => `<span class="bsk-y bsk-n-${nadir(c)}" title="${h(ad(c))}" aria-label="${h(ad(c))}">${sembol(c)}</span>`).join("")}</span>` : "";
  const unvan = k => { const x = kimlikDuz(k); return x.unvanAd || ad(x.unvan); };

  const koleksiyonMu = kod => !!KOL[kod];
  kok.BS_SIMGE = { META, NADIR, S, Y, KOL, avatar, semboller, simge, sembol, unvan, ad, nadir, BAS, oz, OZ_SVG, koleksiyonMu };
})(typeof window !== "undefined" ? window : globalThis);
