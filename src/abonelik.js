"use strict";
/* Sakin aboneliği (aylık, mağaza içi satın alma).
   App Store ve Google Play, uygulama içinde satılan dijital abonelikler için kendi ödeme sistemlerini zorunlu kılar.
   Satın alma cihazda RevenueCat SDK'sı ile yapılır; sunucu, sonucu RevenueCat REST API'sinden kendisi sorgular
   (istemcinin "ödedim" demesine güvenilmez). Webhook yalnızca "bu kullanıcıyı yeniden sorgula" tetikleyicisidir.
   Site öder modelinde (sites.odeme_modeli = 'site') aidat içinde ödenen bedel o sitenin tüm sakinlerini kapsar. */

const DURUMLAR = ["aktif", "iptal_edildi", "odeme_sorunu", "suresi_doldu", "iade"];

function revenueCatSaglayici(ayar, fetchFn = globalThis.fetch) {
  const { apiAnahtari, hak = "premium" } = ayar, taban = ayar.taban || "https://api.revenuecat.com";
  return {
    ad: "revenuecat",
    async sorgula(aboneId) {
      const r = await fetchFn(`${taban}/v1/subscribers/${encodeURIComponent(aboneId)}`, {
        headers: { Authorization: `Bearer ${apiAnahtari}`, Accept: "application/json" }
      });
      if (!r.ok) throw new Error(`RevenueCat yanıtı ${r.status}`);
      const d = await r.json();
      const sub = d && d.subscriber;
      const e = sub && sub.entitlements && sub.entitlements[hak];
      if (!e) return { durum: "yok" };
      const bitis = e.expires_date ? Date.parse(e.expires_date) : null;
      const urun = e.product_identifier || "";
      const s = (sub.subscriptions && sub.subscriptions[urun]) || {};
      const magaza = s.store === "app_store" ? "apple" : s.store === "play_store" ? "google" : (s.store || "");
      let durum = "aktif";
      if (s.refunded_at) durum = "iade";
      else if (bitis !== null && bitis < Date.now()) durum = "suresi_doldu";
      else if (s.billing_issues_detected_at) durum = "odeme_sorunu";
      else if (s.unsubscribe_detected_at) durum = "iptal_edildi";
      return { durum, bitis, urun, magaza, deneme: s.period_type === "trial", ortam: s.is_sandbox ? "test" : "canli" };
    }
  };
}

function createAbonelik({ db, cfg, now }) {
  const a = cfg.abonelik || {};
  const saglayici = a.saglayici || (a.revenuecat && a.revenuecat.apiAnahtari ? revenueCatSaglayici(a.revenuecat, a.fetch) : null);
  const q = {
    get: db.prepare("SELECT * FROM abonelikler WHERE user_id = ?"),
    yaz: db.prepare(`INSERT INTO abonelikler (user_id, saglayici, magaza, urun, durum, bitis, deneme, ortam, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET saglayici = excluded.saglayici, magaza = excluded.magaza, urun = excluded.urun, durum = excluded.durum,
      bitis = excluded.bitis, deneme = excluded.deneme, ortam = excluded.ortam, guncelleme = excluded.guncelleme`),
    sil: db.prepare("DELETE FROM abonelikler WHERE user_id = ?"),
    aboneId: db.prepare("SELECT abone_id FROM users WHERE id = ?"),
    aboneIdYaz: db.prepare("UPDATE users SET abone_id = ? WHERE id = ? AND abone_id IS NULL"),
    userByAbone: db.prepare("SELECT id FROM users WHERE abone_id = ?")
  };
  const fiyatMetni = a.fiyatMetni || "100 TL / ay";

  /* Mağazaya gönderilen kimlik: sıralı kullanıcı numarası yerine rastgele, kalıcı bir değer. */
  function aboneIdAl(userId) {
    const r = q.aboneId.get(userId);
    if (r && r.abone_id) return r.abone_id;
    q.aboneIdYaz.run("bs_" + require("node:crypto").randomBytes(12).toString("hex"), userId);
    return q.aboneId.get(userId).abone_id;
  }

  /* "iptal_edildi" ve "odeme_sorunu": otomatik yenileme kapalı ya da ödeme alınamadı, ama dönem bitene kadar hak sürer. */
  function kayitGecerli(r) {
    return !!r && ["aktif", "iptal_edildi", "odeme_sorunu"].includes(r.durum) && (r.bitis === null || r.bitis > now());
  }

  function durum(userId, site, siteDurumu) {
    const r = q.get.get(userId);
    const temel = { fiyatMetni, magazaHazir: !!saglayici, odemeModeli: site ? site.odeme_modeli || "sakin" : "sakin" };
    if (site && site.odeme_modeli === "site" && siteDurumu !== "askida") return { ...temel, aktif: true, kaynak: "site", bitis: null };
    if (kayitGecerli(r)) return { ...temel, aktif: true, kaynak: r.magaza || r.saglayici, durum: r.durum, bitis: r.bitis, deneme: !!r.deneme };
    return { ...temel, aktif: false, kaynak: null, durum: r ? r.durum : "yok", bitis: r ? r.bitis : null };
  }

  async function yenile(userId) {
    if (!saglayici) return null;
    const s = await saglayici.sorgula(aboneIdAl(userId));
    if (s.durum === "yok") { q.sil.run(userId); return null; }
    if (!DURUMLAR.includes(s.durum)) throw new Error("Bilinmeyen abonelik durumu: " + s.durum);
    q.yaz.run(userId, saglayici.ad, s.magaza || "", String(s.urun || "").slice(0, 100), s.durum, s.bitis, s.deneme ? 1 : 0, s.ortam || "", now());
    return q.get.get(userId);
  }

  /* Webhook: gövdeye güvenmeden yalnızca kullanıcı kimliğini alır ve sağlayıcıyı yeniden sorgular. */
  async function webhook(govde) {
    const e = govde && govde.event;
    const kimlikler = [e && e.app_user_id, ...((e && e.aliases) || []), ...((e && e.transferred_to) || []), ...((e && e.transferred_from) || [])]
      .filter(x => typeof x === "string" && /^bs_[0-9a-f]{24}$/.test(x));
    const islenen = [];
    for (const k of new Set(kimlikler)) {
      const u = q.userByAbone.get(k);
      if (u) { await yenile(u.id); islenen.push(k); }
    }
    return islenen.length;
  }

  return { saglayici, durum, yenile, webhook, aboneIdAl, fiyatMetni };
}

module.exports = { createAbonelik, revenueCatSaglayici, DURUMLAR };
