"use strict";
/* Nasıl kullanılır sayfası: /s/ABCD2345 veya ?kod=ABCD2345 yolundan davet kodunu ve site adını gösterir. */
(function () {
  const m = location.pathname.match(/^\/s\/([A-Za-z0-9-]{1,20})\/?$/);
  const ham = (m && m[1]) || new URLSearchParams(location.search).get("kod") || "";
  const kod = ham.toUpperCase().replace(/[^A-Z0-9]/g, "");
  document.getElementById("nYazdir").addEventListener("click", () => window.print());
  if (kod.length !== 8) return;
  fetch("/api/davet/onizleme/" + encodeURIComponent(kod)).then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.gecerli) { document.getElementById("nKodSatir").textContent = "Bu bağlantıdaki davet kodu geçersiz veya süresi dolmuş. Site yönetiminden yeni kod iste."; return; }
    const h1 = document.getElementById("nSite");
    h1.textContent = d.site + " "; const sp = document.createElement("span"); sp.textContent = "· Sakin"; h1.appendChild(sp);
    document.title = d.site + " · Nasıl kullanılır";
    document.getElementById("nGiris").textContent = d.site + " sakin uygulamasına telefonundan birkaç dakikada katılabilirsin. Şifre yok; giriş kodu SMS ile gelir.";
    document.getElementById("nKodSatir").textContent = "Davet kodun aşağıda; uygulamayı bu sayfadaki bağlantıdan açarsan kod kendiliğinden yazılır.";
    document.getElementById("nKod").textContent = d.kod;
    document.getElementById("nKodKutu").hidden = false;
    document.getElementById("nAc").href = "/?davet=" + encodeURIComponent(d.kod);
  }).catch(() => {});
})();
