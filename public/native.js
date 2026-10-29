"use strict";
/* Web ile mobil uygulama (Capacitor) arasındaki ince katman.
   Tarayıcıda: her şey bugünkü gibi çalışır (aynı kaynak, çerez, CSRF).
   Mobilde: web dosyaları uygulamanın içindedir; API istekleri BS_AYAR.apiTaban adresine Bearer jetonla gider.
   Yerel yetenekler (mağaza satın alma, güvenli saklama, paylaşma, duvar kâğıdı) mobil derlemede eklenen
   window.BSNative köprüsünden gelir; yoksa ilgili düğmeler gizlenir. */
(function () {
  const cap = window.Capacitor;
  const native = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  const A = window.BS_AYAR || {};
  const K = () => window.BSNative || null;
  let token = null;
  const BS = {
    native,
    platform: native && typeof cap.getPlatform === "function" ? cap.getPlatform() : "web",
    apiTaban: native ? String(A.apiTaban || "").replace(/\/$/, "") : "",
    async tokenOku() { if (!native || !K()) return null; try { token = await K().tokenOku(); } catch (e) { token = null; } return token; },
    async tokenYaz(t) { token = t; if (native && K()) await K().tokenYaz(t); },
    async tokenSil() { token = null; if (native && K()) { try { await K().tokenSil(); } catch (e) { /* yok */ } } },
    baslik(h) { if (native) { h["X-Istemci"] = "mobil"; if (token) h.Authorization = "Bearer " + token; } return h; },
    url(yol) { return BS.apiTaban + yol; },
    magaza() { const k = K(); return native && k && k.magaza ? k.magaza : null; },
    duvar() { const k = K(); return native && k && k.duvar ? k.duvar : null; },
    paylas() { const k = K(); return native && k && k.paylasDosya ? k.paylasDosya : null; },
    /* Mağaza ekranı: önce yerel yönetim sayfası, yoksa mağaza adresi */
    async abonelikYonet() { const m = BS.magaza(); if (m && m.yonet) { try { await m.yonet(); return; } catch (e) { /* adrese düş */ } } window.open(BS.abonelikYonetUrl(), "_blank"); },
    abonelikYonetUrl() {
      return BS.platform === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";
    },
    yasal: { kosullar: A.kosullarUrl || "/kosullar.html", gizlilik: A.gizlilikUrl || "/gizlilik.html" }
  };
  window.BS = BS;
})();
