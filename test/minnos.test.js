"use strict";
/* Minnoş sunucu bileşeni: Anthropic Messages API bağlantısı (sahte sunucuyla), Premium kapısı, günlük sınır, Bekçi süzgeci,
   gizlilik (maskeleme, anahtarın istemciye gitmemesi), hata durumunda "yok" cevabı. */
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { sunucuBaslat, ortam } = require("./yardimci");

let sahte, istekler = [], mod = "ok", C, O, SID;
test.before(async () => {
  sahte = http.createServer((req, res) => {
    let g = ""; req.on("data", d => { g += d; }); req.on("end", () => {
      istekler.push({ basliklar: req.headers, govde: JSON.parse(g || "{}"), yol: req.url });
      if (mod === "hata") { res.writeHead(500); return res.end("{}"); }
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ content: [{ type: "text", text: "Mırr! Cevap geldi komşum." }] }));
    });
  });
  await new Promise(r => sahte.listen(0, "127.0.0.1", r));
  C = await sunucuBaslat({ config: { arenaTick: false, minnos: { anahtar: "test-anahtar-123", apiTaban: `http://127.0.0.1:${sahte.address().port}`, model: "claude-haiku-5-5" } } });
  O = await ortam(C); SID = O.siteA.id;
});
test.after(async () => { await C.kapat(); await new Promise(r => sahte.close(r)); });

test("Premium değilse yapay zekâ çağrılmaz; kapı açılınca çağrılır ve istek biçimi doğrudur", async () => {
  let r = await O.sakinA1.post("/api/minnos/sor", { soru: "Duvar kâğıdı nasıl yapılır?" }); assert.deepEqual(r.body, { kaynak: "yok", neden: "premium" }); assert.equal(istekler.length, 0);
  assert.equal((await O.sakinA1.get("/api/minnos/bilgi")).body.premium, false);
  await O.admin.patch(`/api/platform/siteler/${SID}`, { odemeModeli: "site" });
  r = await O.sakinA1.post("/api/minnos/sor", { soru: "Hizmetlerde neler var? Tel 0532 111 22 33, mail ali@ornek.com" });
  assert.equal(r.status, 200); assert.equal(r.body.kaynak, "yapay-zeka"); assert.match(r.body.cevap, /Cevap geldi/); assert.ok(r.body.kalan <= 24);
  const i = istekler[0]; assert.equal(i.yol, "/v1/messages"); assert.equal(i.basliklar["x-api-key"], "test-anahtar-123"); assert.equal(i.basliklar["anthropic-version"], "2023-06-01");
  assert.equal(i.govde.model, "claude-haiku-5-5"); assert.ok(i.govde.max_tokens <= 500); assert.match(i.govde.system, /Minnoş/); assert.match(i.govde.system, /dişi bir sokak kedisi/);
  assert.equal(i.govde.messages.length, 1); assert.equal(i.govde.messages[0].role, "user");
  assert.doesNotMatch(i.govde.messages[0].content, /0532|ali@ornek/, "kişisel bilgi servise gitmeden maskelenir"); assert.match(i.govde.messages[0].content, /gizlendi/);
  assert.doesNotMatch(JSON.stringify(r.body), /test-anahtar/, "anahtar istemciye gitmez");
});

test("Bekçi süzgeci: küfürlü soru servise gitmez; boş ve uzun soru reddedilir; geçersiz oturum yok", async () => {
  const once = istekler.length;
  const r = await O.sakinA1.post("/api/minnos/sor", { soru: "siktir git sen" }); assert.equal(r.body.kaynak, "engel"); assert.equal(istekler.length, once);
  assert.equal((await O.sakinA1.post("/api/minnos/sor", { soru: "   " })).status, 400);
  assert.equal((await O.sakinA1.post("/api/minnos/sor", { soru: "a".repeat(301) })).status, 400);
});

test("Kahve falı: 1–3 sembol gerekir; konu ve semboller isteğe girer; fal uyarısı sistem komutundadır", async () => {
  assert.equal((await O.sakinA1.post("/api/minnos/fal", { konu: "ask", semboller: [] })).status, 400);
  assert.equal((await O.sakinA1.post("/api/minnos/fal", { konu: "ask", semboller: ["yok-boyle-sembol"] })).status, 400);
  const r = await O.sakinA2.post("/api/minnos/fal", { konu: "para", semboller: ["kus", "yol", "yuzuk", "ay", "kus"], niyet: "yeni iş başvurusu" });
  assert.equal(r.body.kaynak, "yapay-zeka"); const i = istekler[istekler.length - 1].govde;
  assert.match(i.messages[0].content, /para ve bereket/); assert.match(i.messages[0].content, /kuş, yol, yüzük/); assert.doesNotMatch(i.messages[0].content, /\bay\b.*\bay\b/, "en çok 3 sembol, tekrarsız");
  assert.match(i.system, /eğlence/); assert.match(i.system, /Ölüm, hastalık/); assert.match(i.messages[0].content, /yeni iş başvurusu/);
});

test("Servis hata verirse { kaynak: yok, neden: hata }; günlük sınır dolunca { limit }", async () => {
  let r = await O.sakinB1.post("/api/minnos/sor", { soru: "Merhaba" }); assert.equal(r.body.neden, "premium", "ayrı sitede Premium yok");
  mod = "hata"; r = await O.sakinA2.post("/api/minnos/sor", { soru: "Arena nedir?" }); assert.deepEqual(r.body, { kaynak: "yok", neden: "hata" });
  mod = "ok";
  const MN = C.app.minnos; const hepsi = [];
  for (let i = 0; i < 30; i++) { C.saat.kayma += 1000; hepsi.push((await MN.sor(SID, O.yonA.me.user.id, true, "Soru " + i)).kaynak); }
  assert.equal(hepsi.filter(x => x === "yapay-zeka").length, 25); assert.equal((await MN.sor(SID, O.yonA.me.user.id, true, "bir tane daha")).neden, "limit");
  assert.equal((await MN.sor(SID, O.yonA.me.user.id, true, "bir tane daha")).kaynak, "yok");
  C.saat.kayma += 24 * 3600e3; assert.equal((await MN.sor(SID, O.yonA.me.user.id, true, "yeni gün")).kaynak, "yapay-zeka", "ertesi gün sayaç sıfırlanır");
});

test("Anahtar yoksa servis kapalı döner (istemci hazır cevaplara geçer)", async () => {
  const c2 = await sunucuBaslat({ config: { arenaTick: false } }); const o2 = await ortam(c2);
  await o2.admin.patch(`/api/platform/siteler/${o2.siteA.id}`, { odemeModeli: "site" });
  assert.deepEqual((await o2.sakinA1.post("/api/minnos/sor", { soru: "Merhaba" })).body, { kaynak: "yok", neden: "kapali" });
  assert.equal((await o2.sakinA1.get("/api/minnos/bilgi")).body.yapayZeka, false); await c2.kapat();
});
