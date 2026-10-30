"use strict";
/* Arena, sohbet ve şikâyet modüllerinin ortak yardımcıları: görünen ad, çevrim içi sayacı, engel, susturma, kimlikten kişi bulma. */
const UTC_ARTI = 3 * 3600e3; // site saati (UTC+3)

function createOrtak({ db, now, kimlik }) {
  const q = {
    profil: db.prepare("SELECT veri FROM belgeler WHERE site_id = ? AND koleksiyon = 'sakinler' AND belge_id = ?"),
    uyeler: db.prepare("SELECT user_id FROM uyelikler WHERE site_id = ?"),
    engel: db.prepare("SELECT 1 FROM engeller WHERE site_id = ? AND ((user_id = ? AND engellenen = ?) OR (user_id = ? AND engellenen = ?))"),
    sustur: db.prepare("SELECT bitis FROM susturmalar WHERE site_id = ? AND user_id = ?")
  };

  const kisaAd = ad => {
    const p = String(ad || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "Komşu";
    return p.length === 1 ? p[0].slice(0, 20) : `${p[0].slice(0, 20)} ${p[p.length - 1].charAt(0).toLocaleUpperCase("tr")}.`;
  };
  /* Görünen ad ve blok: Merter sakin kaydından (ad, blok). Başkasına yalnızca ad kısaltması ve blok gösterilir; kat ve daire asla. */
  const onbellek = new Map();
  function profil(siteId, userId) {
    const k = siteId + ":" + userId, e = onbellek.get(k), t = now();
    if (e && t - e.t < 60000) return e.v;
    let v = { ad: "Komşu", blok: "" };
    try {
      const r = q.profil.get(siteId, kimlik(siteId, userId));
      const p = r && r.veri ? JSON.parse(r.veri) : null;
      if (p) v = { ad: kisaAd(p.ad), blok: String(p.blok || "").toLocaleUpperCase("tr").slice(0, 10) };
    } catch (_) { /* varsayılan */ }
    if (onbellek.size > 20000) onbellek.clear();
    onbellek.set(k, { t, v }); return v;
  }
  const profilUnut = (siteId, userId) => onbellek.delete(siteId + ":" + userId);

  /* Çevrim içi: son 70 saniyede arena/sohbet isteği gönderen kişiler (bellek içi, süreç başına) */
  const gorulen = new Map();
  function temas(siteId, userId) {
    let m = gorulen.get(siteId); if (!m) { m = new Map(); gorulen.set(siteId, m); }
    m.set(userId, now());
  }
  function cevrimici(siteId) {
    const m = gorulen.get(siteId); if (!m) return 0;
    const sinir = now() - 70000; let n = 0;
    for (const t of m.values()) if (t >= sinir) n++;
    return n;
  }
  function temizle() {
    const sinir = now() - 300000;
    for (const [s, m] of gorulen) { for (const [u, t] of m) if (t < sinir) m.delete(u); if (!m.size) gorulen.delete(s); }
  }

  const engelVar = (siteId, a, b) => !!q.engel.get(siteId, a, b, b, a);
  function susturuldu(siteId, userId) { const r = q.sustur.get(siteId, userId); return r && r.bitis > now() ? r.bitis : 0; }

  /* kimlik (20 haneli, siteye özgü) → kullanıcı numarası. Üyeler değiştikçe tazelenir. */
  const kimlikHaritasi = new Map();
  function kisiBul(siteId, kim) {
    let h = kimlikHaritasi.get(siteId);
    if (!h || !h.m.has(kim)) {
      const m = new Map(); for (const u of q.uyeler.all(siteId)) m.set(kimlik(siteId, u.user_id), u.user_id);
      h = { m }; kimlikHaritasi.set(siteId, h);
    }
    return h.m.get(kim) || null;
  }

  const gunAnahtari = ms => new Date(ms + UTC_ARTI).toISOString().slice(0, 10);
  const gunBaslangic = ms => Date.parse(gunAnahtari(ms) + "T00:00:00Z") - UTC_ARTI;

  return { kisaAd, profil, profilUnut, temas, cevrimici, temizle, engelVar, susturuldu, kisiBul, gunAnahtari, gunBaslangic };
}
module.exports = { createOrtak };
