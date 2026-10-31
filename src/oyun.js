"use strict";
/* Turnuvadaki masa oyunları (Satranç, Tavla): canlı, süreli, sunucu yetkili.
   Her oyuncunun bir saati vardır; sırası gelen oyuncunun saati işler. Süresi biten kaybeder. Hamleyi yalnızca sunucu doğrular
   (satranc.js / tavla.js); zarı da sunucu atar. Turnuvada beraberlik olmaz: satrançta berabere biten oyun renkler değişerek en çok
   2 kez yeniden oynanır, hâlâ berabereyse son oyunda saatinde daha çok süresi kalan kazanır. */
const crypto = require("node:crypto");
const { tx } = require("./db");
const { Hata } = require("./validate");
const SAT = require("./satranc");
const TAV = require("./tavla");

const OYUNLAR = { satranc: "Satranç", tavla: "Tavla" };
const VARSAYILAN = { satrancSureMs: 5 * 60000, satrancArtisMs: 3000, tavlaSureMs: 6 * 60000, tavlaArtisMs: 5000, oyunGeriSayimMs: 3000, enCokYenidenOyun: 2 };
const zarAt = () => crypto.randomInt(1, 7);

function createOyun({ db, now, hub, ortak, kazanim, ayar = {}, bitisCb }) {
  const C = { ...VARSAYILAN, ...ayar };
  const q = {
    ekle: db.prepare(`INSERT INTO oyun_maclar (id, site_id, oyun, a_user, b_user, turnuva_mac_id, durum, ver, sure_a, sure_b, son, tekrar, olusturma)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`),
    get: db.prepare("SELECT * FROM oyun_maclar WHERE id = ?"),
    guncelle: db.prepare("UPDATE oyun_maclar SET durum = ?, ver = ver + 1, sure_a = ?, sure_b = ?, son = ? WHERE id = ? AND bitti = 0"),
    bitir: db.prepare("UPDATE oyun_maclar SET bitti = 1, sonuc = ?, neden = ?, ver = ver + 1, sure_a = ?, sure_b = ?, son = ? WHERE id = ? AND bitti = 0"),
    turMac: db.prepare("UPDATE turnuva_mac SET mac_id = ? WHERE id = ? AND durum = 'oynuyor'")
  };
  const sureAyar = oyun => (oyun === "satranc" ? [C.satrancSureMs, C.satrancArtisMs] : [C.tavlaSureMs, C.tavlaArtisMs]);

  /* Saklanan durum: { o: motor durumu, h: hamle listesi (satranç, "e2e4") } */
  const oku = r => JSON.parse(r.durum);
  /* Sırası olan renk: 'b' (beyaz = a_user) ya da 's' (siyah = b_user) */
  const sira = (r, d) => d.o.tur;
  const kullanici = (r, renk) => (renk === "b" ? r.a_user : r.b_user);
  const renkOf = (r, userId) => (r.a_user === userId ? "b" : r.b_user === userId ? "s" : null);

  function baslat({ siteId, oyun, a, b, turMacId = null, tekrar = 0 }) {
    if (!OYUNLAR[oyun]) throw new Hata(400, "Geçersiz oyun.");
    // Beyaz (a) rastgele; yeniden oyunda çağıran renkleri değiştirerek verir
    const sure = sureAyar(oyun)[0], t = now(), id = "o" + crypto.randomBytes(9).toString("hex");
    const d = oyun === "satranc" ? { o: SAT.fenOku(), h: [] } : { o: TAV.yeni(zarAt, crypto.randomInt(2) ? "b" : "s"), h: [] };
    q.ekle.run(id, siteId, oyun, a, b, turMacId, JSON.stringify(d), sure, sure, t + C.oyunGeriSayimMs, tekrar, t);
    return id;
  }
  /* Saatleri o ana kadar günceller (yalnızca sırası olan işler; geri sayım bitmeden işlemez) */
  function saatler(r, t = now()) {
    const d = oku(r), renk = sira(r, d), gecen = Math.max(0, t - r.son);
    return { b: r.sure_a - (renk === "b" ? gecen : 0), s: r.sure_b - (renk === "s" ? gecen : 0), renk, d };
  }
  function zamanAsimi(r) {
    if (r.bitti) return r;
    const s = saatler(r);
    if ((s.renk === "b" ? s.b : s.s) > 0) return r;
    return sonlandir(r, s.renk === "b" ? "s" : "b", "süre doldu");
  }
  /* kazanan: 'b' | 's' | 'berabere' */
  function sonlandir(r, kazanan, neden) {
    let sonuc = r;
    tx(db, () => {
      const t = now(), s = saatler(r, t);
      if (kazanan === "berabere" && r.turnuva_mac_id) {
        // Turnuvada beraberlik olmaz
        const dahaCok = Math.max(0, s.b) === Math.max(0, s.s) ? null : (s.b > s.s ? "b" : "s");
        if (r.tekrar < C.enCokYenidenOyun) {
          q.bitir.run("berabere", neden, Math.max(0, s.b), Math.max(0, s.s), t, r.id);
          const yeni = baslat({ siteId: r.site_id, oyun: r.oyun, a: r.b_user, b: r.a_user, turMacId: r.turnuva_mac_id, tekrar: r.tekrar + 1 });
          q.turMac.run(yeni, r.turnuva_mac_id);
          hub.bildir("oyun:" + r.id); hub.bildir("oyun:" + yeni); hub.bildir("tur:" + turnuvaOf(r));
          sonuc = q.get.get(r.id); return;
        }
        kazanan = dahaCok || (r.a_user < r.b_user ? "b" : "s"); neden = neden + " · saatte fazla süresi kalan kazandı";
      }
      q.bitir.run(kazanan === "berabere" ? "berabere" : kazanan, neden, Math.max(0, s.b), Math.max(0, s.s), t, r.id);
      sonuc = q.get.get(r.id);
      hub.bildir("oyun:" + r.id);
      if (bitisCb) bitisCb(sonuc, kazanan === "berabere" ? null : kullanici(sonuc, kazanan), neden);
    });
    return sonuc;
  }
  const turnuvaOf = r => (db.prepare("SELECT turnuva_id FROM turnuva_mac WHERE id = ?").get(r.turnuva_mac_id) || {}).turnuva_id;

  function getir(siteId, userId, id) {
    const r = q.get.get(String(id)); if (!r || r.site_id !== siteId || !renkOf(r, userId)) throw new Hata(404, "Oyun bulunamadı.");
    return r;
  }
  /* Turnuva döngüsü için: süre aşımını denetle */
  function kontrol(id) { const r = q.get.get(String(id)); return r ? zamanAsimi(r) : null; }

  function gorunum(r0, userId) {
    const r = zamanAsimi(r0), t = now(), s = saatler(r, t), benRenk = renkOf(r, userId), prof = u => { const p = ortak.profil(r.site_id, u); return { ad: p.ad, blok: p.blok, kimlik: kazanim ? kazanim.gorunum(r.site_id, u) : null }; };
    const d = s.d;
    const durum = r.oyun === "satranc" ? SAT.gorunum(d.o) : TAV.gorunum(d.o);
    const benSira = !r.bitti && s.renk === benRenk; // geri sayımda da gönderilir; hamle sunucuda başlangıçtan önce reddedilir
    if (!benSira) durum.hedefler = {}; // yalnızca sırası gelene yasal hedefler gösterilir
    const sonuc = r.bitti ? (r.sonuc === "berabere" ? "berabere" : r.sonuc === benRenk ? "ben" : "rakip") : null;
    return { id: r.id, oyun: r.oyun, oyunAd: OYUNLAR[r.oyun], ver: r.ver, simdi: t, baslangic: r.son && !r.bitti && t < r.son ? r.son : null, ben: benRenk, sira: r.bitti ? null : s.renk,
      beyaz: prof(r.a_user), siyah: prof(r.b_user), sureler: { b: Math.max(0, r.bitti ? r.sure_a : s.b), s: Math.max(0, r.bitti ? r.sure_b : s.s) }, artisMs: sureAyar(r.oyun)[1],
      durum, hamleler: d.h.slice(-40), sonHamle: d.h.length ? d.h[d.h.length - 1] : null, bitti: !!r.bitti, sonuc, neden: r.neden || null, tekrar: r.tekrar, turnuvaMacId: r.turnuva_mac_id,
      yenidenOyun: !!r.bitti && r.sonuc === "berabere" && !!r.turnuva_mac_id };
  }
  function goster(siteId, userId, id) { return gorunum(getir(siteId, userId, id), userId); }
  async function bekle(siteId, userId, id, bilinen, req) {
    let g = goster(siteId, userId, id);
    if (bilinen !== undefined && Number(bilinen) === g.ver && !g.bitti) {
      const r = q.get.get(String(id)), s = saatler(r), kalan = Math.max(0, (s.renk === "b" ? s.b : s.s)) + 30;
      await hub.bekle("oyun:" + id, Math.min(8000, Math.max(100, kalan, g.baslangic ? g.baslangic - now() + 20 : 0)), req);
      g = goster(siteId, userId, id);
    }
    return g;
  }

  function hamle(siteId, userId, id, g) {
    let r = zamanAsimi(getir(siteId, userId, id));
    if (r.bitti) throw new Hata(409, "Oyun bitti.", "oyun");
    const renk = renkOf(r, userId), t = now(), s = saatler(r, t);
    if (t < r.son) throw new Hata(409, "Oyun birazdan başlıyor.", "oyun");
    if (s.renk !== renk) throw new Hata(409, "Sıra sizde değil.", "sira");
    const d = s.d; let sure = { b: Math.max(0, s.b), s: Math.max(0, s.s) }, bitis = null;
    const artis = sureAyar(r.oyun)[1];
    if (r.oyun === "satranc") {
      const m = SAT.hamleBul(d.o, g); if (!m) throw new Hata(400, "Bu hamle yapılamaz.", "hamle");
      const yeni = SAT.uygula(d.o, m); d.h.push(SAT.ad(m.k) + SAT.ad(m.h) + (m.t ? m.t.toLowerCase() : "")); d.o = yeni;
      sure[renk] += artis; // hamle bitince artış
      const st = SAT.durum(yeni); if (st.bitti) bitis = { kazanan: st.sonuc === "beyaz" ? "b" : st.sonuc === "siyah" ? "s" : "berabere", neden: st.neden };
    } else {
      const g2 = g && typeof g === "object" ? { k: g.k === "bar" ? "bar" : Number(g.k), h: g.h === "off" ? "off" : Number(g.h), z: g.z === undefined ? undefined : Number(g.z) } : null;
      const sonuc = TAV.hamle(d.o, g2, zarAt); if (sonuc.hata) throw new Hata(400, sonuc.hata, "hamle");
      const onceki = d.o.tur; d.o = sonuc.durum;
      if (sonuc.durum.tur !== onceki) sure[renk] += artis; // sıra değişince artış
      if (sonuc.bitti) bitis = { kazanan: sonuc.bitti, neden: "tüm pulları topladı" };
    }
    if (d.h.length > 500) d.h = d.h.slice(-300);
    let sonRow = r;
    tx(db, () => {
      q.guncelle.run(JSON.stringify(d), sure.b, sure.s, t, r.id);
      sonRow = q.get.get(r.id);
    });
    if (bitis) sonRow = sonlandir(sonRow, bitis.kazanan, bitis.neden);
    hub.bildir("oyun:" + r.id);
    return gorunum(sonRow, userId);
  }
  function teslim(siteId, userId, id) {
    const r = zamanAsimi(getir(siteId, userId, id));
    if (r.bitti) throw new Hata(409, "Oyun bitti.", "oyun");
    const renk = renkOf(r, userId);
    return gorunum(sonlandir(r, renk === "b" ? "s" : "b", "teslim oldu"), userId);
  }
  /* Berabere biten oyundan sonra turnuva maçının güncel oyunu (yeniden oyun) */
  function yeni(siteId, userId, id) {
    const r = getir(siteId, userId, id); if (!r.turnuva_mac_id) return { id: r.id };
    const tm = db.prepare("SELECT mac_id FROM turnuva_mac WHERE id = ?").get(r.turnuva_mac_id);
    return { id: tm && tm.mac_id ? tm.mac_id : r.id };
  }
  return { baslat, goster, bekle, hamle, teslim, kontrol, yeni, OYUNLAR, C };
}
module.exports = { createOyun, OYUNLAR };
