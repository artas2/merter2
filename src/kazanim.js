"use strict";
/* Arena kimliği: maç ve etkinliklerden kazanılan simge (avatar), çerçeve, sembol (en çok 3 gösterilir) ve unvan.
   Ödülleri yalnızca sunucu verir; istemci yalnızca sahip olduklarından seçim yapar. Görseller istemcidedir (merter/simgeler.js),
   burada yalnızca kod, ad, koşul ve nadirlik vardır. Başlangıç ödülleri herkese açıktır. */
const { Hata } = require("./validate");

const NADIR = { siradan: "Sıradan", nadir: "Nadir", destansi: "Destansı", efsanevi: "Efsanevi" };
const K = (kod, tur, ad, kosul, nadirlik = "siradan", baslangic = false, koleksiyon = "") => ({ kod, tur, ad, kosul, nadirlik, baslangic, koleksiyon });
/* Turnuva koleksiyonu: İstanbul ve Anadolu simgeleri. Her turnuvanın şampiyonu turnuvanın ödül simgesini kazanır
   (zaten varsa koleksiyondaki sıradaki eksik simgeyi). Görseller merter/simgeler.js'te kendi çizimimizdir. */
const T = (kod, ad) => K(kod, "simge", ad, "Turnuva şampiyonluğu ödülü (İstanbul ve Anadolu koleksiyonu).", "efsanevi", false, "turnuva");
const KOLEKSIYON = [
  T("t-galata", "Galata Kulesi"), T("t-kizkulesi", "Kız Kulesi"), T("t-ayasofya", "Ayasofya"), T("t-bogaz", "Boğaz Köprüsü"), T("t-bayrak", "Al Bayrak ve Lale"),
  T("t-karadeniz", "Karadeniz Çayı"), T("t-taskopru", "Taş Köprü"), T("t-fistik", "Antep Fıstığı"), T("t-baklava", "Baklava"), T("t-zeugma", "Zeugma Mozaiği"),
  T("t-demli", "Demli Çay"), T("t-nazar", "Nazar Boncuğu"), T("t-vapur", "Vapur"), T("t-siluet", "İstanbul Silueti"), T("t-lale", "Lale")
];
/* Mavi Öz: her eşleşmeli düellodan sonra kazanılır (antrenman hariç). Aynı rakiple günde 3 maçtan sonrası öz vermez. */
const OZ = { galibiyet: 30, berabere: 20, yenilgi: 15, turnuvaEk: 10, sampiyon: 100 };
const KATALOG = [
  // Simgeler
  K("s-damla", "simge", "Damla", "Herkese açık başlangıç simgesi.", "siradan", true),
  K("s-hilal", "simge", "Hilal", "İlk düello galibiyeti."),
  K("s-yildiz", "simge", "Sekiz Köşeli Yıldız", "5 düello galibiyeti.", "nadir"),
  K("s-cinar", "simge", "Çınar Yaprağı", "10 düello galibiyeti.", "nadir"),
  K("s-kalkan", "simge", "Kalkan", "Art arda 3 galibiyet.", "nadir"),
  K("s-simsek", "simge", "Şimşek", "Bir düelloda 5 sorunun hepsini ortalama 4 saniyenin altında doğru bil.", "destansi"),
  K("s-kandil", "simge", "Kandil", "Bütün bilgi kartlarını öğren.", "destansi"),
  K("s-gul", "simge", "Gül", "25 düello galibiyeti.", "destansi"),
  K("s-kule", "simge", "Kule", "Sezon sonunda blok savaşını kazanan blokta yer al.", "destansi"),
  K("s-tac", "simge", "Taç", "Bir turnuvada şampiyon ol.", "efsanevi"),
  // Çerçeveler
  K("c-sade", "cerceve", "Sade", "Herkese açık başlangıç çerçevesi.", "siradan", true),
  K("c-bronz", "cerceve", "Bronz", "Bir sezonda 100 puana ulaş (Kalfa).", "nadir"),
  K("c-gumus", "cerceve", "Gümüş", "Bir sezonda 400 puana ulaş (Usta).", "destansi"),
  K("c-altin", "cerceve", "Altın", "Bir sezonda 1000 puana ulaş (Efsane).", "efsanevi"),
  K("c-zumrut", "cerceve", "Zümrüt", "Bir turnuvada şampiyon ol.", "efsanevi"),
  K("c-sezon", "cerceve", "Sezon Defnesi", "Bir sezonu ilk 3'te bitir.", "efsanevi"),
  // Semboller
  K("y-ilk", "sembol", "İlk Adım", "İlk düellonu tamamla."),
  K("y-ogrenci", "sembol", "Öğrenci", "10 bilgi kartı öğren."),
  K("y-kusursuz", "sembol", "Kusursuz", "Bir düelloda 5 sorunun hepsini doğru bil.", "nadir"),
  K("y-seri5", "sembol", "Beşli Seri", "Art arda 5 galibiyet.", "destansi"),
  K("y-elli", "sembol", "Elli Maç", "50 düello tamamla.", "nadir"),
  K("y-turnuva", "sembol", "Turnuva Galibi", "Bir turnuva maçı kazan.", "nadir"),
  K("y-alim", "sembol", "Âlim", "Bütün bilgi kartlarını öğren.", "destansi"),
  K("y-blok", "sembol", "Blok Zaferi", "Sezon sonunda blok savaşını kazanan blokta yer al.", "destansi"),
  K("y-podyum", "sembol", "Podyum", "Bir sezonu ilk 3'te bitir.", "efsanevi"),
  // Unvanlar
  K("u-komsu", "unvan", "Komşu", "Herkese açık başlangıç unvanı.", "siradan", true),
  K("u-merakli", "unvan", "Meraklı", "10 bilgi kartı öğren."),
  K("u-rakipsiz", "unvan", "Rakipsiz", "Art arda 5 galibiyet.", "destansi"),
  K("u-yildirim", "unvan", "Yıldırım", "Bir düelloda 5 sorunun hepsini ortalama 4 saniyenin altında doğru bil.", "destansi"),
  K("u-bilge", "unvan", "Bilge", "Bütün bilgi kartlarını öğren.", "destansi"),
  K("u-usta", "unvan", "Arena Ustası", "25 düello galibiyeti.", "destansi"),
  K("u-blok", "unvan", "Blok Lideri", "Blok savaşını kazanan blokun en çok puan alan sakini ol.", "efsanevi"),
  K("u-sampiyon", "unvan", "Şampiyon", "Bir turnuvada şampiyon ol.", "efsanevi"),
  K("u-sezon", "unvan", "Sezonun Yıldızı", "Bir sezonu birinci bitir.", "efsanevi"),
  ...KOLEKSIYON
];
const KOD = new Map(KATALOG.map(k => [k.kod, k]));
const BASLANGIC = { simge: "s-damla", cerceve: "c-sade", semboller: [], unvan: "u-komsu", ozGoster: false };

function createKazanim({ db, now }) {
  const q = {
    var: db.prepare("SELECT kod, zaman, kaynak FROM kazanimlar WHERE site_id = ? AND user_id = ?"),
    ekle: db.prepare("INSERT OR IGNORE INTO kazanimlar (site_id, user_id, kod, zaman, kaynak) VALUES (?, ?, ?, ?, ?)"),
    kaynakla: db.prepare("SELECT kod FROM kazanimlar WHERE site_id = ? AND user_id = ? AND kaynak = ?"),
    secim: db.prepare("SELECT * FROM arena_gorunum WHERE site_id = ? AND user_id = ?"),
    secimYaz: db.prepare(`INSERT INTO arena_gorunum (site_id, user_id, simge, cerceve, semboller, unvan, oz_goster, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site_id, user_id) DO UPDATE SET simge = excluded.simge, cerceve = excluded.cerceve, semboller = excluded.semboller, unvan = excluded.unvan, oz_goster = excluded.oz_goster, guncelleme = excluded.guncelleme`),
    ozEkle: db.prepare("INSERT OR IGNORE INTO oz_kayit (site_id, user_id, kaynak, miktar, zaman) VALUES (?, ?, ?, ?, ?)"),
    ozArtir: db.prepare("UPDATE arena_istatistik SET mavi_oz = mavi_oz + ? WHERE site_id = ? AND user_id = ?"),
    ozKaynak: db.prepare("SELECT miktar FROM oz_kayit WHERE site_id = ? AND user_id = ? AND kaynak = ?"),
    ozSon: db.prepare("SELECT kaynak, miktar, zaman FROM oz_kayit WHERE site_id = ? AND user_id = ? ORDER BY zaman DESC LIMIT ?"),
    ist: db.prepare("SELECT * FROM arena_istatistik WHERE site_id = ? AND user_id = ?"),
    istEkle: db.prepare("INSERT OR IGNORE INTO arena_istatistik (site_id, user_id) VALUES (?, ?)"),
    istYaz: db.prepare("UPDATE arena_istatistik SET mac = ?, galibiyet = ?, seri = ?, en_seri = ?, kusursuz = ? WHERE site_id = ? AND user_id = ?")
  };
  const gorunumOnbellek = new Map();

  function ver(siteId, userId, kodlar, kaynak = "") {
    const yeni = [];
    for (const kod of kodlar) if (KOD.has(kod) && !KOD.get(kod).baslangic && q.ekle.run(siteId, userId, kod, now(), String(kaynak)).changes) yeni.push(kod);
    if (yeni.length) gorunumOnbellek.delete(siteId + ":" + userId);
    return yeni;
  }
  function sahip(siteId, userId) {
    const s = new Set(KATALOG.filter(k => k.baslangic).map(k => k.kod));
    for (const r of q.var.all(siteId, userId)) s.add(r.kod);
    return s;
  }
  function istatistik(siteId, userId) { q.istEkle.run(siteId, userId); return q.ist.get(siteId, userId); }
  /* Mavi Öz: aynı kaynak (ör. "mac:12") bir kez sayılır */
  function ozVer(siteId, userId, kaynak, miktar) {
    if (!(miktar > 0)) return 0;
    istatistik(siteId, userId);
    if (!q.ozEkle.run(siteId, userId, String(kaynak), Math.round(miktar), now()).changes) return 0;
    q.ozArtir.run(Math.round(miktar), siteId, userId); gorunumOnbellek.delete(siteId + ":" + userId);
    return Math.round(miktar);
  }
  const ozKaynaktan = (siteId, userId, kaynak) => { const r = q.ozKaynak.get(siteId, userId, String(kaynak)); return r ? r.miktar : 0; };
  const ozToplam = (siteId, userId) => istatistik(siteId, userId).mavi_oz;

  /* Düello bittiğinde (canlı ya da turnuva): istatistik ve ödüller. o = { kazandi, dogru, ortSureMs, turnuva } */
  function macSonu(siteId, userId, macId, o) {
    const s = istatistik(siteId, userId);
    const mac = s.mac + 1, gal = s.galibiyet + (o.kazandi ? 1 : 0), seri = o.kazandi ? s.seri + 1 : 0, enSeri = Math.max(s.en_seri, seri), kus = s.kusursuz + (o.dogru === 5 ? 1 : 0);
    q.istYaz.run(mac, gal, seri, enSeri, kus, siteId, userId);
    const k = ["y-ilk"];
    if (gal >= 1) k.push("s-hilal"); if (gal >= 5) k.push("s-yildiz"); if (gal >= 10) k.push("s-cinar"); if (gal >= 25) k.push("s-gul", "u-usta");
    if (seri >= 3) k.push("s-kalkan"); if (seri >= 5) k.push("y-seri5", "u-rakipsiz");
    if (o.dogru === 5) k.push("y-kusursuz"); if (o.dogru === 5 && o.ortSureMs < 4000) k.push("s-simsek", "u-yildirim");
    if (mac >= 50) k.push("y-elli");
    if (o.turnuva && o.kazandi) k.push("y-turnuva");
    return ver(siteId, userId, k, "mac:" + macId);
  }
  function kartSayisi(siteId, userId, ogrenilen, toplam) {
    const k = []; if (ogrenilen >= 10) k.push("y-ogrenci", "u-merakli"); if (ogrenilen >= toplam) k.push("s-kandil", "y-alim", "u-bilge");
    return ver(siteId, userId, k, "kart");
  }
  function sezonPuani(siteId, userId, puan, kaynak = "puan") {
    const k = []; if (puan >= 100) k.push("c-bronz"); if (puan >= 400) k.push("c-gumus"); if (puan >= 1000) k.push("c-altin");
    return ver(siteId, userId, k, kaynak);
  }
  /* Şampiyon: taç, zümrüt çerçeve, unvan, turnuvanın koleksiyon simgesi (varsa sıradaki eksik olan) ve Mavi Öz */
  function sampiyon(siteId, userId, turId, odul) {
    const s = sahip(siteId, userId), i = Math.max(0, KOLEKSIYON.findIndex(k => k.kod === odul));
    let kol = null;
    for (let j = 0; j < KOLEKSIYON.length && !kol; j++) { const k = KOLEKSIYON[(i + j) % KOLEKSIYON.length].kod; if (!s.has(k)) kol = k; }
    ozVer(siteId, userId, "turnuva:" + turId, OZ.sampiyon);
    return ver(siteId, userId, ["s-tac", "c-zumrut", "u-sampiyon", ...(kol ? [kol] : [])], "turnuva:" + turId);
  }
  /* Sezon sonu: ilk 3, blok savaşı kazanan blok ve blokun lideri */
  function sezonSonu(siteId, sezonId, ilk3, kazananBlokUyeleri, blokLideri) {
    ilk3.forEach((u, i) => ver(siteId, u, i === 0 ? ["c-sezon", "y-podyum", "u-sezon"] : ["c-sezon", "y-podyum"], "sezon:" + sezonId));
    for (const u of kazananBlokUyeleri) ver(siteId, u, ["s-kule", "y-blok"], "sezon:" + sezonId);
    if (blokLideri) ver(siteId, blokLideri, ["u-blok"], "sezon:" + sezonId);
  }

  function secimAl(siteId, userId) {
    const r = q.secim.get(siteId, userId), s = sahip(siteId, userId);
    if (!r) return { ...BASLANGIC };
    let sem = []; try { sem = JSON.parse(r.semboller || "[]"); } catch (_) { sem = []; }
    // Sahip olunmayan (ör. veri taşıma sonrası) seçimler başlangıca döner
    return { simge: s.has(r.simge) ? r.simge : BASLANGIC.simge, cerceve: s.has(r.cerceve) ? r.cerceve : BASLANGIC.cerceve,
      semboller: sem.filter(x => s.has(x) && KOD.get(x).tur === "sembol").slice(0, 3), unvan: s.has(r.unvan) ? r.unvan : BASLANGIC.unvan, ozGoster: !!r.oz_goster };
  }
  function secimYaz(siteId, userId, b) {
    const s = sahip(siteId, userId), d = secimAl(siteId, userId);
    const al = (kod, tur, alan) => {
      if (kod === undefined) return d[alan];
      if (typeof kod !== "string" || !KOD.has(kod) || KOD.get(kod).tur !== tur) throw new Hata(400, "Geçersiz seçim.", alan);
      if (!s.has(kod)) throw new Hata(403, "Bu ödüle henüz sahip değilsiniz.", alan);
      return kod;
    };
    const simge = al(b.simge, "simge", "simge"), cerceve = al(b.cerceve, "cerceve", "cerceve"), unvan = al(b.unvan, "unvan", "unvan");
    let sem = d.semboller;
    if (b.semboller !== undefined) {
      if (!Array.isArray(b.semboller) || b.semboller.length > 3 || new Set(b.semboller).size !== b.semboller.length) throw new Hata(400, "En çok 3 farklı sembol seçebilirsiniz.", "semboller");
      sem = b.semboller.map(x => al(x, "sembol", "semboller"));
    }
    if (b.ozGoster !== undefined && typeof b.ozGoster !== "boolean") throw new Hata(400, "Geçersiz seçim.", "ozGoster");
    const oz = b.ozGoster === undefined ? d.ozGoster : b.ozGoster;
    q.secimYaz.run(siteId, userId, simge, cerceve, JSON.stringify(sem), unvan, oz ? 1 : 0, now());
    gorunumOnbellek.delete(siteId + ":" + userId);
    return secimAl(siteId, userId);
  }
  /* Başkalarına görünen kimlik (sıralama, eşleşme ekranı, profil kartı) */
  function gorunum(siteId, userId) {
    const k = siteId + ":" + userId, e = gorunumOnbellek.get(k);
    if (e && now() - e.t < 30000) return e.v;
    const sc = secimAl(siteId, userId), v = { simge: sc.simge, cerceve: sc.cerceve, semboller: sc.semboller, unvan: sc.unvan, unvanAd: KOD.get(sc.unvan).ad };
    if (sc.ozGoster) v.maviOz = ozToplam(siteId, userId); // yalnızca sahibi "profilimde göster" dediyse başkalarına görünür
    if (gorunumOnbellek.size > 20000) gorunumOnbellek.clear();
    gorunumOnbellek.set(k, { t: now(), v }); return v;
  }
  function kimlik(siteId, userId) {
    const v = q.var.all(siteId, userId), m = new Map(v.map(r => [r.kod, r.zaman])), ist = istatistik(siteId, userId);
    return { katalog: KATALOG.map(k => ({ kod: k.kod, tur: k.tur, ad: k.ad, kosul: k.kosul, nadirlik: k.nadirlik, nadirlikAd: NADIR[k.nadirlik], koleksiyon: k.koleksiyon || undefined, var: k.baslangic || m.has(k.kod), zaman: m.get(k.kod) || null })),
      secim: secimAl(siteId, userId), istatistik: { mac: ist.mac, galibiyet: ist.galibiyet, seri: ist.seri, enSeri: ist.en_seri, kusursuz: ist.kusursuz, maviOz: ist.mavi_oz },
      ozSon: q.ozSon.all(siteId, userId, 10).map(r => ({ kaynak: r.kaynak.split(":")[0], miktar: r.miktar, zaman: r.zaman })), ozKurali: OZ,
      sahip: (k => k.length)(KATALOG.filter(k => k.baslangic || m.has(k.kod))), toplam: KATALOG.length };
  }
  const kaynaktanYeni = (siteId, userId, kaynak) => q.kaynakla.all(siteId, userId, String(kaynak)).map(r => r.kod);

  return { ver, ozVer, ozKaynaktan, ozToplam, macSonu, kartSayisi, sezonPuani, sampiyon, sezonSonu, secimYaz, secimAl, gorunum, kimlik, kaynaktanYeni, istatistik };
}
module.exports = { createKazanim, KATALOG, KOD, NADIR, BASLANGIC, KOLEKSIYON, OZ };
