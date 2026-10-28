"use strict";
/* Belge deposu: artifact'teki 22 erişim kuralının sunucuda aynen uygulandığını doğrular. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { sunucuBaslat, Istemci, ortam } = require("./yardimci");
const { kuralBul, birlestir } = require("../src/belgeler");

let C, O;
test.before(async () => { C = await sunucuBaslat({ config: { akisBekleMs: 300 } }); O = await ortam(C); });
test.after(() => C.kapat());
const db = (k, op, yol, veri) => k.post("/api/db", { op, yol, veri });
const uid = k => k.me.aktifSite.kimlik;

test("kural çözümü: {self}, varsayılan, data/users", () => {
  assert.deepEqual(kuralBul(["sakinler", "u1"], "u1"), { read: "interact", write: "interact" });
  assert.deepEqual(kuralBul(["sakinler", "u2"], "u1"), { path: "sakinler", read: "admin", write: "admin" });
  assert.deepEqual(kuralBul(["bilinmeyen", "x"], "u1"), { read: "view", write: "interact" });
  assert.deepEqual(kuralBul(["data", "users", "u2", "kart"], "u1"), { read: "yok", write: "yok" });
  assert.deepEqual(birlestir({ a: { b: 1, c: 2 }, d: [1] }, { a: { c: 3 }, d: [2], __proto__: { x: 1 } }), { a: { b: 1, c: 3 }, d: [2] });
});

test("kimlik: sitede kalıcı, siteler arasında farklı", async () => {
  assert.match(uid(O.sakinA1), /^u[0-9a-f]{20}$/);
  assert.notEqual(uid(O.sakinA1), uid(O.sakinA2));
  await O.sakinA1.yenile(); assert.equal(O.sakinA1.me.aktifSite.kimlik, uid(O.sakinA1));
});

test("sakinler: herkes kendi belgesini yazar; başkasınınkini okuyamaz; yönetici hepsini görür", async () => {
  const a1 = O.sakinA1, a2 = O.sakinA2;
  assert.equal((await db(a1, "set", "sakinler/" + uid(a1), { ad: "Ayşe", blok: "C" })).status, 200);
  assert.equal((await db(a2, "set", "sakinler/" + uid(a2), { ad: "Ali", blok: "A" })).status, 200);
  assert.equal((await db(a1, "get", "sakinler/" + uid(a2))).status, 403);
  assert.equal((await db(a1, "set", "sakinler/" + uid(a2), { ad: "x" })).status, 403);
  assert.equal((await db(a1, "delete", "sakinler/" + uid(a2))).status, 403);
  const l1 = await db(a1, "koleksiyon", "sakinler");
  assert.deepEqual(l1.body.belgeler.map(b => b.id), [uid(a1)], "sakin yalnızca kendini listeler");
  const ly = await db(O.yonA, "koleksiyon", "sakinler");
  assert.deepEqual(ly.body.belgeler.map(b => b.id).sort(), [uid(a1), uid(a2)].sort());
  // Başka site göremez
  assert.deepEqual((await db(O.yonB, "koleksiyon", "sakinler")).body.belgeler, []);
  assert.equal((await db(O.yonB, "get", "sakinler/" + uid(a1))).body.var, false);
});

test("ayarlar: herkes okur, yalnızca yönetici yazar; denetçi yazamaz", async () => {
  assert.equal((await db(O.yonA, "set", "ayarlar/site", { siteAdi: "Merter Çınar Evleri" })).status, 200);
  assert.equal((await db(O.sakinA1, "get", "ayarlar/site")).body.veri.siteAdi, "Merter Çınar Evleri");
  assert.equal((await db(O.sakinA1, "set", "ayarlar/site", { siteAdi: "x" })).status, 403);
  assert.equal((await db(O.denetciA, "update", "ayarlar/site", { siteAdi: "x" })).status, 403);
});

test("gönderiler, beğeniler, yorumlar: herkes okur, yalnızca kendininkini yazar; yönetici siler", async () => {
  const a1 = O.sakinA1, a2 = O.sakinA2;
  await db(a1, "set", "gonderiler/" + uid(a1), { items: { p1: { metin: "Merhaba" } } });
  assert.equal((await db(a2, "get", "gonderiler/" + uid(a1))).body.veri.items.p1.metin, "Merhaba");
  assert.equal((await db(a2, "update", "gonderiler/" + uid(a1), { items: { p1: { metin: "değişti" } } })).status, 403);
  assert.equal((await db(O.yonA, "update", "gonderiler/" + uid(a1), { items: { p1: { gizli: true } } })).status, 200, "yönetici gizleyebilir");
  const g = (await db(a1, "get", "gonderiler/" + uid(a1))).body.veri;
  assert.deepEqual(g.items.p1, { metin: "Merhaba", gizli: true }, "update iç içe birleşir");
});

test("data/users: yalnızca sahibi; yönetici dahil kimse okuyamaz", async () => {
  const yol = `data/users/${uid(O.sakinA1)}/kart`;
  assert.equal((await db(O.sakinA1, "set", yol, { scores: { Y01: 5 } })).status, 200);
  assert.equal((await db(O.yonA, "get", yol)).status, 403);
  assert.equal((await db(O.sakinA2, "set", yol, { scores: {} })).status, 403);
  assert.deepEqual((await db(O.sakinA1, "get", yol)).body.veri, { scores: { Y01: 5 } });
});

test("lisans/site: sanal, Premium durumunu yansıtır, kimse yazamaz", async () => {
  assert.deepEqual((await db(O.sakinA1, "get", "lisans/site")).body, { var: true, veri: { premium: false } });
  assert.equal((await db(O.yonA, "set", "lisans/site", { premium: true })).status, 403, "yönetici kendine Premium açamaz");
  await O.admin.patch(`/api/platform/siteler/${O.siteA.id}`, { odemeModeli: "site" });
  assert.equal((await db(O.sakinA1, "get", "lisans/site")).body.veri.premium, true, "site öder → Premium");
  assert.deepEqual((await db(O.sakinA1, "koleksiyon", "lisans")).body.belgeler, [{ id: "site", veri: { premium: true } }]);
  await O.admin.patch(`/api/platform/siteler/${O.siteA.id}`, { odemeModeli: "sakin" });
});

test("geçersiz yollar ve gövdeler reddedilir", async () => {
  for (const y of ["", "a", "a/b/c", "../x/y", "a b/c", "a/" + "x".repeat(90)]) assert.equal((await db(O.sakinA1, "get", y)).status, 400, y);
  assert.equal((await db(O.sakinA1, "set", "katilim/" + uid(O.sakinA1), [1, 2])).status, 400);
  assert.equal((await db(O.sakinA1, "set", "katilim/" + uid(O.sakinA1), { a: "x".repeat(530 * 1024) })).status, 413);
  assert.equal((await db(O.sakinA1, "update", "katilim/" + uid(O.sakinA1) + "yok", { a: 1 })).status, 403);
  assert.equal((await db(O.sakinA1, "update", "katilim/" + uid(O.sakinA1), { a: 1 })).status, 404, "olmayan belge güncellenemez");
  assert.equal((await db(O.sakinA1, "yok", "katilim/x")).status, 400);
});

test("değişiklik akışı: yazınca bekleyen istemci uyanır; okuyamadığı yollar bildirilmez", async () => {
  const ilk = (await O.sakinA2.get("/api/db/akis")).body.sira;
  const bekle = O.sakinA2.get("/api/db/akis?sonra=" + ilk);
  await new Promise(r => setTimeout(r, 50));
  await db(O.sakinA1, "set", "sakinler/" + uid(O.sakinA1), { ad: "Ayşe 2" });
  await db(O.sakinA1, "set", "katilim/" + uid(O.sakinA1), { e1: true });
  const r = (await bekle).body;
  assert.ok(r.sira > ilk);
  const r2 = (await O.sakinA2.get("/api/db/akis?sonra=" + ilk)).body;
  assert.ok(r2.yollar.includes("katilim/" + uid(O.sakinA1)));
  assert.ok(!r2.yollar.includes("sakinler/" + uid(O.sakinA1)), "başkasının sakin kaydı akışta görünmez");
  const bos = (await O.sakinB1.get("/api/db/akis?sonra=0")).body;
  assert.ok(!bos.yollar.some(y => y.includes(uid(O.sakinA1))), "başka site görmez");
});

test("fotoğraf: yükle, bağlantıyla görüntüle, sahibi siler; tür denetimi", async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString("base64");
  const y = await O.sakinA1.post("/api/varlik", { tip: "image/jpeg", veri: jpeg });
  assert.equal(y.status, 200); assert.match(y.body.id, /^[0-9a-f]{32}$/);
  const g = await fetch(C.base + y.body.url); assert.equal(g.status, 200); assert.equal(g.headers.get("content-type"), "image/jpeg");
  assert.equal((await g.arrayBuffer()).byteLength, 204);
  assert.equal((await O.sakinA1.post("/api/varlik", { tip: "image/png", veri: jpeg })).status, 415, "içerik türüyle uyuşmalı");
  assert.equal((await O.sakinA1.post("/api/varlik", { tip: "text/html", veri: jpeg })).status, 415);
  await O.sakinA2.del("/api/varlik/" + y.body.id); assert.equal((await fetch(C.base + y.body.url)).status, 200, "başkası silemez");
  await O.sakinA1.del("/api/varlik/" + y.body.id); assert.equal((await fetch(C.base + y.body.url)).status, 404);
});

test("siteden çıkarılan sakinin belgeleri ve fotoğrafları silinir", async () => {
  const k = await new Istemci(C).giris("0501" + String(Date.now()).slice(-7)); await k.katil(O.davetA);
  const u = k.me.aktifSite.kimlik;
  await db(k, "set", "sakinler/" + u, { ad: "Geçici" }); await db(k, "set", `data/users/${u}/kart`, { a: 1 });
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(10)]).toString("base64");
  const f = (await k.post("/api/varlik", { tip: "image/jpeg", veri: jpeg })).body;
  const uyeId = (await O.yonA.get("/api/yonetim/uyeler")).body.uyeler.find(x => x.telefon === k.me.user.telefon).userId;
  assert.equal((await O.yonA.del("/api/yonetim/uyeler/" + uyeId)).status, 200);
  assert.equal((await db(O.yonA, "get", "sakinler/" + u)).body.var, false);
  assert.equal((await fetch(C.base + f.url)).status, 404);
});

test("hesap silinince tüm sitelerdeki belgeler silinir", async () => {
  const k = await new Istemci(C).giris("0502" + String(Date.now()).slice(-7)); await k.katil(O.davetA);
  const u = k.me.aktifSite.kimlik;
  await db(k, "set", "gonderiler/" + u, { items: { a: { metin: "x" } } });
  assert.equal((await k.del("/api/hesap", { onay: true })).status, 200);
  assert.equal((await db(O.sakinA1, "get", "gonderiler/" + u)).body.var, false);
});

test("askıdaki sitede okuma serbest, yazma kapalı", async () => {
  await O.admin.patch(`/api/platform/siteler/${O.siteB.id}`, { durum: "askida" });
  assert.equal((await db(O.sakinB1, "get", "ayarlar/site")).status, 200);
  assert.equal((await db(O.sakinB1, "set", "katilim/" + uid(O.sakinB1), { a: 1 })).status, 403);
  await O.admin.patch(`/api/platform/siteler/${O.siteB.id}`, { durum: "aktif" });
});
