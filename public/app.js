"use strict";
/* Bilinçli Sakin — istemci. Görünümler ve iş mantığı prototipten (site-yonetimi/index.html) taşındı;
   veri katmanı claude.ai "db" yerine bu uygulamanın REST API'sine bağlandı. */
const { M, BY, PHASES, LEVEL, NEXT, TEMALAR, HAZIR_ALANLAR, TIPLER, varsayilanAyar, ALT, BIRIMLER, ALT_RENK, ORNEK_KATALOG, adimFor,
  YAKINLIK, YAS, IS, DURUM, ROLLER, PLANLAR, SITE_DURUM, katAd } = window.ORTAK;
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BUYIL = new Date().getFullYear();

/* ---------- Görsel yardımcılar: satır içi SVG ikonlar (kütüphane yok), boş durum, iskelet, bildirim ---------- */
const IKON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cart: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  check: '<path d="M5 12.5 10 17 19 7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  frame: '<path d="M4 4h16v16H4zM4 9h16M9 9v11"/>',
  install: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 8v6M9 11h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18.5" r="1.5"/><circle cx="17" cy="18.5" r="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6"/>',
  wifioff: '<path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18"/>'
};
const ik = (ad, sinif = "ikon") => `<svg class="${sinif}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IKON[ad] || ""}</svg>`;
const bos = (ikon, baslik, metin, ek = "") => `<div class="bos-durum">${ik(ikon, "ikon ikon-buyuk")}<b>${esc(baslik)}</b><p>${esc(metin)}</p>${ek}</div>`;
const iskelet = (n = 3) => `<div class="iskelet-grup" aria-busy="true" aria-label="Yükleniyor"><div class="iskelet h"></div>${'<div class="iskelet"></div>'.repeat(n)}</div>`;
let bildirimT = null;
function bildir(metin) {
  const el = document.getElementById("bildirim"); if (!el) return;
  el.textContent = metin; el.classList.add("goster");
  clearTimeout(bildirimT); bildirimT = setTimeout(() => el.classList.remove("goster"), 1800);
}
async function panoyaKopyala(metin) { try { await navigator.clipboard.writeText(metin); return true; } catch (e) { return false; } }

/* ---------- API ---------- */
let ME = null;
async function api(method, url, body) {
  const h = {};
  if (method !== "GET") { h["Content-Type"] = "application/json"; if (ME && ME.csrf && !BS.native) h["X-CSRF-Token"] = ME.csrf; }
  BS.baslik(h);
  const r = await fetch(BS.url(url), { method, headers: h, credentials: BS.native ? "omit" : "same-origin", body: method === "GET" ? undefined : JSON.stringify(body || {}) });
  let d = null; try { d = await r.json(); } catch (e) { d = null; }
  if (!r.ok) { const err = new Error((d && d.hata) || "İstek başarısız (" + r.status + ")"); err.status = r.status; throw err; }
  return d;
}

/* ---------- Durum ---------- */
let ROL = "", ADMIN = false, YONETIM = false, SALT = false;
let state = { scores: {}, kanit: {} };
let saveTimer = null, saving = false, pendingSave = false;
let AYAR = varsayilanAyar();
let ayDraft = null, ayDirty = false, ayStatus = "", aySaving = false;
let KAT = { urunler: [], tur: { id: "", ad: "", sonTarih: "", teslim: "", acik: false } }, sepet = { kalemler: {}, not: "", tur: "" };
let spF = { kat: "pazar", q: "" }, spMode = "alis", spSaveT = null, spSaving = false, spPend = false, spStatus = "", SIP = null, sipHata = "";
let kdDraft = null, kdDirty = false, kdStatus = "", kdYeniTurSor = false;
let profil = null, pDraft = null, pDirty = false, pSaving = false, pStatus = "", pDelAsk = false;
let tumSakinler = null, sakinHata = "", aF = { blok: "", kat: "" };
let saatFarki = 0;
const simdi = () => Date.now() + saatFarki;
let giris = { adim: "tel", tel: "", hata: "", bilgi: "", bekle: false };
let katilHata = "", hesapDurum = "", hesapSilSor = false;
let UYE = null, DAVET = null, uyeDurum = "", yeniDavet = null, uyeSilSor = null, kopyaDurum = "";
let OZ = { alisveris: false, egitim: false }, OZET = null, ozetHata = "";
const DAVET_URL = (() => { try { const k = new URLSearchParams(location.search).get("davet"); if (k) sessionStorage.setItem("bss-davet", k); return sessionStorage.getItem("bss-davet") || ""; } catch (e) { return ""; } })();
let PLAT = null, platDurum = "", platYeni = null;
try { const f = JSON.parse(localStorage.getItem("bss-sepetF") || "null"); if (f) spF = { ...spF, ...f }; } catch (e) { /* yok */ }

function setSync(t) { const el = document.getElementById("sync"); if (el) el.textContent = t; }
const aktifM = () => M.filter(m => !(AYAR.gizliModul || []).includes(m.code));
function ekAlanlar() { return window.ORTAK.ekAlanlar(AYAR); }
const kategoriler = (p, ozel) => window.ORTAK.kategoriler(p, ozel, BUYIL);
const onerilenYol = p => window.ORTAK.onerilenYol(p, AYAR.gizliModul, BUYIL);

/* ---------- Puan kartı ---------- */
function queueSave() {
  if (SALT) { setSync("Site askıda · kaydedilmedi"); return; }
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, 700); setSync("Kaydediliyor…");
}
async function flush() {
  if (saving) { pendingSave = true; return; }
  saving = true;
  try { await api("PUT", "/api/puan", { scores: state.scores, kanit: state.kanit }); setSync("Hesabına kaydedildi · tüm cihazlar"); }
  catch (e) { setSync("Kaydedilemedi: " + e.message); }
  saving = false; if (pendingSave) { pendingSave = false; flush(); }
}
function sc(c) { return state.scores[c] || 0; }
function preStatus(m) { return m.pre.filter(p => sc(p) < 4); }
function stats() {
  const vals = aktifM().map(m => sc(m.code)).filter(Boolean);
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const low = aktifM().filter(m => sc(m.code)).sort((a, b) => sc(a.code) - sc(b.code)).slice(0, 3);
  return { n: vals.length, avg, low };
}
function picker(code) {
  const s = sc(code);
  return `<div class="picker" role="group" aria-label="${code} puanı">` +
    Array.from({ length: 10 }, (_, i) => { const v = i + 1; return `<button type="button" data-set="${code}" data-v="${v}" class="${v === s ? "on" : v < s ? "fill" : ""}" aria-pressed="${v === s}">${v}</button>`; }).join("") + `</div>`;
}
function warn7(code) {
  const s = sc(code); if (s >= 7 && !(state.kanit[code] || "").trim()) return `<p class="note">7 ve üzeri puan yalnızca bir site görevindeki kanıtla verilir. Kanıtı aşağıya yaz (ör. ${BY[code].proj[0]}: rapor, tutanak, hesap tablosu).</p>`;
  return "";
}

/* ---------- Markdown ---------- */
const docs = {};
async function loadMd(file) {
  if (docs[file] !== undefined) return docs[file];
  try { const r = await fetch(BS.url("/md/" + encodeURIComponent(file)), { headers: BS.baslik({}), credentials: BS.native ? "omit" : "same-origin" }); docs[file] = r.ok ? await r.text() : null; } catch (e) { docs[file] = null; }
  return docs[file];
}
function renderMd(md, el) {
  // Markdown dosyaları uygulamayla birlikte gelen statik içeriktir (kullanıcı girdisi değildir).
  el.innerHTML = window.marked.parse(md);
  el.querySelectorAll("table").forEach(t => { const d = document.createElement("div"); d.className = "tbl"; t.replaceWith(d); d.appendChild(t); });
  [...el.querySelectorAll("h3")].forEach(h => {
    const det = document.createElement("details"), sum = document.createElement("summary"), body = document.createElement("div");
    body.className = "body"; const h3 = document.createElement("h3"); h3.innerHTML = h.innerHTML; sum.appendChild(h3); det.append(sum, body);
    let n = h.nextSibling; while (n && !(n.nodeType === 1 && /^H[1-3]$/.test(n.tagName))) { const nx = n.nextSibling; body.appendChild(n); n = nx; }
    h.replaceWith(det);
  });
}

/* ---------- Harita, kart, modüller (prototipten) ---------- */
function kilitKarti(ozellik, baslik) {
  return `<div class="scorebox kilit" data-kilit="${ozellik}"><div class="eyebrow">${ik("lock")} ${esc(baslik)}</div><b>Bu özellik ${esc(PLANLAR[window.ORTAK.OZELLIK_PAKET[ozellik]])} paketinde</b><p class="lvl" style="margin:4px 0 0">${esc(window.ORTAK.ozellikMesaj(ozellik))}</p></div>`;
}
function profilKutusu() {
  return profil ? `<div class="scorebox"><div class="eyebrow">Profilin</div><div class="chips" style="margin:6px 0 0"><span class="chip acc">${konum(profil)}</span>${kategoriler(profil, true).map(c => `<span class="chip ${c.startsWith("Acil") ? "warn" : ""}">${esc(c)}</span>`).join("")}</div></div>`
    : `<div class="scorebox"><b>Profilini oluştur</b><p class="lvl" style="margin:4px 0 8px">Blok, kat, daire ve hane bilgilerini gir; yönetim duyuruları ve acil durum planını doğru kişilere ulaştırsın.</p><a class="chip acc" href="#profil">Profilimi oluştur →</a></div>`;
}
/* ---------- Sakin ana sayfası ---------- */
let kurulumOlayi = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); kurulumOlayi = e; if (current === "diger") render(false); });
const standalone = () => { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } };
const iosMu = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function lsOku(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsYaz(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* yok */ } }
function selamMetni() { return profil ? `Merhaba, ${profil.blok} Blok ${katAd(profil.kat)} ${profil.daire}` : "Merhaba"; }
function viewAna() {
  const a = AYAR;
  let h = hkHero() + `<section class="selam" aria-labelledby="selam"><p class="eyebrow">${esc(a.siteAdi || "Sitem")}</p><h2 class="title" id="selam">${esc(selamMetni())}</h2>
    ${a.karsilama ? `<p class="lead" style="margin:0">${esc(a.karsilama)}</p>` : ""}</section>`;
  if (!profil) h += `<section class="karsilama" aria-labelledby="kars-b"><h3 id="kars-b">Hoş geldin! 3 kısa adım</h3>
    <ol><li><span class="no" aria-hidden="true">1</span><span><b>Profilini oluştur</b>Blok, kat, daire ve hanende kaç kişi yaşadığı. 2 dakika sürer; adın ve doğum tarihin sorulmaz.</span></li>
    <li><span class="no" aria-hidden="true">2</span><span>${OZ.alisveris ? "<b>Sepetine bak</b>Yönetim alışveriş turu açınca pazar ve market ürünlerini sepetine ekle." : "<b>Duyuruları takip et</b>Yönetimin duyuruları ve iletişim numaraları bu sayfada."}</span></li>
    <li><span class="no" aria-hidden="true">3</span><span><b>Verilerin senin</b>“Diğer › Hesabım”dan bilgilerini indirebilir ya da silebilirsin.</span></li></ol>
    <a class="btn pri" href="#profil">Profilimi oluştur</a></section>`;
  h += `<div class="kartlar">`;
  if (a.duyuru) h += `<section class="bkart duyuru genis" aria-label="Duyuru"><span class="ik">${ik("megaphone")}</span><div class="gv"><h3>Duyuru</h3><p>${esc(a.duyuru)}</p></div></section>`;
  if (OZ.alisveris) {
    const n = sepetAdet(), oz = sepetOzet(eski() ? {} : sepet.kalemler), t = KAT.tur;
    const durum = !t.id ? "Şu an açık tur yok" : turAcik() ? `Sipariş açık${t.sonTarih ? " · " + kalanSure() : ""}` : "Sipariş kapalı";
    h += `<a class="bkart" href="#sepet" id="kartSepet"><span class="ik">${ik("cart")}</span><div class="gv"><h3>Sepetim</h3><p>${t.id ? esc(t.ad || "Alışveriş turu") + " · " : ""}${esc(durum)}</p>
      <span class="durum">${n ? `${n} ürün${oz.t ? " · ~" + Math.round(oz.t).toLocaleString("tr-TR") + " TL" : ""}` : turAcik() ? "Sepetin boş · ürün ekle" : "Ürünlere göz at"}</span></div></a>`;
  }
  h += profil ? `<a class="bkart" href="#profil" id="kartProfil"><span class="ik">${ik("user")}</span><div class="gv"><h3>Profilim</h3><p>${konum(profil)}</p><span class="durum">${kategoriler(profil, true).length} kategori · güncelle</span></div></a>`
    : `<a class="bkart uyari" href="#profil" id="kartProfil"><span class="ik">${ik("user")}</span><div class="gv"><h3>Profilim</h3><p>Profilin eksik. Duyurular ve acil durum planı için gerekli.</p><span class="durum">2 dakikada tamamla →</span></div></a>`;
  if ((a.iletisim || []).length) h += `<section class="bkart" aria-label="İletişim numaraları"><span class="ik">${ik("phone")}</span><div class="gv"><h3>İletişim</h3>
    ${a.iletisim.map(i => `<div class="tel-satir"><span><b>${esc(i.ad)}</b><span class="no">${esc(i.tel)}</span></span><span class="confirm" style="margin:0"><a class="btn" href="tel:${esc(i.tel.replace(/[^0-9+]/g, ""))}" aria-label="${esc(i.ad)} ara">${ik("phone")}Ara</a><button class="btn" type="button" data-kopya="${esc(i.tel)}" aria-label="${esc(i.ad)} numarasını kopyala">${ik("copy")}Kopyala</button></span></div>`).join("")}</div></section>`;
  if (OZ.egitim) {
    const st = stats(), yol = profil ? onerilenYol(profil) : [];
    h += `<section class="bkart" aria-label="Öğren"><span class="ik">${ik("book")}</span><div class="gv"><h3>Öğren</h3><p>${st.n ? `${st.n}/${aktifM().length} modül puanlandı · ortalama ${st.avg.toFixed(1)}` : "Sitende söz sahibi olmak için kısa modüller."}</p>
      ${yol.length ? `<div class="chips" style="margin:8px 0 0">${yol.slice(0, 3).map(c => `<a class="chip ${sc(c) >= 6 ? "ok" : "acc"}" href="#${c}">${c} · ${esc(BY[c].title)}</a>`).join("")}</div>` : ""}
      <a class="durum" href="#harita">Öğrenme haritası →</a></div></section>`;
  }
  h += `</div>`;
  if (!BS.native && !standalone() && lsOku("bss-ipucu-kurulum") !== "kapali") h += `<div class="ipucu" id="kurulumIpucu">${ik("install")}<p><b>Ana ekrana ekle:</b> uygulama gibi tek dokunuşla açılır. <a href="#diger">Nasıl?</a></p><button class="btn" type="button" data-act="ipucuKapat" aria-label="İpucunu kapat">Kapat</button></div>`;
  if (!OZ.alisveris) h += kilitKarti("alisveris", "Ortak market ve pazar sepeti");
  if (!OZ.egitim) h += kilitKarti("egitim", "Eğitim modülleri ve puan kartı");
  return h;
}
const mrow = (href, ikon, baslik, alt, ek = "") => `<a class="mrow" href="${href}" ${ek}><span class="ik">${ik(ikon)}</span><span class="gv">${esc(baslik)}${alt ? `<small>${esc(alt)}</small>` : ""}</span>${ik("chev", "ikon ok-i")}</a>`;
function kurulumKarti() {
  if (BS.native) return "";
  if (standalone()) return `<div class="ipucu">${ik("check")}<p>Uygulama ana ekranından açıldı.</p></div>`;
  return `<div class="row" id="kurulum"><div class="head"><b>Ana ekrana ekle</b></div>
    <p class="lvl" style="margin:6px 0">${iosMu() ? "iPhone/iPad: Safari'de alttaki <b>Paylaş</b> simgesine (kutudan çıkan ok) dokunun, listeden <b>Ana Ekrana Ekle</b>'yi seçin." : "Android: tarayıcı menüsünden (⋮) <b>Ana ekrana ekle</b> ya da <b>Uygulamayı yükle</b>'yi seçin. iPhone'da Safari'nin <b>Paylaş</b> menüsünü kullanın."}</p>
    ${kurulumOlayi ? `<button class="btn pri" type="button" data-act="kur">${ik("install")}Uygulamayı yükle</button>` : ""}</div>`;
}
function viewDiger() {
  let h = `<p class="eyebrow">${esc(AYAR.siteAdi || "Sitem")}</p><h2 class="title">Diğer</h2>`;
  if (OZ.egitim) h += `<h3 class="menu-baslik">Öğren</h3>${mrow("#harita", "book", "Öğrenme haritası", `${aktifM().length} modül · önerilen yol`)}${mrow("#kart", "star", "Puan kartım", "Kendini 1–10 değerlendir")}${mrow("#projeler", "clipboard", "Site görevleri", "Gerçek işlerde kanıt")}${mrow("#cerceve", "frame", "Ana çerçeve", "Puanlama kuralları")}`;
  if (YONETIM) h += `<h3 class="menu-baslik">Site yönetimi</h3>${mrow("#yonetim", "chart", "Yönetim paneli", ADMIN ? "Özet, sakinler, sipariş, ayarlar, üyeler" : "Özet, sakinler ve siparişler (salt-okur)")}`;
  h += `<h3 class="menu-baslik">Hikmet</h3>${mrow("#hikmet", "book", "Ayetler ve hadisler", "Günün ayeti/hadisi, konuya göre arşiv, duvar kâğıdı")}`;
  h += `<h3 class="menu-baslik">Hesap</h3>${mrow("#abonelik", "star", "Abonelik", abonelikOzet())}${mrow("#hesap", "shield", "Hesabım ve verilerim", "Verilerini indir, sil; site değiştir")}${mrow("/aydinlatma.html", "file", "Aydınlatma metni", "Kişisel veriler nasıl kullanılıyor")}${mrow(BS.yasal.gizlilik, "shield", "Gizlilik politikası", "")}${mrow(BS.yasal.kosullar, "file", "Kullanım koşulları", "Abonelik koşulları dahil")}
    <h3 class="menu-baslik">Uygulama</h3>${kurulumKarti()}${mrow("/nasil-kullanilir.html", "help", "Nasıl kullanılır", "5 adımda kısa kılavuz")}
    <button class="mrow" type="button" data-act="cikis"><span class="ik">${ik("logout")}</span><span class="gv">Çıkış yap</span></button>`;
  if (!OZ.alisveris) h += kilitKarti("alisveris", "Ortak market ve pazar sepeti");
  if (!OZ.egitim) h += kilitKarti("egitim", "Eğitim modülleri ve puan kartı");
  return h;
}
function viewYonetim() {
  if (!YONETIM) return bos("lock", "Bu bölüm yalnızca site yönetimine açık", "Site yönetimindeysen yöneticiden rol iste.");
  return `<p class="eyebrow">Yalnızca site yönetimi görür${ROL === "site_denetci" ? " · denetçi: salt-okur" : ""}</p><h2 class="title">Yönetim</h2>
    ${mrow("#ozet", "chart", "Özet", "Doluluk, bloklar, turlar, yeni katılanlar")}${mrow("#sakinler", "users", "Sakinler", "Kategoriler, tahliye listesi, haneler")}
    ${OZ.alisveris ? mrow("#siparis", "truck", "Toplu sipariş", "Ürün toplamları, teslimat listesi") : ""}${OZ.alisveris && ADMIN ? mrow("#katalog", "list", "Katalog ve tur", "Ürünler, fiyatlar, sipariş turu") : ""}
    ${ADMIN ? mrow("#ayarlar", "settings", "Site ayarları", "Ad, renk, duyuru, bloklar, sorular") + mrow("#uyeler", "users", "Üyeler ve davetler", "Davet kodu, bağlantı, roller") : ""}
    ${OZ.alisveris ? "" : kilitKarti("alisveris", "Toplu sipariş ve katalog")}`;
}
function viewHarita() {
  const st = stats();
  let h = `<p class="eyebrow">${aktifM().length} yetkinlik · 4 faz · 1–10 puan</p><h2 class="title">Sitende söz sahibi ol</h2>
  <p class="lead">Yönetim planını anla, aidatının nereye gittiğini oku, bakımı ve güvenliği izle, kurulda gerekçeli önerge ver, hakkını bil. Her beceri önce öğrenilir, sonra uygulanır, ölçülür, sitenin gerçek bir işinde kanıtlanır ve başka sakinlere öğretilir. Kartlardaki puan senin puan kartından gelir.</p>
  <div class="summary"><div><b>${st.n}/${aktifM().length}</b><span>puanlanan modül</span></div><div><b>${st.avg ? st.avg.toFixed(1) : "–"}</b><span>genel ortalama</span></div><div><b>${st.low[0] ? st.low[0].code : "–"}</b><span>en zayıf modül</span></div></div>`;
  if (profil) { const yol = onerilenYol(profil); h += `<div class="scorebox"><div class="eyebrow">${konum(profil)} · senin için önerilen yol</div><div class="chips" style="margin:6px 0 0">${yol.map(c => `<a class="chip ${sc(c) >= 6 ? "ok" : ""}" href="#${c}">${c} · ${esc(BY[c].title)}</a>`).join("")}</div></div>`; }
  else h += `<div class="scorebox"><b>Profilini oluştur</b><p class="lvl" style="margin:4px 0 8px">Blok, kat, daire ve hane bilgilerini gir; sana uygun modülleri önerelim.</p><a class="chip acc" href="#profil">Profilimi oluştur →</a></div>`;
  for (const p of [1, 2, 3, 4]) {
    h += `<section class="phase"><h3>Faz ${p} <em>${PHASES[p]}</em></h3><div class="cards">`;
    for (const m of aktifM().filter(m => m.phase === p)) {
      const s = sc(m.code);
      h += `<a class="card" href="#${m.code}"><code>${m.code}</code><span class="t">${esc(m.title)}<small>${LEVEL(s)}</small></span><span class="score ${s ? "" : "empty"}">${s || "–"}</span><span class="bar"><i style="width:${s * 10}%"></i></span></a>`;
    }
    h += `</div></section>`;
  }
  return h;
}
function viewKart() {
  const st = stats();
  let h = `<p class="eyebrow">Kişisel · hesabına bağlı</p><h2 class="title">Puan kartım</h2>
  <p class="lead">Her yetkinliğe kanıtına göre 1–10 puan ver. Puan en zayıf kanıta göre belirlenir. Toplantıda çok konuşmak tek başına puan getirmez; belge ve gerekçe ölçülür.</p>
  <div class="summary"><div><b>${st.avg ? st.avg.toFixed(1) : "–"}</b><span>genel ustalık puanı</span></div><div><b>${st.n}/${aktifM().length}</b><span>puanlanan</span></div><div><b>${st.low.map(m => m.code).join(" ") || "–"}</b><span>gelişime buradan başla</span></div></div>`;
  for (const m of aktifM()) {
    const s = sc(m.code), miss = preStatus(m);
    h += `<div class="row"><div class="head"><a href="#${m.code}"><code>${m.code}</code>${esc(m.title)}</a><span class="score ${s ? "" : "empty"}">${s || "–"}</span></div>
    ${picker(m.code)}
    <div class="lvl"><b>${LEVEL(s)}</b> · Sonraki adım: ${NEXT(s)}${miss.length ? ` · <span style="color:var(--warn)">Ön koşul eksik: ${miss.join(", ")}</span>` : ""}</div>
    ${warn7(m.code)}
    <label class="lvl" for="k-${m.code}" style="display:block;margin-top:6px">Kanıt (${m.proj.join(", ")})</label>
    <input id="k-${m.code}" data-kanit="${m.code}" value="${esc(state.kanit[m.code] || "")}" maxlength="300" placeholder="Ör. ${m.proj[0]} raporu, rubrik 3,2/4"></div>`;
  }
  h += `<div class="confirm" id="resetBox"><button class="btn danger" type="button" id="reset">Tüm puanları sıfırla</button></div>`;
  return h;
}
async function viewDoc(file, eyebrow, title, lead) {
  const main = document.getElementById("main");
  main.innerHTML = `<p class="eyebrow">${eyebrow}</p><h2 class="title">${title}</h2><p class="lead">${lead}</p><div class="doc" id="doc">${iskelet()}</div>`;
  const md = await loadMd(file); const el = document.getElementById("doc"); if (!el) return;
  if (md) renderMd(md, el); else el.innerHTML = `<div class="pending">Bu bölüm hâlâ hazırlanıyor. Sayfa güncellendiğinde burada görünecek.</div>`;
}
async function viewModul(code) {
  const m = BY[code], s = sc(code), main = document.getElementById("main");
  main.innerHTML = `<p class="eyebrow">Faz ${m.phase} · ${PHASES[m.phase]}</p><h2 class="title"><span style="color:var(--accent)">${code}</span> ${esc(m.title)}</h2>
  <div class="chips">${m.pre.length ? m.pre.map(p => `<a class="chip ${sc(p) >= 4 ? "ok" : "warn"}" href="#${p}">Ön koşul ${p} ≥ 4</a>`).join("") : `<span class="chip">Ön koşul yok</span>`}
  ${m.proj.map(p => `<a class="chip acc" href="#projeler">Görev: ${p}</a>`).join("")}</div>
  <div class="scorebox" id="sb"><div class="head" style="display:flex;justify-content:space-between"><span class="eyebrow">Bu modüldeki puanın</span><span class="score ${s ? "" : "empty"}">${s || "–"}</span></div>
  ${picker(code)}<div class="lvl"><b>${LEVEL(s)}</b> · Sonraki adım: ${NEXT(s)}</div>${warn7(code)}</div>
  <div class="doc" id="doc">${iskelet()}</div>
  <div class="titleblock"><div><span>Modül</span>${code}</div><div><span>Faz</span>${m.phase} · ${PHASES[m.phase]}</div><div><span>Ölçek</span>1–10 puan</div><div><span>Görev</span>${m.proj.join(" ")}</div></div>`;
  const md = await loadMd(m.file); const el = document.getElementById("doc"); if (!el) return;
  if (md) renderMd(md, el); else el.innerHTML = `<div class="pending">${code} modülü hâlâ yazılıyor. Hazır olunca bu sayfada görünecek. Puan kartını şimdiden kullanabilirsin.</div>`;
}

/* ---------- Site ayarları ---------- */
function applyAyar() {
  const t = TEMALAR[AYAR.tema] || TEMALAR.yesil; let st = document.getElementById("siteTema");
  if (!st) { st = document.createElement("style"); st.id = "siteTema"; document.head.appendChild(st); }
  const tc = document.getElementById("themeColor"); if (tc) tc.setAttribute("content", t.l[0]);
  st.textContent = `:root{--accent:${t.l[0]};--accent-soft:${t.l[1]}}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--accent:${t.d[0]};--accent-soft:${t.d[1]}}}:root[data-theme="dark"]{--accent:${t.d[0]};--accent-soft:${t.d[1]}}`;
  const h1 = document.querySelector(".brand h1");
  if (h1) h1.innerHTML = AYAR.siteAdi ? `${esc(AYAR.siteAdi)} <span>· Sakin</span>` : `Bilinçli <span>Sakin</span>`;
  document.title = AYAR.siteAdi ? `${AYAR.siteAdi} · Bilinçli Sakin` : "Bilinçli Site Sakini";
}
function siteKarti() {
  const a = AYAR; if (!a.siteAdi && !a.karsilama && !a.duyuru && !(a.iletisim || []).length) return "";
  return `<div class="scorebox">${a.siteAdi ? `<div class="eyebrow">${esc(a.siteAdi)}</div>` : ""}
   ${a.karsilama ? `<p style="margin:4px 0 0">${esc(a.karsilama)}</p>` : ""}
   ${a.duyuru ? `<p class="note" style="color:var(--ink);background:var(--weld-soft);padding:8px;margin-top:8px"><b>Duyuru:</b> ${esc(a.duyuru)}</p>` : ""}
   ${(a.iletisim || []).length ? `<div class="tbl" style="margin-top:8px"><table><tbody>${a.iletisim.map(i => `<tr><td>${esc(i.ad)}</td><td style="user-select:all;font-family:var(--f-mono)">${esc(i.tel)}</td></tr>`).join("")}</tbody></table></div>` : ""}</div>`;
}
function ekInput(a, v, id) {
  const val = v ?? "";
  if (a.tip === "evethayir") return `<select id="${esc(id)}" data-ek="${esc(a.k)}"><option value="">Seç</option><option ${val === "Evet" ? "selected" : ""}>Evet</option><option ${val === "Hayır" ? "selected" : ""}>Hayır</option></select>`;
  if (a.tip === "secim") return `<select id="${esc(id)}" data-ek="${esc(a.k)}"><option value="">Seç</option>${String(a.secenekler || "").split(",").map(x => x.trim()).filter(Boolean).map(x => `<option ${x === val ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
  return `<input id="${esc(id)}" data-ek="${esc(a.k)}" value="${esc(val)}" ${a.tip === "sayi" ? 'inputmode="numeric"' : ""} maxlength="40">`;
}
function viewAyarlar() {
  if (!ADMIN) return `<div class="pending">Bu bölüm yalnızca site yönetimine açık.</div>`;
  if (!ayDraft) ayDraft = JSON.parse(JSON.stringify(AYAR));
  const a = ayDraft;
  const chk = (on, attr, label) => `<label class="lvl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${attr} ${on ? "checked" : ""} style="width:auto"> ${label}</label>`;
  return `<p class="eyebrow">Yalnızca site yönetimi görür</p><h2 class="title">Site ayarları</h2>
  <p class="lead">Bu sayfayı sitenize göre ayarlayın. Değişiklikler kaydedildiğinde tüm sakinlerde görünür.</p>
  <div class="row"><div class="head"><b>Kimlik</b></div><div class="pgrid">
   <label class="lvl" for="ay-ad">Site adı<input id="ay-ad" data-ay="siteAdi" value="${esc(a.siteAdi)}" maxlength="50" placeholder="Ör. Çınar Evleri"></label>
   <label class="lvl" for="ay-td">Toplam daire sayısı (isteğe bağlı)<input id="ay-td" data-ay="toplamDaire" value="${esc(a.toplamDaire ?? "")}" inputmode="numeric" maxlength="4" placeholder="Ör. 120"></label>
   <label class="lvl" for="ay-tema">Renk<select id="ay-tema" data-ay="tema">${Object.entries(TEMALAR).map(([k, t]) => `<option value="${k}" ${a.tema === k ? "selected" : ""}>${t.ad}</option>`).join("")}</select></label></div>
   <label class="lvl" for="ay-kar" style="display:block;margin-top:8px">Karşılama metni<input id="ay-kar" data-ay="karsilama" value="${esc(a.karsilama)}" maxlength="200" placeholder="Ör. Sitemize hoş geldiniz. Sorularınız için yönetim ofisi hafta içi 09–18 açık."></label>
   <label class="lvl" for="ay-duy" style="display:block;margin-top:8px">Duyuru (Harita sayfasının başında görünür)<input id="ay-duy" data-ay="duyuru" value="${esc(a.duyuru)}" maxlength="240"></label></div>
  <div class="row"><div class="head"><b>Bloklar ve katlar</b></div><p class="lvl" style="margin:2px 0 6px">Tanımlarsanız sakinler blok ve katı listeden seçer; yazım hatası olmaz.</p>
   ${a.bloklar.map((b, i) => `<div class="pgrid birey"><label class="lvl" for="bl-${i}">Blok adı<input id="bl-${i}" data-ayl="bloklar:${i}:ad" value="${esc(b.ad)}" maxlength="10"></label>
    <label class="lvl" for="bmn-${i}">En alt kat<input id="bmn-${i}" data-ayl="bloklar:${i}:minKat" value="${esc(b.minKat)}" inputmode="numeric"></label>
    <label class="lvl" for="bmx-${i}">En üst kat<input id="bmx-${i}" data-ayl="bloklar:${i}:maxKat" value="${esc(b.maxKat)}" inputmode="numeric"></label>
    <label class="lvl" for="bd-${i}">Daire sayısı<input id="bd-${i}" data-ayl="bloklar:${i}:daire" value="${esc(b.daire ?? "")}" inputmode="numeric" maxlength="4" placeholder="İsteğe bağlı"></label>
    <button class="btn" type="button" data-ayact="del:bloklar:${i}">Çıkar</button></div>`).join("")}
   ${a.bloklar.length < 30 ? `<button class="btn" type="button" data-ayact="add:bloklar">+ Blok ekle</button>` : ""}</div>
  <div class="row"><div class="head"><b>İletişim numaraları</b></div>
   ${a.iletisim.map((c, i) => `<div class="pgrid birey"><label class="lvl" for="il-${i}">Ad / görev<input id="il-${i}" data-ayl="iletisim:${i}:ad" value="${esc(c.ad)}" maxlength="40" placeholder="Ör. Yönetim ofisi"></label>
    <label class="lvl" for="it-${i}">Telefon<input id="it-${i}" data-ayl="iletisim:${i}:tel" value="${esc(c.tel)}" maxlength="20" inputmode="tel"></label>
    <button class="btn" type="button" data-ayact="del:iletisim:${i}">Çıkar</button></div>`).join("")}
   ${a.iletisim.length < 8 ? `<button class="btn" type="button" data-ayact="add:iletisim">+ Numara ekle</button>` : ""}</div>
  <div class="row"><div class="head"><b>Profil soruları</b></div>
   ${chk(a.isDurumuSor, 'data-ay="isDurumuSor"', "Bireylerin iş durumunu sor")}
   ${chk(a.telefonZorunlu, 'data-ay="telefonZorunlu"', "Telefon zorunlu olsun")}
   <div class="eyebrow" style="margin-top:10px">Hazır ek alanlar</div>
   ${HAZIR_ALANLAR.map(h => chk((a.hazir || []).includes(h.k), `data-ayh="${h.k}"`, h.label)).join("")}
   <div class="eyebrow" style="margin-top:10px">Siteye özel alanlar</div>
   ${a.ozel.map((o, i) => `<div class="pgrid birey"><label class="lvl" for="oz-${i}">Soru<input id="oz-${i}" data-ayl="ozel:${i}:label" value="${esc(o.label)}" maxlength="40" placeholder="Ör. Bisiklet var mı"></label>
    <label class="lvl" for="ozt-${i}">Tür<select id="ozt-${i}" data-ayl="ozel:${i}:tip">${Object.entries(TIPLER).map(([k, v]) => `<option value="${k}" ${o.tip === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    ${o.tip === "secim" ? `<label class="lvl" for="ozs-${i}">Seçenekler (virgülle)<input id="ozs-${i}" data-ayl="ozel:${i}:secenekler" value="${esc(o.secenekler)}" maxlength="120"></label>` : ""}
    <button class="btn" type="button" data-ayact="del:ozel:${i}">Çıkar</button></div>`).join("")}
   ${a.ozel.length < 8 ? `<button class="btn" type="button" data-ayact="add:ozel">+ Soru ekle</button>` : ""}
   <p class="lvl" style="margin:8px 0 0">Kimlik numarası, sağlık tanısı veya gelir gibi hassas bilgiler sormayın.</p></div>
  ${OZ.egitim ? "" : `<div hidden>`}<div class="row"><div class="head"><b>Gösterilecek modüller</b></div><p class="lvl" style="margin:2px 0 6px">Sitenizle ilgisi olmayan modülleri gizleyebilirsiniz.</p>
   ${M.map(m => chk(!(a.gizliModul || []).includes(m.code), `data-aym="${m.code}"`, `${m.code} · ${esc(m.title)}`)).join("")}</div>${OZ.egitim ? "" : `</div>`}
  <div class="confirm"><button class="btn pri" type="button" data-ayact="save" ${aySaving || SALT ? "disabled" : ""}>Ayarları kaydet</button><span class="lvl" id="ayStatus">${esc(ayStatus) || (ayDirty ? "Kaydedilmemiş değişiklik var" : "")}</span></div>`;
}
function ayarEvent(e) {
  const t = e.target, a = ayDraft; if (!a) return false;
  const redraw = () => { if (e.type === "change" && (t.tagName === "SELECT" || t.type === "checkbox")) { const y = window.scrollY; render(false); window.scrollTo(0, y); } else { const s = document.getElementById("ayStatus"); if (s) s.textContent = "Kaydedilmemiş değişiklik var"; } };
  if (t.dataset.ay) { a[t.dataset.ay] = t.type === "checkbox" ? t.checked : t.value; ayDirty = true; ayStatus = ""; if (t.dataset.ay === "tema" && e.type === "change") { const keep = AYAR; AYAR = { ...AYAR, tema: t.value }; applyAyar(); AYAR = keep; } redraw(); return true; }
  if (t.dataset.ayl) { const [l, i, f] = t.dataset.ayl.split(":"); a[l][+i][f] = t.value; ayDirty = true; ayStatus = ""; if (t.tagName === "SELECT" && e.type === "change") redraw(); return true; }
  if (t.dataset.ayh && e.type === "change") { const k = t.dataset.ayh; a.hazir = t.checked ? [...new Set([...(a.hazir || []), k])] : (a.hazir || []).filter(x => x !== k); ayDirty = true; return true; }
  if (t.dataset.aym && e.type === "change") { const k = t.dataset.aym; a.gizliModul = t.checked ? (a.gizliModul || []).filter(x => x !== k) : [...new Set([...(a.gizliModul || []), k])]; ayDirty = true; return true; }
  return false;
}
async function ayarClick(act) {
  const a = ayDraft;
  if (act.startsWith("add:")) { const l = act.slice(4); a[l].push(l === "bloklar" ? { ad: "", minKat: "0", maxKat: "" } : l === "iletisim" ? { ad: "", tel: "" } : { k: "o" + Date.now().toString(36), label: "", tip: "evethayir", secenekler: "" }); ayDirty = true; }
  else if (act.startsWith("del:")) { const [, l, i] = act.split(":"); a[l].splice(+i, 1); ayDirty = true; }
  else if (act === "save") {
    const n = v => { v = parseInt(v, 10); return Number.isFinite(v) ? v : null; };
    const bloklar = a.bloklar.map(b => ({ ad: String(b.ad || "").trim().toLocaleUpperCase("tr").slice(0, 10), minKat: n(b.minKat) ?? 0, maxKat: n(b.maxKat), ...(n(b.daire) ? { daire: n(b.daire) } : {}) })).filter(b => b.ad);
    if (bloklar.some(b => b.maxKat === null || b.maxKat < b.minKat || b.minKat < -5 || b.maxKat > 80)) { ayStatus = "Her blok için en alt ve en üst katı doğru gir (-5 ile 80 arası)."; return render(false); }
    if (new Set(bloklar.map(b => b.ad)).size !== bloklar.length) { ayStatus = "Aynı blok adı iki kez girilmiş."; return render(false); }
    const td = String(a.toplamDaire ?? "").trim();
    if (td && !(/^\d{1,4}$/.test(td) && +td >= 1 && +td <= 5000)) { ayStatus = "Toplam daire sayısı 1 ile 5000 arasında olmalı."; return render(false); }
    const body = { toplamDaire: td ? +td : null, siteAdi: String(a.siteAdi || "").trim().slice(0, 50), tema: TEMALAR[a.tema] ? a.tema : "yesil", karsilama: String(a.karsilama || "").trim().slice(0, 200),
      duyuru: String(a.duyuru || "").trim().slice(0, 240), bloklar,
      iletisim: a.iletisim.map(c => ({ ad: String(c.ad || "").trim().slice(0, 40), tel: String(c.tel || "").trim().slice(0, 20) })).filter(c => c.ad && c.tel),
      isDurumuSor: !!a.isDurumuSor, telefonZorunlu: !!a.telefonZorunlu, hazir: (a.hazir || []).filter(k => HAZIR_ALANLAR.some(h => h.k === k)),
      ozel: a.ozel.map(o => ({ k: String(o.k).slice(0, 20), label: String(o.label || "").trim().slice(0, 40), tip: TIPLER[o.tip] ? o.tip : "metin", secenekler: o.tip === "secim" ? String(o.secenekler || "").slice(0, 120) : "" })).filter(o => o.label),
      gizliModul: (a.gizliModul || []).filter(c => BY[c]) };
    aySaving = true; ayStatus = "Kaydediliyor…"; render(false);
    try { const r = await api("PUT", "/api/site/ayarlar", body); AYAR = { ...varsayilanAyar(), ...r.ayarlar }; applyAyar(); ayDraft = null; ayDirty = false; ayStatus = "Kaydedildi. Tüm sakinlerde görünüyor."; }
    catch (e) { ayStatus = "Kaydedilemedi: " + e.message; }
    aySaving = false;
  }
  const y = window.scrollY; render(false); window.scrollTo(0, y);
}

/* ---------- Ortak market ve pazar sepeti ---------- */
const eski = () => !!(sepet.tur && KAT.tur.id && sepet.tur !== KAT.tur.id);
const turAcik = () => window.ORTAK.turAcik(KAT.tur, simdi());
const kalanSure = () => window.ORTAK.kalanSure(KAT.tur, simdi());
const fiyatYaz = v => v === "" || v == null || !Number.isFinite(+v) ? "" : `~${(+v).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
const sepetOzet = k => window.ORTAK.sepetOzet(k, KAT.urunler);
function tile(u) { const c = ALT_RENK[u.alt] || ALT_RENK["Diğer"]; return `<span class="tile" style="background:${c}" aria-hidden="true">${esc(u.ad.trim().charAt(0).toLocaleUpperCase("tr"))}</span>`; }
function stepper(u, q, big) {
  const dis = !turAcik() || SALT ? "disabled" : "";
  if (!q) return `<button class="btn addb" type="button" data-sp="q:${esc(u.id)}:1" ${dis}>Ekle</button>`;
  return `<div class="step${big ? " big" : ""}"><button type="button" data-sp="q:${esc(u.id)}:-1" aria-label="${esc(u.ad)} azalt" ${dis}>−</button><output>${q.toLocaleString("tr-TR")} <small>${esc(u.birim)}</small></output><button type="button" data-sp="q:${esc(u.id)}:1" aria-label="${esc(u.ad)} artır" ${dis}>+</button></div>`;
}
function turKarti() {
  const t = KAT.tur; if (!t.id) return bos("cart", "Henüz açık bir alışveriş turu yok.", ADMIN ? "Katalog sekmesinden fiyatları girip ilk turu başlatabilirsiniz." : "Yönetim yeni bir pazar ya da market turu açtığında burada göreceksin. Şimdilik ürünlere göz atabilirsin.");
  return `<div class="turk"><div><div class="eyebrow">${turAcik() ? "Sipariş açık" : "Sipariş kapalı"}</div><b>${esc(t.ad || "Alışveriş turu")}</b>${t.teslim ? `<div class="lvl">Teslim: ${esc(t.teslim)}</div>` : ""}</div>${t.sonTarih ? `<span class="chip ${turAcik() ? "ok" : "warn"}">${kalanSure()}</span>` : ""}</div>`;
}
function viewSepet() {
  const tabs = `<div class="seg" role="tablist"><button type="button" data-sp="mode:alis" aria-pressed="${spMode === "alis"}">Alışveriş</button><button type="button" data-sp="mode:sepetim" aria-pressed="${spMode === "sepetim"}">Sepetim</button>${YONETIM ? `<button type="button" data-sp="mode:siparis" aria-pressed="${spMode === "siparis"}">Toplu sipariş</button>` : ""}${ADMIN ? `<button type="button" data-sp="mode:katalog" aria-pressed="${spMode === "katalog"}">Katalog</button>` : ""}</div>`;
  let h = `<p class="eyebrow">Ortak alışveriş${AYAR.siteAdi ? " · " + esc(AYAR.siteAdi) : ""}</p><h2 class="title">Market ve pazar</h2>${tabs}`;
  if (spMode === "siparis" && YONETIM) return h + viewSiparis();
  if (spMode === "katalog" && ADMIN) return h + viewKatalog();
  h += turKarti();
  if (!profil) h += `<div class="scorebox"><b>Önce profilini oluştur</b><p class="lvl" style="margin:4px 0 8px">Siparişin blok, kat ve daireye göre teslim edilir.</p><a class="chip acc" href="#profil">Profilimi oluştur →</a></div>`;
  if (eski() && Object.keys(sepet.kalemler).length) h += `<div class="scorebox"><b>Önceki turdan kalan sepetin var</b><p class="lvl" style="margin:4px 0 8px">Aynı ürünlerle bu tura sipariş verebilirsin.</p><button class="btn" type="button" data-sp="tasi" ${turAcik() && !SALT ? "" : "disabled"}>Bu tura taşı</button> <button class="btn" type="button" data-sp="bosalt" ${SALT ? "disabled" : ""}>Boşalt</button></div>`;
  const oz = sepetOzet(eski() ? {} : sepet.kalemler);
  if (spMode === "sepetim") {
    const items = Object.entries(eski() ? {} : sepet.kalemler).map(([id, q]) => [KAT.urunler.find(u => u.id === id), q]).filter(([u, q]) => u && q);
    h += items.length ? `<div class="clist">${items.map(([u, q]) => `<div class="citem">${tile(u)}<div class="cn"><b>${esc(u.ad)}</b><small>${esc(u.alt)} · ${fiyatYaz(u.fiyat) || "fiyat sorulacak"}${u.fiyat !== "" ? ` · satır ~${(q * u.fiyat).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL` : ""}</small></div>${stepper(u, q, true)}</div>`).join("")}</div>
      <label class="lvl" for="spNot" style="display:block;margin-top:12px">Not (ör. olgun olmasın, kapıya bırakın)<textarea id="spNot" data-spnot="1" maxlength="200" ${turAcik() && !SALT ? "" : "disabled"}>${esc(sepet.not)}</textarea></label>
      <div class="scorebox" style="margin-top:12px"><div class="head" style="display:flex;justify-content:space-between"><span>${oz.n} ürün</span><b>${oz.t ? "~" + oz.t.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + " TL" : "—"}</b></div><p class="lvl" style="margin:6px 0 0">Fiyatlar tahminidir${oz.eksik ? "; bazı ürünlerin fiyatı teslimde belli olur" : ""}. Ödeme yönetimin belirlediği şekilde yapılır; bu sayfa ödeme almaz.</p></div>`
      : bos("cart", "Sepetin şimdilik boş", "Pazar ve market ürünlerine göz at; istediğini “Ekle” ile sepete koy. Son sipariş zamanına kadar değiştirebilirsin.", `<button class="btn pri" type="button" data-sp="mode:alis">Ürünlere göz at</button>`);
  } else {
    const list = KAT.urunler.filter(u => u.aktif !== false && u.kat === spF.kat);
    h += `<div class="seg two"><button type="button" data-sp="kat:pazar" aria-pressed="${spF.kat === "pazar"}">Pazar</button><button type="button" data-sp="kat:market" aria-pressed="${spF.kat === "market"}">Market</button></div>
      <input id="spAra" data-spara="1" value="${esc(spF.q)}" placeholder="Ürün ara: domates, süt…" autocomplete="off" style="margin:8px 0 4px">`;
    if (!list.length) h += bos("list", "Bu bölümde henüz ürün yok", ADMIN ? "“Katalog” sekmesinden ürün ekleyebilirsiniz." : "Yönetim ürün ekledikçe burada görünecek.");
    for (const alt of ALT[spF.kat]) {
      const us = list.filter(u => u.alt === alt); if (!us.length) continue;
      h += `<section class="altg" data-alt="${esc(alt)}"><h3 class="eyebrow" style="margin:16px 0 8px">${esc(alt)}</h3><div class="pcards">${us.map(u => { const q = eski() ? 0 : (+sepet.kalemler[u.id] || 0); return `<div class="pcard${q ? " on" : ""}" data-name="${esc(u.ad.toLocaleLowerCase("tr"))}">${tile(u)}<b>${esc(u.ad)}</b><small>${esc(u.birim)}${fiyatYaz(u.fiyat) ? " · " + fiyatYaz(u.fiyat) : ""}</small>${stepper(u, q)}</div>`; }).join("")}</div></section>`;
    }
  }
  h += `<div class="cartbar"><button type="button" data-sp="mode:${spMode === "sepetim" ? "alis" : "sepetim"}"><span>${spMode === "sepetim" ? "← Ürünlere dön" : `Sepetim · ${oz.n} ürün`}</span><b>${oz.t ? "~" + oz.t.toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " TL" : ""}</b></button><small id="spStatus">${esc(spStatus)}</small></div>`;
  return h;
}
async function sipYukle() {
  try { SIP = await api("GET", "/api/yonetim/siparis"); sipHata = ""; } catch (e) { sipHata = e.message; }
  if (current === "sepet" && spMode === "siparis") render(false);
}
function viewSiparis() {
  if (!SIP) { if (!sipHata) sipYukle(); return turKarti() + `<p class="lvl">${sipHata ? esc(sipHata) : ""}</p>${sipHata ? "" : iskelet(2)}`; }
  const sp = SIP.teslimat, ag = SIP.urunler, top = SIP.toplam;
  let h = turKarti() + `<div class="summary" style="margin-top:12px"><div><b>${SIP.hane}</b><span>hane sipariş verdi</span></div><div><b>${ag.length}</b><span>farklı ürün</span></div><div><b>${top ? "~" + Math.round(top).toLocaleString("tr-TR") : "—"}</b><span>tahmini TL</span></div></div>`;
  h += `<div class="confirm"><button class="btn" type="button" data-sp="yenile">Yenile</button></div>`;
  if (!sp.length) return h + bos("truck", "Bu turda henüz sipariş yok", "Sakinler sepetlerine ürün ekledikçe ürün toplamları ve teslimat listesi burada oluşur.");
  h += `<div class="confirm"><button class="btn" type="button" data-sp="kopyala">Tedarikçi listesini kopyala</button>${ADMIN ? `<a class="btn" href="/api/yonetim/siparis.csv?liste=urun" download>Ürün listesi (CSV)</a><a class="btn" href="/api/yonetim/siparis.csv?liste=teslimat" download>Teslimat listesi (CSV)</a>` : ""}<span class="lvl" id="kopyaDurum"></span></div>
   <h3 class="eyebrow" style="margin:16px 0 6px">Ürün bazında toplam</h3><div class="tbl"><table><thead><tr><th>Ürün</th><th>Miktar</th><th>Hane</th><th>Tahmini</th></tr></thead><tbody>${ag.map(a => `<tr><td>${esc(a.ad)}</td><td>${a.q.toLocaleString("tr-TR")} ${esc(a.birim)}</td><td>${a.h}</td><td>${a.fiyat !== "" ? "~" + (a.q * a.fiyat).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + " TL" : "—"}</td></tr>`).join("")}</tbody></table></div>
   <h3 class="eyebrow" style="margin:16px 0 6px">Teslimat listesi (blok · kat · daire)</h3>`;
  h += sp.map(d => `<div class="row"><div class="head"><b>${esc(d.blok || "?")} Blok · ${katAd(d.kat)} · Daire ${esc(d.daire || "?")}</b><span class="lvl">${d.n} ürün${d.t ? " · ~" + Math.round(d.t).toLocaleString("tr-TR") + " TL" : ""}</span></div>
    <p style="margin:6px 0 0">${d.kalemler.map(k => `${esc(k.ad)} ${k.q.toLocaleString("tr-TR")} ${esc(k.birim)}`).join(" · ")}</p>${d.not ? `<p class="lvl" style="margin:4px 0 0">Not: ${esc(d.not)}</p>` : ""}</div>`).join("");
  return h;
}
function viewKatalog() {
  if (!kdDraft) kdDraft = JSON.parse(JSON.stringify(KAT));
  const k = kdDraft, t = k.tur;
  let h = `<div class="row"><div class="head"><b>Alışveriş turu</b>${k.yeniTur ? `<span class="chip warn">Yeni tur (kaydedilmedi)</span>` : ""}</div><div class="pgrid">
   <label class="lvl" for="kt-ad">Tur adı<input id="kt-ad" data-kt="ad" value="${esc(t.ad)}" maxlength="50" placeholder="Ör. Cumartesi pazarı"></label>
   <label class="lvl" for="kt-son">Son sipariş zamanı<input id="kt-son" type="datetime-local" data-kt="sonTarih" value="${esc(t.sonTarih)}"></label>
   <label class="lvl" for="kt-tes">Teslim bilgisi<input id="kt-tes" data-kt="teslim" value="${esc(t.teslim)}" maxlength="80" placeholder="Ör. Cumartesi 14:00, blok girişleri"></label></div>
   <label class="lvl" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="kt-acik" data-kt="acik" ${t.acik ? "checked" : ""} style="width:auto"> Siparişe açık</label>
   <div class="confirm">${kdYeniTurSor ? `<span class="lvl">Yeni tur başlatılınca sakinlerin mevcut sepetleri bu tura sayılmaz.</span><button class="btn danger" type="button" data-sp="yenitur:evet">Yeni turu başlat</button><button class="btn" type="button" data-sp="yenitur:hayir">Vazgeç</button>` : `<button class="btn" type="button" data-sp="yenitur:sor">${t.id || k.yeniTur ? "Yeni tur başlat" : "İlk turu başlat"}</button>`}</div></div>
  <div class="row"><div class="head"><b>Ürünler (${k.urunler.length})</b></div>
   ${!k.urunler.length ? `<p class="lvl">Katalog boş. Örnek listeyi yükleyip düzenleyebilirsiniz; fiyatlar boş gelir, siz girersiniz.</p><button class="btn" type="button" data-sp="ornek">Örnek kataloğu yükle</button>` : ""}
   ${k.urunler.map((u, i) => `<div class="pgrid birey">
    <label class="lvl" for="ku-${i}">Ürün<input id="ku-${i}" data-ku="${i}:ad" value="${esc(u.ad)}" maxlength="40"></label>
    <label class="lvl" for="kk-${i}">Bölüm<select id="kk-${i}" data-ku="${i}:kat"><option value="pazar" ${u.kat === "pazar" ? "selected" : ""}>Pazar</option><option value="market" ${u.kat === "market" ? "selected" : ""}>Market</option></select></label>
    <label class="lvl" for="ka-${i}">Tür<select id="ka-${i}" data-ku="${i}:alt">${ALT[u.kat].map(a => `<option ${a === u.alt ? "selected" : ""}>${a}</option>`).join("")}</select></label>
    <label class="lvl" for="kb-${i}">Birim<select id="kb-${i}" data-ku="${i}:birim">${BIRIMLER.map(b => `<option ${b === u.birim ? "selected" : ""}>${b}</option>`).join("")}</select></label>
    <label class="lvl" for="kf-${i}">Tahmini fiyat (TL)<input id="kf-${i}" data-ku="${i}:fiyat" value="${esc(u.fiyat)}" inputmode="decimal"></label>
    <label class="lvl" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-ku="${i}:aktif" ${u.aktif !== false ? "checked" : ""} style="width:auto"> Satışta</label></div>`).join("")}
   ${k.urunler.length < 300 ? `<button class="btn" type="button" data-sp="urunekle" style="margin-top:8px">+ Ürün ekle</button>` : ""}</div>
  <div class="confirm"><button class="btn pri" type="button" data-sp="kdkaydet" ${SALT ? "disabled" : ""}>Kataloğu ve turu kaydet</button><span class="lvl" id="kdStatus">${esc(kdStatus) || (kdDirty ? "Kaydedilmemiş değişiklik var" : "")}</span></div>`;
  return h;
}
function spRedraw() { const y = window.scrollY; render(false); window.scrollTo(0, y); navGuncelle(); }
function spQueue() { spStatus = "Kaydediliyor…"; clearTimeout(spSaveT); spSaveT = setTimeout(spFlush, 700); }
async function spFlush() {
  spSaveT = null; if (spSaving) { spPend = true; return; } spSaving = true;
  const kal = Object.fromEntries(Object.entries(sepet.kalemler).filter(([id, q]) => q > 0 && KAT.urunler.some(u => u.id === id))); sepet.kalemler = { ...kal };
  try { const r = await api("PUT", "/api/sepet", { kalemler: kal, not: String(sepet.not || "").slice(0, 200) }); sepet.tur = r.sepet.tur; spStatus = "Sepet kaydedildi"; SIP = null; }
  catch (e) { spStatus = "Kaydedilemedi: " + e.message; }
  spSaving = false; const s = document.getElementById("spStatus"); if (s) s.textContent = spStatus; if (spPend) { spPend = false; spFlush(); }
}
async function sepetClick(a) {
  const [k, x, y] = a.split(":");
  if (k === "mode") { spMode = x; if (x === "siparis") SIP = null; render(false); window.scrollTo(0, 0); return; }
  if (k === "kat") { spF.kat = x; spF.q = ""; try { localStorage.setItem("bss-sepetF", JSON.stringify(spF)); } catch (e) { /* yok */ } return spRedraw(); }
  if (k === "yenile") { SIP = null; sipHata = ""; return spRedraw(); }
  if (k === "q") {
    if (!turAcik() || SALT) return; if (!profil) { location.hash = "#profil"; return; } const u = KAT.urunler.find(z => z.id === x); if (!u) return;
    const st = adimFor(u.birim), cur = +sepet.kalemler[x] || 0, nv = Math.max(0, Math.min(99, Math.round((cur + st * (+y)) * 2) / 2));
    if (eski()) { sepet.kalemler = {}; sepet.tur = KAT.tur.id; } if (nv) sepet.kalemler[x] = nv; else delete sepet.kalemler[x]; spQueue(); spRedraw();
    if (!cur && nv) { bildir(`${u.ad} sepete eklendi`); const kart = document.querySelector(`.pcard[data-name="${CSS.escape(u.ad.toLocaleLowerCase("tr"))}"]`); if (kart) { kart.classList.add("eklendi"); setTimeout(() => kart.classList.remove("eklendi"), 700); } }
    else if (cur && !nv) bildir(`${u.ad} sepetten çıkarıldı`);
    return;
  }
  if (k === "tasi") { sepet.tur = KAT.tur.id; spQueue(); return spRedraw(); }
  if (k === "bosalt") { sepet = { kalemler: {}, not: "", tur: KAT.tur.id }; spQueue(); return spRedraw(); }
  if (k === "kopyala") {
    const t = `${KAT.tur.ad || "Sipariş"}${AYAR.siteAdi ? " · " + AYAR.siteAdi : ""}\n` + SIP.urunler.map(a => `${a.ad}: ${a.q.toLocaleString("tr-TR")} ${a.birim}`).join("\n");
    const el = document.getElementById("kopyaDurum");
    try { await navigator.clipboard.writeText(t); if (el) el.textContent = "Kopyalandı"; } catch (e) { if (el) { el.textContent = t; el.style.whiteSpace = "pre-line"; el.style.userSelect = "all"; } }
    return;
  }
  if (!kdDraft) return;
  if (k === "ornek") { kdDraft.urunler = JSON.parse(JSON.stringify(ORNEK_KATALOG)); kdDirty = true; }
  else if (k === "urunekle") { kdDraft.urunler.push({ id: "u" + Date.now().toString(36), ad: "", kat: spF.kat, alt: ALT[spF.kat][0], birim: "adet", fiyat: "", aktif: true }); kdDirty = true; }
  else if (k === "yenitur") { if (x === "sor") kdYeniTurSor = true; else if (x === "hayir") kdYeniTurSor = false; else { kdDraft.yeniTur = true; kdDraft.tur.acik = true; kdYeniTurSor = false; kdDirty = true; kdStatus = "Yeni tur hazır; kaydetmeyi unutmayın."; } }
  else if (k === "kdkaydet") {
    const urunler = kdDraft.urunler.map(u => ({ id: String(u.id).slice(0, 24), ad: String(u.ad || "").trim().slice(0, 40), kat: u.kat === "market" ? "market" : "pazar", alt: ALT[u.kat === "market" ? "market" : "pazar"].includes(u.alt) ? u.alt : "Diğer", birim: BIRIMLER.includes(u.birim) ? u.birim : "adet", fiyat: u.fiyat === "" || !Number.isFinite(+String(u.fiyat).replace(",", ".")) ? "" : Math.max(0, +String(u.fiyat).replace(",", ".")), aktif: u.aktif !== false })).filter(u => u.ad);
    const t = kdDraft.tur, tur = { ad: String(t.ad || "").trim().slice(0, 50), sonTarih: String(t.sonTarih || "").slice(0, 16), teslim: String(t.teslim || "").trim().slice(0, 80), acik: !!t.acik };
    if (tur.acik && !t.id && !kdDraft.yeniTur) { kdStatus = "Önce bir tur başlatın."; return spRedraw(); }
    kdStatus = "Kaydediliyor…"; spRedraw();
    try { const r = await api("PUT", "/api/katalog", { urunler, tur, yeniTur: !!kdDraft.yeniTur }); KAT = r.katalog; saatFarki = r.simdi - Date.now(); kdDraft = null; kdDirty = false; kdStatus = "Kaydedildi."; SIP = null; }
    catch (e) { kdStatus = "Kaydedilemedi: " + e.message; }
  }
  spRedraw();
}
function spAra() { const q = String(spF.q || "").toLocaleLowerCase("tr").trim(); document.querySelectorAll(".pcard").forEach(c => c.hidden = !!q && !c.dataset.name.includes(q)); document.querySelectorAll(".altg").forEach(g => g.hidden = ![...g.querySelectorAll(".pcard")].some(c => !c.hidden)); }
function sepetEvent(e) {
  const t = e.target;
  if (t.dataset.spara) { spF.q = t.value; spAra(); return true; }
  if (t.dataset.spnot) { sepet.not = t.value; spQueue(); const s = document.getElementById("spStatus"); if (s) s.textContent = spStatus; return true; }
  if (!kdDraft) return false;
  if (t.dataset.kt) { kdDraft.tur[t.dataset.kt] = t.type === "checkbox" ? t.checked : t.value; kdDirty = true; return true; }
  if (t.dataset.ku) { const [i, f] = t.dataset.ku.split(":"); const u = kdDraft.urunler[+i]; u[f] = t.type === "checkbox" ? t.checked : t.value; if (f === "kat") u.alt = ALT[u.kat][0]; kdDirty = true; if (e.type === "change" && t.tagName === "SELECT") spRedraw(); return true; }
  return false;
}

/* ---------- Sakin profili ve kategoriler ---------- */
function blankProfil() { return { ad: "", telefon: "", blok: "", kat: "", daire: "", durum: "", tasinma: "", bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "" }], yardim: false, yardimNot: "", kvkk: false, ek: {} }; }
function konum(p) { return `${esc(p.blok || "?")} Blok · ${katAd(p.kat)} · Daire ${esc(p.daire || "?")}`; }
function viewProfil() {
  if (!pDraft) pDraft = profil ? JSON.parse(JSON.stringify({ ...blankProfil(), ...profil })) : blankProfil();
  const p = pDraft, cats = kategoriler(p, true), yol = onerilenYol(p);
  const opt = (arr, v, ph) => `<option value="">${ph}</option>` + arr.map(a => `<option ${a === v ? "selected" : ""}>${a}</option>`).join("");
  return `<p class="eyebrow">Sakin profili · yalnızca sen ve site yönetimi görür</p><h2 class="title">Profilim</h2>
  <p class="lead">Dairen ve hanen hakkındaki bilgiler, seni doğru gruba yerleştirmek, sana uygun modülleri önermek, duyuruları ve acil durum planını doğru kişilere ulaştırmak için kullanılır. Diğer sakinler bu bilgileri göremez.</p>
  ${profil && !pDirty ? `<div class="scorebox"><div class="eyebrow">Kategorilerin</div><div class="chips" style="margin:6px 0 0"><span class="chip acc">${konum(p)}</span>${cats.map(c => `<span class="chip ${c.startsWith("Acil") ? "warn" : ""}">${esc(c)}</span>`).join("")}</div>
   ${OZ.egitim ? `<div class="eyebrow" style="margin-top:10px">Senin için önerilen yol</div><div class="chips" style="margin:6px 0 0">${yol.map(c => `<a class="chip ${sc(c) >= 6 ? "ok" : ""}" href="#${c}">${c} · ${esc(BY[c].title)}${sc(c) ? ` · ${sc(c)}` : ""}</a>`).join("")}</div>` : ""}</div>` : ""}
  <div class="row"><div class="head"><b>Konum</b></div>
   <div class="pgrid">
    ${AYAR.bloklar.length ? (() => {
      const bl = AYAR.bloklar.find(b => b.ad === p.blok); const katlar = bl ? Array.from({ length: bl.maxKat - bl.minKat + 1 }, (_, i) => bl.minKat + i) : [];
      return `<label class="lvl" for="pf-blok">Blok<select id="pf-blok" data-pf="blok"><option value="">Seç</option>${AYAR.bloklar.map(b => `<option value="${esc(b.ad)}" ${b.ad === p.blok ? "selected" : ""}>${esc(b.ad)} Blok</option>`).join("")}</select></label>
      <label class="lvl" for="pf-kat">Kat<select id="pf-kat" data-pf="kat" ${bl ? "" : "disabled"}><option value="">${bl ? "Seç" : "Önce blok seç"}</option>${katlar.map(k => `<option value="${k}" ${String(k) === String(p.kat) ? "selected" : ""}>${katAd(k)}</option>`).join("")}</select></label>`;
    })()
    : `<label class="lvl" for="pf-blok">Blok<input id="pf-blok" data-pf="blok" value="${esc(p.blok)}" placeholder="Ör. A" maxlength="10" autocapitalize="characters"></label>
    <label class="lvl" for="pf-kat">Kat<input id="pf-kat" data-pf="kat" value="${esc(p.kat)}" inputmode="numeric" placeholder="Ör. 2 (zemin 0)"></label>`}
    ${(() => {
      const bl = AYAR.bloklar.find(b => b.ad === p.blok);
      if (!AYAR.bloklar.length || !bl || !Number.isInteger(bl.daire)) return `<label class="lvl" for="pf-daire">Daire no<input id="pf-daire" data-pf="daire" value="${esc(p.daire)}" placeholder="Ör. 7" maxlength="10"></label>`;
      return `<label class="lvl" for="pf-daire">Daire no<select id="pf-daire" data-pf="daire"><option value="">Seç</option>${Array.from({ length: bl.daire }, (_, i) => String(i + 1)).map(d => `<option value="${d}" ${d === String(p.daire) ? "selected" : ""}>${d}</option>`).join("")}</select></label>`;
    })()}
    <label class="lvl" for="pf-durum">Oturma durumu<select id="pf-durum" data-pf="durum">${opt(DURUM, p.durum, "Seç")}</select></label>
    <label class="lvl" for="pf-tasinma">Taşınma yılı<input id="pf-tasinma" data-pf="tasinma" value="${esc(p.tasinma)}" inputmode="numeric" placeholder="Ör. ${BUYIL}"></label>
   </div></div>
  <div class="row"><div class="head"><b>Hanede yaşayanlar (${p.bireyler.length})</b></div>
   <p class="lvl" style="margin:2px 0 8px">Ad ve doğum tarihi istenmez; yalnızca yakınlık, yaş grubu${AYAR.isDurumuSor ? " ve iş durumu" : ""}.</p>
   ${p.bireyler.map((b, i) => `<div class="pgrid birey">
     <label class="lvl" for="b-${i}-y">Yakınlık<select id="b-${i}-y" data-bf="${i}:yakinlik">${opt(YAKINLIK, b.yakinlik, "Seç")}</select></label>
     <label class="lvl" for="b-${i}-a">Yaş grubu<select id="b-${i}-a" data-bf="${i}:yas">${opt(YAS, b.yas, "Seç")}</select></label>
     ${AYAR.isDurumuSor ? `<label class="lvl" for="b-${i}-i">İş durumu<select id="b-${i}-i" data-bf="${i}:is">${opt(IS, b.is, "Seç")}</select></label>` : ""}
     ${p.bireyler.length > 1 ? `<button class="btn" type="button" data-pact="del:${i}" aria-label="${i + 1}. bireyi çıkar">Çıkar</button>` : ""}</div>`).join("")}
   ${p.bireyler.length < 12 ? `<button class="btn" type="button" data-pact="add">+ Birey ekle</button>` : ""}</div>
  ${ekAlanlar().length ? `<div class="row"><div class="head"><b>${esc(AYAR.siteAdi || "Site")} için ek bilgiler (isteğe bağlı)</b></div><div class="pgrid">${ekAlanlar().map(a => `<label class="lvl" for="ek-${esc(a.k)}">${esc(a.label)}${ekInput(a, (p.ek || {})[a.k], "ek-" + a.k)}</label>`).join("")}</div></div>` : ""}
  <div class="row"><div class="head"><b>İletişim${AYAR.telefonZorunlu ? "" : " (isteğe bağlı)"}</b></div>
   <div class="pgrid">
    <label class="lvl" for="pf-ad">Yönetimin hitap edeceği ad<input id="pf-ad" data-pf="ad" value="${esc(p.ad)}" maxlength="60" autocomplete="name"></label>
    <label class="lvl" for="pf-tel">Telefon${AYAR.telefonZorunlu ? " (zorunlu)" : ""}<input id="pf-tel" data-pf="telefon" value="${esc(p.telefon)}" inputmode="tel" maxlength="20" autocomplete="tel"></label>
   </div></div>
  <div class="row"><div class="head"><b>Acil durum (isteğe bağlı)</b></div>
   <label class="lvl" style="display:flex;gap:8px;align-items:flex-start;margin-top:6px"><input type="checkbox" id="pf-yardim" data-pf="yardim" ${p.yardim ? "checked" : ""} style="width:auto;margin-top:4px"> Yangın, deprem veya tahliyede hanemizden birinin yardıma ihtiyacı olabilir.</label>
   ${p.yardim ? `<input id="pf-ynot" data-pf="yardimNot" value="${esc(p.yardimNot)}" maxlength="120" placeholder="Kısaca: ör. tekerlekli sandalye, yatağa bağlı, bebek (tanı yazma)">` : ""}
   <p class="lvl" style="margin:6px 0 0">Bu bilgi yalnızca tahliye planı için kullanılır. Sağlık tanısı yazma.</p></div>
  <div class="row"><label class="lvl" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="pf-kvkk" data-pf="kvkk" ${p.kvkk ? "checked" : ""} style="width:auto;margin-top:4px"> <span>Bu bilgilerin site yönetimi tarafından gruplama, duyuru ve acil durum planı amacıyla saklanmasını kabul ediyorum. Profilimi istediğim zaman silebilirim. <a href="/aydinlatma.html">Aydınlatma metni</a></span></label></div>
  <div class="confirm"><button class="btn pri" type="button" data-pact="save" ${pSaving || SALT ? "disabled" : ""}>${profil ? "Profili güncelle" : "Profili kaydet"}</button><span class="lvl" id="pStatus">${esc(pStatus) || (pDirty ? "Kaydedilmemiş değişiklik var" : "")}</span></div>
  ${profil ? `<div class="confirm">${pDelAsk ? `<span class="lvl">Profilin ve bu sitedeki sepetin kalıcı olarak silinecek.</span><button class="btn danger" type="button" data-pact="delyes">Evet, sil</button><button class="btn" type="button" data-pact="delno">Vazgeç</button>` : `<button class="btn danger" type="button" data-pact="delask">Profilimi sil</button>`}</div>` : ""}`;
}
async function saveProfil() {
  const p = pDraft, kat = parseInt(p.kat, 10), tas = parseInt(p.tasinma, 10);
  if (!String(p.blok).trim() || !Number.isFinite(kat) || !String(p.daire).trim() || !p.durum) { pStatus = "Blok, kat, daire ve oturma durumu zorunlu."; return render(false); }
  if (kat < -5 || kat > 80) { pStatus = "Kat -5 ile 80 arasında olmalı."; return render(false); }
  if (p.tasinma && (!Number.isFinite(tas) || tas < 1950 || tas > BUYIL)) { pStatus = `Taşınma yılı 1950–${BUYIL} arasında olmalı.`; return render(false); }
  if (p.bireyler.some(b => !b.yakinlik || !b.yas)) { pStatus = "Her birey için yakınlık ve yaş grubu seç."; return render(false); }
  if (AYAR.telefonZorunlu && !String(p.telefon || "").trim()) { pStatus = "Bu sitede telefon zorunlu."; return render(false); }
  if (AYAR.bloklar.length) { const bl = AYAR.bloklar.find(b => b.ad === p.blok); if (!bl || kat < bl.minKat || kat > bl.maxKat) { pStatus = "Blok ve katı listeden seç."; return render(false); }
    if (Number.isInteger(bl.daire) && !(/^\d+$/.test(String(p.daire).trim()) && +p.daire >= 1 && +p.daire <= bl.daire)) { pStatus = `${bl.ad} Blok için daire numarasını 1–${bl.daire} arasından seç.`; return render(false); } }
  if (!p.kvkk) { pStatus = "Kaydetmek için onay kutusunu işaretle."; return render(false); }
  const body = { ad: String(p.ad || "").trim().slice(0, 60), telefon: String(p.telefon || "").trim().slice(0, 20),
    blok: String(p.blok).trim().toLocaleUpperCase("tr").slice(0, 10), kat, daire: String(p.daire).trim().slice(0, 10), durum: p.durum,
    tasinma: Number.isFinite(tas) ? tas : "", bireyler: p.bireyler.slice(0, 12).map(b => ({ yakinlik: b.yakinlik, yas: b.yas, is: AYAR.isDurumuSor ? (b.is || "") : "" })),
    ek: Object.fromEntries(ekAlanlar().map(a => [a.k, String((p.ek || {})[a.k] ?? "").trim().slice(0, 40)]).filter(([, v]) => v)),
    yardim: !!p.yardim, yardimNot: p.yardim ? String(p.yardimNot || "").trim().slice(0, 120) : "", kvkk: true };
  pSaving = true; pStatus = "Kaydediliyor…"; render(false);
  try { const r = await api("PUT", "/api/profil", body); profil = r.profil; pDraft = null; pDirty = false; pStatus = "Kaydedildi."; }
  catch (e) { pStatus = "Kaydedilemedi: " + e.message; }
  pSaving = false; render(false);
}
async function delProfil() {
  try { await api("DELETE", "/api/profil"); profil = null; pDraft = null; pDirty = false; sepet = { kalemler: {}, not: "", tur: "" }; pStatus = "Profilin silindi."; }
  catch (e) { pStatus = "Silinemedi: " + e.message; }
  pDelAsk = false; render(false);
}
async function sakinYukle() {
  try { tumSakinler = (await api("GET", "/api/yonetim/sakinler")).sakinler; sakinHata = ""; } catch (e) { sakinHata = e.message; tumSakinler = []; }
  if (current === "sakinler") render(false);
}
function viewSakinler() {
  if (!YONETIM) return `<div class="pending">Bu bölüm yalnızca site yönetimine açık.</div>`;
  if (!tumSakinler) { sakinYukle(); return `${iskelet()}`; }
  const all = tumSakinler.filter(p => p && p.blok);
  const bloklar = [...new Set(all.map(p => p.blok))].sort((a, b) => a.localeCompare(b, "tr"));
  const katlar = [...new Set(all.filter(p => !aF.blok || p.blok === aF.blok).map(p => p.kat))].sort((a, b) => a - b);
  const list = all.filter(p => (!aF.blok || p.blok === aF.blok) && (aF.kat === "" || String(p.kat) === aF.kat))
    .sort((a, b) => a.blok.localeCompare(b.blok, "tr") || a.kat - b.kat || String(a.daire).localeCompare(String(b.daire), "tr", { numeric: true }));
  const kisi = list.reduce((n, p) => n + (p.bireyler || []).length, 0);
  const cnt = {}; list.forEach(p => kategoriler(p, true).forEach(c => { const k = c.replace(/\(\d+\)$/, "").replace(/^\d+ kişilik hane$/, "").trim(); if (k) cnt[k] = (cnt[k] || 0) + 1; }));
  const isd = {}; list.forEach(p => (p.bireyler || []).filter(b => b.yas === "18–64" || b.yas === "65+").forEach(b => { const k = b.is || "Belirtilmemiş"; isd[k] = (isd[k] || 0) + 1; }));
  const yardim = list.filter(p => p.yardim);
  ekAlanlar().filter(a => a.tip === "evethayir").forEach(a => { const n = list.filter(p => (p.ek || {})[a.k] === "Evet").length; if (n) cnt[a.label] = n; });
  const opt = (arr, v, f) => arr.map(a => `<option value="${esc(a)}" ${String(a) === String(v) ? "selected" : ""}>${esc(f ? f(a) : a)}</option>`).join("");
  let h = `<p class="eyebrow">Yalnızca site yönetimi görür${ROL === "site_denetci" ? " · denetçi: salt-okur" : ""}</p><h2 class="title">Sakinler</h2>
  <p class="lead">Sakinlerin doldurduğu profiller. Bu bilgiler kişisel veridir: yalnızca gruplama, duyuru ve acil durum planı için kullan, dışarıya aktarma.</p>
  ${sakinHata ? `<p class="err">${esc(sakinHata)}</p>` : ""}
  <div class="confirm" style="margin:0 0 12px"><button class="btn" type="button" data-act="sakinYenile">Yenile</button>${ADMIN ? `<a class="btn" href="/api/yonetim/sakinler.csv" download>Sakin listesi (CSV)</a>` : ""}</div>
  <div class="pgrid" style="margin-bottom:12px"><label class="lvl" for="aBlok">Blok<select id="aBlok" data-af="blok"><option value="">Tüm bloklar</option>${opt(bloklar, aF.blok)}</select></label>
   <label class="lvl" for="aKat">Kat<select id="aKat" data-af="kat"><option value="">Tüm katlar</option>${opt(katlar, aF.kat, katAd)}</select></label></div>
  <div class="summary"><div><b>${list.length}</b><span>hane</span></div><div><b>${kisi}</b><span>kişi</span></div><div><b>${yardim.length}</b><span>acil yardım gerekebilir</span></div></div>`;
  if (!all.length) return h + bos("users", "Henüz profil yok", "Sakinler “Profilim” sekmesinden blok, kat, daire ve hane bilgilerini girdikçe burada gruplanır. Davet bağlantısını “Üyeler”den paylaşabilirsiniz.");
  h += `<h3 class="eyebrow" style="margin:18px 0 6px">Kategoriler</h3><div class="chips">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="chip ${k.startsWith("Acil") ? "warn" : ""}">${esc(k)} · ${n}</span>`).join("")}</div>
  <h3 class="eyebrow" style="margin:18px 0 6px">Yetişkinlerin iş durumu</h3><div class="tbl"><table><thead><tr><th>Durum</th><th>Kişi</th></tr></thead><tbody>${Object.entries(isd).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td></tr>`).join("")}</tbody></table></div>`;
  if (yardim.length) h += `<h3 class="eyebrow" style="margin:18px 0 6px">Tahliyede öncelikli haneler</h3><div class="tbl"><table><thead><tr><th>Konum</th><th>Not</th><th>Telefon</th></tr></thead><tbody>${yardim.map(p => `<tr><td>${konum(p)}</td><td>${esc(p.yardimNot || "—")}</td><td>${esc(p.telefon || "—")}</td></tr>`).join("")}</tbody></table></div>`;
  h += `<h3 class="eyebrow" style="margin:18px 0 6px">Haneler</h3><div class="tbl"><table><thead><tr><th>Konum</th><th>Durum</th><th>Kişi</th><th>Kategoriler</th>${ekAlanlar().length ? "<th>Ek bilgiler</th>" : ""}<th>İletişim</th></tr></thead><tbody>${list.map(p => `<tr><td>${konum(p)}</td><td>${esc(p.durum)}</td><td>${(p.bireyler || []).length}</td><td>${kategoriler(p, false).slice(1).map(esc).join(", ")}</td>${ekAlanlar().length ? `<td>${ekAlanlar().filter(a => (p.ek || {})[a.k]).map(a => `${esc(a.label)}: ${esc(p.ek[a.k])}`).join("<br>")}</td>` : ""}<td>${esc(p.ad || "")}${p.telefon ? `<br>${esc(p.telefon)}` : ""}</td></tr>`).join("")}</tbody></table></div>`;
  return h;
}
function profilEvent(e) {
  const t = e.target;
  if (current !== "profil" && current !== "sakinler") return false;
  if (t.dataset.pf && pDraft) {
    const f = t.dataset.pf; pDraft[f] = t.type === "checkbox" ? t.checked : t.value; if (f === "blok" && t.tagName === "SELECT") { pDraft.kat = ""; pDraft.daire = ""; } pDirty = true; pStatus = "";
    if (e.type === "change" && (t.tagName === "SELECT" || t.type === "checkbox")) { const y = window.scrollY; render(false); window.scrollTo(0, y); }
    else { const s = document.getElementById("pStatus"); if (s) s.textContent = "Kaydedilmemiş değişiklik var"; } return true;
  }
  if (t.dataset.ek && pDraft) { pDraft.ek = pDraft.ek || {}; pDraft.ek[t.dataset.ek] = t.value; pDirty = true; pStatus = ""; return true; }
  if (t.dataset.bf && pDraft) { const [i, f] = t.dataset.bf.split(":"); pDraft.bireyler[+i][f] = t.value; pDirty = true; pStatus = ""; return true; }
  if (t.dataset.af && e.type === "change") { aF[t.dataset.af] = t.value; if (t.dataset.af === "blok") aF.kat = ""; render(false); return true; }
  return false;
}

/* ---------- Giriş, katılım, hesap ---------- */
function viewGiris() {
  const g = giris;
  if (g.adim === "tel") return `<div class="auth">${ik("home", "ikon ikon-buyuk")}<p class="eyebrow">Giriş</p><h2 class="title">Bilinçli Sakin</h2>
    <p class="lead">Cep telefonu numaranı gir; tek kullanımlık giriş kodu gönderelim. Şifre yok.</p>
    <div class="row"><label class="lvl" for="g-tel">Cep telefonu<input id="g-tel" data-g="tel" value="${esc(g.tel)}" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" maxlength="20"></label>
    <div class="confirm"><button class="btn pri" type="button" data-act="kodIste" ${g.bekle ? "disabled" : ""}>Kod gönder</button></div><p class="err" id="g-err">${esc(g.hata)}</p></div>
    <p class="lvl">Devam ederek <a href="/aydinlatma.html">aydınlatma metnini</a> okuduğunu kabul edersin.</p></div>`;
  return `<div class="auth"><p class="eyebrow">Giriş</p><h2 class="title">Kodu gir</h2>
    <p class="lead">${esc(g.tel)} numarasına 6 haneli bir kod gönderdik. Kod 5 dakika geçerlidir.</p>
    <div class="row"><label class="lvl" for="g-kod">Giriş kodu<input id="g-kod" class="kod" data-g="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"></label>
    <div class="confirm"><button class="btn pri" type="button" data-act="kodDogrula" ${g.bekle ? "disabled" : ""}>Giriş yap</button><button class="btn" type="button" data-act="kodTekrar">Numarayı değiştir</button></div>
    <p class="err" id="g-err">${esc(g.hata)}</p>${g.bilgi ? `<p class="ok-t">${esc(g.bilgi)}</p>` : ""}</div></div>`;
}
function viewKatil() {
  const uy = ME.uyelikler || [];
  return `<div class="auth">${ik("users", "ikon ikon-buyuk")}<p class="eyebrow">Siteye katıl</p><h2 class="title">Davet kodu</h2>
    <p class="lead">Site yönetiminden aldığın davet kodunu gir (ör. ABCD-2345).</p>
    <div class="row"><label class="lvl" for="d-kod">Davet kodu<input id="d-kod" class="kod" style="letter-spacing:.12em" maxlength="12" autocomplete="off" autocapitalize="characters" value="${esc(DAVET_URL)}"></label>
    <div class="confirm"><button class="btn pri" type="button" data-act="davetKullan">Katıl</button></div><p class="err">${esc(katilHata)}</p></div>
    ${uy.length ? `<div class="row"><div class="head"><b>Üye olduğun siteler</b></div>${uy.map(u => `<div class="confirm"><button class="btn" type="button" data-act="siteSec:${u.siteId}">${esc(u.ad)} · ${esc(ROLLER[u.rol])}</button></div>`).join("")}</div>` : ""}
    <div class="confirm"><button class="btn" type="button" data-act="cikis">Çıkış yap</button><a class="btn" href="#hesap">Hesabım</a></div></div>`;
}
/* ---------- Abonelik ---------- */
let abDurum = "", abMesgul = false, abFiyat = "";
const tarihYaz = ms => new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
function abonelikOzet() {
  const a = ME && ME.abonelik; if (!a) return "";
  if (a.aktif) return a.kaynak === "site" ? "Siteniz ödüyor · tüm özellikler açık" : `Etkin${a.bitis ? " · " + tarihYaz(a.bitis) + "'e kadar" : ""}`;
  return `Ücretsiz kullanıyorsun · Premium ${a.fiyatMetni}`;
}
function viewAbonelik() {
  const a = ME.abonelik || { aktif: false, fiyatMetni: "" }, m = BS.magaza();
  const ozellik = `<ul class="ab-liste">${window.ORTAK.PREMIUM_OZELLIKLER.map(x => `<li>${ik("check")}<span>${esc(x)}</span></li>`).join("")}</ul>`;
  let h = `<p class="eyebrow">Hesap</p><h2 class="title">Abonelik</h2>
    <p class="lead">Profil, ortak sepet, duyurular ve günün ayeti/hadisi her zaman ücretsizdir. Premium, sakinlere ek kolaylıklar sunar.</p>`;
  if (a.aktif) {
    h += `<div class="row ab-kart on"><div class="head"><b>${ik("star")} Premium etkin</b></div>
      <p class="lvl">${a.kaynak === "site" ? "Site yönetiminiz bu bedeli tüm sakinler için ödüyor. Ayrıca bir şey yapmanız gerekmiyor." :
        `${a.durum === "iptal_edildi" ? "Otomatik yenileme kapalı. " : a.durum === "odeme_sorunu" ? "Mağaza ödemeyi alamadı; ödeme yönteminizi kontrol edin. " : ""}${a.bitis ? "Dönem sonu: " + tarihYaz(a.bitis) : ""}`}</p>
      ${ozellik}
      ${a.kaynak !== "site" ? `<div class="confirm"><a class="btn" href="${BS.abonelikYonetUrl()}" target="_blank" rel="noopener">Aboneliği yönet veya iptal et</a></div>` : ""}</div>`;
  } else {
    h += `<div class="row ab-kart"><div class="head"><b>Premium</b><span class="ab-fiyat">${esc(abFiyat || a.fiyatMetni)}</span></div>${ozellik}`;
    if (m && a.magazaHazir) {
      h += `<div class="confirm"><button class="btn pri" type="button" data-act="abone" ${abMesgul ? "disabled" : ""}>${abMesgul ? "Bekleyin…" : "Premium'a geç"}</button>
        <button class="btn" type="button" data-act="geriYukle" ${abMesgul ? "disabled" : ""}>Satın alımları geri yükle</button></div>
        <p class="lvl ab-yasal">Aylık otomatik yenilenen abonelik. Ödeme, onayladığınızda ${BS.platform === "ios" ? "Apple Kimliği" : "Google Play"} hesabınızdan alınır. Dönem bitmeden en az 24 saat önce iptal edilmezse abonelik aynı ücretle yenilenir.
        İptal ve yönetim: ${BS.platform === "ios" ? "Ayarlar › Apple Kimliği › Abonelikler" : "Google Play › Ödemeler ve abonelikler"}. <a href="${esc(BS.yasal.kosullar)}">Kullanım koşulları</a> · <a href="${esc(BS.yasal.gizlilik)}">Gizlilik politikası</a></p>`;
    } else if (BS.native) h += `<p class="lvl">Mağaza bağlantısı şu anda kurulamadı. Biraz sonra tekrar deneyin.</p>`;
    else h += `<p class="lvl">Premium'a telefon uygulamasından geçebilirsiniz (App Store / Google Play). Site yönetiminiz bedeli aidat içinde tüm sakinler için ödemeyi de seçebilir.</p>`;
    h += `</div>`;
  }
  if (a.magazaHazir) h += `<div class="confirm"><button class="btn" type="button" data-act="abYenile">Abonelik durumunu yenile</button></div>`;
  h += `<p class="err" role="status">${esc(abDurum)}</p>`;
  return h;
}
async function magazaIslem(k) {
  const m = BS.magaza(); if (!m || abMesgul) return;
  abMesgul = true; abDurum = ""; render(false);
  try {
    const { aboneId } = await api("GET", "/api/abonelik");
    await m.hazirla(aboneId);
    if (k === "abone") { const s = await m.satinAl(); if (s === "vazgecildi") { abDurum = ""; return; } }
    else await m.geriYukle();
    const r = await api("POST", "/api/abonelik/yenile", {});
    ME.abonelik = r.abonelik;
    abDurum = r.abonelik.aktif ? "Teşekkürler, Premium etkin." : (k === "geriYukle" ? "Geri yüklenecek bir abonelik bulunamadı." : "Ödeme onaylanınca Premium açılacak. Birkaç dakika içinde 'Abonelik durumunu yenile'ye dokunun.");
  } catch (e) { abDurum = e && e.message ? e.message : "İşlem tamamlanamadı."; }
  finally { abMesgul = false; render(false); }
}
const telGoster = t => t && t.startsWith("+90") ? "0" + t.slice(3, 6) + " " + t.slice(6, 9) + " " + t.slice(9, 11) + " " + t.slice(11) : t;
function viewHesap() {
  const s = ME.aktifSite, uy = ME.uyelikler || [];
  return `<p class="eyebrow">Hesap ve kişisel veriler</p><h2 class="title">Hesabım</h2>
  <div class="row"><dl class="kv"><dt>Telefon</dt><dd>${esc(telGoster(ME.user.telefon))}</dd>
   ${s ? `<dt>Aktif site</dt><dd>${esc(s.ad)}</dd><dt>Rolün</dt><dd>${esc(ROLLER[s.rol])}</dd><dt>Site durumu</dt><dd>${esc(SITE_DURUM[s.durum] || s.durum)}</dd>` : ""}
   ${ME.user.platformAdmin ? `<dt>Rol</dt><dd>Platform yöneticisi</dd>` : ""}</dl></div>
  ${uy.length > 1 ? `<div class="row"><div class="head"><b>Site değiştir</b></div>${uy.map(u => `<div class="confirm"><button class="btn ${s && s.id === u.siteId ? "pri" : ""}" type="button" data-act="siteSec:${u.siteId}">${esc(u.ad)} · ${esc(ROLLER[u.rol])}</button></div>`).join("")}</div>` : ""}
  ${!ME.user.platformAdmin ? `<div class="row"><div class="head"><b>Başka bir siteye katıl</b></div><div class="pgrid"><label class="lvl" for="d-kod">Davet kodu<input id="d-kod" maxlength="12" autocomplete="off"></label></div><div class="confirm"><button class="btn" type="button" data-act="davetKullan">Katıl</button></div><p class="err">${esc(katilHata)}</p></div>` : ""}
  <div class="row"><div class="head"><b>Kişisel verilerin (KVKK)</b></div>
   <p class="lvl" style="margin:4px 0 8px">Hesabındaki tüm kişisel verileri (profil, sepet, puan kartı, üyelikler) JSON dosyası olarak indirebilirsin. Hesabını silersen tüm sitelerdeki profilin, sepetin ve puan kartın kalıcı olarak silinir.</p>
   <div class="confirm">${BS.native ? (BS.paylas() ? `<button class="btn" type="button" data-act="veriPaylas">Verilerimi indir (JSON)</button>` : "") : `<a class="btn" href="/api/hesap/veri" download>Verilerimi indir (JSON)</a>`}<a class="btn" href="/aydinlatma.html">Aydınlatma metni</a></div>
   <div class="confirm">${hesapSilSor ? `<span class="lvl">Hesabın ve tüm verilerin kalıcı olarak silinecek. Bu işlem geri alınamaz.</span><button class="btn danger" type="button" data-act="hesapSilEvet">Evet, hesabımı sil</button><button class="btn" type="button" data-act="hesapSilHayir">Vazgeç</button>` : `<button class="btn danger" type="button" data-act="hesapSilSor">Hesabımı sil</button>`}</div>
   <p class="err">${esc(hesapDurum)}</p></div>
  <div class="confirm"><button class="btn" type="button" data-act="cikis">Çıkış yap</button></div>`;
}

/* ---------- Yönetici: üyeler ve davet kodları ---------- */
async function uyeYukle() {
  try { const [u, d] = await Promise.all([api("GET", "/api/yonetim/uyeler"), api("GET", "/api/yonetim/davetler")]); UYE = u.uyeler; DAVET = d.davetler; }
  catch (e) { uyeDurum = e.message; UYE = UYE || []; DAVET = DAVET || []; }
  if (current === "uyeler") render(false);
}
function viewUyeler() {
  if (!ADMIN) return `<div class="pending">Bu bölüm yalnızca site yöneticisine açık.</div>`;
  if (!UYE) { uyeYukle(); return `${iskelet()}`; }
  const rolOpt = v => Object.entries(ROLLER).map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("");
  return `<p class="eyebrow">Yalnızca site yöneticisi görür</p><h2 class="title">Üyeler ve davetler</h2>
  <p class="lead">Sakinler siteye yalnızca davet koduyla katılır. Bir kodu birden çok haneyle paylaşabilir (kullanım sayısı) ya da tek kişilik kod üretebilirsiniz.</p>
  <div class="row"><div class="head"><b>Yeni davet kodu</b></div><div class="pgrid">
   <label class="lvl" for="dv-rol">Rol<select id="dv-rol">${rolOpt("sakin")}</select></label>
   <label class="lvl" for="dv-max">Kullanım sayısı<input id="dv-max" value="50" inputmode="numeric" maxlength="3"></label>
   <label class="lvl" for="dv-gun">Geçerlilik (gün)<input id="dv-gun" value="14" inputmode="numeric" maxlength="2"></label>
   <label class="lvl" for="dv-ac">Açıklama<input id="dv-ac" maxlength="60" placeholder="Ör. A Blok panosu"></label></div>
   <div class="confirm"><button class="btn pri" type="button" data-act="davetUret" ${SALT ? "disabled" : ""}>Kod üret</button></div>
   ${yeniDavet ? `<p class="lvl" style="margin:8px 0 0">Yeni kod:</p><div class="code-big" id="yeniKod">${esc(yeniDavet)}</div><div class="confirm"><button class="btn" type="button" data-act="davetKopyala:${esc(yeniDavet)}">Bağlantı ve kodu kopyala</button><a class="btn" href="/s/${esc(yeniDavet)}" target="_blank" rel="noopener">Nasıl kullanılır sayfası</a></div>` : ""}
   ${kopyaDurum ? `<p class="lvl" id="kopyaMetni" style="white-space:pre-line;user-select:all;margin:6px 0 0">${esc(kopyaDurum)}</p>` : ""}
   <p class="err">${esc(uyeDurum)}</p></div>
  <h3 class="eyebrow" style="margin:18px 0 6px">Davet kodları</h3>
  ${DAVET.length ? DAVET.map(d => `<div class="row uye"><div><b style="font-family:var(--f-mono)">${esc(d.kod)}</b> <span class="chip ${d.gecerli ? "ok" : "warn"}">${d.gecerli ? "Geçerli" : d.iptal ? "İptal" : "Geçersiz"}</span><div class="lvl">${esc(ROLLER[d.rol])} · ${d.kullanim}/${d.maxKullanim} kullanım · ${d.bitis ? "son: " + new Date(d.bitis).toLocaleDateString("tr-TR") : ""}${d.aciklama ? " · " + esc(d.aciklama) : ""}</div></div>${d.gecerli ? `<div class="confirm" style="margin:0">${d.rol === "sakin" ? `<button class="btn" type="button" data-act="davetKopyala:${esc(d.kod)}">Bağlantı ve kodu kopyala</button>` : ""}<button class="btn danger" type="button" data-act="davetIptal:${esc(d.kod)}" ${SALT ? "disabled" : ""}>İptal et</button></div>` : ""}</div>`).join("") : bos("users", "Henüz davet kodu yok", "Yukarıdan bir kod üretip “Bağlantı ve kodu kopyala” ile site grubunda paylaşın.")}
  <h3 class="eyebrow" style="margin:18px 0 6px">Üyeler (${UYE.length})</h3>
  ${UYE.map(u => `<div class="row uye"><div><b>${esc(telGoster(u.telefon))}</b>${u.ben ? ` <span class="chip acc">Sen</span>` : ""}<div class="lvl">${u.konum ? konum(u.konum) : "Profil yok"}</div></div>
    ${u.ben ? `<span class="lvl">${esc(ROLLER[u.rol])}</span>` : `<div class="confirm" style="margin:0"><select data-uyerol="${u.userId}" aria-label="Rol" ${SALT ? "disabled" : ""}>${rolOpt(u.rol)}</select><button class="btn danger" type="button" data-act="uyeCikarSor:${u.userId}" ${SALT ? "disabled" : ""}>Siteden çıkar</button></div>`}
    ${uyeSilSor === u.userId ? `<div class="confirm" style="flex-basis:100%" data-onay="${u.userId}"><span class="lvl">Bu üye siteden çıkarılacak; profili, sepeti ve puan kartı bu siteden silinecek.</span><button class="btn danger" type="button" data-act="uyeCikarEvet:${u.userId}">Evet, çıkar</button><button class="btn" type="button" data-act="uyeCikarHayir">Vazgeç</button></div>` : ""}</div>`).join("")}`;
}

/* ---------- Özet (pilot ölçümü) ---------- */
async function ozetYukle() {
  try { OZET = await api("GET", "/api/yonetim/ozet"); ozetHata = ""; } catch (e) { ozetHata = e.message; OZET = {}; }
  if (current === "ozet") render(false);
}
function viewOzet() {
  if (!YONETIM) return `<div class="pending">Bu bölüm yalnızca site yönetimine açık.</div>`;
  if (!OZET) { ozetYukle(); return `${iskelet()}`; }
  if (ozetHata) return `<p class="err">${esc(ozetHata)}</p>`;
  const o = OZET, tarih = t => t ? new Date(t).toLocaleDateString("tr-TR") : "—";
  const dol = o.toplamDaire ? `%${o.doluluk.toLocaleString("tr-TR")}` : String(o.profilHane);
  let h = `<p class="eyebrow">Yalnızca site yönetimi görür${ROL === "site_denetci" ? " · salt-okur" : ""}</p><h2 class="title">Özet</h2>
  <p class="lead">İlk hafta kontrolü: kaç hane profil doldurdu, hangi blok geride, alışveriş turuna kaç hane katıldı.</p>
  <div class="confirm" style="margin:0 0 12px"><button class="btn" type="button" data-act="ozetYenile">Yenile</button></div>
  <div class="summary" id="ozetKart"><div><b>${dol}</b><span>${o.toplamDaire ? `doluluk (${o.profilHane}/${o.toplamDaire} daire)` : "profil dolduran hane"}</span></div>
   <div><b>${o.son7GunKatilan}</b><span>son 7 günde katılan sakin</span></div>
   <div><b>${o.alisveris ? (o.acikTur ? o.acikTur.hane : "–") : "–"}</b><span>${o.alisveris ? "bu turda sipariş veren hane" : "alışveriş paketi yok"}</span></div></div>
  ${o.toplamDaire ? "" : `<p class="lvl">Doluluk yüzdesi için Site ayarlarına toplam daire sayısını girin.</p>`}
  <h3 class="eyebrow" style="margin:18px 0 6px">Blok bazında</h3>
  ${o.bloklar.length ? `<div class="tbl"><table><thead><tr><th>Blok</th><th>Profil dolduran</th><th>Daire</th><th>Doluluk</th></tr></thead><tbody>${o.bloklar.map(b => `<tr><td>${esc(b.blok)}</td><td>${b.hane}</td><td>${b.daire ?? "—"}</td><td>${b.doluluk === null ? "—" : "%" + b.doluluk.toLocaleString("tr-TR")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="pending">Henüz blok veya profil yok.</div>`}`;
  if (o.alisveris) {
    h += `<h3 class="eyebrow" style="margin:18px 0 6px">Alışveriş turları</h3><div class="tbl"><table><thead><tr><th>Tur</th><th>Hane</th><th>Tarih</th></tr></thead><tbody>
    ${o.acikTur ? `<tr><td>${esc(o.acikTur.ad || "Güncel tur")} <span class="chip ${o.acikTur.acik ? "ok" : "warn"}">${o.acikTur.acik ? "açık" : "kapalı"}</span></td><td>${o.acikTur.hane}</td><td>güncel</td></tr>` : ""}
    ${o.oncekiTurlar.map(t => `<tr><td>${esc(t.ad || "Tur")}</td><td>${t.hane}</td><td>${tarih(t.kapanis)}</td></tr>`).join("")}</tbody></table></div>
    ${!o.oncekiTurlar.length ? `<p class="lvl">Önceki tur kaydı yok. Yeni tur başlatıldıkça son 3 tur burada görünür.</p>` : ""}`;
  } else h += kilitKarti("alisveris", "Alışveriş turları");
  return h;
}

/* ---------- Platform yöneticisi ---------- */
async function platYukle() {
  try { PLAT = (await api("GET", "/api/platform/siteler")).siteler; } catch (e) { platDurum = e.message; PLAT = PLAT || []; }
  if (current === "platform") render(false);
}
function viewPlatform() {
  if (!PLAT) { platYukle(); return `${iskelet()}`; }
  const opt = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("");
  return `<p class="eyebrow">Satıcı paneli · sakin verisi görünmez</p><h2 class="title">Siteler</h2>
  <p class="lead">Burada yalnızca site oluşturur, plan ve abonelik durumunu yönetirsiniz. Sakinlerin kişisel verileri bu panelde yer almaz; veri sorumlusu site yönetimidir.</p>
  <div class="row"><div class="head"><b>Yeni site</b></div><div class="pgrid">
   <label class="lvl" for="ps-ad">Site adı<input id="ps-ad" maxlength="60" placeholder="Ör. Lale Sitesi"></label>
   <label class="lvl" for="ps-plan">Paket<select id="ps-plan">${opt(PLANLAR, "tam")}</select></label>
   <label class="lvl" for="ps-gun">Deneme (gün)<input id="ps-gun" value="30" inputmode="numeric" maxlength="3"></label></div>
   <div class="confirm"><button class="btn pri" type="button" data-act="siteOlustur">Site oluştur</button></div>
   ${platYeni ? `<p class="lvl" style="margin:8px 0 0">${esc(platYeni.ad)} için ilk yönetici davet kodu (tek kullanım, 14 gün):</p><div class="code-big" id="platKod">${esc(platYeni.kod)}</div>` : ""}
   <p class="err">${esc(platDurum)}</p></div>
  ${PLAT.map(s => `<div class="row"><div class="head"><b>${esc(s.ad)}</b><span class="chip ${s.etkinDurum === "askida" ? "warn" : s.etkinDurum === "aktif" ? "ok" : ""}">${esc(SITE_DURUM[s.etkinDurum])}${s.etkinDurum !== s.durum ? " (deneme süresi doldu)" : ""}</span></div>
   <p class="lvl" style="margin:4px 0">${esc(PLANLAR[s.plan] || s.plan)} paketi · ${s.uyeSayisi} üye · ${s.yoneticiSayisi} yönetici · #${s.id}</p>
   <div class="pgrid"><label class="lvl" for="pp-${s.id}">Paket<select id="pp-${s.id}">${opt(PLANLAR, s.plan)}</select></label>
    <label class="lvl" for="pd-${s.id}">Durum<select id="pd-${s.id}">${opt(SITE_DURUM, s.durum)}</select></label>
    <label class="lvl" for="pb-${s.id}">Deneme bitiş<input id="pb-${s.id}" type="date" value="${esc(s.denemeBitis || "")}"></label></div>
   <div class="confirm"><button class="btn" type="button" data-act="siteKaydet:${s.id}">Kaydet</button><button class="btn" type="button" data-act="yonDavet:${s.id}">Yönetici davet kodu üret</button></div></div>`).join("")}`;
}

/* ---------- Yönlendirme ve çizim ---------- */
const KILITLI = { sepet: ["alisveris", "Ortak market ve pazar sepeti"], siparis: ["alisveris", "Toplu sipariş"], katalog: ["alisveris", "Katalog ve tur"], harita: ["egitim", "Öğrenme haritası"], kart: ["egitim", "Puan kartı"], projeler: ["egitim", "Site görevleri"], cerceve: ["egitim", "Ana çerçeve"] };
/* Erişilebilir sayfalar (sekmede görünmese de) */
function erisilebilir() {
  if (!ME) return [];
  if (ME.user.platformAdmin) return ["platform", "hesap"];
  if (!ME.aktifSite) return ["katil", "hesap"];
  return ["ana", "profil", "diger", "hesap", "abonelik", "hikmet", ...(OZ.alisveris ? ["sepet"] : []), ...(OZ.alisveris && YONETIM ? ["siparis"] : []), ...(OZ.alisveris && ADMIN ? ["katalog"] : []),
    ...(OZ.egitim ? ["harita", "kart", "projeler", "cerceve"] : []), ...(YONETIM ? ["yonetim", "ozet", "sakinler"] : []), ...(ADMIN ? ["ayarlar", "uyeler"] : [])];
}
/* Masaüstü üst menü */
function sekmeler() {
  if (!ME) return [];
  if (ME.user.platformAdmin) return [["platform", "Siteler", "home"], ["hesap", "Hesabım", "shield"]];
  if (!ME.aktifSite) return [["katil", "Siteye katıl", "home"], ["hesap", "Hesabım", "shield"]];
  return [["ana", "Ana sayfa", "home"], ...(OZ.alisveris ? [["sepet", "Sepet", "cart"]] : []), ["profil", "Profilim", "user"],
    ...(OZ.egitim ? [["harita", "Öğren", "book"], ["kart", "Puan Kartım", "star"]] : []), ...(YONETIM ? [["yonetim", "Yönetim", "chart"]] : []), ["diger", "Diğer", "menu"]];
}
/* Telefon alt çubuğu: en fazla 4 öğe */
function altSekmeler() {
  if (!ME) return [];
  if (ME.user.platformAdmin || !ME.aktifSite) return sekmeler();
  return [["ana", "Ana sayfa", "home"], ...(OZ.alisveris ? [["sepet", "Sepet", "cart"]] : OZ.egitim ? [["harita", "Öğren", "book"]] : []), ["profil", "Profil", "user"], ["diger", "Diğer", "menu"]];
}
function grup(v, ust) {
  if (["siparis", "katalog"].includes(v)) return "sepet";
  if (v in BY || ["projeler", "cerceve"].includes(v)) return ust && OZ.egitim ? "harita" : (OZ.alisveris || !OZ.egitim ? "diger" : "harita");
  if (["ozet", "sakinler", "ayarlar", "uyeler"].includes(v)) return ust ? "yonetim" : "diger";
  if (v === "yonetim") return ust ? "yonetim" : "diger";
  if ((v === "hesap" || v === "abonelik" || v === "hikmet") && ME && ME.aktifSite) return ust ? "ana" : "diger";
  if (!ust && ["kart"].includes(v)) return "diger";
  if (!ust && v === "harita" && OZ.alisveris) return "diger";
  return v;
}
function sepetAdet() { return eski() ? 0 : Object.values(sepet.kalemler || {}).filter(q => q > 0).length; }
function navCiz() {
  const tabs = sekmeler(), alt = altSekmeler();
  document.getElementById("tabs").innerHTML = tabs.map(([v, t]) => `<a href="#${v}" data-v="${v}">${t}</a>`).join("");
  const ab = document.getElementById("altbar");
  ab.innerHTML = alt.map(([v, t, i]) => `<a href="#${v}" data-v="${v}">${ik(i)}<span>${t}</span>${v === "sepet" ? `<span class="rozet" hidden></span>` : ""}</a>`).join("");
  ab.hidden = !alt.length; document.body.classList.toggle("altbarli", !!alt.length);
  navGuncelle();
}
function navGuncelle() {
  const v = current;
  document.querySelectorAll("nav.tabs a").forEach(a => a.setAttribute("aria-current", a.dataset.v === grup(v, true) ? "page" : "false"));
  document.querySelectorAll("#altbar a").forEach(a => a.setAttribute("aria-current", a.dataset.v === grup(v, false) ? "page" : "false"));
  const r = document.querySelector("#altbar .rozet"), n = OZ.alisveris ? sepetAdet() : 0;
  if (r) { r.hidden = !n; r.textContent = n; r.setAttribute("aria-label", `${n} ürün`); }
}
let current = "ana";
function route() {
  let v = (location.hash || "").slice(1);
  const izinli = erisilebilir();
  if (!ME) v = "giris";
  else if (ME.user.platformAdmin) { if (!izinli.includes(v)) v = "platform"; }
  else if (!ME.aktifSite) { if (!izinli.includes(v)) v = "katil"; }
  else if (!(v in BY) && !izinli.includes(v) && !KILITLI[v]) v = "ana";
  if (v === "siparis" || v === "katalog") { if (izinli.includes(v)) { spMode = v; SIP = null; v = "sepet"; } }
  else if (v === "sepet" && (spMode === "siparis" || spMode === "katalog") && !YONETIM) spMode = "alis";
  // Yönetim listeleri her girişte tazelenir
  if (v === "uyeler") { UYE = null; uyeSilSor = null; } else if (v === "sakinler") tumSakinler = null; else if (v === "ozet") OZET = null; else if (v === "platform") PLAT = null;
  current = v; render(true);
}
function banner() {
  const s = ME && ME.aktifSite;
  if (!s) return "";
  if (s.saltOkur) return `<div class="banner" role="status">Site aboneliği askıda: şu anda yalnızca görüntüleme yapılabilir. Değişiklikler kaydedilmez.</div>`;
  if (s.durum === "deneme" && s.denemeBitis && ADMIN) return `<div class="banner" role="status" style="background:var(--accent-soft);color:var(--ink)">Deneme sürümü · bitiş: ${esc(new Date(s.denemeBitis + "T12:00:00").toLocaleDateString("tr-TR"))}</div>`;
  return "";
}
function render(scrollTop) {
  const main = document.getElementById("main");
  let v = current;
  if (v === "siparis" || v === "katalog") v = KILITLI[v] && !OZ.alisveris ? v : "sepet";
  navGuncelle();
  const ae = document.activeElement, odakta = sel => !scrollTop && ae && main.contains(ae) && ae.matches(sel);
  if (v === "giris") main.innerHTML = viewGiris();
  else if (v === "katil") main.innerHTML = viewKatil();
  else if (v === "hesap") main.innerHTML = viewHesap();
  else if (v === "abonelik") main.innerHTML = viewAbonelik();
  else if (v === "hikmet") main.innerHTML = viewHikmet();
  else if (v === "platform") main.innerHTML = viewPlatform();
  else if (KILITLI[v] && !OZ[KILITLI[v][0]] || (v in BY && !OZ.egitim)) { const [oz, bas] = KILITLI[v] || ["egitim", "Eğitim modülü"]; main.innerHTML = banner() + `<h2 class="title">${esc(bas)}</h2>` + kilitKarti(oz, bas); }
  else if (v === "ana") main.innerHTML = banner() + viewAna();
  else if (v === "diger") main.innerHTML = viewDiger();
  else if (v === "yonetim") main.innerHTML = banner() + viewYonetim();
  else if (v === "harita") main.innerHTML = banner() + viewHarita();
  else if (v === "ozet") main.innerHTML = banner() + viewOzet();
  else if (v === "profil") { if (odakta("input:not([type=checkbox])")) return; main.innerHTML = banner() + viewProfil(); }
  else if (v === "sakinler") main.innerHTML = banner() + viewSakinler();
  else if (v === "uyeler") main.innerHTML = banner() + viewUyeler();
  else if (v === "sepet") { if (odakta("input:not([type=checkbox]),textarea")) return; main.innerHTML = banner() + viewSepet(); spAra(); }
  else if (v === "ayarlar") { if (odakta("input:not([type=checkbox])")) return; main.innerHTML = banner() + viewAyarlar(); }
  else if (v === "kart") { if (!scrollTop && document.activeElement?.dataset?.kanit) return; main.innerHTML = banner() + viewKart(); }
  else if (scrollTop) {
    if (v === "projeler") viewDoc("19-site-gorevleri.md", "Sitenin gerçek işleri", "Site görevleri", "Modüller sitenin gerçek bir işinde birleşir. 7 ve üzeri puan yalnızca bu görevlerdeki kanıtla verilir.");
    else if (v === "cerceve") viewDoc("00-ana-cerceve.md", "Kurallar", "Ana çerçeve", "Mimarlık ustalık sisteminden site sakinine uyarlanan puanlama, öğrenme sırası, şablon ve beceri zinciri.");
    else viewModul(v);
  }
  else if (v in BY) { const sb = document.getElementById("sb"); if (sb) { const s = sc(v); sb.innerHTML = `<div class="head" style="display:flex;justify-content:space-between"><span class="eyebrow">Bu modüldeki puanın</span><span class="score ${s ? "" : "empty"}">${s || "–"}</span></div>${picker(v)}<div class="lvl"><b>${LEVEL(s)}</b> · Sonraki adım: ${NEXT(s)}</div>${warn7(v)}`; } }
  if (scrollTop) { window.scrollTo(0, 0); if (document.body.dataset.oturum === "1" && ae && ae.closest && ae.closest("nav")) main.focus({ preventScroll: true }); }
}

/* ---------- Eylemler ---------- */
const val = id => (document.getElementById(id) || {}).value || "";
async function eylem(a) {
  const [k, x] = a.split(/:(.*)/s);
  try {
    if (k === "kodIste") {
      giris.tel = val("g-tel"); giris.bekle = true; giris.hata = ""; render(false);
      try { const r = await api("POST", "/api/auth/otp-iste", { telefon: giris.tel }); giris.tel = telGoster(r.telefon); giris.adim = "kod"; giris.bilgi = ""; }
      catch (e) { giris.hata = e.message; }
      giris.bekle = false; render(false); const el = document.getElementById(giris.adim === "kod" ? "g-kod" : "g-tel"); if (el) el.focus(); return;
    }
    if (k === "kodDogrula") {
      giris.bekle = true; giris.hata = ""; const kod = val("g-kod");
      try { const d = await api("POST", "/api/auth/otp-dogrula", { telefon: giris.tel, kod }); if (d && d.token) await BS.tokenYaz(d.token); giris = { adim: "tel", tel: "", hata: "", bilgi: "", bekle: false }; location.hash = ""; await basla(); return; }
      catch (e) { giris.hata = e.message; if (e.status === 429 && /Yeni kod/.test(e.message)) giris.adim = "tel"; }
      giris.bekle = false; render(false); return;
    }
    if (k === "abone" || k === "geriYukle") { await magazaIslem(k); return; }
    if (k === "abYenile") { abDurum = "Kontrol ediliyor…"; render(false); try { const r = await api("POST", "/api/abonelik/yenile", {}); ME.abonelik = r.abonelik; abDurum = r.abonelik.aktif ? "Aboneliğin etkin." : "Etkin bir abonelik bulunamadı."; } catch (e) { abDurum = e.message; } render(false); return; }
    if (k === "veriPaylas") { const r = await fetch(BS.url("/api/hesap/veri"), { headers: BS.baslik({}), credentials: "omit" }); if (!r.ok) throw new Error("Veriler alınamadı."); await BS.paylas()({ ad: "bilincli-sakin-verilerim.json", metin: await r.text(), tip: "application/json" }); return; }
    if (k === "ipucuKapat") { lsYaz("bss-ipucu-kurulum", "kapali"); return render(false); }
    if (k === "kur") { if (kurulumOlayi) { kurulumOlayi.prompt(); try { await kurulumOlayi.userChoice; } catch (e) { /* yok */ } kurulumOlayi = null; render(false); } return; }
    if (k === "yenidenDene") { location.reload(); return; }
    if (k === "kodTekrar") { giris.adim = "tel"; giris.hata = ""; render(false); return; }
    if (k === "cikis") { try { await api("POST", "/api/auth/cikis"); } finally { await BS.tokenSil(); } ME = null; location.hash = ""; location.reload(); return; }
    if (k === "davetKullan") {
      katilHata = "";
      try { await api("POST", "/api/davet/kullan", { kod: val("d-kod") }); try { sessionStorage.removeItem("bss-davet"); } catch (e) { /* yok */ } location.hash = "#profil"; await basla(); }
      catch (e) { katilHata = e.message; render(false); }
      return;
    }
    if (k === "siteSec") { await api("POST", "/api/site-sec", { siteId: +x }); location.hash = "#ana"; await basla(); return; }
    if (k === "hesapSilSor") { hesapSilSor = true; return render(false); }
    if (k === "hesapSilHayir") { hesapSilSor = false; return render(false); }
    if (k === "hesapSilEvet") {
      try { const d = await api("DELETE", "/api/hesap", { onay: true }); await BS.tokenSil(); ME = null; location.hash = ""; giris.bilgi = ""; document.getElementById("main").innerHTML = `<div class="auth"><h2 class="title">Hesabın silindi</h2><p class="lead">Tüm kişisel verilerin silindi.</p>${d && d.not ? `<p class="lvl">${esc(d.not)}</p>` : ""}<a class="btn" href="/">Giriş sayfasına dön</a></div>`; navCiz(); }
      catch (e) { hesapDurum = e.message; render(false); }
      return;
    }
    if (k === "sakinYenile") { tumSakinler = null; return render(false); }
    if (k === "ozetYenile") { OZET = null; return render(false); }
    if (k === "davetUret") {
      uyeDurum = "";
      try { const r = await api("POST", "/api/yonetim/davetler", { rol: val("dv-rol"), maxKullanim: +val("dv-max") || 0, gun: +val("dv-gun") || 0, aciklama: val("dv-ac") }); yeniDavet = r.kod; UYE = null; }
      catch (e) { uyeDurum = e.message; }
      return render(false);
    }
    if (k === "davetIptal") { await api("DELETE", "/api/yonetim/davetler/" + encodeURIComponent(x)); UYE = null; return render(false); }
    if (k === "uyeCikarSor") { uyeSilSor = +x; return render(false); }
    if (k === "uyeCikarHayir") { uyeSilSor = null; return render(false); }
    if (k === "uyeCikarEvet") {
      uyeSilSor = null;
      try { await api("DELETE", "/api/yonetim/uyeler/" + x); uyeDurum = "Üye siteden çıkarıldı."; } catch (e) { uyeDurum = e.message; }
      UYE = null; tumSakinler = null; OZET = null; return render(false);
    }
    if (k === "davetKopyala") {
      const metin = `${AYAR.siteAdi || "Sitemiz"} sakin uygulamasına katılmak için:\n${location.origin}/s/${x}\nDavet kodu: ${x}`;
      try { await navigator.clipboard.writeText(metin); kopyaDurum = "Kopyalandı:\n" + metin; } catch (e) { kopyaDurum = metin; }
      return render(false);
    }
    if (k === "siteOlustur") {
      platDurum = "";
      try { const r = await api("POST", "/api/platform/siteler", { ad: val("ps-ad"), plan: val("ps-plan"), denemeGun: +val("ps-gun") || 0 }); platYeni = { ad: r.site.ad, kod: r.davetKodu }; PLAT = null; }
      catch (e) { platDurum = e.message; }
      return render(false);
    }
    if (k === "siteKaydet") {
      platDurum = "";
      try { await api("PATCH", "/api/platform/siteler/" + x, { plan: val("pp-" + x), durum: val("pd-" + x), denemeBitis: val("pb-" + x) || null }); platDurum = "Kaydedildi."; PLAT = null; }
      catch (e) { platDurum = e.message; }
      return render(false);
    }
    if (k === "yonDavet") {
      const r = await api("POST", "/api/platform/siteler/" + x + "/yonetici-davet");
      platYeni = { ad: (PLAT.find(s => String(s.id) === x) || {}).ad || "", kod: r.davetKodu }; return render(false);
    }
  } catch (e) {
    if (current === "uyeler") { uyeDurum = e.message; render(false); } else if (current === "platform") { platDurum = e.message; render(false); } else alert(e.message);
  }
}

document.addEventListener("click", e => {
  if (hikmetTikla(e)) return;
  const ac = e.target.closest("[data-act]"); if (ac) { eylem(ac.dataset.act); return; }
  const ko = e.target.closest("[data-kopya]");
  if (ko) { panoyaKopyala(ko.dataset.kopya).then(ok => bildir(ok ? `${ko.dataset.kopya} kopyalandı` : "Kopyalanamadı; numarayı basılı tutup seçebilirsin.")); return; }
  const spb = e.target.closest("[data-sp]"); if (spb) { sepetClick(spb.dataset.sp); return; }
  const ya = e.target.closest("[data-ayact]"); if (ya) { ayarClick(ya.dataset.ayact); return; }
  const pa = e.target.closest("[data-pact]");
  if (pa) {
    const a = pa.dataset.pact;
    if (a === "add") { pDraft.bireyler.push({ yakinlik: "", yas: "", is: "" }); pDirty = true; }
    else if (a.startsWith("del:")) { pDraft.bireyler.splice(+a.slice(4), 1); pDirty = true; }
    else if (a === "save") { saveProfil(); return; }
    else if (a === "delask") pDelAsk = true; else if (a === "delno") pDelAsk = false; else if (a === "delyes") { delProfil(); return; }
    const y = window.scrollY; render(false); window.scrollTo(0, y); return;
  }
  const b = e.target.closest("[data-set]");
  if (b) {
    const c = b.dataset.set, v = +b.dataset.v; state.scores[c] = state.scores[c] === v ? 0 : v; if (!state.scores[c]) delete state.scores[c]; queueSave();
    const y = window.scrollY; render(false); window.scrollTo(0, y); return;
  }
  if (e.target.id === "reset") { document.getElementById("resetBox").innerHTML = `<span class="lvl">${M.length} modülün puanı ve kanıtı silinecek.</span><button class="btn danger" type="button" id="resetYes">Evet, sıfırla</button><button class="btn" type="button" id="resetNo">Vazgeç</button>`; return; }
  if (e.target.id === "resetYes") { state = { scores: {}, kanit: {} }; queueSave(); render(false); return; }
  if (e.target.id === "resetNo") { render(false); }
});
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" || !e.target.matches("input")) return;
  if (e.target.id === "g-tel") eylem("kodIste"); else if (e.target.id === "g-kod") eylem("kodDogrula"); else if (e.target.id === "d-kod") eylem("davetKullan");
});
document.addEventListener("input", e => { if (current === "sepet" && sepetEvent(e)) return; if (current === "ayarlar" && ayarEvent(e)) return; if (profilEvent(e)) return; const c = e.target.dataset?.kanit; if (c) { state.kanit[c] = e.target.value; queueSave(); } });
document.addEventListener("change", e => {
  if (current === "sepet" && sepetEvent(e)) return; if (current === "ayarlar" && ayarEvent(e)) return; if (profilEvent(e)) return;
  const r = e.target.dataset?.uyerol;
  if (r) api("PATCH", "/api/yonetim/uyeler/" + r, { rol: e.target.value }).then(() => { uyeDurum = "Rol güncellendi."; UYE = null; render(false); }).catch(err => { uyeDurum = err.message; render(false); });
});
window.addEventListener("hashchange", route);

/* ---------- Başlangıç ---------- */
function baglantiYok() {
  document.getElementById("main").innerHTML = `<div class="bos-durum cevrimdisi" role="alert">${ik("wifioff", "ikon ikon-buyuk")}<b>Bağlantı yok</b><p>İnternete bağlı değilsin. Bilgilerin güvende; bağlantı gelince yeniden dene.</p><button class="btn pri" type="button" data-act="yenidenDene">Tekrar dene</button></div>`;
}
async function basla() {
  let agHatasi = false;
  await BS.tokenOku();
  try { ME = await api("GET", "/api/me"); if (!ME || !ME.user) ME = null; }
  catch (e) { ME = null; agHatasi = !e.status; }
  if (agHatasi) { document.body.dataset.oturum = "0"; baglantiYok(); return; }
  // Site kapsamlı tüm önbellekleri sıfırla
  tumSakinler = null; UYE = null; DAVET = null; SIP = null; PLAT = null; OZET = null; OZ = { alisveris: false, egitim: false }; uyeSilSor = null; kopyaDurum = ""; profil = null; pDraft = null; pDirty = false; kdDraft = null; ayDraft = null;
  state = { scores: {}, kanit: {} }; sepet = { kalemler: {}, not: "", tur: "" }; AYAR = varsayilanAyar();
  const s = ME && ME.aktifSite;
  ROL = s ? s.rol : ""; ADMIN = ROL === "site_yonetici"; YONETIM = ADMIN || ROL === "site_denetci"; SALT = !!(s && s.saltOkur);
  if (s) {
    setSync("Yükleniyor…");
    OZ = s.ozellikler || { alisveris: false, egitim: false };
    const yok = Promise.resolve(null);
    try {
      const [a, k, p, pu, sp] = await Promise.all([api("GET", "/api/site/ayarlar"), OZ.alisveris ? api("GET", "/api/katalog") : yok, api("GET", "/api/profil"), OZ.egitim ? api("GET", "/api/puan") : yok, OZ.alisveris ? api("GET", "/api/sepet") : yok]);
      AYAR = { ...varsayilanAyar(), ...a.ayarlar }; profil = p.profil;
      if (k) { KAT = k.katalog; saatFarki = k.simdi - Date.now(); }
      if (pu) state = { scores: pu.scores || {}, kanit: pu.kanit || {} };
      if (sp) sepet = sp.sepet;
    } catch (e) { if (!e.status) { baglantiYok(); return; } throw e; }
    setSync(`${ROLLER[ROL]}${SALT ? " · salt-okur" : ""}`);
  } else setSync(ME ? (ME.user.platformAdmin ? "Platform yöneticisi" : "") : "");
  applyAyar(); navCiz(); route();
  document.body.dataset.oturum = ME ? "1" : "0";
}
window.addEventListener("offline", () => bildir("Bağlantı koptu. Değişiklikler bağlantı gelince kaydedilebilir."));
window.addEventListener("online", () => bildir("Bağlantı geri geldi."));
/* Servis çalışanı yalnızca statik dosyaları önbelleğe alır (bkz. sw.js); API ve kişisel veri önbelleğe alınmaz. */
if (!BS.native && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => { /* desteklenmiyor */ });
basla();
