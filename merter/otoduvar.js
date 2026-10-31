"use strict";
/* Otomatik Hikmet duvar kâğıdı: ayet ve hadisler telefonun ana ekranında ve kilit ekranında kendiliğinden değişir.
   - Android "Her açılışta yeni": uygulamanın canlı duvar kâğıdı; ekran her açıldığında sıradaki metin.
   - Android "Her gün yeni": her gün uygulamadaki "Günün ayeti/hadisi" ana ve kilit ekranına konur.
   - iPhone: uygulamalar duvar kâğıdını değiştiremez; Kestirmeler'deki "Günün Hikmet görseli" eylemiyle günlük otomasyon kurulur.
   Görseller telefonda bir kez üretilir (Hikmet çizim kodu, Amiri yazı tipi): her metin için ana ve kilit düzeni.
   Metinler ya da site adı değişince görseller yeniden üretilir. Yalnızca telefon uygulamasında yüklenir.
   Gerektirir: Merter arayüzü (HK, hkDuvarCiz, AYAR, render, toast), native.js (BS), kopru.js (BSNative.duvar). */
(function () {
  const D = () => (window.BSNative && BSNative.duvar && BSNative.duvar.havuzYaz ? BSNative.duvar : null);
  if (!D()) return;
  const h = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const bildir = m => { try { if (typeof toast === "function") toast(m); } catch (e) { /* yok */ } };
  const platform = () => (window.BS && BS.platform) || "android";
  const S = { durum: null, uretiliyor: false, ilerleme: 0, hata: "", iosAdim: false };

  /* Sürüm: metinler, kaynaklar ve site adı değişince değişir → görseller yeniden üretilir */
  function surum() {
    const t = HK.map(x => x.id + "|" + x.ar + "|" + x.tr + "|" + x.kaynak + "|" + x.tema).join("\n") + "\n" + (AYAR.siteAdi || "") + "\nv1";
    let a = 2166136261; for (let i = 0; i < t.length; i++) { a ^= t.charCodeAt(i); a = Math.imul(a, 16777619) >>> 0; }
    return HK.length + "-" + a.toString(36);
  }
  const yeniden = () => { if (typeof current !== "undefined" && current === "hikmet") { const y = window.scrollY; render(false); window.scrollTo(0, y); } };
  async function durumYukle() { try { S.durum = await D().otomatikDurum(); } catch (e) { S.durum = { mod: "kapali", n: 0, surum: "" }; } yeniden(); }

  async function havuzUret() {
    if (S.uretiliyor) return; S.uretiliyor = true; S.ilerleme = 0; S.hata = ""; yeniden();
    try {
      const toplam = HK.length * 2;
      for (let i = 0; i < HK.length; i++) {
        for (const ekran of ["ana", "kilit"]) {
          const cv = await hkDuvarCiz(HK[i], ekran);
          await D().havuzYaz({ ad: `${ekran}-${i}.jpg`, base64: cv.toDataURL("image/jpeg", 0.9).split(",")[1] });
          S.ilerleme++;
          const b = document.getElementById("odIlerleme"); if (b) b.style.width = Math.round(S.ilerleme / toplam * 100) + "%";
          await new Promise(r => setTimeout(r, 0)); // arayüz donmasın
        }
      }
      S.durum = await D().havuzBitir({ n: HK.length, surum: surum() });
    } finally { S.uretiliyor = false; }
  }
  async function ayarla(mod) {
    S.hata = "";
    try {
      if (mod !== "kapali" && (!S.durum || S.durum.n !== HK.length || S.durum.surum !== surum())) await havuzUret();
      const r = await D().otomatikAyarla({ mod });
      S.durum = { ...S.durum, ...r };
      if (mod === "acilis") bildir(r.canli ? "Her açılışta yeni ayet ve hadis açık." : r.listeden ? "Listeden \"Hikmet\" canlı duvar kâğıdını seçin." : "Açılan ekranda \"Duvar kâğıdını ayarla\"ya dokunun; kilit ekranı için de seçin.");
      else if (mod === "gunluk") { bildir(r.uygulandi === false && platform() === "android" ? "Ayarlandı; duvar kâğıdı kısa süre içinde değişecek." : platform() === "ios" ? "Görseller hazır. Kestirmeler'de otomasyonu kurun." : "Ana ve kilit ekranı bugünün ayeti/hadisi oldu; her gün değişecek."); if (platform() === "ios") S.iosAdim = true; }
      else bildir("Otomatik değişim kapatıldı.");
    } catch (e) { S.hata = (e && e.message) || "Ayarlanamadı."; }
    yeniden();
  }

  function kart() {
    if (!S.durum) { setTimeout(durumYukle, 0); return `<section class="od"><p class="lvl">Otomatik duvar kâğıdı yükleniyor…</p></section>`; }
    const d = S.durum, mod = d.mod || "kapali", ios = platform() === "ios";
    const secenek = (k, baslik, alt, kilit) => `<button type="button" class="od-sec${mod === k ? " on" : ""}" data-od="${k}" aria-pressed="${mod === k}" ${S.uretiliyor ? "disabled" : ""}>
      <span class="od-damla" aria-hidden="true"></span><span><b>${baslik}</b><small>${alt}</small></span>${kilit ? `<i class="od-etiket">${kilit}</i>` : ""}</button>`;
    let x = `<section class="od" aria-labelledby="odB"><div class="od-bas"><h3 id="odB">Otomatik duvar kâğıdı</h3><p>Ayetler ve hadisler ana ekranınızda ve kilit ekranınızda kendiliğinden değişsin.</p></div>`;
    if (S.uretiliyor) x += `<div class="od-uret"><p>Görseller hazırlanıyor (${S.ilerleme}/${HK.length * 2})… Uygulamayı kapatmayın.</p><div class="od-cubuk"><i id="odIlerleme" style="width:${Math.round(S.ilerleme / (HK.length * 2) * 100)}%"></i></div></div>`;
    x += `<div class="od-liste" role="group" aria-label="Değişim sıklığı">`;
    if (!ios) x += secenek("acilis", "Her açılışta yeni", "Telefonu her açtığınızda sıradaki ayet ya da hadis", "Canlı duvar kâğıdı");
    x += secenek("gunluk", "Her gün yeni", ios ? "Kestirmeler otomasyonuyla her sabah günün metni" : "Her gün uygulamadaki günün ayeti/hadisi");
    x += secenek("kapali", "Kapalı", "Duvar kâğıdım değişmesin") + `</div>`;
    if (!ios && mod === "acilis" && !d.canli) x += `<p class="od-not">Canlı duvar kâğıdı henüz seçilmedi. "Her açılışta yeni"ye yeniden dokunup açılan ekranda onaylayın.</p>`;
    if (!ios && mod === "acilis" && d.canli) x += `<p class="od-not ok">Açık: telefonu her açtığınızda yeni bir ayet ya da hadis. Bazı telefonlarda kilit ekranı canlı duvar kâğıdını göstermez; o durumda "Her gün yeni"yi seçin.</p>`;
    if (!ios && mod === "gunluk") x += `<p class="od-not ok">Açık: ana ve kilit ekranı her gün günün ayeti/hadisi oluyor.</p>`;
    if (ios && (mod === "gunluk" || S.iosAdim)) x += `<div class="od-ios"><b>iPhone'da bir kez kurun (Kestirmeler uygulaması):</b><ol>
      <li>Otomasyon sekmesinde yeni bir kişisel otomasyon oluşturun: her gün belirli bir saatte (ör. 06:00) çalışsın ve onay sormadan çalışacak şekilde ayarlayın.</li>
      <li>Eylem olarak <b>Bilinçli Sakin › Günün Hikmet görseli</b>'ni ekleyin (Ekran: Kilit ekranı).</li>
      <li>Ardından duvar kâğıdını ayarlama eylemini ekleyin, önceki adımın görselini seçin; kilit ekranını ve ana ekranı işaretleyin.</li></ol>
      <small>Menü adları iOS sürümüne göre biraz farklı olabilir. iPhone, uygulamaların duvar kâğıdını kendiliğinden değiştirmesine izin vermez; ekran açılışına bağlı otomasyon da yoktur. Günde birkaç kez değişsin isterseniz birden çok saat ekleyin ve eylemde "Her çalışmada sıradaki"yi açın.</small></div>`;
    if (S.hata) x += `<p class="od-not hata" role="alert">${h(S.hata)}</p>`;
    return x + `</section>`;
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-od]"); if (b && !S.uretiliyor) { e.preventDefault(); ayarla(b.dataset.od); } });

  /* Uygulama açılınca: otomatik mod açıksa ve metinler/site adı değiştiyse görselleri sessizce yeniler */
  async function denetle() {
    await durumYukle();
    const d = S.durum;
    if (d && d.mod && d.mod !== "kapali" && (d.n !== HK.length || d.surum !== surum())) { try { await havuzUret(); } catch (e) { /* sonra yeniden denenir */ } yeniden(); }
  }
  if (window.claude && claude.use) claude.use("db").then(() => setTimeout(denetle, 3000)).catch(() => {});

  window.BS_OTODUVAR = {
    kart,
    pencereNotu: () => `<p class="lvl" style="margin:8px 0 0"><a href="#hikmet" data-hkdv="kapat">Her gün ya da her açılışta kendiliğinden değişsin →</a></p>`,
    _surum: surum
  };
})();
