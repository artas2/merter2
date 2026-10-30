"use strict";
/* Arena: bilgi kartlarıyla yarışma. Hepsi sunucu tarafında yetkilidir (istemci yalnızca gösterir ve cevap yollar).
   - Sezon: site başına 28 günlük sezon; kişisel puan ve blok (A, B, C…) takım sıralaması.
   - Canlı düello: rastgele eşleşen iki sakin, 5 soru, soru başına 15 sn. Durum zamandan hesaplanır (her maç için zamanlayıcı yok).
   - Turnuva: tek elemeli, belirli saatlerde. İki oyuncunun da o saatte çevrim içi olması gerekir (hazırım + gelmeme kuralları).
   Ölçek notu: bellek içi eşleşme kuyruğu ve uzun yoklama tek süreç içindir (docs/PERFORMANS.md). */
const crypto = require("node:crypto");
const { tx } = require("./db");
const { Hata } = require("./validate");
const { KARTLAR, KART_ID } = require("./kartlar");

const VARSAYILAN = {
  soruSayisi: 5, soruMs: 15000, araMs: 3500, geriSayimMs: 4000,
  sezonMs: 28 * 864e5, gunTavan: 400, ayniRakipGunluk: 3, kartGunluk: 10, kartPuan: 2,
  hazirMs: 5 * 60000, beklemeMs: 3 * 60000, minTurAraligiMs: 10 * 60000, esleslemeZamanAsimiMs: 45000
};
const TURLAR = [[0, "Çırak"], [100, "Kalfa"], [400, "Usta"], [1000, "Efsane"]];
const unvan = p => TURLAR.filter(([e]) => p >= e).pop()[1];
const karistir = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function createArena({ db, now, hub, ortak, kimlik, ayar = {} }) {
  const C = { ...VARSAYILAN, ...ayar };
  const q = {
    sezonAktif: db.prepare("SELECT * FROM sezonlar WHERE site_id = ? AND baslangic <= ? AND bitis > ? ORDER BY id DESC LIMIT 1"),
    sezonSon: db.prepare("SELECT MAX(bitis) b, COUNT(*) n FROM sezonlar WHERE site_id = ?"),
    sezonEkle: db.prepare("INSERT INTO sezonlar (site_id, ad, baslangic, bitis) VALUES (?, ?, ?, ?)"),
    sezonlar: db.prepare("SELECT * FROM sezonlar WHERE site_id = ? ORDER BY id DESC LIMIT ?"),
    spEkle: db.prepare("INSERT OR IGNORE INTO sezon_puan (sezon_id, user_id, site_id, blok, ad) VALUES (?, ?, ?, ?, ?)"),
    spGet: db.prepare("SELECT * FROM sezon_puan WHERE sezon_id = ? AND user_id = ?"),
    spGuncelle: db.prepare("UPDATE sezon_puan SET puan = puan + ?, mac = mac + ?, galibiyet = galibiyet + ?, gun = ?, gun_puan = ?, blok = ?, ad = ? WHERE sezon_id = ? AND user_id = ?"),
    spTop: db.prepare("SELECT user_id, ad, blok, puan, mac, galibiyet FROM sezon_puan WHERE sezon_id = ? ORDER BY puan DESC, user_id ASC LIMIT ?"),
    spSira: db.prepare("SELECT COUNT(*) n FROM sezon_puan WHERE sezon_id = ? AND (puan > ? OR (puan = ? AND user_id < ?))"),
    spBlok: db.prepare("SELECT blok, puan FROM sezon_puan WHERE sezon_id = ? AND blok != '' ORDER BY puan DESC"),
    spToplam: db.prepare("SELECT COUNT(*) n FROM sezon_puan WHERE sezon_id = ?"),
    kartOgr: db.prepare("INSERT OR IGNORE INTO kart_ogrenme (site_id, user_id, kart_id, zaman) VALUES (?, ?, ?, ?)"),
    kartListe: db.prepare("SELECT kart_id, zaman FROM kart_ogrenme WHERE site_id = ? AND user_id = ?"),
    kartBugun: db.prepare("SELECT COUNT(*) n FROM kart_ogrenme WHERE site_id = ? AND user_id = ? AND zaman >= ?"),
    macEkle: db.prepare("INSERT INTO maclar (id, site_id, tur, turnuva_mac_id, a_user, b_user, t0, soru_ms, ara_ms, sorular, sezon_id, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    macGet: db.prepare("SELECT * FROM maclar WHERE id = ?"),
    macAktif: db.prepare("SELECT id FROM maclar WHERE site_id = ? AND bitti = 0 AND (a_user = ? OR b_user = ?) ORDER BY olusturma DESC LIMIT 1"),
    macBitir: db.prepare("UPDATE maclar SET bitti = 1, a_puan = ?, b_puan = ?, kazanan = ? WHERE id = ? AND bitti = 0"),
    macGecmis: db.prepare("SELECT id, tur, a_user, b_user, a_puan, b_puan, kazanan, olusturma FROM maclar WHERE site_id = ? AND bitti = 1 AND (a_user = ? OR b_user = ?) ORDER BY olusturma DESC LIMIT ?"),
    ayniRakip: db.prepare("SELECT COUNT(*) n FROM maclar WHERE site_id = ? AND tur = 'canli' AND bitti = 1 AND id != ? AND olusturma >= ? AND ((a_user = ? AND b_user = ?) OR (a_user = ? AND b_user = ?))"),
    cevapEkle: db.prepare("INSERT OR IGNORE INTO mac_cevap (mac_id, user_id, soru_no, secim, sure_ms, dogru, puan) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    cevaplar: db.prepare("SELECT user_id, soru_no, secim, sure_ms, dogru, puan FROM mac_cevap WHERE mac_id = ?"),
    turEkle: db.prepare("INSERT INTO turnuvalar (site_id, ad, baslangic, tur_araligi_ms, max_kisi, sezon_id, olusturan, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    turGet: db.prepare("SELECT * FROM turnuvalar WHERE id = ? AND site_id = ?"),
    turListe: db.prepare("SELECT * FROM turnuvalar WHERE site_id = ? AND (durum IN ('kayit','oynaniyor') OR baslangic > ?) ORDER BY baslangic DESC LIMIT 12"),
    turAktif: db.prepare("SELECT * FROM turnuvalar WHERE site_id = ? AND durum IN ('kayit','oynaniyor')"),
    turAktifSiteler: db.prepare("SELECT DISTINCT site_id FROM turnuvalar WHERE durum IN ('kayit','oynaniyor')"),
    turDurum: db.prepare("UPDATE turnuvalar SET durum = ? WHERE id = ?"),
    turBitir: db.prepare("UPDATE turnuvalar SET durum = 'bitti', sampiyon = ? WHERE id = ?"),
    katEkle: db.prepare("INSERT OR IGNORE INTO turnuva_katilim (turnuva_id, user_id, tohum, zaman) VALUES (?, ?, ?, ?)"),
    katSil: db.prepare("DELETE FROM turnuva_katilim WHERE turnuva_id = ? AND user_id = ?"),
    katListe: db.prepare("SELECT * FROM turnuva_katilim WHERE turnuva_id = ? ORDER BY tohum"),
    katSay: db.prepare("SELECT COUNT(*) n, COALESCE(MAX(tohum), 0) m FROM turnuva_katilim WHERE turnuva_id = ?"),
    tmEkle: db.prepare("INSERT INTO turnuva_mac (turnuva_id, tur, sira, a_user, b_user, slot) VALUES (?, ?, ?, ?, ?, ?)"),
    tmListe: db.prepare("SELECT * FROM turnuva_mac WHERE turnuva_id = ? ORDER BY tur, sira"),
    tmGet: db.prepare("SELECT * FROM turnuva_mac WHERE id = ?"),
    tmSonraki: db.prepare("SELECT * FROM turnuva_mac WHERE turnuva_id = ? AND tur = ? AND sira = ?"),
    tmYerles: db.prepare("UPDATE turnuva_mac SET a_user = ? WHERE id = ?"),
    tmYerlesB: db.prepare("UPDATE turnuva_mac SET b_user = ? WHERE id = ?"),
    tmHazir: db.prepare("UPDATE turnuva_mac SET a_hazir = ? , b_hazir = ? WHERE id = ?"),
    tmBasla: db.prepare("UPDATE turnuva_mac SET durum = 'oynuyor', mac_id = ? WHERE id = ? AND durum = 'bekle'"),
    tmBitti: db.prepare("UPDATE turnuva_mac SET durum = 'bitti', kazanan = ?, neden = ? WHERE id = ? AND durum != 'bitti'"),
    tmKatilimci: db.prepare("SELECT 1 FROM turnuva_katilim WHERE turnuva_id = ? AND user_id = ?")
  };

  /* ---------- Sezon ---------- */
  function sezonAl(siteId) {
    const t = now();
    let s = q.sezonAktif.get(siteId, t, t);
    if (s) return s;
    tx(db, () => {
      s = q.sezonAktif.get(siteId, t, t);
      if (s) return;
      const { n } = q.sezonSon.get(siteId);
      const r = q.sezonEkle.run(siteId, `Sezon ${n + 1}`, t, t + C.sezonMs);
      s = { id: Number(r.lastInsertRowid), site_id: siteId, ad: `Sezon ${n + 1}`, baslangic: t, bitis: t + C.sezonMs };
    });
    return s;
  }
  /* Puan ekler. tavan: günlük tavan uygulanır (turnuva ödülleri tavansızdır). Eklenen miktarı döndürür. */
  function puanEkle(siteId, sezonId, userId, puan, { tavan = true, mac = 0, galibiyet = 0 } = {}) {
    const p = ortak.profil(siteId, userId), gun = ortak.gunAnahtari(now());
    q.spEkle.run(sezonId, userId, siteId, p.blok, p.ad);
    const r = q.spGet.get(sezonId, userId), dun = r.gun === gun ? r.gun_puan : 0;
    const ver = tavan ? Math.max(0, Math.min(puan, C.gunTavan - dun)) : Math.max(0, puan);
    q.spGuncelle.run(ver, mac, galibiyet, gun, dun + (tavan ? ver : 0), p.blok, p.ad, sezonId, userId);
    return ver;
  }
  function siralama(siteId, userId) {
    const s = sezonAl(siteId), t = now();
    const top = q.spTop.all(s.id, 20).map((r, i) => ({ sira: i + 1, ad: r.ad, blok: r.blok, puan: r.puan, mac: r.mac, galibiyet: r.galibiyet, unvan: unvan(r.puan), ben: r.user_id === userId }));
    const b = q.spGet.get(s.id, userId);
    const ben = b ? { sira: q.spSira.get(s.id, b.puan, b.puan, userId).n + 1, puan: b.puan, mac: b.mac, galibiyet: b.galibiyet, unvan: unvan(b.puan), bugun: b.gun === ortak.gunAnahtari(t) ? b.gun_puan : 0 }
      : { sira: null, puan: 0, mac: 0, galibiyet: 0, unvan: unvan(0), bugun: 0 };
    // Blok savaşı: her blokun en iyi 10 sakininin puan toplamı (büyük bloklar avantajlı olmasın)
    const bl = new Map();
    for (const r of q.spBlok.all(s.id)) { const x = bl.get(r.blok) || { blok: r.blok, puan: 0, kisi: 0, katilan: 0 }; x.katilan++; if (x.kisi < 10) { x.puan += r.puan; x.kisi++; } bl.set(r.blok, x); }
    const bloklar = [...bl.values()].sort((a, c) => c.puan - a.puan);
    return { sezon: { id: s.id, ad: s.ad, baslangic: s.baslangic, bitis: s.bitis, kalanMs: Math.max(0, s.bitis - t) }, top, ben, bloklar, katilan: q.spToplam.get(s.id).n, tavan: C.gunTavan };
  }
  function gecmisSezonlar(siteId) {
    const t = now();
    return q.sezonlar.all(siteId, 6).filter(s => s.bitis <= t).map(s => ({ id: s.id, ad: s.ad, bitis: s.bitis, ilk3: q.spTop.all(s.id, 3).map((r, i) => ({ sira: i + 1, ad: r.ad, blok: r.blok, puan: r.puan })) }));
  }

  /* ---------- Bilgi kartları ---------- */
  function kartlar(siteId, userId) {
    const t = now(), g = ortak.gunAnahtari(t);
    const ogr = new Set(q.kartListe.all(siteId, userId).map(r => r.kart_id));
    const gunun = KARTLAR[parseInt(g.replace(/-/g, ""), 10) % KARTLAR.length].id;
    return { kartlar: KARTLAR.map(k => ({ id: k.id, k: k.k, baslik: k.baslik, bilgi: k.bilgi, soru: k.soru, sec: k.sec, d: k.d, ogrendi: ogr.has(k.id) })), gunun, ogrenilen: ogr.size, toplam: KARTLAR.length };
  }
  function kartOgrendi(siteId, userId, kartId) {
    if (!KART_ID.has(kartId)) throw new Hata(404, "Kart bulunamadı.");
    const s = sezonAl(siteId), t = now();
    return tx(db, () => {
      if (q.kartBugun.get(siteId, userId, ortak.gunBaslangic(t)).n >= C.kartGunluk) { q.kartOgr.run(siteId, userId, kartId, t); return { puan: 0, not: `Bugün ${C.kartGunluk} karttan puan kazandınız; okumaya devam edebilirsiniz.` }; }
      const r = q.kartOgr.run(siteId, userId, kartId, t);
      return { puan: r.changes ? puanEkle(siteId, s.id, userId, C.kartPuan) : 0 };
    });
  }

  /* ---------- Düello ---------- */
  function macOlustur({ siteId, tur, a, b = null, turnuvaMacId = null }) {
    const s = sezonAl(siteId);
    const sorular = karistir(KARTLAR).slice(0, C.soruSayisi).map(k => ({ id: k.id, perm: karistir([0, 1, 2, 3]) }));
    const id = crypto.randomBytes(9).toString("base64url");
    q.macEkle.run(id, siteId, tur, turnuvaMacId, a, b, now() + C.geriSayimMs, C.soruMs, C.araMs, JSON.stringify(sorular), s.id, now());
    return id;
  }
  const sureler = m => { const N = JSON.parse(m.sorular).length, d = m.soru_ms + m.ara_ms; return { N, d, bitis: m.t0 + N * d }; };
  function sinirlar(m, N) {
    const d = m.soru_ms + m.ara_ms, b = [];
    for (let i = 0; i < N; i++) { b.push(m.t0 + i * d, m.t0 + i * d + m.soru_ms); } b.push(m.t0 + N * d);
    return b;
  }
  function aktifMac(siteId, userId) {
    const r = q.macAktif.get(siteId, userId, userId); if (!r) return null;
    const m = q.macGet.get(r.id), { bitis } = sureler(m);
    if (now() >= bitis + 1000) { macBitir(m); return null; }
    return r.id;
  }
  function macBitir(m0) {
    let sonuc = null;
    tx(db, () => {
      const m = q.macGet.get(m0.id); if (!m || m.bitti) return;
      const cv = q.cevaplar.all(m.id), topla = u => cv.filter(c => c.user_id === u).reduce((s, c) => s + c.puan, 0);
      const sure = u => cv.filter(c => c.user_id === u && c.dogru).reduce((s, c) => s + c.sure_ms, 0);
      const a = m.a_user, b = m.b_user, ap = a ? topla(a) : 0, bp = b ? topla(b) : 0;
      let kazanan = null;
      if (b) {
        if (ap !== bp) kazanan = ap > bp ? a : b;
        else if (m.tur === "turnuva") kazanan = sure(a) !== sure(b) ? (sure(a) < sure(b) ? a : b) : a; // turnuvada beraberlik olmaz
      }
      q.macBitir.run(ap, bp, kazanan, m.id);
      // Puanlar
      const tekrar = m.tur === "canli" && b ? q.ayniRakip.get(m.site_id, m.id, ortak.gunBaslangic(m.olusturma), a, b, b, a).n : 0;
      const sayilir = tekrar < C.ayniRakipGunluk;
      const ver = (u, p) => {
        if (!u || !m.sezon_id) return 0;
        if (m.tur === "antrenman") return puanEkle(m.site_id, m.sezon_id, u, Math.round(p / 10 * 0.3), { mac: 1 });
        if (!sayilir) return puanEkle(m.site_id, m.sezon_id, u, 0, { mac: 1 });
        const bonus = kazanan === u ? 25 : (kazanan === null && b ? 10 : 0);
        return puanEkle(m.site_id, m.sezon_id, u, Math.round(p / 10) + bonus, { mac: 1, galibiyet: kazanan === u ? 1 : 0 });
      };
      sonuc = { kazanan, a, b, ap, bp, kazanilan: { [a]: ver(a, ap), ...(b ? { [b]: ver(b, bp) } : {}) }, sayildi: sayilir };
      if (m.tur === "turnuva" && m.turnuva_mac_id) turnuvaMacBitti(m.turnuva_mac_id, kazanan, "oynandı");
    });
    hub.bildir("mac:" + m0.id);
    return sonuc;
  }

  const gorunumSoru = (k, perm) => ({ metin: k.soru, secenekler: perm.map(j => k.sec[j]) });
  function macGoster(siteId, userId, macId) {
    let m = q.macGet.get(macId);
    if (!m || m.site_id !== siteId || (m.a_user !== userId && m.b_user !== userId)) throw new Hata(404, "Maç bulunamadı.");
    const t = now(), sorular = JSON.parse(m.sorular), N = sorular.length, d = m.soru_ms + m.ara_ms, bitis = m.t0 + N * d;
    if (!m.bitti && t >= bitis + 500) { macBitir(m); m = q.macGet.get(macId); }
    const cv = q.cevaplar.all(macId), rakipId = m.a_user === userId ? m.b_user : m.a_user;
    const benim = cv.filter(c => c.user_id === userId), rakip = cv.filter(c => c.user_id === rakipId);
    const faz = sinirlar(m, N).filter(b => b <= t).length, ver = faz * 100 + cv.length;
    const gelecek = sinirlar(m, N).find(b => b > t) || null;
    let i = t < m.t0 ? -1 : Math.floor((t - m.t0) / d); const pencerede = i >= 0 && i < N && (t - m.t0) % d < m.soru_ms;
    const gecmis = [];
    let benimToplam = 0, rakipToplam = 0;
    for (let n = 0; n < N; n++) {
      const kapandi = t >= m.t0 + n * d + m.soru_ms; if (!kapandi) break;
      const k = KART_ID.get(sorular[n].id), perm = sorular[n].perm, bc = benim.find(c => c.soru_no === n), rc = rakip.find(c => c.soru_no === n);
      benimToplam += bc ? bc.puan : 0; rakipToplam += rc ? rc.puan : 0;
      gecmis.push({ no: n, ...gorunumSoru(k, perm), dogru: perm.indexOf(k.d), aciklama: k.bilgi, ben: bc ? { secim: bc.secim, puan: bc.puan } : null, rakip: rc ? { secim: rc.secim, puan: rc.puan } : null });
    }
    let soru = null;
    if (pencerede) {
      const k = KART_ID.get(sorular[i].id), bc = benim.find(c => c.soru_no === i), ws = m.t0 + i * d;
      soru = { no: i, ...gorunumSoru(k, sorular[i].perm), baslangic: ws, bitis: ws + m.soru_ms, cevapladim: bc ? { secim: bc.secim } : null, rakipCevapladi: rakip.some(c => c.soru_no === i) };
    }
    const rk = rakipId ? ortak.profil(siteId, rakipId) : null;
    const kazandi = m.bitti ? (m.kazanan === userId ? "ben" : m.kazanan === null ? "berabere" : "rakip") : null;
    return { id: m.id, tur: m.tur, simdi: t, t0: m.t0, soruMs: m.soru_ms, araMs: m.ara_ms, soruSayisi: N, bitis, bitti: !!m.bitti, durum: t < m.t0 ? "geriSayim" : pencerede ? "soru" : t < bitis ? "ara" : "bitti",
      siradaki: gelecek, ver, soru, gecmis, ben: { ad: ortak.profil(siteId, userId).ad, puan: m.bitti ? (m.a_user === userId ? m.a_puan : m.b_puan) : benimToplam },
      rakip: rk ? { ad: rk.ad, blok: rk.blok, puan: m.bitti ? (m.a_user === userId ? m.b_puan : m.a_puan) : rakipToplam } : null, sonuc: kazandi, turnuvaMacId: m.turnuva_mac_id };
  }
  function macCevap(siteId, userId, macId, soruNo, secim) {
    const m = q.macGet.get(macId);
    if (!m || m.site_id !== siteId || (m.a_user !== userId && m.b_user !== userId)) throw new Hata(404, "Maç bulunamadı.");
    const sorular = JSON.parse(m.sorular), N = sorular.length, d = m.soru_ms + m.ara_ms, t = now();
    if (!Number.isInteger(soruNo) || soruNo < 0 || soruNo >= N) throw new Hata(400, "Geçersiz soru.");
    if (!Number.isInteger(secim) || secim < 0 || secim > 3) throw new Hata(400, "Geçersiz seçenek.");
    const ws = m.t0 + soruNo * d, gecen = t - ws;
    if (gecen < 0 || gecen > m.soru_ms + 400) throw new Hata(409, gecen < 0 ? "Soru henüz başlamadı." : "Süre doldu.");
    const k = KART_ID.get(sorular[soruNo].id), dogru = sorular[soruNo].perm[secim] === k.d ? 1 : 0;
    const sure = Math.min(m.soru_ms, Math.max(0, gecen)), puan = dogru ? 100 + Math.round(50 * Math.max(0, 1 - sure / m.soru_ms)) : 0;
    if (!q.cevapEkle.run(macId, userId, soruNo, secim, sure, dogru, puan).changes) throw new Hata(409, "Bu soruyu zaten cevapladınız.");
    hub.bildirGec("mac:" + macId, 50);
    return { ok: true };
  }
  /* Uzun yoklama: istemcinin bildiği sürüm değişince (cevap geldi ya da faz değişti) ya da en geç ~5 sn sonra döner */
  async function macBekle(siteId, userId, macId, bilinen, req) {
    let g = macGoster(siteId, userId, macId);
    if (bilinen !== undefined && Number(bilinen) === g.ver && !g.bitti) {
      const bekle = Math.min(5000, g.siradaki ? Math.max(50, g.siradaki - now() + 20) : 5000);
      await hub.bekle("mac:" + macId, bekle, req);
      g = macGoster(siteId, userId, macId);
    }
    return g;
  }

  /* ---------- Eşleşme ---------- */
  const kuyruk = new Map(), bulunan = new Map(), sonRakip = new Map();
  const bk = (s, u) => s + ":" + u;
  function esles(siteId, userId) {
    ortak.temas(siteId, userId);
    const aktif = aktifMac(siteId, userId); if (aktif) return { durum: "mac", macId: aktif };
    let k = kuyruk.get(siteId); if (!k) { k = new Map(); kuyruk.set(siteId, k); }
    if (k.has(userId)) { k.get(userId).ts = now(); return { durum: "bekliyor", bekleyen: k.size }; }
    let aday = null;
    for (const [uid, v] of k) {
      if (uid === userId || ortak.engelVar(siteId, userId, uid)) continue;
      const tekrar = sonRakip.get(bk(siteId, userId)) === uid && now() - v.ts < 10000;
      if (!tekrar) { aday = uid; break; }
    }
    if (!aday) { k.set(userId, { ts: now() }); return { durum: "bekliyor", bekleyen: k.size }; }
    k.delete(aday);
    const macId = macOlustur({ siteId, tur: "canli", a: aday, b: userId });
    sonRakip.set(bk(siteId, userId), aday); sonRakip.set(bk(siteId, aday), userId);
    bulunan.set(bk(siteId, aday), { macId, ts: now() });
    hub.bildir("esles:" + bk(siteId, aday));
    return { durum: "mac", macId };
  }
  async function eslesBekle(siteId, userId, req) {
    ortak.temas(siteId, userId);
    const bul = () => { const b = bulunan.get(bk(siteId, userId)); if (b) { bulunan.delete(bk(siteId, userId)); return { durum: "mac", macId: b.macId }; } return null; };
    let r = bul(); if (r) return r;
    const k = kuyruk.get(siteId); if (!k || !k.has(userId)) { const a = aktifMac(siteId, userId); return a ? { durum: "mac", macId: a } : { durum: "yok" }; }
    k.get(userId).ts = now();
    await hub.bekle("esles:" + bk(siteId, userId), 20000, req);
    r = bul(); if (r) return r;
    const k2 = kuyruk.get(siteId); if (k2 && k2.has(userId)) { k2.get(userId).ts = now(); return { durum: "bekliyor", bekleyen: k2.size }; }
    return { durum: "yok" };
  }
  function eslesIptal(siteId, userId) { const k = kuyruk.get(siteId); if (k) k.delete(userId); bulunan.delete(bk(siteId, userId)); return { ok: true }; }
  function antrenman(siteId, userId) {
    const a = aktifMac(siteId, userId); if (a) return { macId: a };
    eslesIptal(siteId, userId);
    return { macId: macOlustur({ siteId, tur: "antrenman", a: userId }) };
  }

  /* ---------- Turnuva ---------- */
  function turnuvaOlustur(siteId, userId, b) {
    const t = now(), bas = Number(b.baslangic), aralik = Number(b.turAraligiDk) * 60000, max = Number(b.maxKisi);
    const ad = String(b.ad || "").trim().slice(0, 60);
    if (!ad) throw new Hata(400, "Turnuva adı gerekli.", "ad");
    if (!Number.isFinite(bas) || bas < t + C.hazirMs + 60000) throw new Hata(400, "Başlangıç en az 6 dakika sonrası olmalı.", "baslangic");
    if (bas > t + 90 * 864e5) throw new Hata(400, "Başlangıç en fazla 90 gün sonrası olabilir.", "baslangic");
    if (!Number.isFinite(aralik) || aralik < C.minTurAraligiMs || aralik > 7 * 864e5) throw new Hata(400, "Tur aralığı 10 dakika ile 7 gün arasında olmalı.", "turAraligiDk");
    if (!Number.isInteger(max) || max < 2 || max > 64) throw new Hata(400, "Katılımcı sayısı 2 ile 64 arasında olmalı.", "maxKisi");
    const s = sezonAl(siteId);
    const r = q.turEkle.run(siteId, ad, bas, aralik, max, s.id, userId, t);
    return { id: Number(r.lastInsertRowid) };
  }
  function turnuvaKatil(siteId, userId, id) {
    return tx(db, () => {
      const tr = q.turGet.get(id, siteId); if (!tr) throw new Hata(404, "Turnuva bulunamadı.");
      if (tr.durum !== "kayit" || now() >= tr.baslangic - C.hazirMs) throw new Hata(409, "Kayıt kapandı.");
      const { n, m } = q.katSay.get(id);
      if (q.tmKatilimci.get(id, userId)) return { ok: true, katilimci: n };
      if (n >= tr.max_kisi) throw new Hata(409, "Turnuva dolu.");
      q.katEkle.run(id, userId, m + 1, now()); return { ok: true, katilimci: q.katSay.get(id).n };
    });
  }
  function turnuvaAyril(siteId, userId, id) {
    const tr = q.turGet.get(id, siteId); if (!tr) throw new Hata(404, "Turnuva bulunamadı.");
    if (tr.durum !== "kayit" || now() >= tr.baslangic - C.hazirMs) throw new Hata(409, "Kayıt kapandı; ayrılamazsınız.");
    q.katSil.run(id, userId); return { ok: true };
  }
  function turnuvaIptal(siteId, id) {
    const tr = q.turGet.get(id, siteId); if (!tr) throw new Hata(404, "Turnuva bulunamadı.");
    if (tr.durum === "bitti" || tr.durum === "iptal") throw new Hata(409, "Turnuva zaten bitti.");
    q.turDurum.run("iptal", id); hub.bildir("tur:" + id); return { ok: true };
  }
  function turnuvaKur(tr) {
    tx(db, () => {
      if (q.turGet.get(tr.id, tr.site_id).durum !== "kayit") return;
      const kat = q.katListe.all(tr.id);
      if (kat.length < 2) { q.turDurum.run("iptal", tr.id); return; }
      let size = 2; while (size < kat.length) size *= 2;
      const turSayisi = Math.round(Math.log2(size)), yer = new Array(size).fill(null), sira = [];
      for (let i = 0; i < size; i += 2) sira.push(i); for (let i = 1; i < size; i += 2) sira.push(i);
      karistir(kat.map(k => k.user_id)).forEach((u, i) => { yer[sira[i]] = u; });
      for (let r = 0; r < turSayisi; r++) for (let s = 0; s < size / 2 ** (r + 1); s++)
        q.tmEkle.run(tr.id, r, s, r === 0 ? yer[2 * s] : null, r === 0 ? yer[2 * s + 1] : null, tr.baslangic + r * tr.tur_araligi_ms);
      q.turDurum.run("oynaniyor", tr.id);
      for (const m of q.tmListe.all(tr.id).filter(x => x.tur === 0 && (x.a_user === null) !== (x.b_user === null))) turnuvaIlerlet(m, m.a_user || m.b_user, "bay geçti");
    });
    hub.bildir("tur:" + tr.id);
  }
  /* Kazananı bir üst tura yerleştirir; final ise turnuvayı bitirir. */
  function turnuvaIlerlet(m, kazanan, neden) {
    if (!q.tmBitti.run(kazanan, neden, m.id).changes) return;
    const tr = db.prepare("SELECT * FROM turnuvalar WHERE id = ?").get(m.turnuva_id);
    const sonraki = q.tmSonraki.get(m.turnuva_id, m.tur + 1, m.sira >> 1);
    if (sonraki) { (m.sira % 2 === 0 ? q.tmYerles : q.tmYerlesB).run(kazanan, sonraki.id); return; }
    // Final: ödüller (günlük tavandan bağımsız)
    q.turBitir.run(kazanan, tr.id);
    const finalist = m.a_user === kazanan ? m.b_user : m.a_user;
    const yarilar = q.tmListe.all(tr.id).filter(x => x.tur === m.tur - 1).flatMap(x => [x.a_user, x.b_user].filter(u => u && u !== x.kazanan));
    if (tr.sezon_id) {
      puanEkle(tr.site_id, tr.sezon_id, kazanan, 150, { tavan: false });
      if (finalist) puanEkle(tr.site_id, tr.sezon_id, finalist, 80, { tavan: false });
      for (const u of yarilar) puanEkle(tr.site_id, tr.sezon_id, u, 40, { tavan: false });
    }
  }
  function turnuvaMacBitti(turMacId, kazanan, neden) {
    const m = q.tmGet.get(turMacId); if (!m || m.durum === "bitti") return;
    turnuvaIlerlet(m, kazanan || m.a_user, neden);
    hub.bildir("tur:" + m.turnuva_id);
  }
  function turnuvaTick(siteId) {
    const t = now();
    for (const tr of q.turAktif.all(siteId)) {
      if (tr.durum === "kayit" && t >= tr.baslangic - C.hazirMs) turnuvaKur(tr);
      for (let tur = 0; tur < 8; tur++) {
        let degisti = false;
        const guncel = q.turGet.get(tr.id, siteId); if (!guncel || guncel.durum !== "oynaniyor") break;
        const sira = Object.fromEntries(q.katListe.all(tr.id).map(k => [k.user_id, k.tohum]));
        for (const m of q.tmListe.all(tr.id)) {
          if (m.durum === "bitti" || !m.a_user || !m.b_user) continue;
          if (m.durum === "oynuyor") {
            const mc = q.macGet.get(m.mac_id); if (mc && !mc.bitti && t >= sureler(mc).bitis + 1000) { macBitir(mc); degisti = true; }
            continue;
          }
          if (m.a_hazir && m.b_hazir && t >= m.slot) {
            tx(db, () => { const id = macOlustur({ siteId, tur: "turnuva", a: m.a_user, b: m.b_user, turnuvaMacId: m.id }); q.tmBasla.run(id, m.id); }); hub.bildir("tur:" + tr.id); degisti = true;
          } else if (t >= m.slot + C.beklemeMs) {
            const kazanan = m.a_hazir && !m.b_hazir ? m.a_user : m.b_hazir && !m.a_hazir ? m.b_user : ((sira[m.a_user] || 1e9) <= (sira[m.b_user] || 1e9) ? m.a_user : m.b_user);
            turnuvaIlerlet(m, kazanan, m.a_hazir !== m.b_hazir ? "rakip gelmedi" : "ikisi de gelmedi"); hub.bildir("tur:" + tr.id); degisti = true;
          }
        }
        if (!degisti) break;
      }
    }
  }
  function turnuvaHazir(siteId, userId, id, turMacId) {
    const tr = q.turGet.get(id, siteId); if (!tr) throw new Hata(404, "Turnuva bulunamadı.");
    turnuvaTick(siteId);
    const m = q.tmGet.get(turMacId); if (!m || m.turnuva_id !== id) throw new Hata(404, "Maç bulunamadı.");
    if (m.a_user !== userId && m.b_user !== userId) throw new Hata(403, "Bu maçta oynamıyorsunuz.");
    const t = now(); if (m.durum !== "bekle") throw new Hata(409, "Maç başladı ya da bitti.");
    if (t < m.slot - C.hazirMs) throw new Hata(409, "Hazır olma penceresi henüz açılmadı.");
    if (t > m.slot + C.beklemeMs) throw new Hata(409, "Hazır olma süresi doldu.");
    q.tmHazir.run(m.a_user === userId ? 1 : m.a_hazir, m.b_user === userId ? 1 : m.b_hazir, m.id);
    turnuvaTick(siteId); hub.bildir("tur:" + id);
    return { ok: true };
  }
  function turnuvaListe(siteId, userId) {
    turnuvaTick(siteId);
    return { turnuvalar: q.turListe.all(siteId, now() - 7 * 864e5).map(tr => ({ id: tr.id, ad: tr.ad, baslangic: tr.baslangic, durum: tr.durum, turAraligiMs: tr.tur_araligi_ms, maxKisi: tr.max_kisi, katilimci: q.katSay.get(tr.id).n, katildim: !!q.tmKatilimci.get(tr.id, userId),
      sampiyon: tr.sampiyon ? ortak.profil(siteId, tr.sampiyon).ad : null })), simdi: now(), hazirMs: C.hazirMs, beklemeMs: C.beklemeMs };
  }
  function turnuvaDetay(siteId, userId, id) {
    turnuvaTick(siteId);
    const tr = q.turGet.get(id, siteId); if (!tr) throw new Hata(404, "Turnuva bulunamadı.");
    const ad = u => u ? { ad: ortak.profil(siteId, u).ad, blok: ortak.profil(siteId, u).blok, ben: u === userId } : null;
    const maclar = q.tmListe.all(id).map(m => ({ id: m.id, tur: m.tur, sira: m.sira, slot: m.slot, a: ad(m.a_user), b: ad(m.b_user), aHazir: !!m.a_hazir, bHazir: !!m.b_hazir, durum: m.durum, kazanan: m.kazanan ? (m.kazanan === m.a_user ? "a" : "b") : null, neden: m.neden,
      macId: m.durum === "oynuyor" && (m.a_user === userId || m.b_user === userId) ? m.mac_id : null, benim: m.a_user === userId || m.b_user === userId }));
    return { turnuva: { id: tr.id, ad: tr.ad, baslangic: tr.baslangic, durum: tr.durum, turAraligiMs: tr.tur_araligi_ms, maxKisi: tr.max_kisi, sampiyon: tr.sampiyon ? ad(tr.sampiyon) : null }, katilimci: q.katSay.get(id).n, katildim: !!q.tmKatilimci.get(id, userId),
      maclar, simdi: now(), hazirMs: C.hazirMs, beklemeMs: C.beklemeMs, tohum: q.katListe.all(id).length };
  }
  async function turnuvaBekle(siteId, userId, id, req) {
    await hub.bekle("tur:" + id, 8000, req);
    return turnuvaDetay(siteId, userId, id);
  }

  /* ---------- Özet ---------- */
  function ozet(siteId, userId) {
    ortak.temas(siteId, userId);
    const s = siralama(siteId, userId), t = now(), g = ortak.gunAnahtari(t);
    return { sezon: s.sezon, ben: s.ben, bloklar: s.bloklar, cevrimici: ortak.cevrimici(siteId), aktifMac: aktifMac(siteId, userId), tavan: C.gunTavan,
      gunKart: KARTLAR[parseInt(g.replace(/-/g, ""), 10) % KARTLAR.length].id, gecmis: q.macGecmis.all(siteId, userId, userId, 5).map(m => ({ tur: m.tur, sonuc: m.tur === "antrenman" ? "antrenman" : m.kazanan === userId ? "kazandi" : m.kazanan === null ? "berabere" : "kaybetti", puan: m.a_user === userId ? m.a_puan : m.b_puan, zaman: m.olusturma })), simdi: t };
  }

  /* Her 10 sn: eski kuyruk girdilerini temizler, turnuvaları ilerletir */
  function tick() {
    const t = now();
    for (const [s, k] of kuyruk) { for (const [u, v] of k) if (t - v.ts > C.esleslemeZamanAsimiMs) k.delete(u); if (!k.size) kuyruk.delete(s); }
    for (const [k, v] of bulunan) if (t - v.ts > 60000) bulunan.delete(k);
    for (const r of q.turAktifSiteler.all()) { try { turnuvaTick(r.site_id); } catch (e) { /* bir sitedeki hata diğerlerini durdurmasın */ } }
    ortak.temizle();
  }

  return { C, sezonAl, siralama, gecmisSezonlar, kartlar, kartOgrendi, esles, eslesBekle, eslesIptal, antrenman, aktifMac, macGoster, macBekle, macCevap, macBitir,
    turnuvaOlustur, turnuvaKatil, turnuvaAyril, turnuvaIptal, turnuvaListe, turnuvaDetay, turnuvaBekle, turnuvaHazir, turnuvaTick, ozet, tick, unvan,
    kuyrukBoyutu: () => [...kuyruk.values()].reduce((s, k) => s + k.size, 0) };
}
module.exports = { createArena, VARSAYILAN, unvan };
