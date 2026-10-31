"use strict";
/* Turnuva masa oyunları: Satranç ve Tavla oyun ekranı. Kurallar ve saat sunucudadır; burası gösterir, dokunmayı hamleye çevirir.
   Taşlar ve tahta bu projeye özgü çizimlerdir. Arena (merter/arena.js) tarafından kullanılır:
   BS_OYUN.baglan({ api, ciz, ses, bildir, kapat, sg }), BS_OYUN.ac(id), BS_OYUN.view(), BS_OYUN.acikMi(). */
(function (kok) {
  const h = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let X = { api: null, ciz() {}, ses() {}, bildir() {}, kapat() {}, sg: () => null };
  const S = { id: null, g: null, t: 0, sec: null, terfi: null, teslimSor: false, hata: "", dongu: 0 };

  /* ---- Satranç taşları (45×45, kendi çizimimiz) ---- */
  const BASE = `<rect x="9" y="36" width="27" height="5" rx="2"/>`;
  const TAS = {
    P: `<circle cx="22.5" cy="13" r="6"/><path d="M15 36c0-8 3-11 4.5-14h6c1.5 3 4.5 6 4.5 14z"/>${BASE}`,
    R: `<path d="M13 36V18h19v18z"/><path d="M11 18V8h5v3h4V8h5v3h4V8h5v10z"/>${BASE}`,
    N: `<path d="M13 36c0-9 2-15 8-19l-4-5 2-5 5 3c8-1 14 6 13 17v9z"/><circle cx="26" cy="15" r="1.4" class="goz"/>${BASE}`,
    B: `<circle cx="22.5" cy="7.5" r="2.6"/><ellipse cx="22.5" cy="17" rx="5.5" ry="7.5"/><path d="M15 36c0-7 3-10 7.5-13 4.5 3 7.5 6 7.5 13z"/><path d="M22.5 11v7M19 14.5h7" class="cizgi"/>${BASE}`,
    Q: `<path d="M11 36 8 14l7.5 8L19 9l3.5 13L26 9l3.5 13 7.5-8-3 22z"/><circle cx="8" cy="12" r="2.2"/><circle cx="19" cy="7" r="2.2"/><circle cx="26" cy="7" r="2.2"/><circle cx="37" cy="12" r="2.2"/>${BASE}`,
    K: `<path d="M22.5 3v9M18.5 7h8" class="cizgi kalin"/><path d="M12 36c0-10 4-13 4-18h13c0 5 4 8 4 18z"/><rect x="15" y="14" width="15" height="5" rx="2"/>${BASE}`
  };
  const TAS_AD = { P: "piyon", R: "kale", N: "at", B: "fil", Q: "vezir", K: "şah" };
  const tasSvg = p => { const t = p.toUpperCase(), beyaz = p === t; return `<svg viewBox="0 0 45 45" class="oy-tas ${beyaz ? "beyaz" : "siyah"}" aria-hidden="true" focusable="false">${TAS[t]}</svg>`; };

  /* ---- Yardımcılar ---- */
  const dk = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const sunucuSimdi = () => S.g.simdi + (Date.now() - S.t);
  /* Bir tarafın kalan süresi (sayaç): sırası olanın saati, geri sayım bittikten sonra işler */
  function kalanMs(renk) {
    const g = S.g; let ms = g.sureler[renk];
    if (!g.bitti && g.sira === renk) ms -= Math.max(0, sunucuSimdi() - Math.max(g.simdi, g.baslangic || 0));
    return Math.max(0, ms);
  }
  const renkAd = r => (r === "b" ? "Beyaz" : "Siyah");

  /* ---- Görünüm ---- */
  function oyuncu(renk) {
    const g = S.g, p = renk === "b" ? g.beyaz : g.siyah, sg = X.sg(), ben = g.ben === renk, sirada = !g.bitti && g.sira === renk, ms = kalanMs(renk);
    return `<div class="oy-oyuncu${sirada ? " sirada" : ""}${ben ? " ben" : ""}">${sg ? sg.avatar(p.kimlik, { boyut: 40 }) : ""}
      <span class="oy-ad"><b>${h(p.ad)}${ben ? " (sen)" : ""}</b><small>${renkAd(renk)}${p.blok ? " · " + h(p.blok) + " Blok" : ""}</small></span>
      <span class="oy-saat${ms < 20000 ? " acil" : ""}" id="oySaat-${renk}" role="timer" aria-label="${renkAd(renk)} kalan süre">${dk(ms)}</span></div>`;
  }
  function satrancTahta() {
    const g = S.g, d = g.durum, ben = g.ben, ters = ben === "s", tahta = d.tahta, benSira = g.sira === ben && !g.bitti;
    const dosyalar = ters ? "hgfedcba" : "abcdefgh", siralar = ters ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const hedef = S.sec && d.hedefler[S.sec] ? d.hedefler[S.sec] : [], son = g.sonHamle ? [g.sonHamle.slice(0, 2), g.sonHamle.slice(2, 4)] : [];
    let sahKare = null; if (d.sah) { const k = d.tur === "b" ? "K" : "k"; const i = tahta.indexOf(k); if (i >= 0) sahKare = "abcdefgh"[i & 7] + (8 - (i >> 3)); }
    let x = "";
    for (const r of siralar) for (const f of dosyalar) {
      const kare = f + r, i = (8 - r) * 8 + "abcdefgh".indexOf(f), p = tahta[i] === "." ? null : tahta[i], koyu = ("abcdefgh".indexOf(f) + r) % 2 === 0;
      const tikla = benSira && (d.hedefler[kare] || hedef.includes(kare));
      const ad = `${kare}${p ? ", " + (p === p.toUpperCase() ? "beyaz " : "siyah ") + TAS_AD[p.toUpperCase()] : ""}${hedef.includes(kare) ? ", hamle yapılabilir" : ""}`;
      x += `<button type="button" class="oy-kare ${koyu ? "koyu" : "acik"}${S.sec === kare ? " sec" : ""}${hedef.includes(kare) ? " hedef" : ""}${son.includes(kare) ? " son" : ""}${sahKare === kare ? " sah" : ""}" data-oy="kare:${kare}" aria-label="${h(ad)}" ${benSira ? "" : "aria-disabled=\"true\""}>${p ? tasSvg(p) : ""}${hedef.includes(kare) && !p ? `<i class="nokta"></i>` : ""}${(r === siralar[siralar.length - 1]) ? `<span class="oy-etiket d">${f}</span>` : ""}${f === dosyalar[0] ? `<span class="oy-etiket s">${r}</span>` : ""}</button>`;
    }
    return `<div class="oy-tahta" role="group" aria-label="Satranç tahtası">${x}</div>`;
  }
  const zar = (n, aktif) => `<span class="oy-zar${aktif ? "" : " kullanildi"}" role="img" aria-label="zar ${n}${aktif ? "" : ", kullanıldı"}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="5"/>${({ 1: [[12, 12]], 2: [[7, 7], [17, 17]], 3: [[7, 7], [12, 12], [17, 17]], 4: [[7, 7], [17, 7], [7, 17], [17, 17]], 5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]], 6: [[7, 6.5], [17, 6.5], [7, 12], [17, 12], [7, 17.5], [17, 17.5]] })[n].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.9"/>`).join("")}</svg></span>`;
  function zarlar() {
    const d = S.g.durum; if (!d.zar) return "";
    const hepsi = d.zar[0] === d.zar[1] ? [d.zar[0], d.zar[0], d.zar[0], d.zar[0]] : d.zar.slice(), kalan = d.kalan.slice();
    return `<div class="oy-zarlar" aria-live="polite"><span class="oy-zarkim">${renkAd(d.tur)} attı</span>${hepsi.map(n => { const i = kalan.indexOf(n); if (i >= 0) { kalan.splice(i, 1); return zar(n, true); } return zar(n, false); }).join("")}</div>`;
  }
  function tavlaTahta() {
    const g = S.g, d = g.durum, ben = g.ben, benSira = g.sira === ben && !g.bitti;
    // Dikey tahta: benim evim sağ altta. Beyaz: sol şerit 12→23, sağ şerit 11→0 (yukarıdan aşağı); siyah: sol 11→0, sağ 12→23.
    const sol = ben === "b" ? Array.from({ length: 12 }, (_, i) => 12 + i) : Array.from({ length: 12 }, (_, i) => 11 - i);
    const sag = ben === "b" ? Array.from({ length: 12 }, (_, i) => 11 - i) : Array.from({ length: 12 }, (_, i) => 12 + i);
    const kaynak = S.sec, hedef = kaynak !== null && d.hedefler[kaynak] ? d.hedefler[kaynak] : [];
    const nokta = i => {
      const n = d.pts[i], renk = n > 0 ? "b" : n < 0 ? "s" : null, say = Math.abs(n), tikla = benSira && (d.hedefler[i] || hedef.includes(i));
      const pul = Array.from({ length: Math.min(say, 5) }, () => `<i class="oy-pul ${renk}"></i>`).join("") + (say > 5 ? `<b class="oy-say">${say}</b>` : "");
      const noktaNo = i + 1;
      return `<button type="button" class="oy-nokta${(i + (i < 12 ? 0 : 1)) % 2 ? " a" : " b"}${String(kaynak) === String(i) ? " sec" : ""}${hedef.includes(i) ? " hedef" : ""}${tikla ? " oynanir" : ""}" data-oy="nokta:${i}" aria-label="nokta ${noktaNo}, ${say ? say + " " + (renk === "b" ? "beyaz" : "siyah") + " pul" : "boş"}${hedef.includes(i) ? ", hamle yapılabilir" : ""}" ${benSira ? "" : "aria-disabled=\"true\""}><span class="oy-no">${noktaNo}</span><span class="oy-pullar">${pul}</span></button>`;
    };
    const barBen = d.bar[ben], barRakip = d.bar[ben === "b" ? "s" : "b"], offBen = d.off[ben], offRakip = d.off[ben === "b" ? "s" : "b"];
    const barHedef = d.hedefler.bar ? true : false, offHedef = hedef.includes("off");
    return `<div class="oy-tavla" role="group" aria-label="Tavla tahtası">
      <div class="oy-serit">${sol.map(nokta).join("")}</div>
      <div class="oy-serit">${sag.map(nokta).join("")}</div>
    </div>
    <div class="oy-yan">
      <button type="button" class="oy-bar${S.sec === "bar" ? " sec" : ""}${barHedef && benSira ? " oynanir" : ""}" data-oy="bar" aria-label="Bar: sende ${barBen} pul, rakipte ${barRakip}" ${benSira ? "" : "aria-disabled=\"true\""}><span>Bar</span><b>${barBen}</b><small>rakip ${barRakip}</small></button>
      <button type="button" class="oy-off${offHedef ? " hedef" : ""}" data-oy="off" aria-label="Topla: sende ${offBen} pul toplandı, rakipte ${offRakip}" ${offHedef ? "" : "aria-disabled=\"true\""}><span>Topla</span><b>${offBen}/15</b><small>rakip ${offRakip}/15</small></button>
    </div>`;
  }
  function not() {
    const g = S.g, d = g.durum; let x = "";
    if (g.oyun === "tavla" && d.son && d.son.pas && d.son.pas.length) x = d.son.pas.map(p => `${renkAd(p.renk)} oynayamadı, sıra geçti (zar ${p.zar.join("-")}).`).join(" ");
    if (g.oyun === "satranc" && d.sah && !g.bitti) x = `${renkAd(d.tur)} şahta!`;
    return x ? `<p class="ar-not" role="status">${h(x)}</p>` : "";
  }
  function sonuc() {
    const g = S.g; if (!g.bitti) return "";
    const t = g.sonuc === "ben" ? ["Kazandın!", "kazandi"] : g.sonuc === "rakip" ? ["Bu sefer olmadı", "kaybetti"] : ["Berabere", "berabere"];
    return `<div class="ar-son oy-son ${t[1]}" role="status"><h3>${t[0]}</h3><p class="lvl">${h(g.neden || "")}</p>
      ${g.yenidenOyun ? `<p class="ar-not">Turnuvada beraberlik olmaz: renkler değişerek yeniden oynanacak.</p>` : ""}
      <div class="ar-eylem">${g.yenidenOyun ? `<button type="button" class="ar-ana" data-oy="yeniOyun">Yeni oyuna geç</button>` : g.turnuvaMacId ? `<button type="button" class="ar-ana" data-oy="kapat">Turnuvaya dön</button>` : `<button type="button" class="ar-ana" data-oy="kapat">Arenaya dön</button>`}</div></div>`;
  }
  function terfiPenceresi() {
    if (!S.terfi) return "";
    const beyaz = S.g.ben === "b";
    return `<div class="oy-terfi" role="dialog" aria-modal="true" aria-label="Terfi taşı seç"><div><b>Piyon terfi: hangi taş?</b><div class="oy-terfiliste">${["Q", "R", "B", "N"].map(t => `<button type="button" data-oy="terfi:${t}" aria-label="${TAS_AD[t]}">${tasSvg(beyaz ? t : t.toLowerCase())}<small>${TAS_AD[t]}</small></button>`).join("")}</div>
      <button type="button" class="ar-hap" data-oy="terfiIptal">Vazgeç</button></div></div>`;
  }
  function view() {
    const g = S.g; if (!g) return `<div class="ar-bekle" aria-busy="true"><span></span><span></span><span></span></div>`;
    const ust = g.ben === "b" ? "s" : "b", alt = g.ben;
    const baslangic = g.baslangic && sunucuSimdi() < g.baslangic;
    const siraYazi = g.bitti ? "" : baslangic ? "Oyun birazdan başlıyor…" : g.sira === g.ben ? "Sıra sende" : "Rakip düşünüyor…";
    return `<div class="oy">
      <div class="oy-baslik"><span class="ar-etiket">${h(g.oyunAd)} · Turnuva${g.tekrar ? ` · yeniden oyun ${g.tekrar}` : ""}</span><span class="oy-sira${g.sira === g.ben && !g.bitti ? " ben" : ""}" aria-live="polite">${siraYazi}</span></div>
      ${oyuncu(ust)}
      ${g.oyun === "satranc" ? satrancTahta() : `${zarlar()}${tavlaTahta()}`}
      ${oyuncu(alt)}
      ${S.hata ? `<p class="ar-not hata" role="alert">${h(S.hata)}</p>` : ""}${not()}
      <p class="lvl oy-kural">Saat: her oyuncuya ${dk(g.oyun === "satranc" ? 300000 : 360000)} + hamle başına ${Math.round(g.artisMs / 1000)} sn. Süresi biten kaybeder.${g.oyun === "satranc" && g.sonHamle ? ` Son hamle: <b>${h(g.sonHamle)}</b>.` : ""}</p>
      ${sonuc()}
      ${!g.bitti ? (S.teslimSor ? `<div class="ar-eylem"><span class="lvl">Teslim olmak istiyor musun?</span><button type="button" class="ar-hap tehlike" data-oy="teslimEvet">Evet, teslim ol</button><button type="button" class="ar-hap" data-oy="teslimHayir">Vazgeç</button></div>` : `<div class="ar-eylem"><button type="button" class="ar-hap" data-oy="teslim">Teslim ol</button></div>`) : ""}
      ${terfiPenceresi()}</div>`;
  }

  /* ---- Akış ---- */
  const bekle = ms => new Promise(r => setTimeout(r, ms));
  function isle(g) {
    const onceki = S.g;
    S.g = g; S.t = Date.now();
    if (!onceki || onceki.sira !== g.sira || onceki.ver !== g.ver) { S.sec = null; S.terfi = null; }
    if (onceki && onceki.ver !== g.ver) {
      if (g.bitti && !onceki.bitti) X.ses(g.sonuc === "ben" ? "galibiyet" : g.sonuc === "rakip" ? "yenilgi" : "berabere");
      else if (g.sira === g.ben && onceki.sira !== g.sira) X.ses("tik");
      else if (g.oyun === "tavla" && onceki.durum.zar && JSON.stringify(onceki.durum.zar) !== JSON.stringify(g.durum.zar)) X.ses("tik");
    }
    if (g.bitti && g.yenidenOyun && !onceki?.bitti) setTimeout(yeniOyun, 3500);
    X.ciz();
  }
  async function dongu(id, d) {
    while (d === S.dongu && S.id === id) {
      try {
        const g = await X.api("GET", `/api/arena/oyun/${encodeURIComponent(id)}${S.g && S.g.id === id ? "?ver=" + S.g.ver : ""}`);
        if (d !== S.dongu) return;
        isle(g); if (g.bitti) return;
      } catch (e) {
        if (d !== S.dongu) return;
        if (e.status === 404 || e.status === 403) { S.hata = e.message; X.ciz(); return; }
        await bekle(1500);
      }
    }
  }
  function ac(id) { S.id = id; S.g = null; S.sec = null; S.terfi = null; S.hata = ""; S.teslimSor = false; const d = ++S.dongu; X.ciz(); dongu(id, d); }
  function kapat(x) { S.dongu++; const id = S.id; S.id = null; S.g = null; X.kapat(x, id); }
  /* Beraberlik sonrası: turnuvadaki yeni oyunu bul */
  async function yeniOyun() {
    if (!S.g || !S.id) return;
    try {
      const gid = S.g.turnuvaMacId; if (!gid) return kapat();
      for (let i = 0; i < 10; i++) {
        const r = await X.api("GET", "/api/arena/oyun-yeni/" + encodeURIComponent(S.id));
        if (r && r.id && r.id !== S.id) return ac(r.id);
        await bekle(500);
      }
      kapat("turnuva");
    } catch (e) { kapat("turnuva"); }
  }
  async function hamleYolla(govde) {
    S.hata = ""; const g = S.g;
    try { const yeni = await X.api("POST", `/api/arena/oyun/${encodeURIComponent(S.id)}/hamle`, govde); X.ses("kabul"); isle(yeni); }
    catch (e) { S.hata = e.message; S.sec = null; X.ciz(); }
    return g;
  }
  function tikla(a) {
    const g = S.g; if (!g) return;
    const [k, ...p] = a.split(":"), x = p.join(":");
    if (k === "kapat") return kapat("turnuva");
    if (k === "yeniOyun") return yeniOyun();
    if (g.bitti) return;
    const d = g.durum, benSira = g.sira === g.ben;
    if (k === "teslim") { S.teslimSor = true; return X.ciz(); }
    if (k === "teslimHayir") { S.teslimSor = false; return X.ciz(); }
    if (k === "teslimEvet") { S.teslimSor = false; return X.api("POST", `/api/arena/oyun/${encodeURIComponent(S.id)}/teslim`, {}).then(isle).catch(e => { S.hata = e.message; X.ciz(); }); }
    if (!benSira) return;
    if (k === "terfiIptal") { S.terfi = null; S.sec = null; return X.ciz(); }
    if (k === "terfi") { const t = S.terfi; S.terfi = null; return hamleYolla({ k: t.k, h: t.h, t: x }); }
    if (k === "kare") { // satranç
      if (S.sec && (d.hedefler[S.sec] || []).includes(x)) {
        const i = (8 - Number(S.sec[1])) * 8 + "abcdefgh".indexOf(S.sec[0]), tas = d.tahta[i];
        if ((tas === "P" && x[1] === "8") || (tas === "p" && x[1] === "1")) { S.terfi = { k: S.sec, h: x }; return X.ciz(); }
        return hamleYolla({ k: S.sec, h: x });
      }
      S.sec = d.hedefler[x] ? x : null; return X.ciz();
    }
    if (k === "nokta" || k === "bar" || k === "off") { // tavla
      const bar = d.bar[g.ben] > 0;
      if (k === "off") { if (S.sec !== null && (d.hedefler[S.sec] || []).includes("off")) return hamleYolla({ k: S.sec === "bar" ? "bar" : Number(S.sec), h: "off" }); return; }
      const hedefNo = k === "nokta" ? Number(x) : null;
      if (S.sec !== null && hedefNo !== null && (d.hedefler[S.sec] || []).includes(hedefNo)) return hamleYolla({ k: S.sec === "bar" ? "bar" : Number(S.sec), h: hedefNo });
      const kaynak = k === "bar" ? "bar" : Number(x);
      S.sec = d.hedefler[kaynak] ? kaynak : null; if (bar && k !== "bar" && d.hedefler.bar) S.hata = "Önce bardaki pulu oyuna sok."; else S.hata = ""; return X.ciz();
    }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-oy]"); if (b && S.id) { e.preventDefault(); if (b.getAttribute("aria-disabled") === "true" && !/^(teslim|kapat|yeniOyun)/.test(b.dataset.oy)) return; tikla(b.dataset.oy); } });
  /* Saat sayaçları: tüm ekranı yeniden çizmeden günceller */
  setInterval(() => {
    if (!S.id || !S.g || S.g.bitti) return;
    for (const r of ["b", "s"]) { const el = document.getElementById("oySaat-" + r); if (el) { const ms = kalanMs(r), v = dk(ms); if (el.textContent !== v) el.textContent = v; el.classList.toggle("acil", ms < 20000); } }
    if (S.g.baslangic && sunucuSimdi() >= S.g.baslangic && S.g.baslangic) { S.g = { ...S.g, baslangic: null }; X.ciz(); }
  }, 250);

  kok.BS_OYUN = { baglan: o => { X = { ...X, ...o }; }, ac, view, acikMi: () => !!S.id, kapat, TAS, tasSvg, dk };
})(typeof window !== "undefined" ? window : globalThis);
