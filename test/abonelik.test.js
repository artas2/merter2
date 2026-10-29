"use strict";
/* Abonelik: App Store (StoreKit 2 JWS, sunucuda imza zinciri doğrulaması) ve Google Play (Developer API) — üçüncü taraf yok. */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { sunucuBaslat, Istemci, ortam, tel } = require("./yardimci");
const { appleJwsDogrula } = require("../src/abonelik");

/* Test sertifika zinciri (test/fixtures/apple): kök → ara (WWDR OID) → yaprak (makbuz imzalama OID) */
const FX = path.join(__dirname, "fixtures", "apple");
const pem = f => fs.readFileSync(path.join(FX, f), "utf8");
const der = f => new crypto.X509Certificate(pem(f)).raw.toString("base64");
const KOK = pem("kok.pem");
function jws(yuk, { anahtar = pem("yaprak.key"), x5c = [der("yaprak.pem"), der("ara.pem"), der("kok.pem")] } = {}) {
  const b = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = b({ alg: "ES256", x5c }) + "." + b(yuk);
  return g + "." + crypto.sign("sha256", Buffer.from(g), { key: anahtar, dsaEncoding: "ieee-p1363" }).toString("base64url");
}
const BUNDLE = "com.bilinclisakin.app";
const ileri = g => Date.now() + g * 864e5;
const islem = (uuid, ek = {}) => ({ bundleId: BUNDLE, productId: "bs_premium_aylik", originalTransactionId: "2000000" + Math.floor(Math.random() * 1e8),
  transactionId: "1", expiresDate: ileri(30), appAccountToken: uuid, environment: "Sandbox", type: "Auto-Renewable Subscription", ...ek });

/* Sahte Google: OAuth jeton uç noktası (JWT imzası gerçekten doğrulanır) ve Play Developer API */
const { publicKey: GPUB, privateKey: GPRIV } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const HH = { client_email: "magaza@test.iam.gserviceaccount.com", private_key: GPRIV.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.googleapis.com/token" };
const GP = new Map(); let gCagri = 0;
const sahteFetch = async (url, o) => {
  gCagri++;
  if (url === HH.token_uri) {
    const a = new URLSearchParams(o.body).get("assertion").split(".");
    assert.ok(crypto.verify("sha256", Buffer.from(a[0] + "." + a[1]), GPUB, Buffer.from(a[2], "base64url")), "JWT imzası");
    assert.equal(JSON.parse(Buffer.from(a[1], "base64url")).scope, "https://www.googleapis.com/auth/androidpublisher");
    return { ok: true, status: 200, json: async () => ({ access_token: "ya29.test", expires_in: 3600 }) };
  }
  assert.equal(o.headers.Authorization, "Bearer ya29.test");
  assert.match(url, /applications\/com\.bilinclisakin\.app\/purchases\/subscriptionsv2\/tokens\//);
  const t = decodeURIComponent(url.split("/").pop());
  if (!GP.has(t)) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => GP.get(t) };
};
const gAbone = (uuid, durum = "SUBSCRIPTION_STATE_ACTIVE", gun = 30) => ({ subscriptionState: durum, lineItems: [{ productId: "bs_premium_aylik", expiryTime: new Date(ileri(gun)).toISOString() }],
  externalAccountIdentifiers: { obfuscatedExternalAccountId: uuid }, testPurchase: {} });

let C, OR;
test.before(async () => {
  C = await sunucuBaslat({ config: { abonelik: { apple: { kokSertifika: KOK, bundleId: BUNDLE }, google: { hizmetHesabi: HH, paket: BUNDLE }, fetch: sahteFetch, bildirimAnahtari: "pubsub_gizli" } } });
  OR = await ortam(C);
});
test.after(() => C.kapat());

test("Apple JWS: geçerli zincir kabul; değiştirilmiş yük, sahte kök, eksik zincir reddedilir", () => {
  const k = new crypto.X509Certificate(KOK);
  const iyi = jws({ a: 1 });
  assert.deepEqual(appleJwsDogrula(iyi, k), { a: 1 });
  const [h, , i] = iyi.split(".");
  assert.throws(() => appleJwsDogrula(h + "." + Buffer.from(JSON.stringify({ a: 2 })).toString("base64url") + "." + i, k), /imzası geçersiz/);
  assert.throws(() => appleJwsDogrula(jws({ a: 1 }, { anahtar: pem("sahte.key"), x5c: [der("sahte-kok.pem"), der("sahte-kok.pem"), der("sahte-kok.pem")] }), k), /Apple tarafından imzalanmamış/);
  // Sahte kökü başa koyup gerçek kökü sona eklemek: zincir kırılır
  assert.throws(() => appleJwsDogrula(jws({ a: 1 }, { anahtar: pem("sahte.key"), x5c: [der("sahte-kok.pem"), der("ara.pem"), der("kok.pem")] }), k), /zinciri geçersiz/);
  // Ara sertifika yaprak gibi kullanılırsa OID denetimi yakalar
  assert.throws(() => appleJwsDogrula(jws({ a: 1 }, { anahtar: pem("ara.key"), x5c: [der("ara.pem"), der("kok.pem"), der("kok.pem")] }), k), /App Store imzası değil|zinciri/);
  assert.throws(() => appleJwsDogrula("a.b", k), /Geçersiz/);
  assert.throws(() => appleJwsDogrula(jws({ a: 1 }, { x5c: [der("yaprak.pem")] }), k), /imzası/);
});

test("iOS: ücretsiz başlar; satın alma kaydı doğrulanınca Premium açılır; hesaba bağlıdır", async () => {
  const sk = OR.sakinA1;
  assert.equal(sk.me.abonelik.aktif, false); assert.deepEqual(sk.me.abonelik.magazalar, { ios: true, android: true });
  const g = (await sk.get("/api/abonelik")).body;
  assert.match(g.hesapUuid, /^[0-9a-f-]{36}$/); assert.equal(g.urun, "bs_premium_aylik"); assert.equal(g.androidPlan, "aylik");
  // Başkasının hesabına yapılmış satın alma
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "ios", jws: jws(islem(crypto.randomUUID())) })).status, 409);
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "ios", jws: jws(islem(g.hesapUuid, { bundleId: "com.baska" })) })).status, 400);
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "ios", jws: jws(islem(g.hesapUuid, { productId: "x" })) })).status, 400);
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "ios", jws: "sahte.kayit.imza" })).status, 400);
  const t = islem(g.hesapUuid);
  const r = await sk.post("/api/abonelik/dogrula", { platform: "ios", jws: jws(t) });
  assert.equal(r.status, 200); assert.equal(r.body.abonelik.aktif, true); assert.equal(r.body.abonelik.kaynak, "apple");
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, true);
  assert.equal(OR.sakinA2.me.abonelik.aktif, false, "başka sakin etkilenmez");
  // Aynı mağaza kaydını başka hesap kullanamaz (kendi UUID'siyle imzalanmış olsa bile)
  const g2 = (await OR.sakinA2.get("/api/abonelik")).body;
  assert.equal((await OR.sakinA2.post("/api/abonelik/dogrula", { platform: "ios", jws: jws({ ...t, appAccountToken: g2.hesapUuid }) })).status, 409);
  OR.appleT = t;
});

test("App Store bildirimleri: iptal dönem sonuna kadar sürer, süre dolunca ve iadede biter; imzasız bildirim reddedilir", async () => {
  const sk = OR.sakinA1, t = OR.appleT;
  const bildir = (tip, tx, yen) => fetch(C.base + "/api/abonelik/apple-bildirim", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ signedPayload: jws({ notificationType: tip, data: { bundleId: BUNDLE, signedTransactionInfo: jws(tx), ...(yen ? { signedRenewalInfo: jws(yen) } : {}) } }) }) });
  let r = await bildir("DID_CHANGE_RENEWAL_STATUS", t, { autoRenewStatus: 0 });
  assert.equal(r.status, 200); assert.equal((await r.json()).islenen, 1);
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, true); assert.equal(sk.me.abonelik.durum, "iptal_edildi");
  await bildir("DID_RENEW", { ...t, expiresDate: ileri(60) }, { autoRenewStatus: 1 });
  await sk.yenile(); assert.equal(sk.me.abonelik.durum, "aktif"); assert.ok(sk.me.abonelik.bitis > ileri(59));
  await bildir("EXPIRED", { ...t, expiresDate: ileri(-1) });
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, false);
  await bildir("REFUND", { ...t, revocationDate: Date.now() });
  await sk.yenile(); assert.equal(sk.me.abonelik.durum, "iade");
  const sahte = jws({ notificationType: "DID_RENEW", data: { bundleId: BUNDLE } }, { anahtar: pem("sahte.key"), x5c: [der("sahte-kok.pem"), der("sahte-kok.pem"), der("sahte-kok.pem")] });
  r = await fetch(C.base + "/api/abonelik/apple-bildirim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signedPayload: sahte }) });
  assert.equal(r.status, 400);
});

test("Android: Google Play jetonu sunucuda sorgulanır; bekleyen ödeme, başka hesap ve bildirimler", async () => {
  const sk = OR.sakinA2, u = (await sk.get("/api/abonelik")).body.hesapUuid;
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "android", token: "yok" })).status, 400);
  GP.set("tok-baska", gAbone(crypto.randomUUID()));
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "android", token: "tok-baska" })).status, 409);
  GP.set("tok-bekle", { ...gAbone(u), subscriptionState: "SUBSCRIPTION_STATE_PENDING" });
  assert.equal((await sk.post("/api/abonelik/dogrula", { platform: "android", token: "tok-bekle" })).status, 202);
  GP.set("tok-1", gAbone(u));
  const r = await sk.post("/api/abonelik/dogrula", { platform: "android", token: "tok-1" });
  assert.equal(r.status, 200); assert.equal(r.body.abonelik.aktif, true); assert.equal(r.body.abonelik.kaynak, "google");
  // RTDN: yalnızca jeton gelir; durum Google'dan yeniden okunur
  const rtdn = (anahtar, token) => fetch(C.base + "/api/abonelik/google-bildirim?anahtar=" + anahtar, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ subscriptionNotification: { notificationType: 13, purchaseToken: token } })).toString("base64") } }) });
  GP.set("tok-1", gAbone(u, "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", 2));
  assert.equal((await rtdn("pubsub_gizli", "tok-1")).status, 200);
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, true); assert.equal(sk.me.abonelik.durum, "odeme_sorunu");
  GP.set("tok-1", gAbone(u, "SUBSCRIPTION_STATE_EXPIRED", -1));
  await rtdn("pubsub_gizli", "tok-1");
  await sk.yenile(); assert.equal(sk.me.abonelik.aktif, false);
  const n = gCagri;
  assert.equal((await rtdn("yanlis", "tok-1")).status, 401); assert.equal(gCagri, n, "yanlış anahtarla Google sorgulanmaz");
});

test("Mağaza yapılandırılmamışsa satın alma kapalı (503), uygulama ücretsiz çalışır", async () => {
  const D = await sunucuBaslat();
  try {
    const u = await new Istemci(D).giris(tel());
    assert.equal(u.me.abonelik.magazaHazir, false);
    assert.equal((await u.post("/api/abonelik/dogrula", { platform: "ios", jws: "a.b.c" })).status, 503);
    assert.equal((await u.post("/api/abonelik/dogrula", { platform: "android", token: "x" })).status, 503);
  } finally { await D.kapat(); }
});

test("Hesap silme aboneliği de siler ve mağaza iptal notu verir", async () => {
  const u = await new Istemci(C).giris(tel());
  const id = (await u.get("/api/abonelik")).body.hesapUuid;
  await u.post("/api/abonelik/dogrula", { platform: "ios", jws: jws(islem(id)) });
  const s = await u.del("/api/hesap", { onay: true });
  assert.equal(s.status, 200); assert.match(s.body.not, /App Store ya da Google Play/);
  assert.equal(C.db.prepare("SELECT COUNT(*) n FROM users WHERE abone_id = ?").get(id).n, 0);
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
