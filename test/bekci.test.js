"use strict";
/* Bekçi (sohbet denetim botu): kurallar, yazım oyunları, masum sözcükler, kişisel bilgi maskeleme, eğitilmiş model ölçümü,
   sohbete entegrasyon (engel, izle, susturma) ve yönetim geri bildirimi. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sunucuBaslat, ortam } = require("./yardimci");
const B = require("../src/bekci");

const model = B.modelYukle();
const karar = (m, md = model) => B.degerlendir(m, md).karar;

test("Kurallar: küfür, tehdit, hakaret, spam ve yazım oyunları engellenir ya da işaretlenir", () => {
  for (const m of ["siktir git", "AMK", "orospu çocuğu", "s1kt1r git", "s i k t i r", "s.i.k.t.i.r", "siiiiktir", "s*ktir lan", "sıktır git buradan".replace("sıktır", "siktir")]) assert.equal(karar(m, null), "engelle", m);
  for (const m of ["seni öldürürüm", "dövecem seni", "evini biliyorum pişman edeceğim", "kafanı kırarım"]) assert.equal(karar(m, null), "engelle", m);
  assert.equal(karar("sen çok aptalsın", null), "engelle", "hedefli hakaret"); assert.equal(karar("aptal karar", null), "izle", "hedefsiz hafif hakaret yalnız işaretlenir");
  assert.equal(karar("geri zekalı", null), "izle");
  assert.equal(karar("ücretsiz kredi www.hizlikredi.com tıkla", null), "engelle"); assert.equal(karar("bahis bonus casino", null), "engelle");
  assert.ok(B.degerlendir("s1kt1r git").turler.includes("kufur"));
});

test("Kurallar: masum sözcükler ve gündelik cümleler engellenmez (Scunthorpe sorunu)", () => {
  for (const m of ["Sık sık asansörde sıkışıyoruz", "şikayet ettim", "Malzeme listesi hazır", "Amcam bahçede", "Alfabetik sıra", "Betonarme bina", "Kasım ayında toplantı", "mal sahibi geldi", "Sıkıntı yok", "Pazartesi akşamı ağaç budama var", "internet kesildi", "Aksiyon planı hazırlandı", "Sikke koleksiyonu yapıyorum", "Gotik mimari güzel", "Pickup araç park etti", "Cumartesi hamsi var mı?", "Emekli amca çay içiyor"]) assert.equal(karar(m), "izin", m);
});

test("Kişisel bilgi: IBAN, geçerli TC kimlik numarası ve e-posta maskelenir; geçersiz 11 haneli sayı korunur", () => {
  const d = B.degerlendir("Hesap TR33 0006 1005 1978 6457 8413 26 ve mail ali@ornek.com, TC 10000000146");
  assert.equal(d.metin, "Hesap [IBAN gizlendi] ve mail [e-posta gizlendi], TC [kimlik no gizlendi]"); assert.deepEqual(d.maskelenen.sort(), ["IBAN", "TC kimlik", "e-posta"]);
  assert.equal(B.degerlendir("Sipariş no 12345678901").metin, "Sipariş no 12345678901"); assert.equal(B.tcGecerli("10000000146"), true); assert.equal(B.tcGecerli("10000000147"), false);
});

test("Eğitilmiş model: ayrı değerlendirme kümesinde ölçülen doğruluk; engelleme kararında temiz mesaj engellenmez", () => {
  assert.ok(model && model.sinif.temiz, "model dosyası var (npm run bekci:egit)");
  const dev = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "bekci-degerlendirme.json"), "utf8"));
  const tum = [...dev.temiz.map(m => [m, false]), ...dev.toksik.map(m => [m, true])];
  let tp = 0, fp = 0, fn = 0; for (const [m, g] of tum) { const a = karar(m) !== "izin"; if (g && a) tp++; else if (!g && a) fp++; else if (g && !a) fn++; }
  assert.ok(tp / (tp + fp) >= 0.9, "kesinlik " + tp / (tp + fp)); assert.ok(tp / (tp + fn) >= 0.9, "duyarlılık " + tp / (tp + fn));
  for (const m of dev.temiz) assert.notEqual(karar(m), "engelle", "temiz mesaj engellenmemeli: " + m);
  // Model tek başına engelleyemez: kuralsız zararlı görünen ama kural eşiğini geçmeyen metin en çok "izle" olur
  assert.notEqual(B.degerlendir("bu yönetim hepsi aptal gibi davranıyor", model).karar, "izin");
});

let C, O, SID;
const ileri = ms => { C.saat.kayma += ms; };
test.before(async () => {
  C = await sunucuBaslat({ config: { arenaTick: false } }); O = await ortam(C); SID = O.siteA.id;
  await O.admin.patch(`/api/platform/siteler/${SID}`, { odemeModeli: "site" });
});
test.after(() => C.kapat());
const yaz = async (k, metin) => { ileri(2000); return k.post("/api/sohbet/oda/site", { metin }); };

test("Sohbet: engellenen mesaj gönderilmez ve sebebi söylenir; masum mesaj geçer; kişisel bilgi maskelenir", async () => {
  let r = await yaz(O.sakinA1, "Merhaba komşular, sık sık görüşelim"); assert.equal(r.status, 200);
  r = await yaz(O.sakinA1, "siktir git amk"); assert.equal(r.status, 422); assert.equal(r.body.alan, "bekci"); assert.match(r.body.hata || r.body.mesaj || JSON.stringify(r.body), /küfür/);
  let liste = (await O.sakinA2.get("/api/sohbet/oda/site")).body.mesajlar.map(m => m.metin); assert.ok(liste.some(x => /sık sık/.test(x))); assert.ok(!liste.some(x => /siktir/.test(x)), "engellenen mesaj odada yok");
  r = await yaz(O.sakinA1, "IBAN TR33 0006 1005 1978 6457 8413 26 yatırın"); assert.equal(r.status, 200); assert.match(r.body.metin, /\[IBAN gizlendi\]/);
  r = await yaz(O.sakinA1, "sen aptal bir insansın"); assert.equal(r.status, 422, "hedefli hakaret engellenir");
  r = await yaz(O.sakinA2, "aptal karar vermişler"); assert.equal(r.status, 200, "hedefsiz hafif hakaret geçer ama yönetime işaretlenir");
});

test("Tekrarlayan ihlal: 3. engelde 1 saat susturma, mesaj uyarır; yönetim kaldırabilir", async () => {
  const k = O.sakinA2;
  let r = await yaz(k, "siktir lan"); assert.equal(r.status, 422); assert.doesNotMatch(r.body.hata || "", /susturma|yazamazsınız/, "1. ihlalde susturma yok");
  r = await yaz(k, "orospu çocuğu"); assert.equal(r.status, 422); assert.match(JSON.stringify(r.body), /1 saat yazamazsınız/, "2. ihlalde uyarı");
  r = await yaz(k, "amk"); assert.equal(r.status, 422); assert.match(JSON.stringify(r.body), /1 saat/, "3. ihlalde susturma bildirimi");
  r = await yaz(k, "Merhaba"); assert.equal(r.status, 403, "susturuldu");
  assert.equal((await O.yonA.del(`/api/yonetim/sustur/${k.me.aktifSite.kimlik}`)).status, 200);
  assert.equal((await yaz(k, "Merhaba, özür dilerim")).status, 200);
});

test("Flood: aynı mesaj 60 saniyede 3. kez engellenir", async () => {
  const k = O.sakinA1; ileri(120000);
  assert.equal((await yaz(k, "toplantı var")).status, 200); assert.equal((await yaz(k, "toplantı var")).status, 200); assert.equal((await yaz(k, "toplantı var")).status, 422);
});

test("Yönetim: Bekçi olayları listelenir, geri bildirim verilir; yalnızca yönetim görür; sakin erişemez", async () => {
  assert.equal((await O.sakinA1.get("/api/yonetim/bekci")).status, 403);
  const r = (await O.yonA.get("/api/yonetim/bekci")).body;
  assert.ok(r.olaylar.length >= 5); assert.ok(r.ozet.engelle >= 5); assert.ok(r.ozet.izle >= 1); assert.equal(r.modelVar, true);
  assert.ok(r.olaylar.some(o => o.karar === "engelle" && o.turler.includes("küfür"))); assert.ok(r.olaylar.every(o => !("norm" in o) && typeof o.ozet === "string"));
  const o = r.olaylar.find(x => x.karar === "izle"); assert.equal((await O.yonA.post(`/api/yonetim/bekci/${o.id}/geri-bildirim`, { dogru: false })).status, 200);
  assert.equal((await O.yonA.get("/api/yonetim/bekci")).body.olaylar.find(x => x.id === o.id).geri, 0);
  assert.equal((await O.yonA.post("/api/yonetim/bekci/99999/geri-bildirim", { dogru: true })).status, 404);
  assert.equal((await O.yonB.get("/api/yonetim/bekci")).body.olaylar.length, 0, "başka sitenin olayları görünmez");
  // geri bildirim süz: yanlış alarm sayılan olay susturma sayacına girmez
  assert.equal(C.db.prepare("SELECT COUNT(*) n FROM bekci_olay WHERE geri = 0").get().n, 1);
});
