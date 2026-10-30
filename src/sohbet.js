"use strict";
/* Sohbet, şikâyet, engelleme ve susturma.
   - Odalar: "site" (tüm site) ve "blok:X" (yalnızca X blokunun sakinleri).
   - Mesajlar canlı akışla (SSE, tek açık bağlantı) gelir: yeni mesajlar 100 ms'lik pencerelerde toplanır, bir kez JSON'a çevrilir ve
     odadaki tüm bağlantılara aynı metin yazılır (1000+ eşzamanlı dinleyici için). Akış açılamazsa uzun yoklama yedektir;
     orada da aynı (oda, sonra) isteğinin yanıtı bir kez hesaplanıp paylaşılır.
   - Telefon numarası benzeri diziler gizlenir (KVKK). Engellenen kişilerin mesajlarını istemci gizler; gizlenen mesajlar sunucuda çıkarılır.
   - Şikâyet: mesaj, Gündem gönderisi, yorum ya da kişi. 3 farklı kişi şikâyet edince içerik kendiliğinden gizlenir; yönetim karar verir. */
const { Hata } = require("./validate");

const SEBEPLER = { taciz: "Taciz ya da hakaret", spam: "Spam ya da reklam", uygunsuz: "Uygunsuz içerik", kisisel: "Kişisel bilgi paylaşımı", diger: "Diğer" };
const OTO_GIZLE = 3, ODA_TUTMA = 1000, SAYFA = 60;
const TEL = /(?:\+?9\s?0[\s.-]?)?\(?0?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}|\b\d{11}\b/g;

function metinTemizle(m) {
  const t = String(m == null ? "" : m).replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮]/g, "").replace(/\s+/g, " ").trim();
  if (!t) throw new Hata(400, "Mesaj boş olamaz.");
  if (t.length > 300) throw new Hata(400, "Mesaj en çok 300 karakter olabilir.");
  return t.replace(TEL, "[numara gizlendi]");
}

function createSohbet({ db, now, hub, ortak, kimlik, bl }) {
  const q = {
    ekle: db.prepare("INSERT INTO sohbet (site_id, oda, user_id, kim, ad, blok, metin, zaman) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    son: db.prepare("SELECT id, kim, ad, blok, metin, zaman FROM sohbet WHERE site_id = ? AND oda = ? AND gizli = 0 ORDER BY id DESC LIMIT ?"),
    sonra: db.prepare("SELECT id, kim, ad, blok, metin, zaman FROM sohbet WHERE site_id = ? AND oda = ? AND id > ? AND gizli = 0 ORDER BY id LIMIT ?"),
    sonId: db.prepare("SELECT COALESCE(MAX(id), 0) id FROM sohbet WHERE site_id = ? AND oda = ?"),
    get: db.prepare("SELECT * FROM sohbet WHERE id = ? AND site_id = ?"),
    gizle: db.prepare("UPDATE sohbet SET gizli = 1 WHERE id = ? AND site_id = ?"),
    budama: db.prepare("DELETE FROM sohbet WHERE site_id = ? AND oda = ? AND id <= (SELECT id FROM sohbet WHERE site_id = ? AND oda = ? ORDER BY id DESC LIMIT 1 OFFSET ?)"),
    sikEkle: db.prepare("INSERT OR IGNORE INTO sikayetler (site_id, bildiren, hedef_tur, hedef_ref, hedef_user, sebep, aciklama, ozet, zaman) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
    sikSay: db.prepare("SELECT COUNT(DISTINCT bildiren) n FROM sikayetler WHERE site_id = ? AND hedef_tur = ? AND hedef_ref = ? AND durum = 'acik'"),
    sikListe: db.prepare(`SELECT hedef_tur, hedef_ref, MAX(hedef_user) hedef_user, COUNT(*) adet, GROUP_CONCAT(DISTINCT sebep) sebepler, MAX(ozet) ozet, MIN(zaman) ilk, MAX(zaman) son, MIN(id) id
      FROM sikayetler WHERE site_id = ? AND durum = ? GROUP BY hedef_tur, hedef_ref ORDER BY son DESC LIMIT 100`),
    sikAciklama: db.prepare("SELECT aciklama FROM sikayetler WHERE site_id = ? AND hedef_tur = ? AND hedef_ref = ? AND aciklama != '' ORDER BY id DESC LIMIT 5"),
    sikKapat: db.prepare("UPDATE sikayetler SET durum = 'kapandi', karar = ? WHERE site_id = ? AND hedef_tur = ? AND hedef_ref = ? AND durum = 'acik'"),
    sikGet: db.prepare("SELECT * FROM sikayetler WHERE id = ? AND site_id = ?"),
    engelEkle: db.prepare("INSERT OR IGNORE INTO engeller (site_id, user_id, engellenen) VALUES (?, ?, ?)"),
    engelSil: db.prepare("DELETE FROM engeller WHERE site_id = ? AND user_id = ? AND engellenen = ?"),
    engelListe: db.prepare("SELECT engellenen FROM engeller WHERE site_id = ? AND user_id = ?"),
    susturYaz: db.prepare("INSERT INTO susturmalar (site_id, user_id, bitis, neden) VALUES (?, ?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET bitis = excluded.bitis, neden = excluded.neden"),
    susturSil: db.prepare("DELETE FROM susturmalar WHERE site_id = ? AND user_id = ?")
  };
  const surum = new Map();          // oda sürümü: gizleme/silmede artar → istemci tam listeyi yeniden alır
  const onbellek = new Map();       // (site|oda|sonra) → hazır yanıt (yeni mesajda temizlenir)
  const sonGonderim = new Map();
  let eklemeSayaci = 0;
  const anahtar = (s, o) => s + "|" + o;

  function odaDogrula(siteId, userId, oda) {
    if (oda === "site") return "site";
    const m = /^blok:([A-Za-zÇĞİÖŞÜçğıöşü0-9]{1,10})$/.exec(String(oda || ""));
    if (!m) throw new Hata(404, "Sohbet odası bulunamadı.");
    const b = m[1].toLocaleUpperCase("tr");
    if (ortak.profil(siteId, userId).blok !== b) throw new Hata(403, "Yalnızca kendi blokunuzun sohbetine katılabilirsiniz. Profilinizde bloku seçin.");
    return "blok:" + b;
  }
  function odalar(siteId, userId) {
    const p = ortak.profil(siteId, userId), l = [{ id: "site", ad: "Site sohbeti" }];
    if (p.blok) l.push({ id: "blok:" + p.blok, ad: p.blok + " Blok" });
    return { odalar: l, ben: { kim: kimlik(siteId, userId), ad: p.ad, blok: p.blok }, susturma: ortak.susturuldu(siteId, userId), sebepler: SEBEPLER,
      engelli: q.engelListe.all(siteId, userId).map(r => kimlik(siteId, r.engellenen)) };
  }

  function yanit(siteId, oda, sonra) {
    const k = anahtar(siteId, oda) + "|" + sonra, e = onbellek.get(k);
    if (e) return e;
    const mesajlar = sonra === null ? q.son.all(siteId, oda, SAYFA).reverse() : q.sonra.all(siteId, oda, sonra, SAYFA);
    const sonId = mesajlar.length ? mesajlar[mesajlar.length - 1].id : (sonra === null ? q.sonId.get(siteId, oda).id : sonra);
    const v = { mesajlar, sonId, surum: surum.get(anahtar(siteId, oda)) || 0, tam: sonra === null };
    if (onbellek.size > 5000) onbellek.clear();
    onbellek.set(k, v); return v;
  }
  async function oku(siteId, userId, odaIstek, sonraIstek, surumIstek, bekle, req) {
    const oda = odaDogrula(siteId, userId, odaIstek); ortak.temas(siteId, userId);
    const ak = anahtar(siteId, oda), sv = surum.get(ak) || 0;
    let sonra = sonraIstek === null || sonraIstek === undefined || sonraIstek === "" || Number(surumIstek) !== sv ? null : Math.max(0, parseInt(sonraIstek, 10) || 0);
    let r = yanit(siteId, oda, sonra);
    if (sonra !== null && !r.mesajlar.length && bekle) {
      await hub.bekle("sohbet:" + ak, 20000, req);
      if ((surum.get(ak) || 0) !== sv) sonra = null;
      r = yanit(siteId, oda, sonra);
    }
    return { ...r, cevrimici: ortak.cevrimici(siteId) };
  }
  function gonder(siteId, userId, odaIstek, metin) {
    const oda = odaDogrula(siteId, userId, odaIstek), t = now();
    const s = ortak.susturuldu(siteId, userId); if (s) throw new Hata(403, `Sohbete yazmanız ${new Date(s).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihine kadar kapalı.`);
    const sk = siteId + ":" + userId, son = sonGonderim.get(sk) || 0;
    if (t - son < 1500) throw new Hata(429, "Biraz yavaş: 1,5 saniyede bir mesaj gönderilebilir.");
    const temiz = metinTemizle(metin), p = ortak.profil(siteId, userId);
    const r = q.ekle.run(siteId, oda, userId, kimlik(siteId, userId), p.ad, p.blok, temiz, t);
    sonGonderim.set(sk, t); if (sonGonderim.size > 50000) sonGonderim.clear();
    const ak = anahtar(siteId, oda);
    for (const k of onbellek.keys()) if (k.startsWith(ak + "|")) onbellek.delete(k);
    if (++eklemeSayaci % 200 === 0) q.budama.run(siteId, oda, siteId, oda, ODA_TUTMA);
    hub.bildirGec("sohbet:" + ak, 120);
    yayinla(siteId, oda, false);
    ortak.temas(siteId, userId);
    return { id: Number(r.lastInsertRowid), metin: temiz, zaman: t };
  }
  function mesajGizle(siteId, id) {
    const m = q.get.get(id, siteId); if (!m) return false;
    q.gizle.run(id, siteId);
    const ak = anahtar(siteId, m.oda); surum.set(ak, (surum.get(ak) || 0) + 1);
    for (const k of onbellek.keys()) if (k.startsWith(ak + "|")) onbellek.delete(k);
    hub.bildir("sohbet:" + ak); yayinla(siteId, m.oda, true); return true;
  }

  /* ---------- Canlı akış (SSE) ---------- */
  const yayin = new Map(); // oda anahtarı → { set: Set(abone), son, zamanlayici, tam }
  function akisAc(siteId, userId, odaIstek, req, res) {
    const oda = odaDogrula(siteId, userId, odaIstek), ak = anahtar(siteId, oda);
    ortak.temas(siteId, userId);
    let y = yayin.get(ak);
    if (!y) { y = { set: new Set(), son: q.sonId.get(siteId, oda).id, zamanlayici: null, tam: false }; yayin.set(ak, y); }
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    const ilk = yanit(siteId, oda, null);
    res.write(`data: ${JSON.stringify({ ...ilk, tam: true, cevrimici: ortak.cevrimici(siteId) })}

`);
    const abone = { res, siteId, userId };
    y.set.add(abone);
    const nabiz = setInterval(() => { ortak.temas(siteId, userId); res.write(": nabız\n\n"); }, 20000); nabiz.unref();
    const kapat = () => { clearInterval(nabiz); y.set.delete(abone); };
    req.once("close", kapat); res.once("close", kapat);
  }
  function yayinla(siteId, oda, tam) {
    const ak = anahtar(siteId, oda), y = yayin.get(ak);
    if (!y) return;
    if (tam) y.tam = true;
    if (y.zamanlayici) return;
    y.zamanlayici = setTimeout(() => {
      y.zamanlayici = null;
      if (!y.set.size) { y.son = q.sonId.get(siteId, oda).id; y.tam = false; return; }
      let veri = "";
      if (y.tam) {
        const r = yanit(siteId, oda, null); y.son = r.sonId; y.tam = false;
        veri = `data: ${JSON.stringify({ ...r, tam: true, cevrimici: ortak.cevrimici(siteId) })}

`;
      } else {
        for (let i = 0; i < 20; i++) {
          const r = yanit(siteId, oda, y.son); if (!r.mesajlar.length) break;
          y.son = r.sonId; veri += `data: ${JSON.stringify({ ...r, tam: false, cevrimici: ortak.cevrimici(siteId) })}

`;
          if (r.mesajlar.length < SAYFA) break;
        }
      }
      if (veri) for (const a of y.set) a.res.write(veri);
    }, 100);
    if (y.zamanlayici.unref) y.zamanlayici.unref();
  }
  const akisSayisi = () => [...yayin.values()].reduce((t, y) => t + y.set.size, 0);
  function mesajSil(siteId, userId, yonetim, id) {
    const m = q.get.get(Number(id), siteId); if (!m) throw new Hata(404, "Mesaj bulunamadı.");
    if (m.user_id !== userId && !yonetim) throw new Hata(403, "Yalnızca kendi mesajınızı silebilirsiniz.");
    mesajGizle(siteId, m.id); return { ok: true };
  }

  /* ---------- Şikâyet ---------- */
  function hedefCoz(siteId, tur, ref) {
    if (tur === "mesaj") {
      const m = q.get.get(Number(ref), siteId); if (!m) throw new Hata(404, "Mesaj bulunamadı.");
      return { user: m.user_id, ozet: m.metin.slice(0, 140), ref: String(m.id) };
    }
    const p = String(ref || "").split(":");
    if (tur === "kisi") { const u = ortak.kisiBul(siteId, p[0]); if (!u) throw new Hata(404, "Kişi bulunamadı."); return { user: u, ozet: ortak.profil(siteId, u).ad, ref: p[0] }; }
    if ((tur === "gonderi" || tur === "yorum") && p.length === 2 && /^u[0-9a-f]{20}$/.test(p[0]) && /^[A-Za-z0-9_-]{1,40}$/.test(p[1])) {
      const u = ortak.kisiBul(siteId, p[0]); if (!u) throw new Hata(404, "İçerik bulunamadı.");
      const belge = bl.sistemOku(siteId, (tur === "gonderi" ? "gonderiler/" : "yorumlar/") + p[0]);
      const ic = belge && (tur === "gonderi" ? belge.posts : belge.items);
      const x = ic && ic[p[1]]; if (!x) throw new Hata(404, "İçerik bulunamadı.");
      return { user: u, ozet: String(x.metin || (x.foto ? "[fotoğraf]" : "")).slice(0, 140), ref: p.join(":") };
    }
    throw new Hata(400, "Geçersiz şikâyet hedefi.");
  }
  function icerikGizle(siteId, tur, ref) {
    if (tur === "mesaj") return mesajGizle(siteId, Number(ref));
    if (tur === "gonderi" || tur === "yorum") {
      const [uid, id] = ref.split(":");
      return bl.sistemGuncelle(siteId, (tur === "gonderi" ? "gonderiler/" : "yorumlar/") + uid, tur === "gonderi" ? { posts: { [id]: { gizli: true } } } : { items: { [id]: { gizli: true } } });
    }
    return false;
  }
  function sikayet(siteId, userId, b) {
    const tur = String(b.tur || ""), sebep = String(b.sebep || "");
    if (!["mesaj", "gonderi", "yorum", "kisi"].includes(tur)) throw new Hata(400, "Geçersiz şikâyet türü.");
    if (!SEBEPLER[sebep]) throw new Hata(400, "Bir sebep seçin.", "sebep");
    const aciklama = String(b.aciklama || "").replace(/\s+/g, " ").trim().slice(0, 300);
    const h = hedefCoz(siteId, tur, b.ref);
    if (h.user === userId) throw new Hata(400, "Kendi içeriğinizi şikâyet edemezsiniz.");
    const yeni = q.sikEkle.run(siteId, userId, tur, h.ref, h.user, sebep, aciklama, h.ozet, now()).changes > 0;
    let gizlendi = false;
    if (tur !== "kisi" && q.sikSay.get(siteId, tur, h.ref).n >= OTO_GIZLE) gizlendi = icerikGizle(siteId, tur, h.ref);
    if (b.engelle) q.engelEkle.run(siteId, userId, h.user);
    return { ok: true, yeni, gizlendi, engellendi: !!b.engelle };
  }
  function sikayetler(siteId, durum) {
    const d = durum === "kapandi" ? "kapandi" : "acik";
    return { sikayetler: q.sikListe.all(siteId, d).map(r => ({ id: r.id, tur: r.hedef_tur, ref: r.hedef_ref, adet: r.adet, sebepler: String(r.sebepler || "").split(",").map(s => SEBEPLER[s] || s), ozet: r.ozet, ilk: r.ilk, son: r.son,
      kisi: r.hedef_user ? { kim: kimlik(siteId, r.hedef_user), ad: ortak.profil(siteId, r.hedef_user).ad, blok: ortak.profil(siteId, r.hedef_user).blok, susturma: ortak.susturuldu(siteId, r.hedef_user) } : null,
      aciklamalar: q.sikAciklama.all(siteId, r.hedef_tur, r.hedef_ref).map(x => x.aciklama) })), sebepler: SEBEPLER };
  }
  function sikayetKarar(siteId, id, karar, saat) {
    const s = q.sikGet.get(Number(id), siteId); if (!s) throw new Hata(404, "Şikâyet bulunamadı.");
    if (!["gizle", "yoksay", "sustur"].includes(karar)) throw new Hata(400, "Karar 'gizle', 'yoksay' ya da 'sustur' olmalı.");
    if (karar === "gizle") icerikGizle(siteId, s.hedef_tur, s.hedef_ref);
    if (karar === "sustur") { if (!s.hedef_user) throw new Hata(409, "Kişi artık sitede değil."); sustur(siteId, s.hedef_user, saat, "şikâyet #" + s.id); icerikGizle(siteId, s.hedef_tur, s.hedef_ref); }
    q.sikKapat.run(karar, siteId, s.hedef_tur, s.hedef_ref);
    return { ok: true };
  }
  function sustur(siteId, userId, saat, neden) {
    const h = Number(saat); if (!Number.isFinite(h) || h < 1 || h > 24 * 30) throw new Hata(400, "Süre 1 saat ile 30 gün arasında olmalı.");
    q.susturYaz.run(siteId, userId, now() + h * 3600e3, String(neden || "").slice(0, 100)); return { ok: true };
  }
  function susturKaldir(siteId, kim) { const u = ortak.kisiBul(siteId, kim); if (!u) throw new Hata(404, "Kişi bulunamadı."); q.susturSil.run(siteId, u); return { ok: true }; }

  /* ---------- Engel ---------- */
  function engelle(siteId, userId, b) {
    let u = null;
    if (b.mesaj) { const m = q.get.get(Number(b.mesaj), siteId); u = m && m.user_id; }
    else if (b.kim) u = ortak.kisiBul(siteId, String(b.kim));
    if (!u) throw new Hata(404, "Kişi bulunamadı.");
    if (u === userId) throw new Hata(400, "Kendinizi engelleyemezsiniz.");
    q.engelEkle.run(siteId, userId, u); return { ok: true, kim: kimlik(siteId, u) };
  }
  function engelKaldir(siteId, userId, kim) { const u = ortak.kisiBul(siteId, kim); if (u) q.engelSil.run(siteId, userId, u); return { ok: true }; }
  function engeller(siteId, userId) {
    return { engeller: q.engelListe.all(siteId, userId).map(r => ({ kim: kimlik(siteId, r.engellenen), ad: ortak.profil(siteId, r.engellenen).ad, blok: ortak.profil(siteId, r.engellenen).blok })) };
  }

  return { akisAc, akisSayisi, odalar, oku, gonder, mesajSil, sikayet, sikayetler, sikayetKarar, sustur, susturKaldir, engelle, engelKaldir, engeller, SEBEPLER, metinTemizle };
}
module.exports = { createSohbet, metinTemizle, SEBEPLER };
