"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { sunucuBaslat, Istemci, ortam, tel } = require("./yardimci");
const { revenueCatSaglayici } = require("../src/abonelik");

/* Sahte RevenueCat: aboneId -> abone yanıtı */
const RC = new Map();
let rcCagri = 0;
const sahteFetch = async (url, o) => {
  rcCagri++;
  assert.equal(o.headers.Authorization, "Bearer sk_test");
  const id = decodeURIComponent(url.split("/").pop());
  const sub = RC.get(id) || { entitlements: {}, subscriptions: {} };
  return { ok: true, status: 200, json: async () => ({ subscriber: sub }) };
};
const ileri = g => new Date(Date.now() + g * 864e5).toISOString();
const abone = (ek = {}, bitis = ileri(30)) => ({ entitlements: { premium: { expires_date: bitis, product_identifier: "bs_aylik" } },
  subscriptions: { bs_aylik: { store: "app_store", period_type: "normal", is_sandbox: true, ...ek } } });

let C, OR;
test.before(async () => { C = await sunucuBaslat({ config: { abonelik: { revenuecat: { apiAnahtari: "sk_test", hak: "premium" }, fetch: sahteFetch, webhookAnahtari: "wh_gizli" } } }); OR = await ortam(C); });
test.after(() => C.kapat());

test("RevenueCat ayrıştırma: durumlar", async () => {
  const s = revenueCatSaglayici({ apiAnahtari: "sk_test" }, sahteFetch);
  RC.set("x1", abone()); assert.equal((await s.sorgula("x1")).durum, "aktif");
  RC.set("x2", abone({ unsubscribe_detected_at: ileri(-1) })); assert.equal((await s.sorgula("x2")).durum, "iptal_edildi");
  RC.set("x3", abone({ billing_issues_detected_at: ileri(-1) })); assert.equal((await s.sorgula("x3")).durum, "odeme_sorunu");
  RC.set("x4", abone({}, ileri(-2))); assert.equal((await s.sorgula("x4")).durum, "suresi_doldu");
  RC.set("x5", abone({ refunded_at: ileri(-1) })); assert.equal((await s.sorgula("x5")).durum, "iade");
  RC.set("x6", abone({ store: "play_store" })); assert.equal((await s.sorgula("x6")).magaza, "google");
  assert.equal((await s.sorgula("yok")).durum, "yok");
});

test("Abonelik: ücretsiz başlar, satın alım sonrası sunucu doğrular, webhook günceller", async () => {
  const o = OR;
  const sk = o.sakinA1;
  assert.equal(sk.me.abonelik.aktif, false);
  assert.equal(sk.me.abonelik.fiyatMetni, "100 TL / ay");
  assert.equal(sk.me.abonelik.magazaHazir, true);
  const g = await sk.get("/api/abonelik");
  assert.match(g.body.aboneId, /^bs_[0-9a-f]{24}$/);
  assert.equal((await sk.get("/api/abonelik")).body.aboneId, g.body.aboneId, "abone kimliği kalıcı");
  // Satın almadan yenile: hâlâ pasif
  let y = await sk.post("/api/abonelik/yenile", {});
  assert.equal(y.status, 200); assert.equal(y.body.abonelik.aktif, false);
  // Mağazada satın aldı
  RC.set(g.body.aboneId, abone());
  y = await sk.post("/api/abonelik/yenile", {});
  assert.equal(y.body.abonelik.aktif, true); assert.equal(y.body.abonelik.kaynak, "apple");
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, true);
  // Başka sakin etkilenmez
  assert.equal(o.sakinA2.me.abonelik.aktif, false);
  // İptal: dönem sonuna kadar sürer
  RC.set(g.body.aboneId, abone({ unsubscribe_detected_at: ileri(0) }));
  const w = await fetch(C.base + "/api/abonelik/webhook", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer wh_gizli" },
    body: JSON.stringify({ event: { type: "CANCELLATION", app_user_id: g.body.aboneId } }) });
  assert.equal(w.status, 200); assert.equal((await w.json()).islenen, 1);
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, true); assert.equal(sk.me.abonelik.durum, "iptal_edildi");
  // Süre doldu
  RC.set(g.body.aboneId, abone({}, ileri(-1)));
  await fetch(C.base + "/api/abonelik/webhook", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer wh_gizli" },
    body: JSON.stringify({ event: { type: "EXPIRATION", app_user_id: g.body.aboneId } }) });
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, false);
});

test("Webhook: yanlış anahtar ve sahte kimlik reddedilir, gövdeye güvenilmez", async () => {
  const kotu = await fetch(C.base + "/api/abonelik/webhook", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer yanlis" }, body: "{}" });
  assert.equal(kotu.status, 401);
  const yok = await fetch(C.base + "/api/abonelik/webhook", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(yok.status, 401);
  const n = rcCagri;
  const r = await fetch(C.base + "/api/abonelik/webhook", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer wh_gizli" },
    body: JSON.stringify({ event: { type: "INITIAL_PURCHASE", app_user_id: "1", expiration_at_ms: Date.now() + 1e10 } }) });
  assert.equal((await r.json()).islenen, 0); assert.equal(rcCagri, n, "bilinmeyen kimlik için sağlayıcı sorgulanmaz");
});

test("Site öder modeli: tüm sakinler kapsanır; site askıya alınınca biter", async () => {
  const o = OR;
  const p = await o.admin.patch(`/api/platform/siteler/${o.siteA.id}`, { odemeModeli: "site" });
  assert.equal(p.status, 200); assert.equal(p.body.site.odemeModeli, "site");
  await o.sakinA2.yenile(); assert.equal(o.sakinA2.me.abonelik.aktif, true); assert.equal(o.sakinA2.me.abonelik.kaynak, "site");
  await o.sakinB1.yenile(); assert.equal(o.sakinB1.me.abonelik.aktif, false, "diğer site etkilenmez");
  await o.admin.patch(`/api/platform/siteler/${o.siteA.id}`, { durum: "askida" });
  await o.sakinA2.yenile(); assert.equal(o.sakinA2.me.abonelik.aktif, false);
  assert.equal((await o.admin.patch(`/api/platform/siteler/${o.siteA.id}`, { odemeModeli: "bedava" })).status, 400);
  assert.equal((await o.yonA.patch(`/api/platform/siteler/${o.siteA.id}`, { odemeModeli: "site" })).status, 403, "site yöneticisi kendine açamaz");
});

test("Mağaza yapılandırılmamışsa yenile 503", async () => {
  const D = await sunucuBaslat();
  try {
    const u = await new Istemci(D).giris(tel());
    assert.equal(u.me.abonelik.magazaHazir, false);
    assert.equal((await u.post("/api/abonelik/yenile", {})).status, 503);
  } finally { await D.kapat(); }
});

test("Mobil jeton: yalnızca uygulama kaynağına verilir, CSRF'siz çalışır, çerezle karışmaz", async () => {
  const t = tel();
  const H = { "content-type": "application/json", origin: "capacitor://localhost", "x-istemci": "mobil" };
  // Ön kontrol (CORS)
  const pf = await fetch(C.base + "/api/auth/otp-iste", { method: "OPTIONS", headers: { origin: "capacitor://localhost", "access-control-request-method": "POST" } });
  assert.equal(pf.status, 204); assert.equal(pf.headers.get("access-control-allow-origin"), "capacitor://localhost");
  assert.match(pf.headers.get("access-control-allow-headers"), /Authorization/);
  const kotuPf = await fetch(C.base + "/api/me", { headers: { origin: "https://kotu.example" } });
  assert.equal(kotuPf.headers.get("access-control-allow-origin"), null);
  let r = await fetch(C.base + "/api/auth/otp-iste", { method: "POST", headers: H, body: JSON.stringify({ telefon: t }) });
  assert.equal(r.status, 200); const telN = (await r.json()).telefon;
  r = await fetch(C.base + "/api/auth/otp-dogrula", { method: "POST", headers: H, body: JSON.stringify({ telefon: t, kod: C.sms.sonKod(telN) }) });
  const d = await r.json(); assert.ok(d.token && d.token.length >= 40, "jeton döner");
  // Jetonla okuma ve CSRF'siz yazma
  const B = { ...H, authorization: "Bearer " + d.token };
  const me = await (await fetch(C.base + "/api/me", { headers: B })).json();
  assert.ok(me.user); assert.equal(me.abonelik.aktif, false);
  r = await fetch(C.base + "/api/abonelik/yenile", { method: "POST", headers: B, body: "{}" });
  assert.equal(r.status, 200);
  // Çerez + jeton birlikte reddedilir
  r = await fetch(C.base + "/api/abonelik/yenile", { method: "POST", headers: { ...B, cookie: "sid=abc" }, body: "{}" });
  assert.equal(r.status, 400);
  // Tarayıcıdan (aynı kaynak) girişte jeton verilmez
  const w = new Istemci(C); const a = await w.post("/api/auth/otp-iste", { telefon: tel() });
  const v = await w.post("/api/auth/otp-dogrula", { telefon: a.body.telefon, kod: C.sms.sonKod(a.body.telefon) });
  assert.equal(v.body.token, undefined);
  // Başlık olmadan uygulama kaynağı da jeton alamaz
  const a2 = await w.post("/api/auth/otp-iste", { telefon: tel() });
  const v2 = await fetch(C.base + "/api/auth/otp-dogrula", { method: "POST", headers: { "content-type": "application/json", origin: "capacitor://localhost" },
    body: JSON.stringify({ telefon: a2.body.telefon, kod: C.sms.sonKod(a2.body.telefon) }) });
  assert.equal(v2.status, 403);
  // Çıkış jetonu geçersiz kılar
  r = await fetch(C.base + "/api/auth/cikis", { method: "POST", headers: B, body: "{}" });
  assert.equal(r.status, 200);
  assert.equal((await (await fetch(C.base + "/api/me", { headers: B })).json()).user, null);
});

test("Hesap silme aboneliği de siler ve mağaza iptal notu verir", async () => {
  const u = await new Istemci(C).giris(tel());
  const id = (await u.get("/api/abonelik")).body.aboneId;
  RC.set(id, abone()); await u.post("/api/abonelik/yenile", {});
  const s = await u.del("/api/hesap", { onay: true });
  assert.equal(s.status, 200); assert.match(s.body.not, /App Store ya da Google Play/);
  assert.equal(C.db.prepare("SELECT COUNT(*) n FROM abonelikler a JOIN users x ON x.id = a.user_id WHERE x.abone_id = ?").get(id).n, 0);
  assert.equal(C.db.prepare("SELECT COUNT(*) n FROM users WHERE abone_id = ?").get(id).n, 0);
});

test("Mağaza inceleme hesabı: SMS gönderilmez, sabit kod çalışır, diğer numaralar etkilenmez", async () => {
  const D = await sunucuBaslat({ config: { incelemeHesabi: { telefon: "0500 999 88 77", kod: "246810" } } });
  try {
    const u = new Istemci(D);
    const a = await u.post("/api/auth/otp-iste", { telefon: "05009998877" });
    assert.equal(a.status, 200); assert.equal(D.sms.sonKod(a.body.telefon), null, "SMS gönderilmedi");
    assert.equal((await u.post("/api/auth/otp-dogrula", { telefon: "05009998877", kod: "111111" })).status, 400);
    assert.equal((await u.post("/api/auth/otp-dogrula", { telefon: "05009998877", kod: "246810" })).status, 200);
    const b = new Istemci(D), t = tel();
    const r = await b.post("/api/auth/otp-iste", { telefon: t });
    assert.match(D.sms.sonKod(r.body.telefon), /^\d{6}$/, "normal numaraya SMS gider");
    assert.equal((await b.post("/api/auth/otp-dogrula", { telefon: t, kod: "246810" })).status, 400, "sabit kod başka numarada geçmez");
  } finally { await D.kapat(); }
  const E = await sunucuBaslat({ config: { incelemeHesabi: { telefon: "05009998877", kod: "12" } } });
  try { const r = await new Istemci(E).post("/api/auth/otp-iste", { telefon: "05009998877" }); assert.match(E.sms.sonKod(r.body.telefon), /^\d{6}$/, "geçersiz kod ayarında özellik kapalı"); }
  finally { await E.kapat(); }
});
