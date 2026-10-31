"use strict";
/* Eşleşme akışı (arama süre sınırı, 10 sn onay, yanıt vermeyince en yakın sıradaki rakip) ve
   arena kimliği (simge, çerçeve, sembol, unvan): ödülü yalnızca sunucu verir, seçim yalnızca sahip olunanlardan. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { sunucuBaslat, ortam } = require("./yardimci");
const { KART_ID, KARTLAR } = require("../src/kartlar");
const { KATALOG } = require("../src/kazanim");

let C, O, SID;
const ileri = ms => { C.saat.kayma += ms; };
const db = (k, op, yol, veri) => k.post("/api/db", { op, yol, veri });
async function profil(k, ad, blok) { assert.equal((await db(k, "set", "sakinler/" + k.me.aktifSite.kimlik, { ad, blok, kat: 1, daire: "1", durum: "Malik" })).status, 200); C.app.ortak.profilUnut(k.me.aktifSite.id, k.me.user.id); }
const dogruSecim = (macId, no) => { const m = C.db.prepare("SELECT sorular FROM maclar WHERE id = ?").get(macId); const s = JSON.parse(m.sorular)[no]; return s.perm.indexOf(KART_ID.get(s.id).d); };
const macSatir = id => C.db.prepare("SELECT * FROM maclar WHERE id = ?").get(id);
const uid = k => k.me.user.id;
function puanYaz(k, puan) {
  const s = C.app.arena.sezonAl(SID);
  C.db.prepare("INSERT INTO sezon_puan (sezon_id, user_id, site_id, blok, ad, puan) VALUES (?, ?, ?, '', '', ?) ON CONFLICT (sezon_id, user_id) DO UPDATE SET puan = excluded.puan").run(s.id, uid(k), SID, puan);
}
const iptalHepsi = async () => { for (const k of [O.sakinA1, O.sakinA2, O.denetciA, O.yonA]) await k.del("/api/arena/esles"); };

test.before(async () => {
  C = await sunucuBaslat({ config: { arenaTick: false } });
  O = await ortam(C); SID = O.siteA.id;
  await profil(O.sakinA1, "Ayşe Yılmaz", "C"); await profil(O.sakinA2, "Ali Kaya", "A"); await profil(O.denetciA, "Deniz Er", "C"); await profil(O.yonA, "Yusuf Ak", "B");
  await O.admin.patch(`/api/platform/siteler/${SID}`, { odemeModeli: "site" });
});
test.after(() => C.kapat());
test.afterEach(() => { C.saat.kayma = 0; });

test("Rakip arama süre sınırı: 60 sn içinde rakip yoksa arama biter", async () => {
  const r = (await O.sakinA1.post("/api/arena/esles", {})).body;
  assert.equal(r.durum, "bekliyor"); assert.equal(r.bitis - r.bas, 60000); assert.ok(r.cevrimici >= 1);
  ileri(30000); assert.equal((await O.sakinA1.post("/api/arena/esles", {})).body.durum, "bekliyor", "tekrar basmak süreyi sıfırlamaz");
  assert.equal((await O.sakinA1.get("/api/arena/esles")).body.bitis, r.bitis);
  ileri(31000);
  const s = (await O.sakinA1.get("/api/arena/esles")).body; assert.equal(s.durum, "sure"); assert.equal(s.sureMs, 60000);
  assert.equal((await O.sakinA1.get("/api/arena/esles")).body.durum, "yok", "kuyruktan çıkarıldı");
  // Süresi dolan biri eşleşmeye aday olmaz
  await O.sakinA2.post("/api/arena/esles", {}); ileri(61000);
  assert.equal((await O.sakinA1.post("/api/arena/esles", {})).body.durum, "bekliyor");
  await iptalHepsi();
});

test("10 sn onay: yanıt vermeyen düşer, kabul eden puanı en yakın sıradaki rakibe yönelir", async () => {
  puanYaz(O.sakinA1, 300); puanYaz(O.sakinA2, 280); puanYaz(O.denetciA, 0); puanYaz(O.yonA, 900);
  // Uyumlu iki kişi kuyrukta birlikte bekleyemez (hemen eşleşir); Deniz ile Yusuf birbirini engellemiş olsun ki ikisi de beklesin
  C.db.prepare("INSERT INTO engeller (site_id, user_id, engellenen) VALUES (?, ?, ?)").run(SID, uid(O.denetciA), uid(O.yonA));
  const ilk = (await O.denetciA.post("/api/arena/esles", {})).body; assert.equal(ilk.durum, "bekliyor", JSON.stringify(ilk));
  assert.equal((await O.yonA.post("/api/arena/esles", {})).body.durum, "bekliyor");
  assert.equal((await O.sakinA2.post("/api/arena/esles", {})).body.durum, "teklif", "280 puanlı Ali 0 puanlı Deniz ile eşleşir (900'e göre daha yakın)");
  const tA2 = (await O.sakinA2.get("/api/arena/esles")).body; assert.equal(tA2.rakip.ad, "Deniz E.");
  // Ayşe (300) gelince kuyrukta yalnız Yusuf (900) kalır
  const t1 = (await O.sakinA1.post("/api/arena/esles", {})).body;
  assert.equal(t1.durum, "teklif"); assert.equal(t1.rakip.ad, "Yusuf A."); assert.equal(t1.bitis - t1.simdi, 10000);
  assert.ok(t1.rakip.kimlik && t1.rakip.kimlik.simge, "teklif ekranında rakibin arena kimliği var");
  assert.equal(t1.rakip.puan, 900);
  // Deniz–Ali teklifi: Ali reddeder → Deniz kuyruğa döner (not: rakip yanıt vermedi)
  await O.denetciA.post("/api/arena/esles/kabul", { teklifId: tA2.teklifId });
  await O.sakinA2.del("/api/arena/esles");
  const dn = (await O.denetciA.get("/api/arena/esles")).body; assert.equal(dn.durum, "bekliyor"); assert.equal(dn.not, "rakipYanitlamadi");
  assert.ok(dn.bitis - dn.simdi >= 20000, "geri dönen için en az 20 sn arama süresi kalır");
  // Ayşe kabul eder, Yusuf 10 sn içinde yanıt vermez → Ayşe sıradaki en yakın rakibe (Deniz) yönelir
  const kb = (await O.sakinA1.post("/api/arena/esles/kabul", { teklifId: t1.teklifId })).body; assert.equal(kb.benKabul, true);
  const uzun = O.sakinA1.get("/api/arena/esles?bilinen=" + encodeURIComponent(`t:${t1.teklifId}:10`)); const t0 = Date.now();
  await new Promise(r => setTimeout(r, 200));
  ileri(10500);
  const t2 = (await uzun).body;
  assert.ok(Date.now() - t0 < 12000);
  assert.equal(t2.durum, "teklif", "kabul eden taraf hemen yeni teklife geçer"); assert.equal(t2.rakip.ad, "Deniz E."); assert.notEqual(t2.teklifId, t1.teklifId);
  const y = (await O.yonA.get("/api/arena/esles")).body; assert.equal(y.durum, "kacirdi", "yanıt vermeyen düşer");
  assert.equal((await O.yonA.get("/api/arena/esles")).body.durum, "yok");
  assert.equal((await O.yonA.post("/api/arena/esles/kabul", { teklifId: t1.teklifId })).status, 409, "süresi dolan teklif kabul edilemez");
  // Yusuf yeniden ararsa yanıtlamadığı Ayşe ile hemen eşleşmez (Ayşe zaten teklifte)
  assert.equal((await O.yonA.post("/api/arena/esles", {})).body.durum, "bekliyor");
  const dt = (await O.denetciA.get("/api/arena/esles")).body; assert.equal(dt.teklifId, t2.teklifId);
  await O.denetciA.post("/api/arena/esles/kabul", { teklifId: t2.teklifId });
  const m = (await O.sakinA1.post("/api/arena/esles/kabul", { teklifId: t2.teklifId })).body;
  assert.equal(m.durum, "mac"); assert.equal((await O.denetciA.get("/api/arena/esles")).body.macId, m.macId);
  const g = (await O.sakinA1.get("/api/arena/mac/" + m.macId)).body; assert.equal(g.rakip.ad, "Deniz E."); assert.ok(g.rakip.kimlik.cerceve);
  // maçı bitir (oynanmadan)
  const ms = macSatir(m.macId); ileri(ms.t0 - Date.now() + 5 * (ms.soru_ms + ms.ara_ms) + 2000);
  await O.sakinA1.get("/api/arena/mac/" + m.macId);
  await iptalHepsi();
  C.db.prepare("DELETE FROM engeller WHERE site_id = ?").run(SID);
});

test("Kimlik kataloğu: başlangıç ödülleri açık, sahip olunmayan seçilemez, en çok 3 sembol", async () => {
  const k = (await O.sakinA2.get("/api/arena/kimlik")).body;
  assert.equal(k.toplam, KATALOG.length);
  for (const t of ["simge", "cerceve", "sembol", "unvan"]) assert.ok(k.katalog.some(x => x.tur === t), t);
  assert.deepEqual(k.secim, { simge: "s-damla", cerceve: "c-sade", semboller: [], unvan: "u-komsu", ozGoster: false });
  assert.ok(k.katalog.find(x => x.kod === "s-damla").var); assert.equal(k.katalog.find(x => x.kod === "s-tac").var, false);
  assert.ok(k.katalog.every(x => x.kosul && x.ad && x.nadirlikAd));
  let r = await O.sakinA2.put("/api/arena/kimlik", { simge: "s-tac" }); assert.equal(r.status, 403);
  r = await O.sakinA2.put("/api/arena/kimlik", { simge: "c-altin" }); assert.equal(r.status, 400, "tür uyuşmazlığı");
  r = await O.sakinA2.put("/api/arena/kimlik", { semboller: ["y-ilk", "y-ilk"] }); assert.equal(r.status, 400);
  r = await O.sakinA2.put("/api/arena/kimlik", { semboller: ["a", "b", "c", "d"] }); assert.equal(r.status, 400);
});

test("Maç kazanınca ödül: sonuç ekranında yeni ödüller, seçilince sıralama ve maçta görünür", async () => {
  const a = O.sakinA1, b = O.sakinA2, AR = C.app.arena;
  const once = (await a.get("/api/arena/kimlik")).body.sahip;
  ileri(11000); // son rakip kuralı
  assert.equal(AR.esles(SID, uid(b)).durum, "bekliyor");
  assert.equal(AR.esles(SID, uid(a)).durum, "teklif"); AR.eslesKabul(SID, uid(a)); const id = AR.eslesKabul(SID, uid(b)).macId;
  const m = macSatir(id), d = m.soru_ms + m.ara_ms;
  for (let n = 0; n < 5; n++) { C.saat.kayma = 0; ileri(m.t0 - Date.now() + n * d + 1500); AR.macCevap(SID, uid(a), id, n, dogruSecim(id, n)); }
  C.saat.kayma = 0; ileri(m.t0 - Date.now() + 5 * d + 1500);
  const g = (await a.get("/api/arena/mac/" + id)).body;
  assert.equal(g.sonuc, "ben");
  for (const kod of ["s-hilal", "y-kusursuz", "s-simsek", "u-yildirim"]) assert.ok(g.yeniKazanimlar.includes(kod), kod);
  assert.equal((await b.get("/api/arena/mac/" + id)).body.yeniKazanimlar.includes("s-hilal"), false, "kaybeden galibiyet ödülü almaz");
  assert.equal((await a.get("/api/arena/mac/" + id)).body.yeniKazanimlar.length, g.yeniKazanimlar.length, "sonuç tekrar açılınca aynı liste");
  // Mavi Öz: kazanan 30, kaybeden 15; sonuç ekranında ve kimlikte
  assert.deepEqual(g.maviOz.kazanilan, 30); const bo = (await b.get("/api/arena/mac/" + id)).body.maviOz; assert.equal(bo.kazanilan, 15);
  assert.equal(g.maviOz.toplam, (await a.get("/api/arena/kimlik")).body.istatistik.maviOz);
  const k = (await a.get("/api/arena/kimlik")).body; assert.ok(k.sahip > once); assert.equal(k.istatistik.galibiyet, 1); assert.equal(k.istatistik.kusursuz, 1);
  const r = await a.put("/api/arena/kimlik", { simge: "s-simsek", unvan: "u-yildirim", semboller: ["y-kusursuz", "y-ilk"] });
  assert.equal(r.status, 200); assert.equal(r.body.simge, "s-simsek");
  const sr = (await b.get("/api/arena/siralama")).body.top.find(x => x.ad === "Ayşe Y.");
  assert.equal(sr.kimlik.simge, "s-simsek"); assert.equal(sr.kimlik.unvanAd, "Yıldırım"); assert.equal(sr.kimlik.semboller.length, 2);
  const gb = (await b.get("/api/arena/mac/" + id)).body; assert.equal(gb.rakip.kimlik.simge, "s-simsek");
  assert.equal("user_id" in sr.kimlik, false);
  // Mavi Öz başkalarına yalnızca "profilimde göster" açıksa görünür
  assert.equal("maviOz" in sr.kimlik, false);
  assert.equal((await a.put("/api/arena/kimlik", { ozGoster: "evet" })).status, 400);
  assert.equal((await a.put("/api/arena/kimlik", { ozGoster: true })).body.ozGoster, true);
  const sr2 = (await b.get("/api/arena/siralama")).body.top.find(x => x.ad === "Ayşe Y.");
  assert.ok(sr2.kimlik.maviOz >= 30); assert.equal(sr2.kimlik.simge, "s-simsek", "diğer seçimler korunur");
  await a.put("/api/arena/kimlik", { ozGoster: false });
  assert.equal("maviOz" in (await b.get("/api/arena/siralama")).body.top.find(x => x.ad === "Ayşe Y.").kimlik, false);
});

test("Antrenman ödül vermez; kart öğrenmek ödül verir", async () => {
  const k = O.yonA, once = (await k.get("/api/arena/kimlik")).body.sahip;
  const r = (await k.post("/api/arena/antrenman", {})).body; const m = macSatir(r.macId);
  ileri(m.t0 - Date.now() + 1000); for (let n = 0; n < 1; n++) await k.post(`/api/arena/mac/${r.macId}/cevap`, { soruNo: 0, secim: dogruSecim(r.macId, 0) });
  C.saat.kayma = 0; ileri(m.t0 - Date.now() + 5 * (m.soru_ms + m.ara_ms) + 1000);
  assert.deepEqual((await k.get("/api/arena/mac/" + r.macId)).body.yeniKazanimlar, []);
  assert.equal((await k.get("/api/arena/mac/" + r.macId)).body.maviOz, null, "antrenman Mavi Öz vermez");
  assert.equal((await k.get("/api/arena/kimlik")).body.sahip, once);
  C.saat.kayma = 0;
  let son;
  for (const kart of KARTLAR.slice(0, 10)) son = (await k.post(`/api/arena/kart/${kart.id}/ogrendim`, {})).body;
  assert.ok(son.yeniKazanimlar.includes("y-ogrenci"), "10 kart → Öğrenci sembolü");
});

test("Sezon sonu: ilk 3 sezon çerçevesi, kazanan blok kule simgesi, bir kez verilir", async () => {
  const s = C.app.arena.sezonAl(SID);
  ileri(29 * 864e5);
  await O.sakinA2.get("/api/arena/siralama");
  const var_ = (k, kod) => !!C.db.prepare("SELECT 1 FROM kazanimlar WHERE site_id = ? AND user_id = ? AND kod = ?").get(SID, uid(k), kod);
  const ilk = C.db.prepare("SELECT user_id FROM sezon_puan WHERE sezon_id = ? ORDER BY puan DESC, user_id LIMIT 1").get(s.id).user_id;
  assert.ok(C.db.prepare("SELECT 1 FROM kazanimlar WHERE user_id = ? AND kod = 'u-sezon'").get(ilk), "sezon birincisi");
  assert.ok(var_(O.yonA, "c-sezon") || var_(O.sakinA1, "c-sezon"));
  assert.equal(C.db.prepare("SELECT odullendi FROM sezonlar WHERE id = ?").get(s.id).odullendi, 1);
  const n = C.db.prepare("SELECT COUNT(*) n FROM kazanimlar").get().n;
  C.app.arena.sezonOdulle(SID); await O.sakinA1.get("/api/arena/siralama");
  assert.equal(C.db.prepare("SELECT COUNT(*) n FROM kazanimlar").get().n, n, "ikinci kez verilmez");
  assert.ok(C.db.prepare("SELECT COUNT(*) n FROM kazanimlar WHERE kod = 's-kule'").get().n >= 1, "blok savaşı kazananlara kule");
});

test("Günlük ve haftalık görevler: ilerleme sunucuda, ödül bir kez, gün değişince yenilenir", async () => {
  const k = O.sakinA1;
  let r = (await k.get("/api/arena/gorevler")).body;
  assert.equal(r.gorevler.filter(g => g.donem === "gun").length, 3); assert.equal(r.gorevler.filter(g => g.donem === "hafta").length, 5);
  assert.ok(r.yenilenme.gun > r.simdi && r.yenilenme.hafta >= r.yenilenme.gun);
  const gd = r.gorevler.find(g => g.kod === "g-duello"), gg = r.gorevler.find(g => g.kod === "g-galibiyet");
  assert.ok(gd.ilerleme >= 1, "bugünkü düellolar sayılır"); assert.equal(gg.tamam, true, "Ayşe bugün kazandı");
  const once = r.maviOz;
  const al = await k.post("/api/arena/gorev/g-galibiyet/al", {}); assert.equal(al.status, 200); assert.equal(al.body.oz, 25); assert.equal(al.body.maviOz, once + 25);
  assert.equal((await k.post("/api/arena/gorev/g-galibiyet/al", {})).status, 409, "ikinci kez alınamaz");
  assert.equal((await k.post("/api/arena/gorev/yok/al", {})).status, 404);
  const yapilmamis = (await O.yonA.get("/api/arena/gorevler")).body.gorevler.find(g => g.kod === "h-kusursuz");
  assert.equal(yapilmamis.tamam, false); assert.equal((await O.yonA.post("/api/arena/gorev/h-kusursuz/al", {})).status, 409, "tamamlanmadan alınamaz");
  assert.equal((await k.get("/api/arena/gorevler")).body.gorevler.find(g => g.kod === "g-galibiyet").alindi, true);
  assert.ok((await k.get("/api/arena/ozet")).body.gorevAlinabilir >= 0);
  // Ertesi gün günlük görevler sıfırlanır
  ileri(864e5 + 1000);
  r = (await k.get("/api/arena/gorevler")).body;
  const y = r.gorevler.find(g => g.kod === "g-galibiyet"); assert.equal(y.ilerleme, 0); assert.equal(y.alindi, false);
});
