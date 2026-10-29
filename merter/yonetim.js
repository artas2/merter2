"use strict";
/* Davetler ve üyeler: site yöneticisinin uygulama içindeki ekranı (#davetler).
   Yalnızca Bilinçli Sakin sunucusuyla (telefon uygulaması ve /m/) çalışır; claude.ai sayfasında bu dosya yüklenmez.
   Tasarım: damla ve kabarcık biçimleri, yumuşak geçişler; hareket azaltma tercihinde animasyon yok.
   Gerektirir: native.js (BS), claude-uyum.js (BS_API, BS_ME), Merter arayüzü (render, current, esc). */
(function () {
  const BS = window.BS;
  const api = (m, y, b) => window.BS_API(m, y, b);
  const h = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ROL = { sakin: "Sakin", site_denetci: "Denetçi", site_yonetici: "Yönetici" };
  const ROL_ACIKLAMA = { sakin: "Profil, sepet, gündem ve hizmetler", site_denetci: "Sakinleri ve siparişleri görür, değiştiremez", site_yonetici: "Her şeyi yönetir, davet üretir" };
  const S = { sekme: "davet", davetler: null, uyeler: null, hata: "", durum: "", yeni: null, form: { rol: "sakin", max: 50, gun: 14, aciklama: "" }, iptalSor: null, cikarSor: null, mesgul: false, yukleniyor: false };

  const acik = () => typeof current !== "undefined" && current === "davetler";
  const yenidenCiz = () => { if (acik()) { const y = window.scrollY; render(false); window.scrollTo(0, y); } };
  async function yukle() {
    if (S.yukleniyor) return; S.yukleniyor = true;
    try {
      const [d, u, sk] = await Promise.all([api("GET", "/api/yonetim/davetler"), api("GET", "/api/yonetim/uyeler"), api("POST", "/api/db", { op: "koleksiyon", yol: "sakinler" }).catch(() => ({ belgeler: [] }))]);
      S.davetler = d.davetler; S.uyeler = u.uyeler; S.adlar = Object.fromEntries(sk.belgeler.map(b => [b.id, (b.veri && b.veri.ad) || ""])); S.hata = "";
    } catch (e) { S.hata = e.message; S.davetler = S.davetler || []; S.uyeler = S.uyeler || []; }
    S.yukleniyor = false; yenidenCiz();
  }
  const davetBaglanti = kod => BS.url("/s/" + encodeURIComponent(kod));
  const site = () => (window.BS_ME && BS_ME() && BS_ME().aktifSite && BS_ME().aktifSite.ad) || "sitemiz";
  const paylasMetni = d => `${site()} uygulamasına davetlisiniz.\nDavet kodu: ${d.kod}\nUygulamayı açın, telefonunuzla giriş yapın ve kodu girin.\nKısa kılavuz: ${davetBaglanti(d.kod)}`;
  const kalanGun = ms => Math.max(0, Math.ceil((ms - Date.now()) / 864e5));
  const adi = u => (S.adlar && S.adlar[u.kimlik]) || "";

  /* Doluluk damlası: kullanım oranı damlanın içindeki sıvı seviyesi olarak gösterilir */
  const damla = (oran, etiket) => `<span class="dm-damla" style="--dolu:${Math.round(Math.min(1, Math.max(0, oran)) * 100)}%" role="img" aria-label="${h(etiket)}"><i></i></span>`;

  function gorunum() {
    if (S.davetler === null && !S.yukleniyor) setTimeout(yukle, 0);
    const ust = `<div class="dm-ust"><p class="eyebrow">${h(site())} · yalnızca yönetim</p><h2 class="title">Davetler ve üyeler</h2>
      <div class="dm-sekme" role="tablist" style="--konum:${S.sekme === "davet" ? 0 : 1}"><span class="dm-sekme-iz" aria-hidden="true"></span>
        <button type="button" role="tab" aria-selected="${S.sekme === "davet"}" data-dm="sekme:davet">Davet kodları</button>
        <button type="button" role="tab" aria-selected="${S.sekme === "uye"}" data-dm="sekme:uye">Üyeler${S.uyeler ? ` <b>${S.uyeler.length}</b>` : ""}</button></div></div>`;
    const not = `${S.hata ? `<p class="dm-not hata" role="alert">${h(S.hata)}</p>` : ""}${S.durum ? `<p class="dm-not" role="status">${h(S.durum)}</p>` : ""}`;
    if (S.davetler === null) return `<section class="dm">${ust}<div class="dm-bekle" aria-busy="true"><span></span><span></span><span></span></div></section>`;
    return `<section class="dm">${ust}${not}${S.sekme === "davet" ? davetGorunum() : uyeGorunum()}</section>`;
  }

  function davetGorunum() {
    const f = S.form;
    let x = "";
    if (S.yeni) {
      x += `<div class="dm-yeni" aria-live="polite"><div class="dm-yeni-damla"><small>Yeni davet kodu</small><output>${h(S.yeni.kod)}</output><span>${h(ROL[S.yeni.rol])} · ${S.yeni.max} kişi · ${S.yeni.gun} gün</span></div>
        <div class="dm-eylem">${waDugme(paylasMetni(S.yeni))}<button type="button" class="dm-hap" data-dm="kopya:${h(S.yeni.kod)}">Kodu kopyala</button>${navigator.share ? `<button type="button" class="dm-hap" data-dm="paylas:${h(S.yeni.kod)}">Paylaş</button>` : ""}</div></div>`;
    }
    x += `<form class="dm-form" data-dm-form onsubmit="return false"><h3>Yeni davet</h3>
      <div class="dm-rol" role="radiogroup" aria-label="Rol">${Object.keys(ROL).map(r => `<label class="dm-rol-k${f.rol === r ? " on" : ""}"><input type="radio" name="dmRol" value="${r}" ${f.rol === r ? "checked" : ""}><b>${ROL[r]}</b><small>${ROL_ACIKLAMA[r]}</small></label>`).join("")}</div>
      <div class="dm-ikili"><label>Kaç kişi kullanabilir<span class="dm-sayac"><button type="button" data-dm="max:-1" aria-label="Azalt">−</button><input id="dmMax" inputmode="numeric" value="${f.max}" aria-label="Kişi sayısı"><button type="button" data-dm="max:1" aria-label="Artır">+</button></span></label>
        <label>Geçerlilik (gün)<span class="dm-sayac"><button type="button" data-dm="gun:-1" aria-label="Azalt">−</button><input id="dmGun" inputmode="numeric" value="${f.gun}" aria-label="Gün"><button type="button" data-dm="gun:1" aria-label="Artır">+</button></span></label></div>
      <label class="dm-satir">Not (isteğe bağlı)<input id="dmAciklama" maxlength="60" placeholder="Ör. C Blok yeni taşınanlar" value="${h(f.aciklama)}"></label>
      <button type="button" class="dm-ana" data-dm="olustur" ${S.mesgul ? "disabled" : ""}>${S.mesgul ? "Hazırlanıyor…" : "Davet kodu oluştur"}</button></form>`;
    const gecerli = S.davetler.filter(d => d.gecerli), eski = S.davetler.filter(d => !d.gecerli);
    x += `<h3 class="dm-baslik">Geçerli davetler <span>${gecerli.length}</span></h3>`;
    x += gecerli.length ? `<ul class="dm-liste">${gecerli.map((d, i) => davetKart(d, i)).join("")}</ul>` : `<div class="dm-bos">${damla(0, "")}<p>Geçerli davet yok. Yukarıdan bir kod oluşturun ve WhatsApp'tan gönderin.</p></div>`;
    if (eski.length) x += `<details class="dm-eski"><summary>Süresi dolan ve iptal edilenler (${eski.length})</summary><ul class="dm-liste">${eski.map((d, i) => davetKart(d, i)).join("")}</ul></details>`;
    return x;
  }
  function davetKart(d, i) {
    const oran = d.maxKullanim ? d.kullanim / d.maxKullanim : 0, durum = d.iptal ? "İptal edildi" : !d.gecerli ? "Geçersiz" : `${kalanGun(d.bitis)} gün kaldı`;
    return `<li class="dm-kabarcik${d.gecerli ? "" : " soluk"}" style="--i:${i}">
      ${damla(oran, `${d.kullanim} / ${d.maxKullanim} kullanıldı`)}
      <div class="dm-govde"><output>${h(d.kod)}</output><span class="dm-rozet r-${h(d.rol)}">${h(ROL[d.rol] || d.rol)}</span>
        <small>${d.kullanim}/${d.maxKullanim} kişi katıldı · ${h(durum)}${d.aciklama ? " · " + h(d.aciklama) : ""}</small></div>
      ${d.gecerli ? `<div class="dm-eylem">${waDugme(paylasMetni(d), true)}<button type="button" class="dm-hap kucuk" data-dm="kopya:${h(d.kod)}" aria-label="${h(d.kod)} kodunu kopyala">Kopyala</button>
        ${S.iptalSor === d.kod ? `<button type="button" class="dm-hap kucuk tehlike" data-dm="iptalEvet:${h(d.kod)}">Evet, iptal et</button><button type="button" class="dm-hap kucuk" data-dm="iptalHayir">Vazgeç</button>`
          : `<button type="button" class="dm-hap kucuk" data-dm="iptalSor:${h(d.kod)}">İptal et</button>`}</div>` : ""}</li>`;
  }
  function uyeGorunum() {
    if (!S.uyeler.length) return `<div class="dm-bos">${damla(0, "")}<p>Henüz üye yok.</p></div>`;
    const sira = [...S.uyeler].sort((a, b) => (b.rol === "site_yonetici") - (a.rol === "site_yonetici") || String((a.konum || {}).blok || "~").localeCompare(String((b.konum || {}).blok || "~"), "tr") || (b.katilim - a.katilim));
    return `<ul class="dm-liste">${sira.map((u, i) => {
      const k = u.konum, ad = adi(u) || "İsimsiz sakin", bas = (ad.trim()[0] || "?").toLocaleUpperCase("tr");
      return `<li class="dm-kabarcik uye" style="--i:${i}"><span class="dm-avatar" aria-hidden="true">${h(bas)}</span>
        <div class="dm-govde"><b>${h(ad)}${u.ben ? " <small>(siz)</small>" : ""}</b><small>${k && k.blok ? `${h(k.blok)} Blok · ${h(k.kat)}. kat · Daire ${h(k.daire)}` : "Profil henüz doldurulmadı"} · ${h(u.telefon)}</small></div>
        ${u.ben ? `<span class="dm-rozet r-${h(u.rol)}">${h(ROL[u.rol])}</span>` : `<div class="dm-eylem"><label class="dm-secim"><span class="gizli">Rol</span><select data-dm-rol="${u.userId}" aria-label="${h(ad)} rolü">${Object.keys(ROL).map(r => `<option value="${r}" ${u.rol === r ? "selected" : ""}>${ROL[r]}</option>`).join("")}</select></label>
          ${S.cikarSor === u.userId ? `<button type="button" class="dm-hap kucuk tehlike" data-dm="cikarEvet:${u.userId}">Evet, çıkar</button><button type="button" class="dm-hap kucuk" data-dm="cikarHayir">Vazgeç</button>`
            : `<button type="button" class="dm-hap kucuk" data-dm="cikarSor:${u.userId}" aria-label="${h(ad)} siteden çıkar">Çıkar</button>`}</div>`}
        ${S.cikarSor === u.userId ? `<p class="dm-uyari">Siteden çıkarılınca bu kişinin profili, sepeti ve paylaşımları silinir.</p>` : ""}</li>`;
    }).join("")}</ul>`;
  }
  function waDugme(metin, kucuk) {
    return `<a class="dm-hap wa${kucuk ? " kucuk" : ""}" href="https://wa.me/?text=${encodeURIComponent(metin)}" target="_blank" rel="noopener noreferrer">WhatsApp'ta gönder</a>`;
  }

  function sayi(id, v, min, max) { const n = parseInt(String(v).replace(/\D/g, ""), 10); return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)); }
  function formOku() {
    const g = id => document.getElementById(id);
    if (g("dmMax")) S.form.max = sayi("dmMax", g("dmMax").value, 1, 500);
    if (g("dmGun")) S.form.gun = sayi("dmGun", g("dmGun").value, 1, 90);
    if (g("dmAciklama")) S.form.aciklama = g("dmAciklama").value.slice(0, 60);
  }
  async function islem(a) {
    const [k, x] = a.split(/:(.*)/s);
    S.durum = ""; S.hata = "";
    if (k === "sekme") { S.sekme = x; S.iptalSor = S.cikarSor = null; return yenidenCiz(); }
    if (k === "max" || k === "gun") { formOku(); if (k === "max") S.form.max = Math.min(500, Math.max(1, S.form.max + Number(x) * (S.form.max >= 10 ? 5 : 1))); else S.form.gun = Math.min(90, Math.max(1, S.form.gun + Number(x))); return yenidenCiz(); }
    if (k === "kopya") { try { await navigator.clipboard.writeText(x); S.durum = `${x} kopyalandı.`; } catch (e) { S.durum = "Kopyalanamadı; kodu basılı tutup seçebilirsiniz."; } return yenidenCiz(); }
    if (k === "paylas") { const d = S.davetler.find(z => z.kod === x) || S.yeni; try { await navigator.share({ title: "Davet kodu", text: paylasMetni(d) }); } catch (e) { /* vazgeçildi */ } return; }
    if (k === "iptalSor") { S.iptalSor = x; return yenidenCiz(); }
    if (k === "iptalHayir") { S.iptalSor = null; return yenidenCiz(); }
    if (k === "cikarSor") { S.cikarSor = Number(x); return yenidenCiz(); }
    if (k === "cikarHayir") { S.cikarSor = null; return yenidenCiz(); }
    try {
      if (k === "olustur") {
        formOku(); S.mesgul = true; yenidenCiz();
        const r = await api("POST", "/api/yonetim/davetler", { rol: S.form.rol, maxKullanim: S.form.max, gun: S.form.gun, aciklama: S.form.aciklama });
        S.yeni = { kod: r.kod, rol: S.form.rol, max: S.form.max, gun: S.form.gun }; S.form.aciklama = "";
      } else if (k === "iptalEvet") { await api("DELETE", "/api/yonetim/davetler/" + encodeURIComponent(x)); S.iptalSor = null; if (S.yeni && S.yeni.kod === x) S.yeni = null; S.durum = "Davet iptal edildi."; }
      else if (k === "cikarEvet") { await api("DELETE", "/api/yonetim/uyeler/" + x); S.cikarSor = null; S.durum = "Üye siteden çıkarıldı."; }
      else return;
      S.mesgul = false; S.davetler = S.davetler || []; await yukle();
    } catch (e) { S.mesgul = false; S.hata = e.message; yenidenCiz(); }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-dm]"); if (b) { e.preventDefault(); islem(b.dataset.dm); return; }
    const r = e.target.closest(".dm-rol-k input"); if (r) { formOku(); S.form.rol = r.value; yenidenCiz(); }
  });
  document.addEventListener("change", async e => {
    const s = e.target.closest("[data-dm-rol]"); if (!s) return;
    try { await api("PATCH", "/api/yonetim/uyeler/" + s.dataset.dmRol, { rol: s.value }); S.durum = "Rol güncellendi."; await yukle(); }
    catch (err) { S.hata = err.message; yenidenCiz(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.closest("[data-dm-form]")) { e.preventDefault(); islem("olustur"); } });

  /* Sakinler sayfasının üstündeki giriş kabarcığı */
  function giris() {
    return `<a class="dm-giris" href="#davetler"><span class="dm-giris-damla" aria-hidden="true"></span><span><b>Davetler ve üyeler</b><small>Davet kodu oluştur, WhatsApp'tan gönder, rolleri yönet</small></span><span aria-hidden="true">›</span></a>`;
  }
  /* Ekran her açılışta arka planda tazelenir */
  window.addEventListener("hashchange", () => { if (location.hash === "#davetler" && S.davetler !== null) { S.yeni = null; yukle(); } });
  window.BS_YONETIM = { view: gorunum, giris };
})();
