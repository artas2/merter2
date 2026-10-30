"use strict";
/* Arena: bilgi kartları, eşleşme ve düello (sunucu yetkili puanlama), sezon ve blok sıralaması, turnuva (hazırım ve gelmeme),
   sohbet (oda yetkisi, numara gizleme, uzun yoklama), şikâyet, engel ve susturma, Premium kapısı. Zaman saat.kayma ile ilerletilir. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { sunucuBaslat, Istemci, ortam, tel } = require("./yardimci");
const { KART_ID, KARTLAR } = require("../src/kartlar");
const { metinTemizle } = require("../src/sohbet");

let C, O;
const ileri = ms => { C.saat.kayma += ms; };
const db = (k, op, yol, veri) => k.post("/api/db", { op, yol, veri });
const kim = k => k.me.aktifSite.kimlik;
async function profil(k, ad, blok) { assert.equal((await db(k, "set", "sakinler/" + kim(k), { ad, blok, kat: 1, daire: "1", durum: "Malik" })).status, 200); C.app.ortak.profilUnut(k.me.aktifSite.id, k.me.user.id); }
const dogruSecim = (macId, no) => { const m = C.db.prepare("SELECT sorular FROM maclar WHERE id = ?").get(macId); const s = JSON.parse(m.sorular)[no]; return s.perm.indexOf(KART_ID.get(s.id).d); };
const macSatir = id => C.db.prepare("SELECT * FROM maclar WHERE id = ?").get(id);

test.before(async () => {
  C = await sunucuBaslat({ config: { arenaTick: false } });
  O = await ortam(C);
  await profil(O.sakinA1, "Ayşe Yılmaz", "C"); await profil(O.sakinA2, "Ali Kaya", "A"); await profil(O.denetciA, "Deniz Er", "C"); await profil(O.yonA, "Yusuf Ak", "B");
  await profil(O.sakinB1, "Bora Tan", "A");
});
test.after(() => C.kapat());

test("Bilgi kartları: herkese açık; öğrenince puan, tekrar ve günlük tavan", async () => {
  assert.ok(KARTLAR.length >= 40);
  const r = (await O.sakinA1.get("/api/arena/kartlar")).body;
  assert.equal(r.toplam, KARTLAR.length); assert.ok(KART_ID.has(r.gunun));
  let x = (await O.sakinA1.post("/api/arena/kart/a01/ogrendim", {})).body; assert.equal(x.puan, 2);
  x = (await O.sakinA1.post("/api/arena/kart/a01/ogrendim", {})).body; assert.equal(x.puan, 0, "aynı kart ikinci kez puan vermez");
  for (const k of KARTLAR.slice(1, 12)) await O.sakinA1.post(`/api/arena/kart/${k.id}/ogrendim`, {});
  const oz = (await O.sakinA1.get("/api/arena/ozet")).body;
  assert.equal(oz.ben.puan, 20, "günde en çok 10 kart puan verir");
  assert.equal((await O.sakinA1.post("/api/arena/kart/yok/ogrendim", {})).status, 404);
  assert.equal((await O.sakinA1.get("/api/arena/kartlar")).body.ogrenilen, 12);
});

test("Premium kapısı: düello, sohbet ve turnuva Premium; kartlar ve şikâyet açık", async () => {
  const r = await O.sakinA1.post("/api/arena/esles", {});
  assert.equal(r.status, 403); assert.equal(r.body.alan, "premium");
  assert.equal((await O.sakinA1.get("/api/sohbet/oda/site")).status, 403);
  assert.equal((await O.sakinA1.get("/api/arena/ozet")).body.premium, false);
  await O.admin.patch(`/api/platform/siteler/${O.siteA.id}`, { odemeModeli: "site" });
  assert.equal((await O.sakinA1.get("/api/arena/ozet")).body.premium, true, "site öder → herkes Premium");
});

let MAC;
test("Eşleşme ve canlı düello: sunucu puanlar, sorular zamanında açılır, cevap tek ve süreli", async () => {
  const a = O.sakinA1, b = O.sakinA2;
  assert.deepEqual((await a.post("/api/arena/esles", {})).body.durum, "bekliyor");
  const bekle = a.get("/api/arena/esles");
  const rb = (await b.post("/api/arena/esles", {})).body;
  assert.equal(rb.durum, "mac"); const ra = (await bekle).body;
  assert.equal(ra.durum, "mac"); assert.equal(ra.macId, rb.macId, "bekleyen taraf aynı maça bağlanır");
  MAC = ra.macId;
  let g = (await a.get("/api/arena/mac/" + MAC)).body;
  assert.equal(g.durum, "geriSayim"); assert.equal(g.soru, null); assert.equal(g.rakip.ad, "Ali K."); assert.equal(g.rakip.blok, "A");
  assert.equal((await O.denetciA.get("/api/arena/mac/" + MAC)).status, 404, "başkası maçı göremez");
  assert.equal((await a.post(`/api/arena/mac/${MAC}/cevap`, { soruNo: 0, secim: 0 })).status, 409, "soru başlamadan cevap yok");
  const m = macSatir(MAC), d = m.soru_ms + m.ara_ms;
  for (let n = 0; n < 5; n++) {
    C.saat.kayma = 0; ileri(m.t0 - Date.now() + n * d + 2000);
    g = (await a.get("/api/arena/mac/" + MAC)).body;
    assert.equal(g.durum, "soru"); assert.equal(g.soru.no, n); assert.equal(g.soru.secenekler.length, 4);
    assert.equal(g.soru.dogru, undefined, "doğru cevap soru açıkken gönderilmez");
    assert.equal(g.gecmis.length, n, "yalnızca kapanan sorular açıklanır");
    const dg = dogruSecim(MAC, n);
    // Uzun yoklama: rakip cevap verince bekleyen istek erken döner
    const lp = a.get(`/api/arena/mac/${MAC}?ver=${g.ver}`); const t0 = Date.now();
    assert.equal((await b.post(`/api/arena/mac/${MAC}/cevap`, { soruNo: n, secim: (dg + 1) % 4 })).status, 200);
    const lr = (await lp).body; assert.ok(Date.now() - t0 < 2500, "uzun yoklama cevapla uyanır"); assert.equal(lr.soru.rakipCevapladi, true);
    assert.equal((await a.post(`/api/arena/mac/${MAC}/cevap`, { soruNo: n, secim: dg })).status, 200);
    assert.equal((await a.post(`/api/arena/mac/${MAC}/cevap`, { soruNo: n, secim: dg })).status, 409, "ikinci cevap yok");
  }
  assert.equal((await a.post(`/api/arena/mac/${MAC}/cevap`, { soruNo: 9, secim: 0 })).status, 400);
  C.saat.kayma = 0; ileri(m.t0 - Date.now() + 5 * d + 1000);
  g = (await a.get("/api/arena/mac/" + MAC)).body;
  assert.equal(g.bitti, true); assert.equal(g.sonuc, "ben"); assert.equal(g.gecmis.length, 5);
  assert.ok(g.ben.puan >= 5 * 100 + 5 * 40, "doğru ve hızlı cevap 100 + hız bonusu"); assert.equal(g.rakip.puan, 0);
  assert.equal(typeof g.gecmis[0].dogru, "number"); assert.ok(g.gecmis[0].aciklama.length > 20, "sonuçta kartın bilgisi gösterilir");
  const gb = (await b.get("/api/arena/mac/" + MAC)).body; assert.equal(gb.sonuc, "rakip");
  const oz = (await a.get("/api/arena/ozet")).body;
  assert.equal(oz.ben.galibiyet, 1); assert.ok(oz.ben.puan > 20 + 80, "maç ve galibiyet puanı eklendi");
  assert.equal(oz.aktifMac, null); assert.equal(oz.gecmis[0].sonuc, "kazandi");
  C.saat.kayma = 0;
});

test("Hile önleme: aynı iki kişi günde 3 maçtan sonra puan kazanmaz; günlük tavan", async () => {
  const AR = C.app.arena, sid = O.siteA.id, a = O.sakinA1.me.user.id, b = O.sakinA2.me.user.id;
  const puan = u => C.db.prepare("SELECT puan FROM sezon_puan WHERE user_id = ? ORDER BY sezon_id DESC LIMIT 1").get(u).puan;
  const oyna = () => { const id = C.db.prepare("SELECT id FROM maclar ORDER BY olusturma DESC LIMIT 1").get(); return id; };
  for (let i = 0; i < 3; i++) {
    C.saat.kayma = 0; assert.equal(AR.esles(sid, a).durum, "bekliyor");
    ileri(11000); // son rakiple hemen yeniden eşleşme 10 sn engellenir
    const id = AR.esles(sid, b).macId; assert.ok(id);
    const m = macSatir(id); C.saat.kayma = m.t0 - Date.now() + 1000;
    AR.macCevap(sid, a, id, 0, dogruSecim(id, 0));
    C.saat.kayma = m.t0 - Date.now() + 5 * (m.soru_ms + m.ara_ms) + 1000;
    const once = puan(a); AR.macBitir(macSatir(id));
    if (i < 2) assert.ok(puan(a) > once, "ilk 3 maç (gün içi) puan verir"); else assert.equal(puan(a), once, "aynı rakiple 4. maç (gün içi) puan vermez");
    C.saat.kayma = 0;
  }
  assert.ok(oyna());
  const sp = C.db.prepare("SELECT gun_puan FROM sezon_puan WHERE user_id = ? ORDER BY sezon_id DESC LIMIT 1").get(a).gun_puan;
  assert.ok(sp <= 400, "günlük tavan 400");
});

test("Antrenman: tek kişilik, düşük puan, galibiyet yok", async () => {
  const r = (await O.denetciA.post("/api/arena/antrenman", {})).body;
  const m = macSatir(r.macId); assert.equal(m.tur, "antrenman"); assert.equal(m.b_user, null);
  C.saat.kayma = 0; ileri(m.t0 - Date.now() + 1000);
  await O.denetciA.post(`/api/arena/mac/${r.macId}/cevap`, { soruNo: 0, secim: dogruSecim(r.macId, 0) });
  C.saat.kayma = 0; ileri(m.t0 - Date.now() + 5 * (m.soru_ms + m.ara_ms) + 1000);
  const g = (await O.denetciA.get("/api/arena/mac/" + r.macId)).body;
  assert.equal(g.bitti, true); assert.equal(g.rakip, null); assert.equal(g.sonuc, "berabere");
  const oz = (await O.denetciA.get("/api/arena/ozet")).body; assert.equal(oz.ben.galibiyet, 0); assert.ok(oz.ben.puan > 0 && oz.ben.puan < 10);
  C.saat.kayma = 0;
});

test("Sezon sıralaması ve blok savaşı", async () => {
  const s = (await O.sakinA2.get("/api/arena/siralama")).body;
  assert.ok(s.top.length >= 3); assert.equal(s.top[0].ad, "Ayşe Y."); assert.equal(s.top[0].blok, "C");
  assert.equal(s.top.find(x => x.ben).ad, "Ali K."); assert.ok(s.ben.sira >= 2);
  assert.equal(s.bloklar[0].blok, "C"); assert.ok(s.bloklar.some(b => b.blok === "A"));
  assert.ok(s.sezon.kalanMs > 20 * 864e5); assert.match(s.sezon.ad, /^Sezon \d+$/);
  assert.equal(s.top.some(x => "kat" in x || "daire" in x || "user_id" in x), false, "sıralamada kat, daire ve iç kimlik yok");
  assert.deepEqual((await O.sakinB1.get("/api/arena/siralama")).body.top, [], "başka site görmez");
});

test("Sezon bitince yenisi başlar, geçmiş sezon ilk 3 ile görünür", async () => {
  ileri(29 * 864e5);
  const s = (await O.sakinA1.get("/api/arena/siralama")).body;
  assert.equal(s.ben.puan, 0); assert.match(s.sezon.ad, /Sezon 2/);
  assert.equal(s.gecmisSezonlar[0].ilk3[0].ad, "Ayşe Y.");
  C.saat.kayma = 0;
  C.db.prepare("DELETE FROM sezonlar WHERE ad = 'Sezon 2'").run();
});

test("Turnuva: kayıt, kura (bay), hazırım penceresi, oynanan maç, gelmeyen rakip, şampiyon ödülü", async () => {
  const bas = Date.now() + 20 * 60000;
  assert.equal((await O.sakinA1.post("/api/arena/turnuvalar", { ad: "x", baslangic: bas, turAraligiDk: 10, maxKisi: 8 })).status, 403, "yalnızca yönetici oluşturur");
  assert.equal((await O.yonA.post("/api/arena/turnuvalar", { ad: "Cuma", baslangic: Date.now() + 60000, turAraligiDk: 10, maxKisi: 8 })).status, 400);
  assert.equal((await O.yonA.post("/api/arena/turnuvalar", { ad: "Cuma", baslangic: bas, turAraligiDk: 5, maxKisi: 8 })).status, 400);
  const id = (await O.yonA.post("/api/arena/turnuvalar", { ad: "Cuma Akşamı Kupası", baslangic: bas, turAraligiDk: 10, maxKisi: 8 })).body.id;
  for (const k of [O.sakinA1, O.sakinA2, O.denetciA]) assert.equal((await k.post(`/api/arena/turnuva/${id}/katil`, {})).status, 200);
  assert.equal((await O.sakinA1.post(`/api/arena/turnuva/${id}/katil`, {})).body.katilimci, 3, "ikinci kayıt sayıyı artırmaz");
  assert.notEqual((await O.sakinB1.post(`/api/arena/turnuva/${id}/katil`, {})).status, 200, "başka site katılamaz");
  assert.throws(() => C.app.arena.turnuvaKatil(O.siteB.id, O.sakinB1.me.user.id, id), /bulunamadı/, "site kimliği oturumdan gelir");
  // Kura: başlangıçtan 5 dk önce
  C.saat.kayma = bas - 4 * 60000 - Date.now();
  let d = (await O.sakinA1.get(`/api/arena/turnuva/${id}`)).body;
  assert.equal(d.turnuva.durum, "oynaniyor"); assert.equal(d.maclar.length, 3, "4'lük ağaç: 2 yarı final + final");
  assert.equal((await O.sakinA1.post(`/api/arena/turnuva/${id}/katil`, {})).status, 409, "kayıt kapandı");
  const bay = d.maclar.find(m => m.tur === 0 && m.durum === "bitti"); assert.ok(bay); assert.equal(bay.neden, "bay geçti");
  const yari = d.maclar.find(m => m.tur === 0 && m.durum === "bekle");
  const kisiler = { "Ayşe Y.": O.sakinA1, "Ali K.": O.sakinA2, "Deniz E.": O.denetciA };
  const A = kisiler[yari.a.ad], B = kisiler[yari.b.ad], baySahibi = kisiler[(bay.a || bay.b).ad];
  assert.equal((await baySahibi.post(`/api/arena/turnuva/${id}/mac/${yari.id}/hazir`, {})).status, 403, "maçında olmayan hazır diyemez");
  await A.post(`/api/arena/turnuva/${id}/mac/${yari.id}/hazir`, {}); await B.post(`/api/arena/turnuva/${id}/mac/${yari.id}/hazir`, {});
  d = (await A.get(`/api/arena/turnuva/${id}`)).body; assert.equal(d.maclar.find(m => m.id === yari.id).durum, "bekle", "saat gelmeden başlamaz");
  C.saat.kayma = bas + 1000 - Date.now();
  d = (await A.get(`/api/arena/turnuva/${id}`)).body;
  const ym = d.maclar.find(m => m.id === yari.id); assert.equal(ym.durum, "oynuyor"); assert.ok(ym.macId);
  const m = macSatir(ym.macId); C.saat.kayma = m.t0 + 1000 - Date.now();
  await A.post(`/api/arena/mac/${ym.macId}/cevap`, { soruNo: 0, secim: dogruSecim(ym.macId, 0) });
  C.saat.kayma = m.t0 + 5 * (m.soru_ms + m.ara_ms) + 1500 - Date.now();
  d = (await A.get(`/api/arena/turnuva/${id}`)).body;
  const final = d.maclar.find(m => m.tur === 1);
  assert.equal(final.a && final.b && true, true, "final iki oyunculu");
  // Final: yalnızca A hazır der; B gelmez → A kazanır
  C.saat.kayma = final.slot - 2 * 60000 - Date.now();
  assert.equal((await A.post(`/api/arena/turnuva/${id}/mac/${final.id}/hazir`, {})).status, 200);
  C.saat.kayma = final.slot + 4 * 60000 - Date.now();
  d = (await A.get(`/api/arena/turnuva/${id}`)).body;
  assert.equal(d.turnuva.durum, "bitti"); assert.equal(d.turnuva.sampiyon.ad, yari.a.ad, "yarı finali ve finali kazanan şampiyon");
  assert.equal(d.maclar.find(m => m.id === final.id).neden, "rakip gelmedi");
  assert.equal(d.turnuva.sampiyon.ben, true);
  const sp = C.db.prepare("SELECT puan FROM sezon_puan WHERE user_id = ? ORDER BY sezon_id DESC LIMIT 1").get(A.me.user.id).puan;
  assert.ok(sp >= 150, "şampiyon ödülü (tavansız)");
  assert.equal((await A.post(`/api/arena/turnuva/${id}/mac/${final.id}/hazir`, {})).status, 409, "biten maça hazır denemez");
  C.saat.kayma = 0;
});

test("Turnuva: 2'den az katılımcı → iptal; yönetici iptal edebilir", async () => {
  C.saat.kayma = 0;
  const bas = Date.now() + 20 * 60000;
  const id = (await O.yonA.post("/api/arena/turnuvalar", { ad: "Boş kupa", baslangic: bas, turAraligiDk: 15, maxKisi: 4 })).body.id;
  await O.sakinA1.post(`/api/arena/turnuva/${id}/katil`, {});
  C.saat.kayma = bas - Date.now();
  const ip = await O.sakinA1.get(`/api/arena/turnuva/${id}`); assert.equal(ip.status, 200, ip.text);
  assert.equal(ip.body.turnuva.durum, "iptal");
  C.saat.kayma = 0;
  const id2 = (await O.yonA.post("/api/arena/turnuvalar", { ad: "İptal", baslangic: bas, turAraligiDk: 15, maxKisi: 4 })).body.id;
  assert.equal((await O.sakinA1.del(`/api/arena/turnuva/${id2}`, {})).status, 403);
  assert.equal((await O.yonA.del(`/api/arena/turnuva/${id2}`, {})).status, 200);
});

test("Sohbet: oda yetkisi, numara gizleme, hız sınırı, uzun yoklama", async () => {
  const a = O.sakinA1, d = O.denetciA, ali = O.sakinA2;
  const od = (await a.get("/api/sohbet")).body;
  assert.deepEqual(od.odalar.map(o => o.id), ["site", "blok:C"]); assert.equal(od.ben.kim, kim(a));
  assert.equal((await a.get("/api/sohbet/oda/blok:A")).status, 403, "başka blokun odası kapalı");
  let r = (await d.get("/api/sohbet/oda/blok:C")).body; const son = r.sonId;
  const lp = d.get(`/api/sohbet/oda/blok:C?sonra=${son}&surum=${r.surum}&bekle=1`); const t0 = Date.now();
  const g = await a.post("/api/sohbet/oda/blok:C", { metin: "Akşam çay bahçede, numaram 0532 123 45 67" });
  assert.equal(g.status, 200); assert.match(g.body.metin, /\[numara gizlendi\]/); assert.doesNotMatch(g.body.metin, /123/);
  r = (await lp).body; assert.ok(Date.now() - t0 < 2000); assert.equal(r.mesajlar.length, 1);
  assert.equal(r.mesajlar[0].ad, "Ayşe Y."); assert.equal(r.mesajlar[0].kim, kim(a)); assert.equal("user_id" in r.mesajlar[0], false);
  assert.equal((await a.post("/api/sohbet/oda/blok:C", { metin: "tekrar" })).status, 429, "1,5 sn kuralı");
  ileri(2000);
  assert.equal((await a.post("/api/sohbet/oda/site", { metin: "  " })).status, 400);
  assert.equal((await a.post("/api/sohbet/oda/site", { metin: "x".repeat(301) })).status, 400);
  assert.equal((await ali.get("/api/sohbet/oda/blok:C")).status, 403);
  assert.equal((await O.sakinB1.get("/api/sohbet/oda/site")).status, 403, "B sitesi Premium değil");
  assert.equal(metinTemizle("+90 532 123 45 67 ve 12345678901"), "[numara gizlendi] ve [numara gizlendi]");
  C.saat.kayma = 0;
});

test("Şikâyet: sohbet mesajı 3 şikâyette gizlenir, yönetim karar verir, susturma ve engel", async () => {
  const a = O.sakinA1;
  ileri(5000);
  const m = (await O.sakinA2.post("/api/sohbet/oda/site", { metin: "Rahatsız edici mesaj" })).body;
  assert.equal((await O.sakinA2.post("/api/sikayet", { tur: "mesaj", ref: m.id, sebep: "taciz" })).status, 400, "kendini şikâyet edemez");
  assert.equal((await a.post("/api/sikayet", { tur: "mesaj", ref: m.id, sebep: "yok" })).status, 400);
  const ilk = (await O.denetciA.get("/api/sohbet/oda/site")).body;
  assert.ok(ilk.mesajlar.some(x => x.id === m.id));
  assert.equal((await a.post("/api/sikayet", { tur: "mesaj", ref: m.id, sebep: "taciz", aciklama: "hakaret" })).body.gizlendi, false);
  assert.equal((await a.post("/api/sikayet", { tur: "mesaj", ref: m.id, sebep: "taciz" })).body.yeni, false, "aynı kişi iki kez sayılmaz");
  await O.denetciA.post("/api/sikayet", { tur: "mesaj", ref: m.id, sebep: "uygunsuz" });
  const s3 = (await O.yonA.post("/api/sikayet", { tur: "mesaj", ref: m.id, sebep: "spam", engelle: true })).body;
  assert.equal(s3.gizlendi, true); assert.equal(s3.engellendi, true);
  const sonra = (await O.denetciA.get(`/api/sohbet/oda/site?sonra=${ilk.sonId}&surum=${ilk.surum}`)).body;
  assert.equal(sonra.tam, true, "gizleme sonrası istemci listeyi baştan alır"); assert.ok(!sonra.mesajlar.some(x => x.id === m.id));
  // Yönetim listesi ve susturma
  assert.equal((await a.get("/api/yonetim/sikayetler")).status, 403);
  const l = (await O.yonA.get("/api/yonetim/sikayetler")).body.sikayetler;
  const s = l.find(x => x.tur === "mesaj" && x.ref === String(m.id)); assert.equal(s.adet, 3); assert.equal(s.kisi.ad, "Ali K."); assert.ok(s.aciklamalar.includes("hakaret"));
  assert.equal((await O.yonA.patch(`/api/yonetim/sikayetler/${s.id}`, { karar: "sustur", saat: 2 })).status, 200);
  ileri(2000);
  const y = await O.sakinA2.post("/api/sohbet/oda/site", { metin: "deneme" }); assert.equal(y.status, 403); assert.match(y.body.hata, /kapalı/);
  assert.equal((await O.yonA.get("/api/yonetim/sikayetler")).body.sikayetler.some(x => x.id === s.id), false, "karar verilen şikâyet kapanır");
  assert.equal((await O.denetciA.del(`/api/yonetim/sustur/${kim(O.sakinA2)}`, {})).status, 200);
  ileri(2000); assert.equal((await O.sakinA2.post("/api/sohbet/oda/site", { metin: "teşekkürler" })).status, 200);
  // Engel listesi
  const e = (await O.yonA.get("/api/engel")).body.engeller; assert.equal(e[0].ad, "Ali K.");
  assert.deepEqual((await O.yonA.get("/api/sohbet")).body.engelli, [kim(O.sakinA2)]);
  await O.yonA.del("/api/engel/" + kim(O.sakinA2), {}); assert.deepEqual((await O.yonA.get("/api/engel")).body.engeller, []);
  C.saat.kayma = 0;
});

test("Şikâyet: Gündem gönderisi ve yorumu 3 şikâyette gizlenir; yönetici yoksayabilir", async () => {
  const u = kim(O.sakinA2);
  await db(O.sakinA2, "set", "gonderiler/" + u, { posts: { p1: { metin: "Uygunsuz gönderi", t: Date.now() } } });
  await db(O.sakinA2, "set", "yorumlar/" + u, { items: { c1: { metin: "kötü yorum", k: "x", uid: u } } });
  assert.equal((await O.sakinA1.post("/api/sikayet", { tur: "gonderi", ref: u + ":yok", sebep: "spam" })).status, 404);
  for (const k of [O.sakinA1, O.denetciA, O.yonA]) await k.post("/api/sikayet", { tur: "gonderi", ref: u + ":p1", sebep: "uygunsuz" });
  assert.equal((await db(O.sakinA1, "get", "gonderiler/" + u)).body.veri.posts.p1.gizli, true);
  await O.sakinA1.post("/api/sikayet", { tur: "yorum", ref: u + ":c1", sebep: "taciz" });
  const l = (await O.denetciA.get("/api/yonetim/sikayetler")).body.sikayetler;
  const y = l.find(x => x.tur === "yorum"); assert.equal(y.ozet, "kötü yorum");
  assert.equal((await O.denetciA.patch(`/api/yonetim/sikayetler/${y.id}`, { karar: "gizle" })).status, 200);
  assert.equal((await db(O.sakinA1, "get", "yorumlar/" + u)).body.veri.items.c1.gizli, true);
  const kisi = await O.sakinA1.post("/api/sikayet", { tur: "kisi", ref: u, sebep: "taciz" });
  assert.equal(kisi.status, 200);
  const g = (await O.yonA.get("/api/yonetim/sikayetler")).body.sikayetler.find(x => x.tur === "kisi");
  assert.equal((await O.yonA.patch(`/api/yonetim/sikayetler/${g.id}`, { karar: "yoksay" })).status, 200);
  assert.equal((await O.yonA.get("/api/yonetim/sikayetler?durum=kapandi")).body.sikayetler.length >= 2, true);
});

test("Hesap silinince sohbet mesajları da silinir", async () => {
  const k = await new Istemci(C).giris(tel()); await k.katil(O.davetA);
  await profil(k, "Geçici Komşu", "E");
  ileri(3000);
  const m = (await k.post("/api/sohbet/oda/site", { metin: "silinecek mesaj" })).body;
  assert.ok(m.id);
  await k.del("/api/hesap", { onay: true });
  assert.equal(C.db.prepare("SELECT COUNT(*) n FROM sohbet WHERE id = ?").get(m.id).n, 0);
  C.saat.kayma = 0;
});

test("Sohbet canlı akışı (SSE): ilk paket tam liste, yeni mesaj aynı bağlantıdan gelir, Premium gerekir", async () => {
  const http = require("node:http");
  const ac = (k, oda) => new Promise((coz, red) => {
    const r = http.request(C.base + `/api/sohbet/oda/${oda}/akis`, { headers: { cookie: k.cerez } }, res => {
      const olaylar = []; let tampon = "";
      res.setEncoding("utf8");
      res.on("data", d => { tampon += d; let i; while ((i = tampon.indexOf("\n\n")) >= 0) { const o = tampon.slice(0, i); tampon = tampon.slice(i + 2); const v = o.split("\n").filter(l => l.startsWith("data: ")).map(l => l.slice(6)).join(""); if (v) olaylar.push(JSON.parse(v)); } });
      coz({ res, olaylar, kapat: () => r.destroy() });
    });
    r.on("error", red); r.end();
  });
  const bekleOlay = async (s, n) => { for (let i = 0; i < 60 && s.olaylar.length < n; i++) await new Promise(r => setTimeout(r, 50)); return s.olaylar; };
  const s = await ac(O.denetciA, "site");
  assert.equal(s.res.statusCode, 200); assert.match(s.res.headers["content-type"], /text\/event-stream/);
  const ilk = (await bekleOlay(s, 1))[0]; assert.equal(ilk.tam, true); assert.ok(Array.isArray(ilk.mesajlar));
  ileri(3000);
  const t0 = Date.now();
  await O.sakinA1.post("/api/sohbet/oda/site", { metin: "Akıştan merhaba" });
  const o = await bekleOlay(s, 2);
  assert.ok(o.length >= 2, "yeni mesaj akıştan geldi"); assert.equal(o[1].tam, false);
  assert.equal(o[1].mesajlar[o[1].mesajlar.length - 1].metin, "Akıştan merhaba"); assert.ok(Date.now() - t0 < 1500);
  assert.equal(C.app.sohbet.akisSayisi(), 1);
  s.kapat(); await new Promise(r => setTimeout(r, 100));
  assert.equal(C.app.sohbet.akisSayisi(), 0, "kapanan bağlantı listeden çıkar");
  const b = await ac(O.sakinB1, "site"); assert.equal(b.res.statusCode, 403, "Premium değilse akış yok"); b.kapat();
  C.saat.kayma = 0;
});
