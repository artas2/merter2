"use strict";
/* Turnuvada Satranç ve Tavla: canlı, süreli, sunucu yetkili. Hamle doğrulama, sıra, saat, teslim, süre aşımı, beraberlikte yeniden oyun,
   Mavi Öz, şampiyonluk. Zaman saat.kayma ile ilerletilir. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { sunucuBaslat, ortam } = require("./yardimci");
const S = require("../src/satranc");

let C, O, SID;
const simdi = () => Date.now() + C.saat.kayma;
const git = ms => { C.saat.kayma = ms - Date.now(); };
const db = (k, op, yol, veri) => k.post("/api/db", { op, yol, veri });
async function profil(k, ad, blok) { assert.equal((await db(k, "set", "sakinler/" + k.me.aktifSite.kimlik, { ad, blok, kat: 1, daire: "1", durum: "Malik" })).status, 200); C.app.ortak.profilUnut(k.me.aktifSite.id, k.me.user.id); }
const uid = k => k.me.user.id;
const hamle = (k, id, g) => k.post(`/api/arena/oyun/${id}/hamle`, g);

test.before(async () => {
  C = await sunucuBaslat({ config: { arenaTick: false } });
  O = await ortam(C); SID = O.siteA.id;
  await profil(O.sakinA1, "Ayşe Yılmaz", "C"); await profil(O.sakinA2, "Ali Kaya", "A");
  await O.admin.patch(`/api/platform/siteler/${SID}`, { odemeModeli: "site" });
});
test.after(() => C.kapat());

/* İki kişilik turnuva kurar, kuradan sonra maçı başlatır; { tid, oyunId } döner */
async function turnuvaBaslat(oyun, ad) {
  const bas = simdi() + 20 * 60000;
  const r = await O.yonA.post("/api/arena/turnuvalar", { ad, baslangic: bas, turAraligiDk: 10, maxKisi: 2, oyun }); assert.equal(r.status, 200, JSON.stringify(r.body));
  const tid = r.body.id;
  for (const k of [O.sakinA1, O.sakinA2]) assert.equal((await k.post(`/api/arena/turnuva/${tid}/katil`, {})).status, 200);
  git(bas - 4 * 60000);
  let d = (await O.sakinA1.get(`/api/arena/turnuva/${tid}`)).body; assert.equal(d.turnuva.oyun, oyun);
  const m = d.maclar[0]; assert.equal(m.durum, "bekle");
  for (const k of [O.sakinA1, O.sakinA2]) await k.post(`/api/arena/turnuva/${tid}/mac/${m.id}/hazir`, {});
  git(bas + 1000);
  d = (await O.sakinA1.get(`/api/arena/turnuva/${tid}`)).body;
  const oyunId = d.maclar[0].macId; assert.ok(oyunId && oyunId[0] === "o", "oyun kimliği");
  git(bas + 5000); // 3 sn geri sayım geçti
  return { tid, oyunId, bas };
}
async function renkler(id) {
  const a = (await O.sakinA1.get(`/api/arena/oyun/${id}`)).body, b = (await O.sakinA2.get(`/api/arena/oyun/${id}`)).body;
  assert.notEqual(a.ben, b.ben); return a.ben === "b" ? { beyaz: O.sakinA1, siyah: O.sakinA2 } : { beyaz: O.sakinA2, siyah: O.sakinA1 };
}
const turnuva = async tid => (await O.sakinA1.get(`/api/arena/turnuva/${tid}`)).body;
const oz = async k => (await k.get("/api/arena/kimlik")).body.istatistik.maviOz;

test("Satranç turnuvası: kısa mat; yetkisiz ve yasa dışı hamleler; şampiyon, Mavi Öz", async () => {
  const oz1 = [await oz(O.sakinA1), await oz(O.sakinA2)];
  const tl = (await O.sakinA1.get("/api/arena/turnuvalar")).body; assert.deepEqual(tl.oyunlar.map(x => x[0]), ["bilgi", "satranc", "tavla"]);
  assert.equal((await O.yonA.post("/api/arena/turnuvalar", { ad: "x", baslangic: simdi() + 20 * 60000, turAraligiDk: 10, maxKisi: 2, oyun: "okey" })).status, 400, "desteklenmeyen oyun");
  const { tid, oyunId } = await turnuvaBaslat("satranc", "Satranç Kupası");
  const R = await renkler(oyunId);
  assert.equal((await O.denetciA.get(`/api/arena/oyun/${oyunId}`)).status, 404, "oyuncu olmayan göremez");
  let g = (await R.beyaz.get(`/api/arena/oyun/${oyunId}`)).body;
  assert.equal(g.oyun, "satranc"); assert.equal(g.sira, "b");
  assert.ok(g.durum.hedefler.e2.includes("e4"), "sırası gelene yasal hedefler"); assert.deepEqual((await R.siyah.get(`/api/arena/oyun/${oyunId}`)).body.durum.hedefler, {}, "sırası olmayana verilmez");
  assert.equal((await hamle(R.siyah, oyunId, { k: "e7", h: "e5" })).status, 409, "sıra beyazda");
  assert.equal((await hamle(R.beyaz, oyunId, { k: "e2", h: "e5" })).status, 400, "yasa dışı hamle");
  assert.equal((await hamle(O.denetciA, oyunId, { k: "e2", h: "e4" })).status, 404);
  assert.equal((await hamle(R.beyaz, oyunId, { k: "f2", h: "f3" })).status, 200);
  const sg = (await hamle(R.siyah, oyunId, { k: "e7", h: "e5" })).body; assert.equal(sg.sira, "b"); assert.equal(sg.sonHamle, "e7e5");
  assert.ok(sg.sureler.b > 0 && sg.sureler.s > 0 && sg.artisMs === 3000);
  await hamle(R.beyaz, oyunId, { k: "g2", h: "g4" });
  // uzun yoklama: rakibin hamlesiyle uyanır
  const lp = R.beyaz.get(`/api/arena/oyun/${oyunId}?ver=${(await R.beyaz.get(`/api/arena/oyun/${oyunId}`)).body.ver}`); const t0 = Date.now();
  const son = (await hamle(R.siyah, oyunId, { k: "d8", h: "h4" })).body;
  const lr = (await lp).body; assert.ok(Date.now() - t0 < 3000); assert.equal(lr.bitti, true);
  assert.equal(son.bitti, true); assert.equal(son.sonuc, "ben"); assert.equal(son.neden, "şah mat");
  assert.equal((await hamle(R.beyaz, oyunId, { k: "a2", h: "a3" })).status, 409, "bitti");
  const d = await turnuva(tid); assert.equal(d.turnuva.durum, "bitti");
  assert.equal(d.turnuva.sampiyon.ad, (await R.siyah.get(`/api/arena/oyun/${oyunId}`)).body.siyah.ad, "mat eden şampiyon");
  // Mavi Öz: kazanan 30+10, kaybeden 15+10, şampiyonluk +100
  const oz2 = [await oz(O.sakinA1), await oz(O.sakinA2)], kaz = R.siyah === O.sakinA1 ? 0 : 1;
  assert.equal(oz2[kaz] - oz1[kaz], 40 + 100); assert.equal(oz2[1 - kaz] - oz1[1 - kaz], 25);
  const k = (await R.siyah.get("/api/arena/kimlik")).body; assert.equal(k.katalog.find(x => x.kod === "s-tac").var, true);
});

test("Satranç: teslim ve süre aşımı (saat sırası gelende işler)", async () => {
  let { tid, oyunId } = await turnuvaBaslat("satranc", "Teslim Kupası");
  let R = await renkler(oyunId);
  await hamle(R.beyaz, oyunId, { k: "e2", h: "e4" });
  const t = (await R.siyah.post(`/api/arena/oyun/${oyunId}/teslim`, {})).body; assert.equal(t.bitti, true); assert.equal(t.sonuc, "rakip", "teslim eden kaybeder"); assert.equal(t.neden, "teslim oldu");
  assert.equal((await turnuva(tid)).turnuva.sampiyon.ad, (await R.beyaz.get(`/api/arena/oyun/${oyunId}`)).body.beyaz.ad, "teslim olanın rakibi kazanır");
  // süre aşımı: beyaz hamle yapmaz
  ({ tid, oyunId } = await turnuvaBaslat("satranc", "Süre Kupası")); R = await renkler(oyunId);
  await hamle(R.beyaz, oyunId, { k: "e2", h: "e4" });
  git(simdi() + 5 * 60000 + 10000); // siyahın 5 dakikası doldu
  const g = (await R.beyaz.get(`/api/arena/oyun/${oyunId}`)).body;
  assert.equal(g.bitti, true); assert.equal(g.neden, "süre doldu"); assert.equal(g.sonuc, "ben", "süresi dolan siyah kaybeder");
  assert.equal((await turnuva(tid)).turnuva.durum, "bitti");
});

test("Satranç: turnuvada beraberlik olmaz; renk değiştirerek yeniden oynanır, sonunda saat belirler", async () => {
  const { tid, oyunId } = await turnuvaBaslat("satranc", "Beraberlik Kupası");
  let id = oyunId;
  const patKur = async id => { // sırası gelen beyaz, tek hamleyle pat yapabilir
    const r = C.db.prepare("SELECT * FROM oyun_maclar WHERE id = ?").get(id);
    C.db.prepare("UPDATE oyun_maclar SET durum = ? WHERE id = ?").run(JSON.stringify({ o: S.fenOku("7k/8/5QK1/8/8/8/8/8 w - - 0 1"), h: [] }), id);
    return r;
  };
  for (let i = 0; i < 3; i++) {
    const R = await renkler(id); await patKur(id);
    const g = (await hamle(R.beyaz, id, { k: "f6", h: "f7" })).body;
    assert.equal(g.bitti, true);
    if (i < 2) {
      assert.equal(g.sonuc, "berabere"); assert.equal(g.yenidenOyun, true); assert.equal(g.neden, "pat");
      const yeni = (await turnuva(tid)).maclar[0].macId; assert.notEqual(yeni, id, "yeni oyun"); assert.equal((await turnuva(tid)).turnuva.durum, "oynaniyor");
      const Y = await renkler(yeni); assert.equal(Y.beyaz, R.siyah, "renkler değişir");
      git(simdi() + 5000); id = yeni;
      C.db.prepare("UPDATE oyun_maclar SET son = ? WHERE id = ?").run(simdi() - 10, id);
    }
  }
  const d = await turnuva(tid); assert.equal(d.turnuva.durum, "bitti"); assert.ok(d.turnuva.sampiyon, "son beraberlikte saat belirler");
  assert.match(C.db.prepare("SELECT neden FROM oyun_maclar WHERE id = ?").get(id).neden, /saatte fazla süresi kalan/);
});

test("Tavla turnuvası: zarı sunucu atar, yalnızca yasal hamle; oyun toplamayla biter", { timeout: 120000 }, async () => {
  const { tid, oyunId } = await turnuvaBaslat("tavla", "Tavla Kupası");
  const R = { b: null, s: null }; const a = (await O.sakinA1.get(`/api/arena/oyun/${oyunId}`)).body; R[a.ben] = O.sakinA1; R[a.ben === "b" ? "s" : "b"] = O.sakinA2;
  let g = a.ben === "b" ? a : (await R.b.get(`/api/arena/oyun/${oyunId}`)).body;
  assert.equal(g.oyun, "tavla"); assert.equal(g.durum.pts.filter(x => x > 0).reduce((p, x) => p + x, 0), 15); assert.equal(g.durum.zar.length, 2); assert.notEqual(g.durum.zar[0], g.durum.zar[1], "açılış atışı");
  const ilk = g.sira; assert.equal((await hamle(R[ilk === "b" ? "s" : "b"], oyunId, { k: 0, h: 1 })).status, 409, "sıra karşıda");
  assert.equal((await hamle(R[ilk], oyunId, { k: 5, h: 5 })).status, 400, "yasa dışı hamle");
  assert.equal((await hamle(R[ilk], oyunId, { k: "x", h: 1 })).status, 400);
  let n = 0;
  for (; n < 1500 && !g.bitti; n++) {
    const kim = R[g.sira], gv = (await kim.get(`/api/arena/oyun/${oyunId}`)).body; g = gv;
    const k = Object.keys(gv.durum.hedefler)[0]; assert.ok(k !== undefined, "sırası gelenin yasal hamlesi var");
    const h = gv.durum.hedefler[k][0], r = await hamle(kim, oyunId, { k: k === "bar" ? "bar" : Number(k), h }); assert.equal(r.status, 200, JSON.stringify(r.body)); g = r.body;
    assert.ok(g.sureler.b > 0 && g.sureler.s > 0);
    if (n % 20 === 0) git(simdi() + 4000);
  }
  assert.equal(g.bitti, true, "oyun " + n + " hamlede bitti"); assert.equal(g.neden, "tüm pulları topladı");
  const kazRenk = g.durum.off.b === 15 ? "b" : "s"; assert.equal(g.durum.off[kazRenk], 15);
  const d = await turnuva(tid); assert.equal(d.turnuva.durum, "bitti");
  assert.equal(d.turnuva.sampiyon.ad, kazRenk === "b" ? g.beyaz.ad : g.siyah.ad);
});
