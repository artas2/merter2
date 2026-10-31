"use strict";
/* Arena: bilgi kartları, canlı düello, sezon, turnuva ve sohbet + Gündem ve sohbette şikâyet/engel.
   Yalnızca Bilinçli Sakin sunucusuyla çalışır (telefon uygulaması ve /m/); claude.ai sayfasında yüklenmez.
   Durum sunucudadır; bu dosya gösterir, uzun yoklamayla dinler ve kullanıcı eylemlerini iletir.
   Gerektirir: native.js (BS), claude-uyum.js (BS_API, BS_ME), Merter arayüzü (render, current, toast). */
(function () {
  const api = (m, y, b) => window.BS_API(m, y, b);
  const h = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bildir = m => { try { if (typeof toast === "function") toast(m); } catch (e) { /* yok */ } };
  const acik = () => typeof current !== "undefined" && current === "arena";
  const KAT = { acil: "Acil durum", site: "Site yönetimi", komsuluk: "Komşuluk", tasarruf: "Tasarruf", alisveris: "Alışveriş", guvenlik: "Güvenlik" };
  const SEKME = [["kartlar", "Kartlar"], ["duello", "Düello"], ["kimlik", "Kimlik"], ["sezon", "Sezon"], ["turnuva", "Turnuva"], ["sohbet", "Sohbet"]];
  const SG = () => window.BS_SIMGE;
  const KTUR = [["simge", "Simgeler"], ["cerceve", "Çerçeveler"], ["sembol", "Semboller"], ["unvan", "Unvanlar"]];
  const turu = kod => ({ s: "simge", c: "cerceve", y: "sembol", u: "unvan" })[String(kod).charAt(0)];
  const A = { sekme: "kartlar", ozet: null, kartlar: null, kat: "", kartAcik: null, deneme: {}, siralama: null, turnuvalar: null, tur: null, turForm: false,
    mac: null, macId: null, esles: "yok", e: null, kimlik: null, benK: null, kTur: "simge", kisi: null, hata: "", sohbet: null, oda: "site", mesajlar: [], sonId: null, surum: 0, cevrimici: 0, yukleniyor: false };
  let fark = 0; // sunucu saati - cihaz saati

  function ciz() {
    if (!acik()) return;
    if (odakta()) { kismiCiz(); return; }
    const y = window.scrollY; render(false); window.scrollTo(0, y);
    const l = document.getElementById("arMesajlar"); if (l) l.scrollTop = l.scrollHeight;
  }
  /* Yazı yazılırken tüm ekran yeniden çizilmez (imleç ve klavye kaybolmasın) */
  function odakta() { const a = document.activeElement; return !!(a && a.matches && a.matches("input:not([type=checkbox]):not([type=radio]), textarea") && a.closest("#arGiris, .ar-form") && acik()); }
  function kismiCiz() {
    const l = document.getElementById("arMesajlar"); if (l) { l.innerHTML = mesajlarHtml(); l.scrollTop = l.scrollHeight; }
    const c = document.getElementById("arCevrim"); if (c) c.textContent = A.cevrimici;
  }
  const hataYaz = e => { A.hata = e && e.message ? e.message : String(e); if (e && e.alan === "premium") A.hata = ""; ciz(); };

  async function ozetYukle() { try { A.ozet = await api("GET", "/api/arena/ozet"); fark = A.ozet.simdi - Date.now(); if (A.ozet.ben.kimlik) A.benK = A.ozet.ben.kimlik; } catch (e) { A.hata = e.message; } ciz(); }
  async function kimlikYukle() {
    try { A.kimlik = await api("GET", "/api/arena/kimlik"); A.benK = { ...A.kimlik.secim, unvanAd: SG().ad(A.kimlik.secim.unvan) }; } catch (e) { A.hata = e.message; }
    ciz(); profilTazele();
  }
  const profilTazele = () => { try { if (typeof current !== "undefined" && current === "profil" && typeof render === "function") render(false); } catch (e) { /* yok */ } };
  async function sekmeYukle() {
    try {
      if (A.sekme === "kartlar" && !A.kartlar) A.kartlar = await api("GET", "/api/arena/kartlar");
      if (A.sekme === "sezon") A.siralama = await api("GET", "/api/arena/siralama");
      if (A.sekme === "kimlik") { await kimlikYukle(); return; }
      if (A.sekme === "turnuva") { A.turnuvalar = await api("GET", "/api/arena/turnuvalar"); fark = A.turnuvalar.simdi - Date.now(); }
      if (A.sekme === "sohbet" && A.ozet && A.ozet.premium) sohbetBaslat();
    } catch (e) { A.hata = e.message; }
    ciz();
  }

  /* ---------- Görünüm ---------- */
  function view() {
    if (!A.ozet) { setTimeout(ozetYukle, 0); setTimeout(sekmeYukle, 0); return `<section class="ar"><div class="ar-bekle" aria-busy="true"><span></span><span></span><span></span></div></section>`; }
    if (A.macId) return `<section class="ar">${macView()}</section>`;
    if (A.esles !== "yok") return `<section class="ar ar-eslesme">${A.hata ? `<p class="ar-not hata" role="alert">${h(A.hata)}</p>` : ""}${eslesView()}</section>`;
    const o = A.ozet;
    const ust = `<div class="ar-ust"><p class="eyebrow">${h(o.sezon.ad)} · ${kalan(o.sezon.bitis)} kaldı · <span class="ar-nokta"></span>${o.cevrimici} çevrim içi</p>
      <h2 class="title">Arena</h2>
      <div class="ar-ben">${SG() ? SG().avatar(A.benK || o.ben.kimlik, { boyut: 44 }) : ""}<span class="ar-unvan">${h(o.ben.unvan)}</span><b>${o.ben.puan}</b><small>puan${o.ben.sira ? ` · ${o.ben.sira}. sıra` : ""} · bugün ${o.ben.bugun}/${o.tavan}</small></div></div>
      <nav class="ar-sekme" role="tablist">${SEKME.map(([k, ad]) => `<button type="button" role="tab" aria-selected="${A.sekme === k}" data-ar="sekme:${k}">${ad}</button>`).join("")}</nav>`;
    const govde = A.sekme === "kartlar" ? kartlarView() : A.sekme === "duello" ? duelloView() : A.sekme === "kimlik" ? kimlikView() : A.sekme === "sezon" ? sezonView() : A.sekme === "turnuva" ? turnuvaView() : sohbetView();
    return `<section class="ar">${ust}${A.hata ? `<p class="ar-not hata" role="alert">${h(A.hata)}</p>` : ""}${govde}${A.kisi ? kisiKartView(A.kisi) : ""}</section>`;
  }
  const kalan = ms => { const d = Math.max(0, ms - (Date.now() + fark)), g = Math.floor(d / 864e5), s = Math.floor(d % 864e5 / 36e5), dk = Math.floor(d % 36e5 / 6e4); return g ? `${g} gün ${s} sa` : s ? `${s} sa ${dk} dk` : `${dk} dk`; };
  const kilit = baslik => `<div class="ar-kilit"><span class="ar-damla" aria-hidden="true"></span><h3>${h(baslik)} Premium'a dahildir</h3>
    <p>Komşularınızla canlı yarışma, sezon sıralaması, turnuvalar ve sohbet Premium ile açılır. Site yönetiminiz tüm sakinler için de açabilir. Bilgi kartlarını okumak her zaman ücretsizdir.</p>
    <button type="button" class="ar-ana" data-bshesap="premium">Premium'u incele</button></div>`;

  /* Kartlar */
  function kartlarView() {
    const K = A.kartlar; if (!K) return `<div class="ar-bekle"><span></span><span></span><span></span></div>`;
    const gunun = K.kartlar.find(k => k.id === K.gunun), l = K.kartlar.filter(k => !A.kat || k.k === A.kat);
    return `<p class="ar-ilerleme"><b>${K.ogrenilen}</b>/${K.toplam} kart öğrenildi <span class="ar-cubuk"><i style="width:${Math.round(K.ogrenilen / K.toplam * 100)}%"></i></span></p>
      ${gunun ? `<h3 class="ar-baslik">Günün kartı</h3>${kartHtml(gunun, true)}` : ""}
      <div class="ar-cip" role="group" aria-label="Konu"><button type="button" class="${!A.kat ? "on" : ""}" data-ar="kat:">Tümü</button>${Object.entries(KAT).map(([k, v]) => `<button type="button" class="${A.kat === k ? "on" : ""}" data-ar="kat:${k}">${v}</button>`).join("")}</div>
      <ul class="ar-kartlar">${l.filter(k => !gunun || k.id !== gunun.id || A.kat).map(k => `<li>${kartHtml(k, A.kartAcik === k.id)}</li>`).join("")}</ul>
      <p class="lvl">Kartlardaki acil numara ve kural bilgileri bilgilendirme amaçlıdır; güncel resmî kaynaktan doğrulayın.</p>`;
  }
  function kartHtml(k, acikMi) {
    const d = A.deneme[k.id];
    if (!acikMi) return `<button type="button" class="ar-kart kapali${k.ogrendi ? " ok" : ""}" data-ar="kart:${k.id}"><span class="ar-etiket">${h(KAT[k.k] || k.k)}</span><b>${h(k.baslik)}</b>${k.ogrendi ? `<span class="ar-tik" aria-label="Öğrenildi">✓</span>` : ""}</button>`;
    return `<article class="ar-kart${k.ogrendi ? " ok" : ""}"><span class="ar-etiket">${h(KAT[k.k] || k.k)}</span><h4>${h(k.baslik)}</h4><p>${h(k.bilgi)}</p>
      <div class="ar-deneme"><b>Kendini dene:</b> ${h(k.soru)}<div class="ar-sec">${k.sec.map((s, i) => `<button type="button" class="${d === undefined ? "" : i === k.d ? "dogru" : i === d ? "yanlis" : "soluk"}" data-ar="dene:${k.id}:${i}" ${d !== undefined ? "disabled" : ""}>${h(s)}</button>`).join("")}</div>
      ${d !== undefined ? `<p class="ar-not">${d === k.d ? (k.ogrendi ? "Doğru!" : "Doğru! Kart öğrenildi olarak işaretlendi.") : "Olmadı. Bilgiyi tekrar okuyup yeniden deneyin."}</p>${d !== k.d ? `<button type="button" class="ar-hap" data-ar="tekrar:${k.id}">Tekrar dene</button>` : ""}` : ""}</div></article>`;
  }

  /* ---------- Eşleşme ekranı: arama (süre sınırlı) → 10 sn onay → maç ---------- */
  const CEVRE = 339.29; // 2πr, r = 54
  const simdiS = () => Date.now() + fark;
  function halka(kalanMs, toplamMs, ic, sinif = "") {
    const oran = Math.max(0, Math.min(1, kalanMs / toplamMs));
    return `<div class="ar-halka ${sinif}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="iz" cx="60" cy="60" r="54"/>
      <circle id="arEsHalka" class="dolu" cx="60" cy="60" r="54" stroke-dasharray="${CEVRE}" stroke-dashoffset="${(CEVRE * (1 - oran)).toFixed(1)}" transform="rotate(-90 60 60)"/></svg><div class="ic">${ic}</div></div>`;
  }
  const oyuncu = (p, sinif) => p ? `<div class="ar-oyuncu ${sinif}">${SG().avatar(p.kimlik, { boyut: 76 })}<b>${h(p.ad)}</b>
    <small>${p.blok ? h(p.blok) + " Blok · " : ""}${h(SG().unvan(p.kimlik))}${p.puan != null ? ` · ${p.puan} puan` : ""}</small>${SG().semboller(p.kimlik && p.kimlik.semboller)}</div>` : "";
  function eslesView() {
    const e = A.e || {}, t = simdiS();
    if (A.esles === "bekliyor") {
      const kalanMs = Math.max(0, e.bitis - t), toplam = e.bitis - e.bas, gecen = t - e.bas;
      return `<div class="ar-esekran" aria-live="polite">
        <p class="eyebrow">Eşleştirme</p><h2 class="title">Rakip aranıyor</h2>
        ${e.not === "rakipYanitlamadi" ? `<p class="ar-not" role="status">Rakip süresinde yanıt vermedi. Puanı size en yakın sıradaki komşu aranıyor.</p>` : ""}
        ${halka(kalanMs, toplam, `<span class="ar-radar" aria-hidden="true"><i></i><i></i><i></i><span class="ar-damla"></span></span><b id="arEsSn">${Math.ceil(kalanMs / 1000)}</b><small>saniye</small>`, "arama")}
        <p class="lvl" id="arEsBilgi">${e.bekleyen > 1 ? `${e.bekleyen - 1} komşu daha sırada` : "Şu an sırada sizden başka kimse yok"} · ${e.cevrimici || 1} çevrim içi</p>
        <p class="lvl">Süre dolarsa arama durur; dilerseniz yeniden başlatabilirsiniz.</p>
        <div class="ar-eylem">${gecen >= 15000 ? `<button type="button" class="ar-ana" data-ar="antrenman">Beklerken antrenman yap</button>` : ""}<button type="button" class="ar-hap" data-ar="eslesIptal">Vazgeç</button></div></div>`;
    }
    if (A.esles === "teklif") {
      const kalanMs = Math.max(0, e.bitis - t);
      return `<div class="ar-esekran teklif" role="alertdialog" aria-labelledby="arTkB" aria-describedby="arTkA">
        <p class="eyebrow">Eşleşme bulundu</p><h2 class="title" id="arTkB">Rakibin hazır mı?</h2>
        <div class="ar-vsmini">${oyuncu(e.ben, "ben")}
          ${halka(kalanMs, e.kabulSureMs, `<b id="arEsSn">${Math.ceil(kalanMs / 1000)}</b><small>saniye</small>`, "onay")}
          ${oyuncu(e.rakip, "rakip")}</div>
        <p class="ar-durumlar"><span class="${e.benKabul ? "ok" : ""}">${e.benKabul ? "✓ Kabul ettin" : "Senin onayın bekleniyor"}</span><span class="${e.rakipKabul ? "ok" : ""}">${e.rakipKabul ? "✓ Rakip kabul etti" : "Rakibin onayı bekleniyor"}</span></p>
        ${e.benKabul ? `<p class="lvl">Rakibin onayı bekleniyor…</p>` : `<div class="ar-eylem"><button type="button" class="ar-ana ar-kabul" data-ar="kabul" autofocus>Kabul et</button><button type="button" class="ar-hap" data-ar="eslesIptal">Reddet</button></div>`}
        <p class="lvl" id="arTkA">${Math.round(e.kabulSureMs / 1000)} saniye içinde kabul edilmezse eşleşme düşer; kabul eden taraf puanı kendine en yakın sıradaki komşuyla eşleşir.</p></div>`;
    }
    const sure = A.esles === "sure";
    return `<div class="ar-esekran bitti" role="status">
      ${halka(0, 1, `<span class="ar-damla" aria-hidden="true"></span>`, "bos")}
      <h2 class="title">${sure ? "Süre doldu" : "Eşleşmeyi kaçırdın"}</h2>
      <p>${sure ? `${Math.round((e.sureMs || 60000) / 1000)} saniye içinde rakip bulunamadı. Biraz sonra yeniden deneyebilir ya da tek başına antrenman yapabilirsin.` : `Rakip bulundu ama ${Math.round((e.kabulSureMs || 10000) / 1000)} saniye içinde kabul etmedin. Rakibin sıradaki komşuya yönlendirildi.`}</p>
      <div class="ar-eylem"><button type="button" class="ar-ana" data-ar="esles">${sure ? "Tekrar dene" : "Yeniden ara"}</button><button type="button" class="ar-hap" data-ar="antrenman">Antrenman</button><button type="button" class="ar-hap" data-ar="eslesKapat">Arenaya dön</button></div></div>`;
  }
  function eslesTik() {
    if (A.esles !== "bekliyor" && A.esles !== "teklif") return;
    if (!acik() || !A.e) return;
    const e = A.e, t = simdiS(), kalanMs = Math.max(0, e.bitis - t), toplam = A.esles === "teklif" ? e.kabulSureMs : e.bitis - e.bas;
    const c = document.getElementById("arEsHalka"), sn = document.getElementById("arEsSn");
    if (c) c.setAttribute("stroke-dashoffset", (CEVRE * (1 - Math.max(0, Math.min(1, kalanMs / toplam)))).toFixed(1));
    if (sn) { const v = String(Math.ceil(kalanMs / 1000)); if (sn.textContent !== v) { sn.textContent = v; if (A.esles === "teklif" && kalanMs <= 3000) sn.parentNode.parentNode.classList.add("acil"); } }
    if (A.esles === "bekliyor" && t - e.bas >= 15000 && !document.querySelector('[data-ar="antrenman"]')) ciz();
  }
  setInterval(eslesTik, 200);
  let eslesDongu = 0;
  const titret = () => { try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { /* yok */ } };
  /* Sunucu yanıtını işler; bitiş durumunda (maç, süre, kaçırma, yok) true döner */
  function eslesIsle(r) {
    if (r.simdi) fark = r.simdi - Date.now();
    if (r.durum === "mac") { eslesDongu++; A.esles = "yok"; A.e = null; macAc(r.macId); return true; }
    const oncekiTeklif = A.esles === "teklif" && A.e ? A.e.teklifId : null;
    A.e = r; A.esles = r.durum === "yok" ? "yok" : r.durum;
    if (r.durum === "teklif" && r.teklifId !== oncekiTeklif) { titret(); bildir(`Rakip bulundu! ${Math.round(r.kabulSureMs / 1000)} saniye içinde kabul et.`); }
    ciz();
    if (r.durum === "teklif" && !r.benKabul) setTimeout(() => { const b = document.querySelector(".ar-kabul"); if (b && acik()) b.focus(); }, 50);
    return r.durum !== "bekliyor" && r.durum !== "teklif";
  }
  async function eslesBaslat() {
    const d = ++eslesDongu; A.hata = "";
    try {
      let r = await api("POST", "/api/arena/esles", {});
      while (d === eslesDongu) {
        if (eslesIsle(r)) return;
        r = await api("GET", "/api/arena/esles?bilinen=" + encodeURIComponent(r.anahtar || ""));
        if (d !== eslesDongu) return;
      }
    } catch (e) { if (d === eslesDongu) { A.esles = "yok"; hataYaz(e); } }
  }

  /* ---------- Arena kimliği: simge, çerçeve, sembol, unvan ---------- */
  const benAd = () => { try { return (typeof profil !== "undefined" && profil && profil.ad) ? String(profil.ad).trim() : "Sen"; } catch (e) { return "Sen"; } };
  function odulGorsel(kod, sec) {
    const t = turu(kod), x = { ...(sec || SG().BAS) };
    if (t === "simge") return SG().avatar({ ...x, simge: kod }, { boyut: 64 });
    if (t === "cerceve") return SG().avatar({ ...x, cerceve: kod }, { boyut: 64 });
    if (t === "sembol") return `<span class="bsk-y buyuk bsk-n-${SG().nadir(kod)}">${SG().sembol(kod)}</span>`;
    return `<span class="ar-unvanodul bsk-n-${SG().nadir(kod)}">${h(SG().ad(kod))}</span>`;
  }
  function kimlikView() {
    const K = A.kimlik; if (!K || !SG()) return `<div class="ar-bekle"><span></span><span></span><span></span></div>`;
    const sec = K.secim, benk = { ...sec, unvanAd: SG().ad(sec.unvan) }, ist = K.istatistik;
    const liste = K.katalog.filter(k => k.tur === A.kTur), sahip = liste.filter(k => k.var).length;
    const secili = k => A.kTur === "sembol" ? sec.semboller.includes(k.kod) : sec[A.kTur] === k.kod;
    return `<div class="ar-kimlikon">${SG().avatar(benk, { boyut: 112 })}
        <div><b class="ar-kad">${h(benAd())}</b><span class="ar-unvan">${h(benk.unvanAd)}</span>${SG().semboller(sec.semboller) || `<small class="lvl">Sembol seçilmedi (en çok 3)</small>`}</div>
        <p class="ar-kist"><span><b>${K.sahip}</b>/${K.toplam} ödül</span><span><b>${ist.galibiyet}</b> galibiyet</span><span><b>${ist.enSeri}</b> en uzun seri</span><span><b>${ist.kusursuz}</b> kusursuz</span></p></div>
      <p class="lvl">Ödülleri düello, kart, turnuva ve sezon sonuçlarına göre sunucu verir. Seçtiklerin sıralamada, eşleşme ekranında ve profil kartında görünür.</p>
      <nav class="ar-sekme ar-kt" role="tablist" aria-label="Ödül türü">${KTUR.map(([k, ad]) => `<button type="button" role="tab" aria-selected="${A.kTur === k}" data-ar="ktur:${k}">${ad}</button>`).join("")}</nav>
      <p class="ar-ilerleme"><b>${sahip}</b>/${liste.length} açıldı${A.kTur === "sembol" ? ` · ${sec.semboller.length}/3 seçili` : ""}</p>
      <ul class="ar-kgrid ${A.kTur}">${liste.map((k, i) => `<li style="--i:${i}"><button type="button" class="ar-kog bsk-n-${k.nadirlik}${k.var ? "" : " kilitli"}${secili(k) ? " secili" : ""}" data-ar="${k.var ? `sec:${k.kod}` : `kilit:${k.kod}`}" aria-pressed="${secili(k)}" aria-label="${h(k.ad)}, ${h(k.nadirlikAd)}${k.var ? (secili(k) ? ", seçili" : "") : ", kilitli: " + h(k.kosul)}">
        <span class="ar-kgor">${odulGorsel(k.kod, sec)}${k.var ? "" : `<span class="ar-kilitik" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10Zm2 0h6V7a3 3 0 0 0-6 0Z"/></svg></span>`}</span>
        <b>${h(k.ad)}</b><small class="ar-nadir">${h(k.nadirlikAd)}</small>${k.var ? (secili(k) ? `<small class="ar-secili">Kullanılıyor</small>` : "") : `<small class="ar-kosul">${h(k.kosul)}</small>`}</button></li>`).join("")}</ul>`;
  }
  async function kimlikSec(kod) {
    if (!A.kimlik) await kimlikYukle();
    const t = turu(kod), sec = A.kimlik.secim;
    let govde;
    if (t === "sembol") { const l = sec.semboller.includes(kod) ? sec.semboller.filter(x => x !== kod) : [...sec.semboller, kod].slice(-3); govde = { semboller: l }; }
    else govde = { [t]: kod };
    const yeni = await api("PUT", "/api/arena/kimlik", govde);
    A.kimlik.secim = yeni; A.benK = { ...yeni, unvanAd: SG().ad(yeni.unvan) };
    bildir(t === "sembol" ? "Semboller güncellendi." : `${SG().ad(kod)} kullanılıyor.`);
    ciz(); profilTazele();
  }
  /* Başka bir komşunun kartı (sıralamadan) */
  function kisiKartView(r) {
    return `<div class="ar-kisiperde" data-ar="kisiKapat"></div><div class="ar-kisikart" role="dialog" aria-modal="true" aria-label="${h(r.ad)} kartı">
      <button type="button" class="mini ar-kisikapat" data-ar="kisiKapat" aria-label="Kapat">✕</button>
      ${SG().avatar(r.kimlik, { boyut: 112 })}<h3>${h(r.ad)}</h3><span class="ar-unvan">${h(SG().unvan(r.kimlik))}</span>
      <p class="lvl">${r.blok ? h(r.blok) + " Blok · " : ""}${r.sira}. sıra · ${r.puan} puan · ${r.galibiyet}/${r.mac} galibiyet</p>
      ${SG().semboller(r.kimlik && r.kimlik.semboller, { sinif: "buyuk" }) || ""}</div>`;
  }

  /* Düello */
  function duelloView() {
    const o = A.ozet; if (!o.premium) return kilit("Canlı düello");
    let x = `<div class="ar-sahne">`;
    x += `<span class="ar-damla buyuk" aria-hidden="true"></span><h3>Rastgele bir komşuyla yarış</h3>
        <p>Rakip bulununca ikiniz de ${Math.round((o.kabulSureMs || 10000) / 1000)} saniye içinde "Kabul et" demelisiniz. 5 soru, soru başına 15 saniye; doğru ve hızlı cevap daha çok puan getirir. Kazandıkça simge, çerçeve, sembol ve unvan açılır.</p>
        <div class="ar-eylem"><button type="button" class="ar-ana" data-ar="esles">Rakip bul</button><button type="button" class="ar-hap" data-ar="antrenman">Tek başına antrenman</button></div>
        ${o.aktifMac ? `<button type="button" class="ar-hap" data-ar="macAc:${h(o.aktifMac)}">Süren maça dön</button>` : ""}`;
    x += `</div>`;
    if (o.gecmis && o.gecmis.length) x += `<h3 class="ar-baslik">Son maçlar</h3><ul class="ar-liste">${o.gecmis.map(g => `<li class="ar-satir"><span class="ar-sonuc ${g.sonuc}">${{ kazandi: "Galibiyet", kaybetti: "Yenilgi", berabere: "Berabere", antrenman: "Antrenman" }[g.sonuc]}</span><b>${g.puan}</b><small>${new Date(g.zaman).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></li>`).join("")}</ul>`;
    return x;
  }

  /* Maç ekranı */
  function macView() {
    const g = A.mac; if (!g) return `<div class="ar-bekle"><span></span><span></span><span></span></div>`;
    const simdi = Date.now() + fark;
    const skor = `<div class="ar-skor"><div class="ben"><small>Sen</small><b>${g.ben.puan}</b><span>${h(g.ben.ad)}</span></div><span class="ar-vs">${g.tur === "antrenman" ? "Antrenman" : g.tur === "turnuva" ? "Turnuva" : "VS"}</span>
      <div class="rakip"><small>${g.rakip ? h(g.rakip.blok ? g.rakip.blok + " Blok" : "Rakip") : "—"}</small><b>${g.rakip ? g.rakip.puan : "–"}</b><span>${g.rakip ? h(g.rakip.ad) : "Tek başına"}</span></div></div>`;
    let ic = "";
    if (g.durum === "geriSayim" && g.rakip && SG()) return `<div class="ar-vssahne" aria-live="polite">${oyuncu({ ...g.ben, puan: null }, "ben")}<span class="ar-vsorta"><small>VS</small><b id="arSayac">${Math.max(1, Math.ceil((g.t0 - simdi) / 1000))}</b></span>${oyuncu({ ...g.rakip, puan: null }, "rakip")}</div><p class="ar-vsnot">Hazır ol! İlk soru birazdan.</p>`;
    if (g.durum === "geriSayim") ic = `<div class="ar-geri"><span class="ar-damla buyuk"><b id="arSayac">${Math.max(1, Math.ceil((g.t0 - simdi) / 1000))}</b></span><p>Hazır ol!</p></div>`;
    else if (g.durum === "soru" && g.soru) {
      const s = g.soru, kalanMs = Math.max(0, s.bitis - simdi);
      ic = `<div class="ar-soru"><p class="ar-no">Soru ${s.no + 1}/${g.soruSayisi}</p><div class="ar-zaman"><i id="arZaman" style="width:${kalanMs / g.soruMs * 100}%"></i></div>
        <h3>${h(s.metin)}</h3><div class="ar-sec buyuk">${s.secenekler.map((t, i) => `<button type="button" class="${s.cevapladim ? (s.cevapladim.secim === i ? "secili" : "soluk") : ""}" data-ar="cevap:${s.no}:${i}" ${s.cevapladim ? "disabled" : ""}>${h(t)}</button>`).join("")}</div>
        <p class="lvl">${s.cevapladim ? "Cevabın alındı. " : ""}${g.rakip ? (s.rakipCevapladi ? "Rakip cevapladı." : "Rakip düşünüyor…") : ""}</p></div>`;
    } else if (g.gecmis.length && !g.bitti) {
      const s = g.gecmis[g.gecmis.length - 1];
      ic = `<div class="ar-soru"><p class="ar-no">Soru ${s.no + 1}/${g.soruSayisi} · sonuç</p><h3>${h(s.metin)}</h3><div class="ar-sec buyuk">${s.secenekler.map((t, i) => `<button type="button" disabled class="${i === s.dogru ? "dogru" : s.ben && s.ben.secim === i ? "yanlis" : "soluk"}">${h(t)}${s.rakip && s.rakip.secim === i ? ` <small class="ar-rk">rakip</small>` : ""}</button>`).join("")}</div>
        <p class="ar-not">${s.ben ? (s.ben.puan ? `+${s.ben.puan} puan` : "Yanlış") : "Süre doldu"}${g.rakip ? ` · Rakip: ${s.rakip ? (s.rakip.puan ? "+" + s.rakip.puan : "yanlış") : "cevap yok"}` : ""}</p><p class="lvl">${h(s.aciklama)}</p></div>`;
    }
    if (g.bitti) {
      const st = { ben: ["Kazandın!", "kazandi"], rakip: ["Bu sefer olmadı", "kaybetti"], berabere: [g.rakip ? "Berabere" : "Antrenman bitti", "berabere"] }[g.sonuc] || ["Bitti", ""];
      const yeni = (g.yeniKazanimlar || []).filter(k => SG() && SG().META[k]);
      const odul = yeni.length ? `<div class="ar-odul" role="status"><h4>${yeni.length > 1 ? "Yeni ödüller açıldı!" : "Yeni ödül açıldı!"}</h4><ul>${yeni.map((k, i) => `<li style="--i:${i}">${odulGorsel(k, A.benK)}<b>${h(SG().ad(k))}</b><small class="ar-nadir bsk-n-${SG().nadir(k)}">${h(SG().NADIR[SG().nadir(k)])}</small><button type="button" class="ar-hap" data-ar="sec:${k}">${turu(k) === "sembol" ? "Sembollere ekle" : "Kullan"}</button></li>`).join("")}</ul></div>` : "";
      ic = `<div class="ar-son ${st[1]}"><span class="ar-damla buyuk"><b>${g.ben.puan}</b></span><h3>${st[0]}</h3>${odul}
        <ol class="ar-ozet">${g.gecmis.map(s => `<li class="${s.ben && s.ben.puan ? "ok" : "x"}"><span>${s.no + 1}</span>${h(s.metin)}<small>Doğru: ${h(s.secenekler[s.dogru])}</small></li>`).join("")}</ol>
        <div class="ar-eylem">${g.turnuvaMacId ? `<button type="button" class="ar-ana" data-ar="macKapat:turnuva">Turnuvaya dön</button>` : `<button type="button" class="ar-ana" data-ar="yeniRakip">Yeni rakip</button>`}<button type="button" class="ar-hap" data-ar="macKapat">Arenaya dön</button></div></div>`;
    }
    return skor + ic;
  }
  function macTik() {
    if (!A.mac || !acik()) return;
    const simdi = Date.now() + fark, z = document.getElementById("arZaman"), s = document.getElementById("arSayac");
    if (z && A.mac.soru) z.style.width = Math.max(0, (A.mac.soru.bitis - simdi) / A.mac.soruMs * 100) + "%";
    if (s) s.textContent = Math.max(1, Math.ceil((A.mac.t0 - simdi) / 1000));
    if (A.mac.siradaki && simdi >= A.mac.siradaki + 150 && !A.macBekliyor) macCek();
  }
  setInterval(macTik, 200);
  let macDongu = 0;
  async function macAc(id) {
    A.macId = id; A.mac = null; A.esles = "yok"; const d = ++macDongu; ciz();
    while (d === macDongu && A.macId === id) {
      try {
        A.macBekliyor = true;
        const g = await api("GET", `/api/arena/mac/${encodeURIComponent(id)}${A.mac ? "?ver=" + A.mac.ver : ""}`);
        A.macBekliyor = false;
        if (d !== macDongu) return;
        fark = g.simdi - Date.now();
        const degisti = !A.mac || A.mac.ver !== g.ver || A.mac.durum !== g.durum;
        A.mac = g; if (degisti) ciz();
        if (g.bitti) { ozetYukle(); return; }
      } catch (e) { A.macBekliyor = false; A.hata = e.message; if (e.status === 404) { A.macId = null; ciz(); return; } await new Promise(r => setTimeout(r, 2000)); }
    }
  }
  async function macCek() { if (!A.macId) return; try { A.macBekliyor = true; const g = await api("GET", "/api/arena/mac/" + encodeURIComponent(A.macId)); fark = g.simdi - Date.now(); A.mac = g; ciz(); } catch (e) { /* döngü dener */ } A.macBekliyor = false; }

  /* Sezon */
  function sezonView() {
    const s = A.siralama; if (!s) return `<div class="ar-bekle"><span></span><span></span><span></span></div>`;
    const enCok = Math.max(1, ...s.bloklar.map(b => b.puan));
    return `<div class="ar-sezon"><div><small>${h(s.sezon.ad)}</small><b>${kalan(s.sezon.bitis)}</b><span>kaldı · ${s.katilan} oyuncu</span></div>
        <div class="ar-benkart"><span class="ar-unvan">${h(s.ben.unvan)}</span><b>${s.ben.puan}</b><small>${s.ben.sira ? s.ben.sira + ". sıra" : "Henüz puan yok"} · ${s.ben.galibiyet}/${s.ben.mac} galibiyet</small></div></div>
      <h3 class="ar-baslik">Blok savaşı</h3><p class="lvl">Her blokun en iyi 10 sakininin puanı toplanır.</p>
      ${s.bloklar.length ? `<ul class="ar-bloklar">${s.bloklar.map((b, i) => `<li style="--i:${i}"><span class="ar-blokad">${h(b.blok)}</span><span class="ar-blokcubuk"><i style="width:${Math.round(b.puan / enCok * 100)}%"></i></span><b>${b.puan}</b></li>`).join("")}</ul>` : `<p class="lvl">Bu sezon henüz puan yok. İlk puanı siz kazanın!</p>`}
      <h3 class="ar-baslik">Sıralama</h3>
      ${s.top.length ? `<ol class="ar-liste">${s.top.map((r, i) => `<li><button type="button" class="ar-satir ar-satirbtn${r.ben ? " ben" : ""}" data-ar="kisi:${i}" aria-label="${h(r.ad)} kartını aç, ${r.sira}. sıra, ${r.puan} puan"><span class="ar-sira">${r.sira}</span>${SG() ? SG().avatar(r.kimlik, { boyut: 38 }) : ""}<span class="ar-ad">${h(r.ad)}${r.blok ? ` <small>${h(r.blok)} Blok</small>` : ""}<small class="ar-aunvan">${h(SG() ? SG().unvan(r.kimlik) : r.unvan)}</small></span>${SG() ? SG().semboller(r.kimlik && r.kimlik.semboller, { sinif: "ar-ssem" }) : ""}<b>${r.puan}</b></button></li>`).join("")}</ol>` : `<p class="lvl">Henüz kimse puan almadı.</p>`}
      ${s.gecmisSezonlar && s.gecmisSezonlar.length ? `<h3 class="ar-baslik">Geçmiş sezonlar</h3><ul class="ar-liste">${s.gecmisSezonlar.map(g => `<li class="ar-satir"><span class="ar-ad">${h(g.ad)}</span><small>${g.ilk3.map(r => `${r.sira}. ${h(r.ad)}`).join(" · ") || "—"}</small></li>`).join("")}</ul>` : ""}`;
  }

  /* Turnuva */
  const tarihYazi = ms => new Date(ms).toLocaleString("tr-TR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const DURUM = { kayit: "Kayıt açık", oynaniyor: "Oynanıyor", bitti: "Bitti", iptal: "İptal" };
  function turnuvaView() {
    if (A.tur) return turDetayView();
    const T = A.turnuvalar; if (!T) return `<div class="ar-bekle"><span></span><span></span><span></span></div>`;
    let x = `<p class="lvl">Turnuvalar belirli saatlerde oynanır. Maç saatinden 5 dakika önce "Hazırım" deyin; iki taraf da hazırsa maç başlar. Maç saatinden 3 dakika sonra gelmeyen taraf turu kaybeder.</p>`;
    if (A.ozet.yonetim) x += A.turForm ? turFormHtml() : `<button type="button" class="ar-hap" data-ar="turForm">+ Turnuva oluştur</button>`;
    x += T.turnuvalar.length ? `<ul class="ar-liste">${T.turnuvalar.map(t => `<li><button type="button" class="ar-turkart ${t.durum}" data-ar="turAc:${t.id}"><span class="ar-etiket">${DURUM[t.durum]}</span><b>${h(t.ad)}</b>
      <small>${tarihYazi(t.baslangic)} · ${t.katilimci}/${t.maxKisi} kişi${t.katildim ? " · Kayıtlısınız" : ""}${t.sampiyon ? " · Şampiyon: " + h(t.sampiyon) : ""}</small></button></li>`).join("")}</ul>` : `<div class="ar-bos"><span class="ar-damla"></span><p>Planlanmış turnuva yok.${A.ozet.yonetim ? " Yukarıdan bir tane oluşturun." : " Site yönetimi duyurduğunda burada görünür."}</p></div>`;
    return x;
  }
  function turFormHtml() {
    const v = new Date(Date.now() + 864e5); v.setHours(21, 0, 0, 0);
    const yerel = new Date(v.getTime() - v.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    return `<form class="ar-form" onsubmit="return false"><h3>Yeni turnuva</h3>
      <label>Ad<input id="arTurAd" maxlength="60" placeholder="Ör. Cuma akşamı kupası"></label>
      <label>Başlangıç<input id="arTurBas" type="datetime-local" value="${yerel}"></label>
      <div class="ar-ikili"><label>Turlar arası (dk)<input id="arTurAra" inputmode="numeric" value="15"></label><label>En çok kişi<input id="arTurMax" inputmode="numeric" value="16"></label></div>
      <div class="ar-eylem"><button type="button" class="ar-ana" data-ar="turOlustur">Oluştur</button><button type="button" class="ar-hap" data-ar="turFormKapat">Vazgeç</button></div></form>`;
  }
  function turDetayView() {
    const d = A.tur, t = d.turnuva, simdi = Date.now() + fark;
    const turSay = Math.max(0, ...d.maclar.map(m => m.tur)) + 1, ad = r => (r === turSay - 1 ? "Final" : r === turSay - 2 ? "Yarı final" : r === turSay - 3 ? "Çeyrek final" : `${r + 1}. tur`);
    let x = `<button type="button" class="ar-hap" data-ar="turKapat">← Turnuvalar</button><div class="ar-turbas"><span class="ar-etiket">${DURUM[t.durum]}</span><h3>${h(t.ad)}</h3><p>${tarihYazi(t.baslangic)} · turlar arası ${Math.round(t.turAraligiMs / 6e4)} dk · ${d.katilimci}/${t.maxKisi} kişi</p>
      ${t.sampiyon ? `<p class="ar-sampiyon"><span class="ar-damla"></span>Şampiyon: <b>${h(t.sampiyon.ad)}</b>${t.sampiyon.blok ? ` (${h(t.sampiyon.blok)} Blok)` : ""}</p>` : ""}</div>`;
    if (t.durum === "kayit") {
      x += `<div class="ar-eylem">${A.ozet.premium ? (d.katildim ? `<button type="button" class="ar-hap" data-ar="turAyril:${t.id}">Kaydımı sil</button><span class="ar-not">Kayıtlısınız. Kura başlangıçtan 5 dk önce çekilir.</span>` : `<button type="button" class="ar-ana" data-ar="turKatil:${t.id}">Kayıt ol</button>`) : `<button type="button" class="ar-ana" data-bshesap="premium">Katılmak için Premium</button>`}
        ${A.ozet.yonetim ? `<button type="button" class="ar-hap tehlike" data-ar="turIptal:${t.id}">Turnuvayı iptal et</button>` : ""}</div>`;
    }
    const benim = d.maclar.find(m => m.benim && m.durum !== "bitti" && m.a && m.b);
    if (benim) {
      const ben = benim.a && benim.a.ben ? "a" : "b", hazirim = ben === "a" ? benim.aHazir : benim.bHazir, rakipHazir = ben === "a" ? benim.bHazir : benim.aHazir;
      const pencere = simdi >= benim.slot - d.hazirMs && simdi <= benim.slot + d.beklemeMs;
      x += `<div class="ar-benimmac"><h4>Sıradaki maçın · ${ad(benim.tur)}</h4><p><b>${h(benim[ben === "a" ? "b" : "a"].ad)}</b> ile · ${tarihYazi(benim.slot)}</p>
        ${benim.durum === "oynuyor" && benim.macId ? `<button type="button" class="ar-ana" data-ar="macAc:${h(benim.macId)}">Maça gir</button>`
          : hazirim ? `<p class="ar-not">Hazırsınız. ${rakipHazir ? "Rakip de hazır; maç saatinde başlar." : "Rakip bekleniyor."}</p>`
          : pencere ? `<button type="button" class="ar-ana" data-ar="hazir:${t.id}:${benim.id}">Hazırım</button>` : `<p class="lvl">"Hazırım" düğmesi maç saatinden 5 dakika önce açılır (${kalan(benim.slot - d.hazirMs)} sonra).</p>`}</div>`;
    }
    if (d.maclar.length) {
      x += `<div class="ar-agac">${[...Array(turSay).keys()].map(r => `<div class="ar-tur"><h4>${ad(r)}<small>${tarihYazi(d.maclar.find(m => m.tur === r).slot)}</small></h4>${d.maclar.filter(m => m.tur === r).map(m => `<div class="ar-esle ${m.durum}${m.benim ? " ben" : ""}">
        ${["a", "b"].map(k => `<span class="${m.kazanan === k ? "kazandi" : m.kazanan ? "eledi" : ""}">${m[k] ? h(m[k].ad) : m.durum === "bitti" ? "—" : "?"}${(k === "a" ? m.aHazir : m.bHazir) && m.durum === "bekle" ? ` <i class="ar-hazir" title="Hazır">●</i>` : ""}</span>`).join("")}
        ${m.neden && m.neden !== "oynandı" ? `<small>${h(m.neden)}</small>` : ""}</div>`).join("")}</div>`).join("")}</div>`;
    }
    return x;
  }
  let turDongu = 0;
  async function turAc(id) {
    const d = ++turDongu;
    try { A.tur = await api("GET", "/api/arena/turnuva/" + id); fark = A.tur.simdi - Date.now(); ciz(); } catch (e) { return hataYaz(e); }
    while (d === turDongu && A.tur && acik() && A.sekme === "turnuva" && !A.macId) {
      try {
        const yeni = await api("GET", `/api/arena/turnuva/${id}?bekle=1`);
        if (d !== turDongu) return;
        A.tur = yeni; fark = yeni.simdi - Date.now();
        const benim = yeni.maclar.find(m => m.benim && m.durum === "oynuyor" && m.macId);
        if (benim) { macAc(benim.macId); return; }
        ciz();
      } catch (e) { await new Promise(r => setTimeout(r, 3000)); }
    }
  }

  /* Sohbet */
  let sohbetDongu = 0;
  function sohbetView() {
    if (!A.ozet.premium) return kilit("Sohbet");
    const S = A.sohbet; if (!S) { setTimeout(sohbetBaslat, 0); return `<div class="ar-bekle"><span></span><span></span><span></span></div>`; }
    return `<div class="ar-sohbet"><div class="ar-cip">${S.odalar.map(o => `<button type="button" class="${A.oda === o.id ? "on" : ""}" data-ar="oda:${h(o.id)}">${h(o.ad)}</button>`).join("")}<span class="ar-cevrim" aria-label="Çevrim içi"><span class="ar-nokta"></span><span id="arCevrim">${A.cevrimici}</span> çevrim içi</span></div>
      ${S.odalar.length < 2 ? `<p class="lvl">Blok sohbeti için Profil'de blokunuzu seçin.</p>` : ""}
      <div class="ar-mesajlar" id="arMesajlar" role="log" aria-live="polite">${mesajlarHtml()}</div>
      ${S.susturma > Date.now() + fark ? `<p class="ar-not hata">Yönetim sohbete yazmanızı ${new Date(S.susturma).toLocaleString("tr-TR")} tarihine kadar kapattı.</p>`
        : `<form class="ar-yaz" onsubmit="return false"><input id="arGiris" maxlength="300" autocomplete="off" placeholder="Mesaj yazın…" aria-label="Mesaj"><button type="button" class="ar-ana" data-ar="gonder" aria-label="Gönder">Gönder</button></form>`}
      <p class="lvl">Saygılı olalım. Telefon numarası paylaşılırsa gizlenir. Uygunsuz mesajı ⋯ menüsünden şikâyet edebilir ya da kişiyi engelleyebilirsiniz.</p></div>`;
  }
  function mesajlarHtml() {
    const S = A.sohbet; if (!S) return "";
    const l = A.mesajlar.filter(m => !engelSet.has(m.kim));
    if (!l.length) return `<p class="ar-bosmesaj">Henüz mesaj yok. İlk merhabayı siz deyin.</p>`;
    return l.map(m => { const ben = m.kim === S.ben.kim; return `<div class="ar-balon${ben ? " ben" : ""}" data-id="${m.id}">${ben ? "" : `<b>${h(m.ad)}${m.blok ? ` <small>${h(m.blok)}</small>` : ""}</b>`}<p>${h(m.metin)}</p>
      <span class="ar-saat">${new Date(m.zaman).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
      <details class="ar-menu"><summary aria-label="Mesaj seçenekleri">⋯</summary><div>${ben || S.yonetim ? `<button type="button" data-ar="msjSil:${m.id}">Sil</button>` : ""}${ben ? "" : `<button type="button" data-sk="ac:mesaj:${m.id}:${h(m.kim)}">Şikâyet et</button><button type="button" data-sk="engel:${h(m.kim)}">Engelle</button>`}</div></details></div>`; }).join("");
  }
  let sohbetYukleniyor = false;
  async function sohbetBaslat() {
    if (sohbetYukleniyor) return; sohbetYukleniyor = true;
    try { A.sohbet = { ...(await api("GET", "/api/sohbet")) }; if (A.sohbet.sebepler) sebepler = A.sohbet.sebepler; } catch (e) { sohbetYukleniyor = false; return hataYaz(e); }
    sohbetYukleniyor = false;
    if (!A.sohbet.odalar.some(o => o.id === A.oda)) A.oda = "site";
    A.mesajlar = []; A.sonId = null; ciz(); sohbetDinle();
  }
  /* Önce canlı akış (SSE, tek bağlantı); açılamazsa uzun yoklama */
  let akisIptal = null;
  function sohbetIsle(r) {
    A.mesajlar = r.tam ? r.mesajlar : A.mesajlar.concat(r.mesajlar).slice(-200);
    A.sonId = r.sonId; A.surum = r.surum; if (r.cevrimici !== undefined) A.cevrimici = r.cevrimici;
    kismiCiz();
  }
  async function sohbetAkis(d, oda) {
    const BS = window.BS, ac = new AbortController(); akisIptal = ac;
    const r = await fetch(BS.url(`/api/sohbet/oda/${encodeURIComponent(oda)}/akis`), { headers: BS.baslik({}), credentials: BS.native ? "omit" : "same-origin", signal: ac.signal });
    if (r.status === 403) { const j = await r.json().catch(() => ({})); const e = new Error(j.hata || "Yetkiniz yok."); e.status = 403; throw e; }
    if (!r.ok || !r.body || !r.body.getReader) throw new Error("akış yok");
    const okur = r.body.getReader(), coz = new TextDecoder(); let tampon = "";
    while (d === sohbetDongu) {
      const { value, done } = await okur.read(); if (done) break;
      tampon += coz.decode(value, { stream: true });
      let i;
      while ((i = tampon.indexOf("\n\n")) >= 0) {
        const olay = tampon.slice(0, i); tampon = tampon.slice(i + 2);
        const veri = olay.split("\n").filter(l => l.startsWith("data: ")).map(l => l.slice(6)).join("\n");
        if (veri) sohbetIsle(JSON.parse(veri));
      }
    }
    try { ac.abort(); } catch (e) { /* kapalı */ }
  }
  async function sohbetDinle() {
    if (akisIptal) { try { akisIptal.abort(); } catch (e) { /* yok */ } akisIptal = null; }
    const d = ++sohbetDongu, oda = A.oda;
    let akisVar = typeof ReadableStream !== "undefined", hataSay = 0;
    while (d === sohbetDongu && acik() && A.sekme === "sohbet" && A.oda === oda) {
      try {
        if (akisVar) { await sohbetAkis(d, oda); hataSay = 0; if (d === sohbetDongu) await new Promise(r => setTimeout(r, 1000)); continue; }
        const q = A.sonId === null ? "" : `?sonra=${A.sonId}&surum=${A.surum}&bekle=1`;
        const r = await api("GET", `/api/sohbet/oda/${encodeURIComponent(oda)}${q}`);
        if (d !== sohbetDongu) return;
        if (r.tam || r.mesajlar.length) sohbetIsle(r); else A.cevrimici = r.cevrimici;
      } catch (e) {
        if (d !== sohbetDongu || (e && e.name === "AbortError")) return;
        if (e.status === 403) { A.hata = e.message; ciz(); return; }
        if (akisVar && ++hataSay >= 2) akisVar = false; // akış iki kez açılamadıysa uzun yoklamaya geç
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (akisIptal) { try { akisIptal.abort(); } catch (e) { /* yok */ } akisIptal = null; }
  }
  async function gonder() {
    const g = document.getElementById("arGiris"); if (!g || !g.value.trim()) return;
    const metin = g.value;
    try { await api("POST", `/api/sohbet/oda/${encodeURIComponent(A.oda)}`, { metin }); g.value = ""; A.hata = ""; }
    catch (e) { bildir(e.message); }
  }

  /* ---------- Eylemler ---------- */
  async function islem(a) {
    const [k, ...p] = a.split(":"), x = p.join(":");
    A.hata = "";
    try {
      if (k === "sekme") { A.sekme = x; A.tur = null; sohbetDongu++; turDongu++; if (akisIptal) { akisIptal.abort(); akisIptal = null; } ciz(); return sekmeYukle(); }
      if (k === "kat") { A.kat = x; return ciz(); }
      if (k === "kart") { A.kartAcik = A.kartAcik === x ? null : x; return ciz(); }
      if (k === "dene") {
        const [id, i] = [p[0], Number(p[1])], kart = A.kartlar.kartlar.find(z => z.id === id);
        A.deneme[id] = i; A.kartAcik = id;
        if (i === kart.d && !kart.ogrendi) {
          const r = await api("POST", `/api/arena/kart/${id}/ogrendim`, {}); kart.ogrendi = true; A.kartlar.ogrenilen++;
          const yeni = (r.yeniKazanimlar || []).filter(k => SG() && SG().META[k]);
          if (yeni.length) { bildir(`Yeni ödül: ${yeni.map(k => SG().ad(k)).join(", ")}. Kimlik sekmesinden kullanabilirsin.`); A.kimlik = null; }
          else if (r.puan) bildir(`+${r.puan} sezon puanı`); else if (r.not) bildir(r.not);
          ozetYukle();
        }
        return ciz();
      }
      if (k === "tekrar") { delete A.deneme[x]; return ciz(); }
      if (k === "esles" || k === "yeniRakip") { A.macId = null; A.mac = null; macDongu++; A.sekme = "duello"; return eslesBaslat(); }
      if (k === "eslesIptal") { eslesDongu++; A.esles = "yok"; A.e = null; ciz(); await api("DELETE", "/api/arena/esles"); return; }
      if (k === "eslesKapat") { eslesDongu++; A.esles = "yok"; A.e = null; return ciz(); }
      if (k === "kabul") {
        if (!A.e || !A.e.teklifId) return;
        const b = document.querySelector(".ar-kabul"); if (b) b.disabled = true;
        const r = await api("POST", "/api/arena/esles/kabul", { teklifId: A.e.teklifId });
        if (A.esles === "teklif" || r.durum === "mac") eslesIsle(r); return;
      }
      if (k === "antrenman") { eslesDongu++; A.esles = "yok"; A.e = null; const r = await api("POST", "/api/arena/antrenman", {}); return macAc(r.macId); }
      if (k === "ktur") { A.kTur = x; return ciz(); }
      if (k === "sec") return kimlikSec(x);
      if (k === "kilit") { const o = A.kimlik && A.kimlik.katalog.find(z => z.kod === x); if (o) bildir(`${o.ad}: ${o.kosul}`); return; }
      if (k === "kimlikAc") { A.sekme = "kimlik"; A.macId = null; if (location.hash !== "#arena") location.hash = "#arena"; else { ciz(); sekmeYukle(); } return; }
      if (k === "kisi") { A.kisi = A.siralama && A.siralama.top[Number(x)]; ciz(); const c = document.querySelector(".ar-kisikapat"); if (c) c.focus(); return; }
      if (k === "kisiKapat") { A.kisi = null; return ciz(); }
      if (k === "macAc") return macAc(x);
      if (k === "cevap") {
        const [no, i] = [Number(p[0]), Number(p[1])];
        if (A.mac && A.mac.soru && A.mac.soru.no === no) { A.mac.soru.cevapladim = { secim: i }; ciz(); }
        await api("POST", `/api/arena/mac/${encodeURIComponent(A.macId)}/cevap`, { soruNo: no, secim: i }); return;
      }
      if (k === "macKapat") { macDongu++; A.macId = null; A.mac = null; if (x === "turnuva") { A.sekme = "turnuva"; if (A.tur) turAc(A.tur.turnuva.id); } ozetYukle(); return ciz(); }
      if (k === "turForm") { A.turForm = true; return ciz(); }
      if (k === "turFormKapat") { A.turForm = false; return ciz(); }
      if (k === "turOlustur") {
        const v = id => (document.getElementById(id) || {}).value || "";
        await api("POST", "/api/arena/turnuvalar", { ad: v("arTurAd"), baslangic: new Date(v("arTurBas")).getTime(), turAraligiDk: Number(v("arTurAra")), maxKisi: Number(v("arTurMax")) });
        A.turForm = false; if (document.activeElement) document.activeElement.blur(); bildir("Turnuva oluşturuldu."); return sekmeYukle();
      }
      if (k === "turAc") return turAc(Number(x));
      if (k === "turKapat") { turDongu++; A.tur = null; return sekmeYukle(); }
      if (k === "turKatil") { await api("POST", `/api/arena/turnuva/${x}/katil`, {}); bildir("Kaydınız alındı."); return turAc(Number(x)); }
      if (k === "turAyril") { await api("DELETE", `/api/arena/turnuva/${x}/katil`, {}); return turAc(Number(x)); }
      if (k === "turIptal") { if (!confirm("Turnuva iptal edilsin mi? Bu geri alınamaz.")) return; await api("DELETE", `/api/arena/turnuva/${x}`, {}); turDongu++; A.tur = null; return sekmeYukle(); }
      if (k === "hazir") { await api("POST", `/api/arena/turnuva/${p[0]}/mac/${p[1]}/hazir`, {}); bildir("Hazır olduğunuz bildirildi."); return turAc(Number(p[0])); }
      if (k === "oda") { A.oda = x; A.mesajlar = []; A.sonId = null; ciz(); return sohbetDinle(); }
      if (k === "gonder") return gonder();
      if (k === "msjSil") { await api("DELETE", "/api/sohbet/mesaj/" + x, {}); return; }
    } catch (e) { hataYaz(e); }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-ar]"); if (b) { e.preventDefault(); islem(b.dataset.ar); } });
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "arGiris") { e.preventDefault(); gonder(); }
    if (e.key === "Escape" && A.kisi && acik()) { A.kisi = null; ciz(); }
  });
  window.addEventListener("hashchange", () => { if (location.hash === "#arena") { ozetYukle(); sekmeYukle(); } else { sohbetDongu++; turDongu++; if (akisIptal) { akisIptal.abort(); akisIptal = null; } } });

  /* ---------- Şikâyet ve engel (Gündem ve sohbet) ---------- */
  const engelSet = new Set();
  let sebepler = { taciz: "Taciz ya da hakaret", spam: "Spam ya da reklam", uygunsuz: "Uygunsuz içerik", kisisel: "Kişisel bilgi paylaşımı", diger: "Diğer" };
  async function engelYukle() { try { const r = await api("GET", "/api/engel"); engelSet.clear(); r.engeller.forEach(x => engelSet.add(x.kim)); } catch (e) { /* oturum yok */ } }
  function skPencere(tur, ref, kim) {
    let el = document.getElementById("arSk");
    if (!el) { el = document.createElement("div"); el.id = "arSk"; el.className = "hkdv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Şikâyet et"); document.body.appendChild(el); }
    el.innerHTML = `<div class="hkdvk ar-sk"><div class="hkdvb"><b>Şikâyet et</b><button type="button" class="mini" data-sk="kapat" aria-label="Kapat">✕</button></div>
      <p class="lvl">Şikâyetiniz site yönetimine iletilir; kimin bildirdiği içerik sahibine gösterilmez. Üç farklı komşu şikâyet ederse içerik hemen gizlenir.</p>
      <div class="ar-sebep" role="radiogroup">${Object.entries(sebepler).map(([k, v], i) => `<label><input type="radio" name="arSebep" value="${k}" ${i === 0 ? "checked" : ""}><span>${h(v)}</span></label>`).join("")}</div>
      <label class="ar-satirlabel">Açıklama (isteğe bağlı)<textarea id="arSkAciklama" maxlength="300" rows="2"></textarea></label>
      <label class="ar-onay"><input type="checkbox" id="arSkEngel"> Bu kişiyi de engelle (paylaşımlarını görmem)</label>
      <div class="ar-eylem"><button type="button" class="ar-ana" data-sk="gonder:${h(tur)}:${h(ref)}:${h(kim || "")}">Şikâyeti gönder</button><button type="button" class="ar-hap" data-sk="kapat">Vazgeç</button></div></div>`;
    el.hidden = false; const b = el.querySelector("input"); if (b) b.focus();
  }
  async function skIslem(a) {
    const [k, ...p] = a.split(":");
    const kapat = () => { const el = document.getElementById("arSk"); if (el) el.hidden = true; };
    try {
      if (k === "kapat") return kapat();
      if (k === "ac") { const [tur, ...r] = p, kim = r.pop(); return skPencere(tur, r.join(":"), kim); }
      if (k === "gonder") {
        const [tur, ...r] = p, kim = r.pop(), ref = r.join(":");
        const sebep = (document.querySelector('input[name="arSebep"]:checked') || {}).value, engelle = !!(document.getElementById("arSkEngel") || {}).checked;
        const s = await api("POST", "/api/sikayet", { tur, ref, sebep, aciklama: (document.getElementById("arSkAciklama") || {}).value || "", engelle });
        if (engelle && kim) engelSet.add(kim);
        kapat(); bildir(s.gizlendi ? "Teşekkürler. İçerik gizlendi ve yönetime iletildi." : "Teşekkürler. Şikâyetiniz yönetime iletildi.");
      } else if (k === "engel") {
        if (!confirm("Bu kişiyi engellemek istiyor musunuz? Paylaşımlarını ve mesajlarını görmezsiniz; düelloda eşleşmezsiniz.")) return;
        await api("POST", "/api/engel", { kim: p[0] }); engelSet.add(p[0]); bildir("Kişi engellendi.");
      }
      const y = window.scrollY; render(false); window.scrollTo(0, y);
    } catch (e) { bildir(e.message); }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-sk]"); if (b) { e.preventDefault(); skIslem(b.dataset.sk); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { const el = document.getElementById("arSk"); if (el && !el.hidden) el.hidden = true; } });

  window.BS_SIKAYET = {
    engelli: kim => engelSet.has(kim),
    menu: (tur, ref, kim) => `<button type="button" class="mini" data-sk="ac:${h(tur)}:${h(ref)}:${h(kim)}">Şikâyet et</button><button type="button" class="mini" data-sk="engel:${h(kim)}">Bu kişiyi engelle</button>`,
    yorumDugme: (ref, kim) => ` <button type="button" class="ys" data-sk="ac:yorum:${h(ref)}:${h(kim)}" aria-label="Yorumu şikâyet et" title="Şikâyet et">⚑</button>`
  };
  let kimlikIstendi = false;
  window.BS_ARENA = {
    view, odakta,
    /* Profil kartı (Kartım): arena simgesi + çerçeve, unvan ve semboller */
    profilAvatar: harf => {
      if (!SG()) return "";
      if (!A.benK && !kimlikIstendi) { kimlikIstendi = true; kimlikYukle(); }
      return `<div class="ok-av-arena">${SG().avatar(A.benK, { boyut: 104, harf: A.benK ? "" : harf })}</div>`;
    },
    profilKimlik: () => {
      if (!SG() || !A.benK) return "";
      return `<div class="ok-arena"><span class="ok-arena-unvan">Arena · ${h(SG().unvan(A.benK))}</span>${SG().semboller(A.benK.semboller)}
        <button type="button" class="ok-arena-dzn" data-ar="kimlikAc">Kimliğini düzenle</button></div>`;
    },
    kart: () => `<a class="hcard link ar-giriskart" href="#arena"><div class="hhead"><span class="ar-damla kucuk" aria-hidden="true"></span><h3>Arena</h3></div>
      <p class="big">Bilgi kartlarıyla komşularınızla yarışın</p><p class="meta">Düello · sezon sıralaması · blok savaşı · turnuva · sohbet</p></a>`
  };
  /* Oturum açılınca engel listesini yükle (Gündem filtresi için) */
  if (window.claude && claude.use) claude.use("user").then(() => engelYukle().then(() => { if (typeof render === "function") { try { render(false); } catch (e) { /* henüz hazır değil */ } } })).catch(() => {});
})();
