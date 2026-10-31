"use strict";
/* Günlük ve haftalık görevler. İlerleme kayıtlı maç ve kart verisinden hesaplanır (istemci ilerleme bildiremez).
   Tamamlanan görevin ödülü (Mavi Öz) "Ödülü al" ile bir kez alınır: oz_kayit'te "gorev:<kod>:<dönem>" kaynağı tekildir.
   Gün Türkiye saatiyle 00:00'da, hafta pazartesi 00:00'da yenilenir. */
const { Hata } = require("./validate");

const GOREVLER = [
  { kod: "g-duello", donem: "gun", ad: "2 düello tamamla", aciklama: "Rakiple eşleşip 2 düelloyu sonuna kadar oyna.", hedef: 2, oz: 20, olcu: "mac" },
  { kod: "g-galibiyet", donem: "gun", ad: "1 düello kazan", aciklama: "Bugün bir düello kazan.", hedef: 1, oz: 25, olcu: "galibiyet" },
  { kod: "g-kart", donem: "gun", ad: "1 bilgi kartı öğren", aciklama: "Bir kartı oku ve \"Kendini dene\" sorusunu doğru cevapla.", hedef: 1, oz: 10, olcu: "kart" },
  { kod: "h-duello", donem: "hafta", ad: "10 düello tamamla", aciklama: "Bu hafta 10 eşleşmeli düello oyna.", hedef: 10, oz: 100, olcu: "mac" },
  { kod: "h-galibiyet", donem: "hafta", ad: "5 düello kazan", aciklama: "Bu hafta 5 galibiyet al.", hedef: 5, oz: 120, olcu: "galibiyet" },
  { kod: "h-kart", donem: "hafta", ad: "5 bilgi kartı öğren", aciklama: "Bu hafta 5 yeni kart öğren.", hedef: 5, oz: 50, olcu: "kart" },
  { kod: "h-kusursuz", donem: "hafta", ad: "Bir düelloyu kusursuz bitir", aciklama: "5 sorunun hepsini doğru bil.", hedef: 1, oz: 80, olcu: "kusursuz" },
  { kod: "h-turnuva", donem: "hafta", ad: "Bir turnuva maçı oyna", aciklama: "Turnuvada bir maçı sonuna kadar oyna.", hedef: 1, oz: 60, olcu: "turnuva" }
];
const GOREV = new Map(GOREVLER.map(g => [g.kod, g]));

function createGorevler({ db, now, ortak, kazanim }) {
  const benimMac = "site_id = ? AND bitti = 1 AND b_user IS NOT NULL AND tur IN ('canli','turnuva') AND (a_user = ? OR b_user = ?) AND olusturma >= ?";
  const q = {
    mac: db.prepare(`SELECT COUNT(*) n FROM maclar WHERE ${benimMac}`),
    galibiyet: db.prepare(`SELECT COUNT(*) n FROM maclar WHERE ${benimMac} AND kazanan = ?`),
    turnuva: db.prepare(`SELECT COUNT(*) n FROM maclar WHERE ${benimMac} AND tur = 'turnuva'`),
    kusursuz: db.prepare(`SELECT COUNT(*) n FROM maclar m WHERE ${benimMac.replace(/(site_id|bitti|b_user|tur|a_user|olusturma)\b/g, "m.$1")}
      AND (SELECT COUNT(*) FROM mac_cevap c WHERE c.mac_id = m.id AND c.user_id = ? AND c.dogru = 1) >= 5`),
    kart: db.prepare("SELECT COUNT(*) n FROM kart_ogrenme WHERE site_id = ? AND user_id = ? AND zaman >= ?")
  };
  const GUN = 864e5;
  /* Dönem başlangıcı ve anahtarı (Türkiye saati) */
  function donem(tur, t = now()) {
    const g = ortak.gunBaslangic(t);
    if (tur === "gun") return { bas: g, bitis: g + GUN, anahtar: ortak.gunAnahtari(t) };
    const gunNo = new Date(ortak.gunAnahtari(t) + "T12:00:00Z").getUTCDay(); // 0 pazar
    const bas = g - ((gunNo + 6) % 7) * GUN;
    return { bas, bitis: bas + 7 * GUN, anahtar: "h" + ortak.gunAnahtari(bas + GUN / 2) };
  }
  function ilerleme(siteId, userId, g, bas) {
    if (g.olcu === "kart") return q.kart.get(siteId, userId, bas).n;
    if (g.olcu === "galibiyet") return q.galibiyet.get(siteId, userId, userId, bas, userId).n;
    if (g.olcu === "kusursuz") return q.kusursuz.get(siteId, userId, userId, bas, userId).n;
    return q[g.olcu].get(siteId, userId, userId, bas).n;
  }
  const kaynak = (g, d) => `gorev:${g.kod}:${d.anahtar}`;
  function liste(siteId, userId) {
    const d = { gun: donem("gun"), hafta: donem("hafta") };
    const gorevler = GOREVLER.map(g => {
      const p = d[g.donem], n = Math.min(g.hedef, ilerleme(siteId, userId, g, p.bas)), alindi = kazanim.ozKaynaktan(siteId, userId, kaynak(g, p)) > 0;
      return { kod: g.kod, donem: g.donem, ad: g.ad, aciklama: g.aciklama, hedef: g.hedef, ilerleme: n, oz: g.oz, tamam: n >= g.hedef, alindi };
    });
    return { gorevler, yenilenme: { gun: d.gun.bitis, hafta: d.hafta.bitis }, maviOz: kazanim.ozToplam(siteId, userId),
      alinabilir: gorevler.filter(g => g.tamam && !g.alindi).length, simdi: now() };
  }
  function al(siteId, userId, kod) {
    const g = GOREV.get(String(kod)); if (!g) throw new Hata(404, "Görev bulunamadı.");
    const p = donem(g.donem);
    if (ilerleme(siteId, userId, g, p.bas) < g.hedef) throw new Hata(409, "Görev henüz tamamlanmadı.", "gorev");
    const verilen = kazanim.ozVer(siteId, userId, kaynak(g, p), g.oz);
    if (!verilen) throw new Hata(409, "Bu görevin ödülü alındı.", "gorev");
    return { oz: verilen, maviOz: kazanim.ozToplam(siteId, userId) };
  }
  const alinabilir = (siteId, userId) => liste(siteId, userId).alinabilir;
  return { liste, al, alinabilir, donem };
}
module.exports = { createGorevler, GOREVLER };
