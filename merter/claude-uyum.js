"use strict";
/* Claude uyum katmanı: Merter Çınar Evleri arayüzü claude.ai'de window.claude.use("db" | "user" | "assets" | "downloads")
   ile çalışır. Bu dosya aynı arayüzü Bilinçli Sakin sunucusuna (src/belgeler.js) bağlar; böylece arayüz kodu değişmeden
   telefon uygulamasında (ve tarayıcıda) çalışır. Oturum: telefon + SMS kodu, ardından site davet kodu.
   Gerektirir: native.js (window.BS). */
(function () {
  const BS = window.BS;
  let ME = null;
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kopya = v => v == null ? v : JSON.parse(JSON.stringify(v));

  async function api(method, yol, body) {
    const h = BS.baslik({});
    if (method !== "GET") { h["Content-Type"] = "application/json"; if (ME && ME.csrf && !BS.native) h["X-CSRF-Token"] = ME.csrf; }
    let r;
    try { r = await fetch(BS.url(yol), { method, headers: h, credentials: BS.native ? "omit" : "same-origin", body: method === "GET" ? undefined : JSON.stringify(body || {}) }); }
    catch (e) { const x = new Error("Bağlantı kurulamadı."); x.code = "unavailable"; x.ag = true; throw x; }
    let d = null; try { d = await r.json(); } catch (e) { d = null; }
    if (!r.ok) {
      const x = new Error((d && d.hata) || "İstek başarısız (" + r.status + ")");
      x.status = r.status;
      // artifact db hata kodlarıyla uyumlu: izin yok → invalid_argument, boyut/kota → quota_exceeded
      x.code = r.status === 403 || r.status === 404 ? "invalid_argument" : r.status === 413 ? "quota_exceeded" : r.status === 401 ? "not_signed_in" : "unavailable";
      throw x;
    }
    return d;
  }

  /* ---------- Giriş kapısı ---------- */
  let kapiCoz;
  const hazir = new Promise(r => { kapiCoz = r; });
  const K = { adim: "tel", tel: "", hata: "", bekle: false };
  function kapiCiz() {
    let el = document.getElementById("bsKapi");
    if (!el) { el = document.createElement("div"); el.id = "bsKapi"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "bsKapiB"); document.body.appendChild(el); }
    const site = (window.BS_AYAR && window.BS_AYAR.siteAdi) || "Bilinçli Sakin";
    const govde = K.adim === "tel" ? `<label for="bsTel">Cep telefonunuz</label><input id="bsTel" inputmode="tel" autocomplete="tel" placeholder="05xx xxx xx xx" value="${esc(K.tel)}" maxlength="20"><button type="button" class="btn pri" data-bskapi="kodIste" ${K.bekle ? "disabled" : ""}>Kod gönder</button>`
      : K.adim === "kod" ? `<p class="lvl">${esc(K.tel)} numarasına 6 haneli bir kod gönderdik.</p><label for="bsKod">Giriş kodu</label><input id="bsKod" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••"><button type="button" class="btn pri" data-bskapi="kodDogrula" ${K.bekle ? "disabled" : ""}>Giriş yap</button><button type="button" class="btn" data-bskapi="geri">Numarayı değiştir</button>`
      : `<p class="lvl">Sitenize katılmak için yönetimden aldığınız davet kodunu girin.</p><label for="bsDavet">Davet kodu</label><input id="bsDavet" autocomplete="off" maxlength="12" placeholder="ABCD-EFGH"><button type="button" class="btn pri" data-bskapi="katil" ${K.bekle ? "disabled" : ""}>Siteye katıl</button><button type="button" class="btn" data-bskapi="cikis">Çıkış yap</button>`;
    el.innerHTML = `<div class="bskapi-k"><p class="eyebrow">${K.adim === "davet" ? "Sitenize katılın" : "Sitenize giriş"}</p><h2 class="title" id="bsKapiB">${esc(site)}</h2>${govde}<p class="err" role="alert">${esc(K.hata)}</p>
      <p class="lvl bskapi-yasal">Giriş yaparak <a href="${esc(BS.yasal.kosullar)}" target="_blank" rel="noopener">kullanım koşullarını</a> kabul etmiş olursunuz. <a href="${esc(BS.url("/aydinlatma.html"))}" target="_blank" rel="noopener">KVKK aydınlatma metni</a> · <a href="${esc(BS.yasal.gizlilik)}" target="_blank" rel="noopener">Gizlilik</a></p></div>`;
    el.hidden = false;
    const odak = el.querySelector("input"); if (odak) setTimeout(() => odak.focus(), 0);
  }
  async function kapiIslem(k) {
    const v = {}; for (const id of ["bsTel", "bsKod", "bsDavet"]) { const el = document.getElementById(id); if (el) v[id] = el.value; }
    const val = id => v[id] || "";
    K.hata = "";
    try {
      if (k === "geri") { K.adim = "tel"; return kapiCiz(); }
      if (k === "cikis") { await cikis(); return; }
      K.bekle = true; kapiCiz();
      if (k === "kodIste") { const r = await api("POST", "/api/auth/otp-iste", { telefon: val("bsTel") }); K.tel = val("bsTel"); K.telN = r.telefon; K.adim = "kod"; }
      else if (k === "kodDogrula") { const d = await api("POST", "/api/auth/otp-dogrula", { telefon: K.telN || K.tel, kod: val("bsKod") }); if (d.token) await BS.tokenYaz(d.token); await meYukle(); }
      else if (k === "katil") { await api("POST", "/api/davet/kullan", { kod: val("bsDavet") }); await meYukle(); }
    } catch (e) { K.hata = e.message; if (e.status === 429 && /Yeni kod/.test(e.message)) K.adim = "tel"; }
    K.bekle = false;
    if (!ME || !ME.aktifSite) kapiCiz();
  }
  async function meYukle() {
    const m = await api("GET", "/api/me");
    ME = m && m.user ? m : null;
    if (!ME) { K.adim = K.adim === "davet" ? "tel" : K.adim; return; }
    if (ME.user.platformAdmin) { K.hata = "Platform yöneticisi hesabıyla site uygulaması kullanılamaz."; K.adim = "tel"; await BS.tokenSil(); ME = null; return; }
    if (!ME.aktifSite) { K.adim = "davet"; return; }
    const el = document.getElementById("bsKapi"); if (el) el.hidden = true;
    kapiCoz(ME);
  }
  async function cikis() {
    try { await api("POST", "/api/auth/cikis", {}); } catch (e) { /* oturum zaten kapalı olabilir */ }
    await BS.tokenSil(); location.reload();
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-bskapi]"); if (b) kapiIslem(b.dataset.bskapi); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || !e.target.closest("#bsKapi")) return;
    const id = e.target.id; if (id === "bsTel") kapiIslem("kodIste"); else if (id === "bsKod") kapiIslem("kodDogrula"); else if (id === "bsDavet") kapiIslem("katil");
  });
  async function baslat() {
    await BS.tokenOku();
    for (let deneme = 0; ; deneme++) {
      try { await meYukle(); break; }
      catch (e) { if (!e.ag || deneme > 2) { K.hata = e.ag ? "Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin." : e.message; break; } await new Promise(r => setTimeout(r, 1500)); }
    }
    if (!ME || !ME.aktifSite) kapiCiz();
  }

  /* ---------- db ---------- */
  const abonelikler = new Set(); // { tur: "doc" | "col", yol, sonraki, hata }
  const snapBelge = (yol, var_, veri) => ({ id: yol.split("/").pop(), ref: { path: yol }, exists: !!var_, data: () => var_ ? kopya(veri) : undefined, metadata: { hasPendingWrites: false, fromCache: false } });
  async function tazele(a) {
    try {
      if (a.tur === "doc") { const r = await api("POST", "/api/db", { op: "get", yol: a.yol }); a.sonraki(snapBelge(a.yol, r.var, r.veri)); }
      else { const r = await api("POST", "/api/db", { op: "koleksiyon", yol: a.yol }); const docs = r.belgeler.map(b => snapBelge(a.yol + "/" + b.id, true, b.veri)); a.sonraki({ docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }); }
    } catch (e) { if (a.hata) a.hata(e); }
  }
  function etkilenen(yollar) {
    const set = new Set(yollar), ust = new Set(yollar.map(y => y.split("/").slice(0, -1).join("/")));
    for (const a of abonelikler) if ((a.tur === "doc" && set.has(a.yol)) || (a.tur === "col" && ust.has(a.yol))) tazele(a);
  }
  let akisBasladi = false;
  async function akisDongusu() {
    if (akisBasladi) return; akisBasladi = true;
    let sira = -1, bekle = 0;
    for (;;) {
      try {
        const r = await api("GET", "/api/db/akis" + (sira >= 0 ? "?sonra=" + sira : ""));
        if (sira >= 0 && r.yollar.length) etkilenen(r.yollar);
        sira = r.sira; bekle = 0;
      } catch (e) {
        if (e.status === 401 || e.status === 403) return;
        bekle = Math.min(30000, (bekle || 1000) * 2); await new Promise(r => setTimeout(r, bekle));
      }
      if (document.hidden) await new Promise(r => { const f = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", f); r(); } }; document.addEventListener("visibilitychange", f); });
    }
  }
  /* Uygulama öne gelince tüm görünümler tazelenir (uzun yoklama arka planda durmuş olabilir). */
  document.addEventListener("visibilitychange", () => { if (!document.hidden) for (const a of abonelikler) tazele(a); });

  function belge(yol) {
    const yaz = async (op, veri) => { await api("POST", "/api/db", { op, yol, veri }); etkilenen([yol]); };
    return {
      id: yol.split("/").pop(), path: yol,
      async get() { const r = await api("POST", "/api/db", { op: "get", yol }); return snapBelge(yol, r.var, r.veri); },
      set: v => yaz("set", v), update: v => yaz("update", v), delete: () => yaz("delete"),
      onSnapshot(sonraki, hata) { const a = { tur: "doc", yol, sonraki, hata }; abonelikler.add(a); tazele(a); akisDongusu(); return () => abonelikler.delete(a); }
    };
  }
  const DB = Object.freeze({
    doc: belge,
    collection(yol) {
      return {
        path: yol, doc: id => belge(yol + "/" + id),
        onSnapshot(sonraki, hata) { const a = { tur: "col", yol, sonraki, hata }; abonelikler.add(a); tazele(a); akisDongusu(); return () => abonelikler.delete(a); }
      };
    }
  });

  /* ---------- user ---------- */
  const USER = Object.freeze({
    id: async () => ME.aktifSite.kimlik,
    canEdit: async () => ME.aktifSite.rol === "site_yonetici",
    isOwner: async () => false,
    can: async n => n === "data.write" ? !ME.aktifSite.saltOkur : null,
    me: async () => ({ id: ME.aktifSite.kimlik, name: "" })
  });

  /* ---------- assets ---------- */
  const b64 = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(blob); });
  const ASSETS = Object.freeze({
    async upload(blob, o) { const tip = (o && o.type) || blob.type || "image/jpeg"; const r = await api("POST", "/api/varlik", { tip, veri: await b64(blob) }); return { ...r, url: BS.url(r.url) }; },
    async delete(id) { await api("DELETE", "/api/varlik/" + id); },
    async list() { return { assets: [], usage: {} }; }
  });
  window.BS_BLOB = id => BS.url("/api/varlik/" + encodeURIComponent(id));

  /* ---------- downloads ---------- */
  const DOWNLOADS = Object.freeze({
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const k = window.BSNative;
      if (BS.native && k && k.duvar && /\.png$/i.test(filename)) { await k.duvar.kaydet({ base64: await b64(blob), ad: filename }); return { status: "saved" }; }
      if (BS.native && k && k.paylasDosya) { await k.paylasDosya({ ad: filename, metin: await blob.text(), tip: blob.type }); return { status: "saved" }; }
      const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
      return { status: "saved" };
    }
  });

  const ADLAR = { db: DB, user: USER, assets: ASSETS, downloads: DOWNLOADS };
  window.claude = Object.freeze({ use: async ad => { if (!(ad in ADLAR)) return null; await hazir; return ADLAR[ad]; } });

  /* ---------- Hesap ve abonelik (Merter arayüzünün Profil sayfasına eklenir) ---------- */
  const PREMIUM_OZELLIK = ["Gündem: fotoğraflı paylaşım, beğeni ve yorumlar", "Sonsuz kaydırma ve hikâye şeridi", "Gönderi sabitleme ve duyuru öne çıkarma"];
  let ab = null, abDurum = "", abMesgul = false, silSor = false;
  const tarih = ms => new Date(ms).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  async function abYukle() { try { ab = (await api("GET", "/api/abonelik")).abonelik; } catch (e) { ab = null; } yeniden(); }
  function yeniden() { const el = document.getElementById("bsHesap"); if (el) el.outerHTML = bolum(); const m = document.getElementById("bsPremium"); if (m && !m.hidden) premiumAc(); }
  function bolum() {
    if (!ME) return "";
    if (!ab) { setTimeout(abYukle, 0); }
    const a = ab || { aktif: false, fiyatMetni: "" };
    return `<section class="hcard" id="bsHesap" aria-labelledby="bsHesapB"><div class="hhead"><h3 id="bsHesapB">Hesap ve abonelik</h3></div>
      <p class="lvl">Telefon: ${esc(ME.user.telefon)} · ${esc(ME.aktifSite.ad)}</p>
      <p><b>Premium:</b> ${a.aktif ? (a.kaynak === "site" ? "Etkin · siteniz ödüyor" : `Etkin${a.bitis ? " · dönem sonu " + tarih(a.bitis) : ""}`) : `Kapalı · ${esc(a.fiyatMetni || "")}`}</p>
      <div class="confirm"><button type="button" class="btn ${a.aktif ? "" : "pri"}" data-bshesap="premium">${a.aktif ? "Aboneliğim" : "Premium'u incele"}</button>
      <a class="btn" href="${esc(BS.yasal.gizlilik)}" target="_blank" rel="noopener">Gizlilik</a><a class="btn" href="${esc(BS.yasal.kosullar)}" target="_blank" rel="noopener">Koşullar</a></div>
      <div class="confirm"><button type="button" class="btn" data-bshesap="cikis">Çıkış yap</button>
      ${silSor ? `<span class="lvl">Hesabınız ve bu uygulamadaki tüm verileriniz kalıcı olarak silinecek.</span><button type="button" class="btn danger" data-bshesap="silEvet">Evet, hesabımı sil</button><button type="button" class="btn" data-bshesap="silHayir">Vazgeç</button>` : `<button type="button" class="btn danger" data-bshesap="silSor">Hesabımı sil</button>`}</div>
      <p class="err" role="status">${esc(abDurum)}</p></section>`;
  }
  function premiumKarti() {
    return `<section class="hcard upsell"><div class="hhead"><h3>Premium Gündem</h3></div><ul class="lvl">${PREMIUM_OZELLIK.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="confirm"><button type="button" class="btn pri" data-bshesap="premium">Premium'u incele</button></div></section>`;
  }
  function premiumAc() {
    let el = document.getElementById("bsPremium");
    if (!el) { el = document.createElement("div"); el.id = "bsPremium"; el.className = "hkdv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Premium"); document.body.appendChild(el); }
    const a = ab || { aktif: false, fiyatMetni: "", magazaHazir: false }, m = BS.magaza();
    let ic;
    if (a.aktif) ic = `<p><b>Premium etkin.</b> ${a.kaynak === "site" ? "Site yönetiminiz bu bedeli tüm sakinler için ödüyor." : (a.durum === "iptal_edildi" ? "Otomatik yenileme kapalı. " : "") + (a.bitis ? "Dönem sonu: " + tarih(a.bitis) : "")}</p>
      ${a.kaynak !== "site" ? `<div class="confirm"><a class="btn" href="${BS.abonelikYonetUrl()}" target="_blank" rel="noopener">Aboneliği yönet veya iptal et</a></div>` : ""}`;
    else if (m && a.magazaHazir) ic = `<p class="bs-fiyat">${esc(a.fiyatMetni)}</p><ul class="lvl">${PREMIUM_OZELLIK.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="confirm"><button type="button" class="btn pri" data-bshesap="abone" ${abMesgul ? "disabled" : ""}>${abMesgul ? "Bekleyin…" : "Premium'a geç"}</button><button type="button" class="btn" data-bshesap="geriYukle" ${abMesgul ? "disabled" : ""}>Satın alımları geri yükle</button></div>
      <p class="lvl" style="font-size:13px">Aylık otomatik yenilenen abonelik. Ödeme, onayladığınızda ${BS.platform === "ios" ? "Apple Kimliği" : "Google Play"} hesabınızdan alınır. Dönem bitmeden en az 24 saat önce iptal edilmezse abonelik aynı ücretle yenilenir. İptal: ${BS.platform === "ios" ? "Ayarlar › Apple Kimliği › Abonelikler" : "Google Play › Ödemeler ve abonelikler"}. <a href="${esc(BS.yasal.kosullar)}" target="_blank" rel="noopener">Kullanım koşulları</a> · <a href="${esc(BS.yasal.gizlilik)}" target="_blank" rel="noopener">Gizlilik politikası</a></p>`;
    else ic = `<ul class="lvl">${PREMIUM_OZELLIK.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="lvl">${BS.native ? "Mağaza bağlantısı şu anda kurulamadı. Biraz sonra tekrar deneyin." : "Premium'a telefon uygulamasından (App Store / Google Play) geçebilirsiniz. Site yönetiminiz bedeli aidat içinde tüm sakinler için ödemeyi de seçebilir."}</p>`;
    el.innerHTML = `<div class="hkdvk"><div class="hkdvb"><b>Premium</b><button type="button" class="mini" data-bshesap="kapat" aria-label="Kapat">✕</button></div>${ic}<p class="err" role="status">${esc(abDurum)}</p></div>`;
    el.hidden = false;
  }
  async function hesapIslem(k) {
    abDurum = "";
    if (k === "premium") { if (!ab) await abYukle(); return premiumAc(); }
    if (k === "kapat") { const el = document.getElementById("bsPremium"); if (el) el.hidden = true; return; }
    if (k === "cikis") return cikis();
    if (k === "silSor" || k === "silHayir") { silSor = k === "silSor"; return yeniden(); }
    if (k === "silEvet") {
      try { const d = await api("DELETE", "/api/hesap", { onay: true }); await BS.tokenSil(); alert("Hesabınız ve verileriniz silindi." + (d && d.not ? "\n\n" + d.not : "")); location.reload(); }
      catch (e) { abDurum = e.message; yeniden(); }
      return;
    }
    if (k === "abone" || k === "geriYukle") {
      const m = BS.magaza(); if (!m || abMesgul) return;
      abMesgul = true; premiumAc();
      try {
        const g = await api("GET", "/api/abonelik");
        const kanitlar = k === "abone" ? [await m.satinAl(g)] : await m.geriYukle(g);
        if (k === "abone" && !kanitlar[0]) return;
        let son = null, not = "";
        for (const x of kanitlar.filter(Boolean)) {
          try { const r = await api("POST", "/api/abonelik/dogrula", x); if (r.abonelik) son = r.abonelik; else not = r.hata || ""; } catch (e) { not = e.message; }
        }
        ab = son || (await api("POST", "/api/abonelik/yenile", {})).abonelik;
        abDurum = ab.aktif ? "Teşekkürler, Premium etkin." : not || (k === "geriYukle" ? "Geri yüklenecek bir abonelik bulunamadı." : "Ödeme onaylanınca Premium açılacak; birkaç dakika sonra tekrar bakın.");
        etkilenen(["lisans/site"]);
      } catch (e) { abDurum = e.message || "İşlem tamamlanamadı."; }
      finally { abMesgul = false; yeniden(); }
    }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-bshesap]"); if (b) hesapIslem(b.dataset.bshesap); });
  window.BS_HESAP = { bolum, premiumKarti };
  /* Yönetim ekranı (yonetim.js) için sunucu çağrısı ve oturum bilgisi */
  window.BS_API = api;
  window.BS_ME = () => ME;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", baslat); else baslat();
})();
