"use strict";
/* Sakin aboneliği (aylık, mağaza içi satın alma) — üçüncü taraf hizmet olmadan, ücretsiz.
   App Store ve Google Play, uygulama içinde satılan dijital abonelikler için kendi ödeme sistemlerini zorunlu kılar.
   - iOS (StoreKit 2): cihaz, Apple'ın imzaladığı işlem kaydını (JWS) gönderir. Sunucu imzayı Apple kök sertifikasına kadar
     zincirle kendisi doğrular (Apple'a istek gerekmez). Yenileme, iptal ve iade App Store Server Notifications V2 ile gelir.
   - Android: cihaz satın alma jetonunu gönderir. Sunucu jetonu Google Play Developer API ile (hizmet hesabı, ücretsiz) sorgular.
     Değişiklikler Google Play gerçek zamanlı geliştirici bildirimleriyle (Pub/Sub itme) gelir.
   - Her satın alma, kişinin uygulama hesabına bağlı rastgele bir kimlikle (hesap UUID'si) yapılır; başka hesaba taşınamaz.
   Site öder modelinde (sites.odeme_modeli = 'site') aidat içinde ödenen bedel o sitenin tüm sakinlerini kapsar. */
const crypto = require("node:crypto");
const fs = require("node:fs");

const DURUMLAR = ["aktif", "iptal_edildi", "odeme_sorunu", "suresi_doldu", "iade"];
const GECERLI = new Set(["aktif", "iptal_edildi", "odeme_sorunu"]);
const URUN = "bs_premium_aylik", ANDROID_PLAN = "aylik";

class MagazaHatasi extends Error { constructor(m, kod = 400) { super(m); this.kod = kod; } }

/* ---------- Apple: JWS (x5c) doğrulaması ---------- */
function oidDer(oid) {
  const p = oid.split(".").map(Number), b = [40 * p[0] + p[1]];
  for (const n of p.slice(2)) { const t = []; let v = n; do { t.unshift(v & 0x7f); v = Math.floor(v / 128); } while (v > 0); for (let i = 0; i < t.length - 1; i++) t[i] |= 0x80; b.push(...t); }
  return Buffer.from([0x06, b.length, ...b]);
}
const OID_YAPRAK = oidDer("1.2.840.113635.100.6.11.1"); // App Store makbuz imzalama
const OID_ARA = oidDer("1.2.840.113635.100.6.2.1");     // Apple WWDR ara sertifika
const b64u = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

function kokYukle(deger) {
  if (!deger) return null;
  const ham = /-----BEGIN/.test(deger) ? deger : fs.existsSync(deger) ? fs.readFileSync(deger) : null;
  if (!ham) throw new Error("Apple kök sertifikası bulunamadı: " + deger);
  return new crypto.X509Certificate(ham);
}

function appleJwsDogrula(jws, kok, simdi = Date.now()) {
  if (typeof jws !== "string" || jws.length > 20000) throw new MagazaHatasi("Geçersiz işlem kaydı.");
  const p = jws.split(".");
  if (p.length !== 3) throw new MagazaHatasi("Geçersiz işlem kaydı.");
  let h; try { h = JSON.parse(b64u(p[0]).toString("utf8")); } catch (_) { throw new MagazaHatasi("Geçersiz işlem kaydı."); }
  if (h.alg !== "ES256" || !Array.isArray(h.x5c) || h.x5c.length < 3) throw new MagazaHatasi("Geçersiz işlem kaydı imzası.");
  const zincir = h.x5c.map(c => new crypto.X509Certificate(Buffer.from(c, "base64")));
  const son = zincir[zincir.length - 1];
  if (son.fingerprint256 !== kok.fingerprint256) throw new MagazaHatasi("İşlem kaydı Apple tarafından imzalanmamış.");
  for (let i = 0; i < zincir.length; i++) {
    const c = zincir[i], ust = zincir[i + 1] || kok;
    if (!c.verify(ust.publicKey) || (i < zincir.length - 1 && !c.checkIssued(ust))) throw new MagazaHatasi("İşlem kaydının sertifika zinciri geçersiz.");
    if (Date.parse(c.validFrom) > simdi || Date.parse(c.validTo) < simdi) throw new MagazaHatasi("İşlem kaydının sertifikası süresi dışında.");
  }
  if (!zincir[0].raw.includes(OID_YAPRAK) || !zincir[1].raw.includes(OID_ARA)) throw new MagazaHatasi("İşlem kaydı App Store imzası değil.");
  const imzaOk = crypto.verify("sha256", Buffer.from(p[0] + "." + p[1]), { key: zincir[0].publicKey, dsaEncoding: "ieee-p1363" }, b64u(p[2]));
  if (!imzaOk) throw new MagazaHatasi("İşlem kaydının imzası geçersiz.");
  try { return JSON.parse(b64u(p[1]).toString("utf8")); } catch (_) { throw new MagazaHatasi("Geçersiz işlem kaydı."); }
}

/* ---------- Google: Play Developer API ---------- */
function googleIstemci({ hizmetHesabi, paket, apiTaban = "https://androidpublisher.googleapis.com" }, fetchFn = globalThis.fetch, simdi = () => Date.now()) {
  const hh = typeof hizmetHesabi === "string" ? JSON.parse(fs.existsSync(hizmetHesabi) ? fs.readFileSync(hizmetHesabi, "utf8") : hizmetHesabi) : hizmetHesabi;
  if (!hh || !hh.client_email || !hh.private_key) throw new Error("Google hizmet hesabı JSON'u eksik (client_email, private_key).");
  let jeton = null, jetonBitis = 0;
  async function erisim() {
    if (jeton && simdi() < jetonBitis - 60000) return jeton;
    const iat = Math.floor(simdi() / 1000), b = o => Buffer.from(JSON.stringify(o)).toString("base64url");
    const govde = b({ alg: "RS256", typ: "JWT" }) + "." + b({ iss: hh.client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: hh.token_uri || "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 });
    const imza = crypto.sign("sha256", Buffer.from(govde), hh.private_key).toString("base64url");
    const r = await fetchFn(hh.token_uri || "https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + govde + "." + imza });
    if (!r.ok) throw new Error("Google erişim jetonu alınamadı (" + r.status + ")");
    const d = await r.json(); jeton = d.access_token; jetonBitis = simdi() + (d.expires_in || 3600) * 1000;
    return jeton;
  }
  return {
    async abonelik(token) {
      const u = `${apiTaban}/androidpublisher/v3/applications/${encodeURIComponent(paket)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`;
      const r = await fetchFn(u, { headers: { Authorization: "Bearer " + await erisim(), Accept: "application/json" } });
      if (r.status === 404 || r.status === 400 || r.status === 410) throw new MagazaHatasi("Satın alma Google Play'de bulunamadı.");
      if (!r.ok) throw new Error("Google Play yanıtı " + r.status);
      return r.json();
    }
  };
}
const GOOGLE_DURUM = { SUBSCRIPTION_STATE_ACTIVE: "aktif", SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "odeme_sorunu", SUBSCRIPTION_STATE_CANCELED: "iptal_edildi",
  SUBSCRIPTION_STATE_ON_HOLD: "suresi_doldu", SUBSCRIPTION_STATE_PAUSED: "suresi_doldu", SUBSCRIPTION_STATE_EXPIRED: "suresi_doldu" };

function createAbonelik({ db, cfg, now }) {
  const a = cfg.abonelik || {};
  const kok = a.apple && a.apple.kokSertifika ? kokYukle(a.apple.kokSertifika) : null;
  const apple = kok && a.apple.bundleId ? { bundleId: a.apple.bundleId } : null;
  const google = a.google && a.google.hizmetHesabi && a.google.paket ? googleIstemci(a.google, a.fetch, now) : null;
  const urun = a.urun || URUN;
  const q = {
    get: db.prepare("SELECT * FROM abonelikler WHERE user_id = ?"),
    yaz: db.prepare(`INSERT INTO abonelikler (user_id, saglayici, magaza, urun, durum, bitis, deneme, ortam, harici_id, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET saglayici = excluded.saglayici, magaza = excluded.magaza, urun = excluded.urun, durum = excluded.durum,
      bitis = excluded.bitis, deneme = excluded.deneme, ortam = excluded.ortam, harici_id = excluded.harici_id, guncelleme = excluded.guncelleme`),
    harici: db.prepare("SELECT user_id FROM abonelikler WHERE magaza = ? AND harici_id = ?"),
    aboneId: db.prepare("SELECT abone_id FROM users WHERE id = ?"),
    aboneIdYaz: db.prepare("UPDATE users SET abone_id = ? WHERE id = ? AND abone_id IS NULL"),
    userByAbone: db.prepare("SELECT id FROM users WHERE abone_id = ?")
  };
  const fiyatMetni = a.fiyatMetni || "100 TL / ay";

  /* Hesap UUID'si: mağazaya gönderilen, kişiye bağlı, rastgele ve kalıcı kimlik (StoreKit appAccountToken / Play obfuscatedAccountId). */
  function aboneIdAl(userId) {
    const r = q.aboneId.get(userId);
    if (r && r.abone_id) return r.abone_id;
    q.aboneIdYaz.run(crypto.randomUUID(), userId);
    return q.aboneId.get(userId).abone_id;
  }
  const kayitGecerli = r => !!r && GECERLI.has(r.durum) && (r.bitis === null || r.bitis > now());

  function durum(userId, site, siteDurumu) {
    const r = q.get.get(userId);
    const temel = { fiyatMetni, magazaHazir: !!(apple || google), magazalar: { ios: !!apple, android: !!google }, odemeModeli: site ? site.odeme_modeli || "sakin" : "sakin" };
    if (site && site.odeme_modeli === "site" && siteDurumu !== "askida") return { ...temel, aktif: true, kaynak: "site", bitis: null };
    if (kayitGecerli(r)) return { ...temel, aktif: true, kaynak: r.magaza || r.saglayici, durum: r.durum, bitis: r.bitis, deneme: !!r.deneme };
    return { ...temel, aktif: false, kaynak: null, durum: r ? r.durum : "yok", bitis: r ? r.bitis : null };
  }

  /* Aynı mağaza kaydı başka bir hesaba bağlıysa reddedilir (bir abonelik tek hesap içindir). */
  function kaydet(userId, magaza, s) {
    if (!DURUMLAR.includes(s.durum)) throw new Error("Bilinmeyen abonelik durumu: " + s.durum);
    const sahip = q.harici.get(magaza, s.harici);
    if (sahip && sahip.user_id !== userId) throw new MagazaHatasi("Bu abonelik başka bir hesaba bağlı.", 409);
    q.yaz.run(userId, magaza, magaza, String(s.urun || "").slice(0, 100), s.durum, s.bitis, s.deneme ? 1 : 0, s.ortam || "", s.harici, now());
  }

  function appleIslem(t, yenileme) {
    if (t.bundleId !== apple.bundleId) throw new MagazaHatasi("İşlem kaydı bu uygulamaya ait değil.");
    if (t.productId !== urun) throw new MagazaHatasi("Bilinmeyen ürün.");
    const bitis = Number(t.expiresDate) || null;
    let d = "aktif";
    if (t.revocationDate) d = "iade";
    else if (bitis !== null && bitis < now()) d = "suresi_doldu";
    else if (yenileme && yenileme.autoRenewStatus === 0) d = "iptal_edildi";
    return { durum: d, bitis, urun: t.productId, harici: String(t.originalTransactionId || ""), deneme: t.offerType === 1, ortam: t.environment === "Sandbox" ? "test" : "canli", hesap: t.appAccountToken };
  }
  async function googleIslem(token) {
    const g = await google.abonelik(token);
    const li = (g.lineItems || [])[0] || {};
    if (li.productId !== urun) throw new MagazaHatasi("Bilinmeyen ürün.");
    if (g.subscriptionState === "SUBSCRIPTION_STATE_PENDING") throw new MagazaHatasi("Ödeme henüz onaylanmadı. Onaylanınca Premium açılacak.", 202);
    const d = GOOGLE_DURUM[g.subscriptionState];
    if (!d) throw new MagazaHatasi("Abonelik durumu anlaşılamadı.");
    return { durum: d, bitis: li.expiryTime ? Date.parse(li.expiryTime) : null, urun: li.productId, harici: token,
      ortam: g.testPurchase ? "test" : "canli", hesap: g.externalAccountIdentifiers && g.externalAccountIdentifiers.obfuscatedExternalAccountId };
  }

  /* Cihazdan gelen satın alma kanıtı */
  async function dogrula(userId, k) {
    const uuid = aboneIdAl(userId);
    let s, magaza;
    if (k && k.platform === "ios") {
      if (!apple) throw new MagazaHatasi("App Store aboneliği henüz yapılandırılmadı.", 503);
      s = appleIslem(appleJwsDogrula(k.jws, kok, now())); magaza = "apple";
    } else if (k && k.platform === "android") {
      if (!google) throw new MagazaHatasi("Google Play aboneliği henüz yapılandırılmadı.", 503);
      if (typeof k.token !== "string" || !k.token || k.token.length > 500) throw new MagazaHatasi("Geçersiz satın alma jetonu.");
      s = await googleIslem(k.token); magaza = "google";
    } else throw new MagazaHatasi("Platform 'ios' ya da 'android' olmalı.");
    if (s.hesap !== uuid) throw new MagazaHatasi("Bu satın alma başka bir hesaba ait.", 409);
    kaydet(userId, magaza, s);
    return q.get.get(userId);
  }

  /* App Store Server Notifications V2: imzalı yük; gövdeye ancak imza doğrulanınca güvenilir. */
  function appleBildirim(govde) {
    if (!apple) throw new MagazaHatasi("App Store yapılandırılmadı.", 503);
    const n = appleJwsDogrula(govde && govde.signedPayload, kok, now());
    const d = n.data || {};
    if (d.bundleId && d.bundleId !== apple.bundleId) throw new MagazaHatasi("Bildirim bu uygulamaya ait değil.");
    if (!d.signedTransactionInfo) return 0;
    const t = appleJwsDogrula(d.signedTransactionInfo, kok, now());
    const y = d.signedRenewalInfo ? appleJwsDogrula(d.signedRenewalInfo, kok, now()) : null;
    const s = appleIslem(t, y);
    if (n.notificationType === "DID_FAIL_TO_RENEW" && s.durum === "aktif") s.durum = "odeme_sorunu";
    const u = (s.hesap && q.userByAbone.get(s.hesap)) || q.harici.get("apple", s.harici);
    if (!u) return 0;
    kaydet(u.id !== undefined ? u.id : u.user_id, "apple", s);
    return 1;
  }
  /* Google Play RTDN (Pub/Sub itme): yalnızca jeton alınır, durum Google'dan yeniden sorgulanır. */
  async function googleBildirim(govde) {
    if (!google) throw new MagazaHatasi("Google Play yapılandırılmadı.", 503);
    let veri;
    try { veri = JSON.parse(Buffer.from(govde.message.data, "base64").toString("utf8")); } catch (_) { throw new MagazaHatasi("Geçersiz bildirim."); }
    const sn = veri.subscriptionNotification;
    if (!sn || !sn.purchaseToken) return 0;
    const s = await googleIslem(sn.purchaseToken);
    const u = (s.hesap && q.userByAbone.get(s.hesap)) || q.harici.get("google", s.harici);
    if (!u) return 0;
    kaydet(u.id !== undefined ? u.id : u.user_id, "google", s);
    return 1;
  }

  return { durum, dogrula, appleBildirim, googleBildirim, aboneIdAl, fiyatMetni, urun, androidPlan: a.androidPlan || ANDROID_PLAN, hazir: !!(apple || google) };
}

module.exports = { createAbonelik, appleJwsDogrula, googleIstemci, MagazaHatasi, DURUMLAR, URUN };
