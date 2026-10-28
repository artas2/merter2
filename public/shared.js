/* Sunucu ve tarayıcı arasında ortak sabitler ve iş kuralları.
   Kaynak: site-yonetimi/index.html prototipi (birebir taşındı). */
(function (root) {
  const M = [
    ["Y01", "Kat mülkiyeti ve yönetim yapısı", "modul-Y01-kat-mulkiyeti-yonetim.md", 1, [], ["R1"]],
    ["Y02", "Binayı ve ortak tesisleri tanıma", "modul-Y02-bina-tesisler.md", 1, [], ["R1"]],
    ["Y03", "Komşuluk, iletişim ve ortak yaşam", "modul-Y03-komsuluk-iletisim.md", 1, [], ["R1"]],
    ["Y04", "Aidat, bütçe ve gider dağılımı", "modul-Y04-aidat-butce.md", 2, ["Y01"], ["R2"]],
    ["Y05", "Bakım, arıza bildirimi ve hizmet takibi", "modul-Y05-bakim-ariza.md", 2, ["Y02"], ["R3"]],
    ["Y06", "Güvenlik ve acil durum hazırlığı", "modul-Y06-guvenlik-acil-durum.md", 2, ["Y02"], ["R4"]],
    ["Y07", "Kurul toplantısı, önerge ve oylama", "modul-Y07-kurul-onerge.md", 3, ["Y01", "Y03"], ["R5"]],
    ["Y08", "Hesap ve yönetim denetimi", "modul-Y08-hesap-denetimi.md", 3, ["Y04"], ["R2"]],
    ["Y09", "Enerji, su ve kaynak verimliliği", "modul-Y09-kaynak-verimliligi.md", 3, ["Y02", "Y04"], ["R5"]],
    ["Y10", "Teklif, tedarikçi ve sözleşme", "modul-Y10-teklif-sozlesme.md", 3, ["Y04", "Y05"], ["R5"]],
    ["Y11", "Haklar, uyuşmazlık ve çözüm yolları", "modul-Y11-haklar-uyusmazlik.md", 3, ["Y01", "Y03"], ["R3"]],
    ["Y12", "Görev üstlenme ve site projesi", "modul-Y12-gorev-proje.md", 4, ["Y07", "Y10"], ["R5"]],
    ["Y13", "Bilgi aktarma ve sakin elçiliği", "modul-Y13-bilgi-aktarma.md", 4, [], ["R6"]]
  ].map(([code, title, file, phase, pre, proj]) => ({ code, title, file, phase, pre, proj }));
  const BY = Object.fromEntries(M.map(m => [m.code, m]));
  const PHASES = { 1: "Temel", 2: "Değerlendirme", 3: "Karar", 4: "Ustalık" };
  const LEVEL = s => !s ? "Puanlanmadı" : s <= 2 ? "Başlangıç" : s === 3 ? "Temel kavrayış" : s <= 5 ? "Rehberli uygulama" : s === 6 ? "Bağımsız sakin" : s === 7 ? "Bütünleştirme" : s === 8 ? "Eleştirel değerlendirme" : s === 9 ? "Öğretici" : "Özgün katkı";
  const NEXT = s => !s ? "Modül testi" : s < 6 ? "Kontrol listesiyle yeni bir uygulama" : s < 7 ? "Bir site görevinde kanıt" : s < 9 ? "Değerlendirme raporu veya öğretme görevi (R6)" : s < 10 ? "Siteye kalıcı rehber veya iyileştirme" : "Ustalık";

  const TEMALAR = {
    yesil: { ad: "Yeşil", l: ["#1F6B5A", "#E2F0EB"], d: ["#6CC4A8", "#16302A"] }, mavi: { ad: "Mavi", l: ["#1D5C88", "#E2EDF5"], d: ["#72B3E2", "#17293A"] },
    bordo: { ad: "Bordo", l: ["#7A2335", "#F5E4E8"], d: ["#E58C9E", "#3A1A22"] }, turuncu: { ad: "Turuncu", l: ["#A34B0E", "#FBEADC"], d: ["#F0A066", "#3A2412"] },
    mor: { ad: "Mor", l: ["#5B3A8C", "#ECE5F5"], d: ["#B9A0E6", "#2A2140"] }, antrasit: { ad: "Antrasit", l: ["#2F3A40", "#E6EAEC"], d: ["#B5C2C9", "#232B30"] }
  };
  const HAZIR_ALANLAR = [{ k: "arac", label: "Araç sayısı", tip: "sayi" }, { k: "plaka", label: "Araç plakası", tip: "metin" }, { k: "otopark", label: "Otopark yeri", tip: "metin" },
    { k: "evcil", label: "Evcil hayvan var", tip: "evethayir" }, { k: "depo", label: "Depo numarası", tip: "metin" }];
  const TIPLER = { metin: "Metin", sayi: "Sayı", evethayir: "Evet / hayır", secim: "Seçenekli" };
  function varsayilanAyar() { return { siteAdi: "", tema: "yesil", karsilama: "", duyuru: "", iletisim: [], bloklar: [], isDurumuSor: true, telefonZorunlu: false, hazir: [], ozel: [], gizliModul: [] }; }
  function ekAlanlar(AYAR) { return [...HAZIR_ALANLAR.filter(a => (AYAR.hazir || []).includes(a.k)), ...(AYAR.ozel || []).filter(a => a && a.label)]; }

  const ALT = { pazar: ["Sebze", "Meyve", "Yeşillik", "Diğer"], market: ["Temel gıda", "Süt ve kahvaltılık", "Et ve tavuk", "İçecek", "Temizlik", "Diğer"] };
  const BIRIMLER = ["adet", "kg", "500 g", "demet", "paket", "litre", "koli"];
  const ALT_RENK = { "Sebze": "#2E7D4F", "Meyve": "#B4470F", "Yeşillik": "#4D7C0F", "Temel gıda": "#8A4B0F", "Süt ve kahvaltılık": "#1D5C88", "Et ve tavuk": "#9F1239", "İçecek": "#0E7490", "Temizlik": "#6D28D9", "Diğer": "#475569" };
  const ORNEK_KATALOG = [["Domates", "pazar", "Sebze", "kg"], ["Salatalık", "pazar", "Sebze", "kg"], ["Biber (sivri)", "pazar", "Sebze", "kg"], ["Patlıcan", "pazar", "Sebze", "kg"], ["Patates", "pazar", "Sebze", "kg"], ["Soğan", "pazar", "Sebze", "kg"], ["Kabak", "pazar", "Sebze", "kg"], ["Havuç", "pazar", "Sebze", "kg"],
    ["Elma", "pazar", "Meyve", "kg"], ["Muz", "pazar", "Meyve", "kg"], ["Portakal", "pazar", "Meyve", "kg"], ["Mandalina", "pazar", "Meyve", "kg"], ["Üzüm", "pazar", "Meyve", "kg"], ["Limon", "pazar", "Meyve", "kg"],
    ["Maydanoz", "pazar", "Yeşillik", "demet"], ["Dereotu", "pazar", "Yeşillik", "demet"], ["Marul", "pazar", "Yeşillik", "adet"], ["Roka", "pazar", "Yeşillik", "demet"],
    ["Ekmek", "market", "Temel gıda", "adet"], ["Pirinç", "market", "Temel gıda", "paket"], ["Makarna", "market", "Temel gıda", "paket"], ["Un", "market", "Temel gıda", "paket"], ["Ayçiçek yağı", "market", "Temel gıda", "litre"], ["Kırmızı mercimek", "market", "Temel gıda", "paket"],
    ["Süt", "market", "Süt ve kahvaltılık", "litre"], ["Yoğurt", "market", "Süt ve kahvaltılık", "adet"], ["Beyaz peynir", "market", "Süt ve kahvaltılık", "500 g"], ["Yumurta (30'lu)", "market", "Süt ve kahvaltılık", "koli"], ["Zeytin", "market", "Süt ve kahvaltılık", "500 g"],
    ["Tavuk göğüs", "market", "Et ve tavuk", "kg"], ["Kıyma", "market", "Et ve tavuk", "kg"], ["Su (5 L)", "market", "İçecek", "adet"], ["Çay", "market", "İçecek", "paket"],
    ["Bulaşık deterjanı", "market", "Temizlik", "adet"], ["Çamaşır deterjanı", "market", "Temizlik", "paket"], ["Tuvalet kâğıdı", "market", "Temizlik", "paket"]]
    .map(([ad, kat, alt, birim], i) => ({ id: "u" + (i + 1), ad, kat, alt, birim, fiyat: "", aktif: true }));
  const adimFor = b => b === "kg" ? 0.5 : 1;

  const YAKINLIK = ["Kendisi", "Eş", "Çocuk", "Ebeveyn", "Kardeş", "Diğer"];
  const YAS = ["0–6", "7–17", "18–64", "65+"];
  const IS = ["Çalışıyor", "Öğrenci", "Emekli", "Ev işleri / bakım", "İş arıyor", "Çalışmıyor", "Belirtmek istemiyor"];
  const DURUM = ["Malik", "Kiracı", "Malik yakını"];
  const ROLLER = { site_yonetici: "Site yöneticisi", site_denetci: "Denetçi", sakin: "Sakin" };
  /* Paketler: temel ⊂ alisveris ⊂ tam */
  const PLANLAR = { temel: "Temel", alisveris: "Alışveriş", tam: "Tam" };
  /* Premium aboneliğin sakine sunduğu ek özellikler. Mağaza incelemesinde bu listedeki her madde uygulamada
     gerçekten çalışıyor olmalıdır; yeni özellik eklenmeden listeye madde yazılmaz. */
  const PREMIUM_OZELLIKLER = [
    "Hikmet duvar kâğıtları: her ayet ve hadis için ana ekran ve kilit ekranı görseli (Android'de tek dokunuşla ayarlanır)"
  ];
  const OZELLIK_PAKET = { alisveris: "alisveris", egitim: "tam" }; // özelliğin açıldığı en düşük paket
  const PAKET_SIRA = { temel: 0, alisveris: 1, tam: 2 };
  function ozellikVar(plan, ozellik) { const g = OZELLIK_PAKET[ozellik]; return !g || (PAKET_SIRA[plan] ?? -1) >= PAKET_SIRA[g]; }
  function ozellikMesaj(ozellik) { return `Bu özellik ${PLANLAR[OZELLIK_PAKET[ozellik]]} paketinde. Paketi yükseltmek için site yönetiminiz satıcıyla görüşebilir.`; }
  const SITE_DURUM = { deneme: "Deneme", aktif: "Aktif", askida: "Askıda" };

  function katAd(k) { k = parseInt(k, 10); return Number.isFinite(k) ? (k === 0 ? "Zemin kat" : k < 0 ? `${-k}. bodrum kat` : `${k}. kat`) : "—"; }
  function kategoriler(p, ozel, buYil) {
    const BUYIL = buYil || new Date().getFullYear();
    const b = p.bireyler || [], out = [];
    if (p.durum) out.push(p.durum);
    out.push(b.length === 1 ? "Tek kişilik hane" : b.length >= 5 ? `Kalabalık hane (${b.length})` : `${b.length} kişilik hane`);
    if (b.some(x => x.yas === "0–6")) out.push("Küçük çocuklu (0–6)");
    else if (b.some(x => x.yas === "7–17")) out.push("Çocuklu hane");
    if (b.some(x => x.yas === "65+")) out.push("65+ birey var");
    if (+p.tasinma >= BUYIL - 1) out.push("Yeni sakin");
    if (b.some(x => x.is === "Öğrenci")) out.push("Öğrenci var");
    if (ozel && p.yardim) out.push("Acil durumda yardım gerekli");
    return out;
  }
  function onerilenYol(p, gizli, buYil) {
    const BUYIL = buYil || new Date().getFullYear();
    const b = p.bireyler || [], y = [];
    if (+p.tasinma >= BUYIL - 1) y.push("Y02", "Y03", "Y01");
    if (p.durum === "Kiracı") y.push("Y03", "Y05", "Y11");
    if (p.durum === "Malik") y.push("Y01", "Y04", "Y07", "Y08");
    if (p.durum === "Malik yakını") y.push("Y01", "Y03", "Y04");
    if (p.yardim || b.some(x => x.yas === "0–6" || x.yas === "7–17" || x.yas === "65+")) y.push("Y06");
    y.push("Y02", "Y05", "Y09", "Y04");
    return [...new Set(y)].filter(c => !(gizli || []).includes(c)).slice(0, 6);
  }

  /* Tur saatleri sitenin yerel saatidir (datetime-local). Türkiye UTC+3 (yaz saati yok). */
  const SITE_UTC_OFFSET = "+03:00";
  function turBitisMs(sonTarih) { if (!sonTarih) return null; const t = Date.parse(sonTarih + ":00" + SITE_UTC_OFFSET); return Number.isFinite(t) ? t : null; }
  function turAcik(tur, simdi) {
    if (!tur || !tur.id || !tur.acik) return false;
    const b = turBitisMs(tur.sonTarih);
    return b === null || b > (simdi || Date.now());
  }
  function kalanSure(tur, simdi) {
    const b = turBitisMs(tur && tur.sonTarih); if (b === null) return "";
    const ms = b - (simdi || Date.now()); if (ms <= 0) return "Süre doldu";
    const g = Math.floor(ms / 864e5), s = Math.floor(ms % 864e5 / 36e5), d = Math.floor(ms % 36e5 / 6e4);
    return g ? `${g} gün ${s} saat kaldı` : s ? `${s} saat ${d} dk kaldı` : `${d} dk kaldı`;
  }
  /* Toplu sipariş: ürün bazında toplam (prototipteki siparisMetni) */
  function siparisToplam(sepetler, urunler) {
    const ag = {};
    sepetler.forEach(d => Object.entries(d.kalemler || {}).forEach(([id, q]) => { if (q > 0) { ag[id] = ag[id] || { q: 0, h: 0 }; ag[id].q += q; ag[id].h++; } }));
    return Object.entries(ag).map(([id, a]) => { const u = urunler.find(x => x.id === id); return u ? { u, ...a } : null; }).filter(Boolean)
      .sort((a, b) => a.u.kat.localeCompare(b.u.kat) || a.u.alt.localeCompare(b.u.alt, "tr") || a.u.ad.localeCompare(b.u.ad, "tr"));
  }
  function sepetOzet(k, urunler) {
    let n = 0, t = 0, eksik = false;
    for (const [id, q] of Object.entries(k || {})) { const u = urunler.find(x => x.id === id); if (!u || !q) continue; n++; if (u.fiyat === "" || u.fiyat == null) eksik = true; else t += q * (+u.fiyat); }
    return { n, t, eksik };
  }
  function teslimatSirala(list) {
    return list.sort((a, b) => String(a.blok).localeCompare(String(b.blok), "tr") || (a.kat - b.kat) || String(a.daire).localeCompare(String(b.daire), "tr", { numeric: true }));
  }

  const api = { M, BY, PHASES, LEVEL, NEXT, TEMALAR, HAZIR_ALANLAR, TIPLER, varsayilanAyar, ekAlanlar, ALT, BIRIMLER, ALT_RENK, ORNEK_KATALOG, adimFor,
    YAKINLIK, YAS, IS, DURUM, ROLLER, PLANLAR, PREMIUM_OZELLIKLER, OZELLIK_PAKET, ozellikVar, ozellikMesaj, SITE_DURUM, katAd, kategoriler, onerilenYol, SITE_UTC_OFFSET, turBitisMs, turAcik, kalanSure, siparisToplam, sepetOzet, teslimatSirala };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ORTAK = api;
})(typeof window !== "undefined" ? window : globalThis);
