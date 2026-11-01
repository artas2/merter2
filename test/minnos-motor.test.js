"use strict";
/* Minnoş'un hazır bilgi bankası ve yerel kahve falı. Motor merter/index.html içinde gömülüdür (Claude sayfasında da çalışsın diye);
   burada işaretli blok çıkarılıp Node'da çalıştırılır. Soru kümesi bilgi bankasını yazarken kullanılmayan, farklı sözcüklerle yazılmış sorulardır. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "merter", "index.html"), "utf8");
const blok = html.slice(html.indexOf("/*MINNOS-MOTOR-BASLA*/"), html.indexOf("/*MINNOS-MOTOR-BITIS*/"));
const M = new Function(blok + "; return MinnosMotor;")();

const SORULAR = [
  ["Düelloda rakip bulunca ne yapmalıyım?", "duello"], ["Eşleşme ne kadar sürüyor?", "duello"], ["Rakibim kabul etmezse ne olur?", "duello"],
  ["Günün ayetini nereden okurum?", "hikmet"], ["Hadis nerede yazıyor?", "hikmet"], ["Telefonumun kilit ekranına yazı koyabilir miyim?", "duvar"], ["Duvar kağıdı yapmak istiyorum", "duvar"],
  ["Ütü siparişi nasıl veririm?", "utu"], ["Halımı yıkatmak istiyorum", "hali"], ["Taze süt sipariş edebilir miyim?", "sut"], ["Çiftlikten süt ne zaman gelir?", "sut"],
  ["Hangi hizmetler var?", "hizmetler"], ["Ev temizliği için randevu alabilir miyim?", "temizlik"], ["Toplu market siparişi nasıl veriliyor?", "sepet"],
  ["İndirim kodu nereden bulurum?", "firsat"], ["Firmanın sitesine nasıl giderim?", "firsat"], ["Seviyem ve rozetlerim nerede?", "kartim"],
  ["Kat ve daire numaramı kimler görür?", "gizlilik"], ["Telefon numaram gizli mi?", "gizlilik"], ["Premium ne kadar?", "premium"], ["Abonelik nedir?", "premium"],
  ["Turnuvada satranç oynanıyor mu?", "turnuva"], ["Tavla turnuvası nasıl işliyor?", "turnuva"], ["Mavi Öz nasıl kazanılır?", "mavioz"],
  ["Günlük görevler neler?", "gorev"], ["Haftalık görev ödülü nasıl alınır?", "gorev"], ["Simge ve çerçeve nasıl açılır?", "odul"], ["Sezon kaç gün sürüyor?", "sezon"], ["Blok savaşı nedir?", "sezon"],
  ["Mesajım neden gönderilmedi?", "bekci"], ["Bekçi ne yapıyor?", "bekci"], ["Birini şikayet etmek istiyorum", "sikayet"], ["Rahatsız edici birini engelleyebilir miyim?", "sikayet"],
  ["Sesleri nasıl kapatırım?", "sesler"], ["Hesabımı silmek istiyorum", "hesap"], ["Yangın çıkarsa kimi arayayım?", "acil"], ["Aidat ne zaman yatırılıyor?", "aidat"],
  ["Kahve falı bakar mısın?", "fal"], ["Teşekkürler Minnoş", "tesekkur"], ["Sen kimsin?", "kim"], ["Neler yapabilirsin?", "yardim"], ["Yarın hava nasıl olacak?", "hava"]
];
const KONU_DISI = ["Dünyanın en yüksek dağı hangisi?", "Fenerbahçe maçı kaç kaç bitti?", "Bana bir şiir yaz", "Bitcoin alayım mı?", "Tarhana çorbası nasıl yapılır?", "Kaç yaşındasın?", "xyzqw abc"];

test("Bilgi bankası: farklı sözcüklerle sorulan uygulama soruları doğru cevaba gider", () => {
  const yanlis = []; let dogru = 0;
  for (const [q, id] of SORULAR) { const r = M.cevapla(q); if (r.id === id) dogru++; else yanlis.push(`${q} → ${r.id} (beklenen ${id})`); }
  const oran = dogru / SORULAR.length; console.log(`      bilgi bankası: ${dogru}/${SORULAR.length} = ${(oran * 100).toFixed(1)}%` + (yanlis.length ? "\n      yanlışlar:\n        " + yanlis.join("\n        ") : ""));
  assert.ok(oran >= 0.9, "doğruluk " + oran + "\n" + yanlis.join("\n"));
});

test("Bilgi bankası: ikinci, ayarlamadan sonra yazılmış bağımsız soru kümesi (genelleme)", () => {
  const Q = [["Rakip bulunamazsa ne yapabilirim?", "duello"], ["Fincan falı baktırmak istiyorum", "fal"], ["Hadis okumak istiyorum", "hikmet"], ["Çiftlik sütü kaç litre alabilirim?", "sut"], ["Bir komşumu rahatsız edici davranışı için bildirmek istiyorum", "sikayet"],
    ["Sohbet odasına nasıl girerim?", "sohbet"], ["Etkinlik takvimi nerede?", "etkinlik"], ["Toplu alışveriş nasıl yapılır?", "sepet"], ["Karta kazandığım simgeyi nasıl takarım?", "odul"], ["Sıralamada kaçıncıyım?", "sezon"],
    ["Mavi Öz'ü başkaları görebilir mi?", "mavioz"], ["Günün hikmeti nerede?", "hikmet"], ["Halı yıkamada fiyat nasıl belirleniyor?", "hali"], ["Yardım eder misin?", "yardim"], ["Selam Minnoş, nasılsın?", "selam"]];
  const yanlis = Q.filter(([q, id]) => M.cevapla(q).id !== id).map(([q, id]) => `${q} → ${M.cevapla(q).id} (beklenen ${id})`);
  console.log(`      bağımsız küme: ${Q.length - yanlis.length}/${Q.length}` + (yanlis.length ? "\n        " + yanlis.join("\n        ") : ""));
  assert.ok((Q.length - yanlis.length) / Q.length >= 0.8, yanlis.join("\n"));
});

test("Bilgi bankası: konu dışı sorularda uydurmaz, dürüstçe bilmediğini söyler", () => {
  for (const q of KONU_DISI) { const r = M.cevapla(q); assert.equal(r.id, null, q + " → " + r.id); assert.match(r.cevap, /hazır bir cevabım yok/); }
});

test("Bilgi bankası: cevaplar uygulamadaki gerçek değerlerle tutarlı ve siteye özel şeyi uydurmaz", () => {
  const c = id => M.BILGI.find(e => e.id === id).c;
  assert.match(c("duello"), /60 saniye/); assert.match(c("duello"), /10 saniye/); assert.match(c("mavioz"), /30/); assert.match(c("mavioz"), /\+100/); assert.match(c("gorev"), /3 günlük/); assert.match(c("gorev"), /5 haftalık/);
  assert.match(c("turnuva"), /5 dakika/); assert.match(c("acil"), /112/); assert.match(c("aidat"), /bilmiyorum/); assert.doesNotMatch(c("premium"), /\d+\s*TL/, "fiyat uydurulmaz");
  assert.ok(M.BILGI.every(e => e.k.length && e.c.length > 20)); assert.equal(new Set(M.BILGI.map(e => e.id)).size, M.BILGI.length);
});

test("Kahve falı: aynı seçim aynı gün aynı falı verir; semboller ve konu yansır; korkutucu söz ve kesin tahmin yok", () => {
  const a = M.fal({ konu: "ask", semboller: ["kus", "kalp"], niyet: "yeni komşu", gun: "2026-11-01" }), b = M.fal({ konu: "ask", semboller: ["kalp", "kus"], niyet: "yeni komşu", gun: "2026-11-01" });
  assert.equal(a, b, "sembol sırası fark etmez"); assert.notEqual(a, M.fal({ konu: "ask", semboller: ["kus", "kalp"], niyet: "yeni komşu", gun: "2026-11-02" }), "ertesi gün başka fal");
  assert.match(a, /yeni komşu/); assert.match(a, /eğlence/);
  assert.equal(M.fal({ konu: "ask", semboller: [] }), null); assert.equal(M.fal({ konu: "ask", semboller: ["yok"] }), null);
  assert.match(M.fal({ konu: "?", semboller: ["dag"] }), /Genel tarafında/, "geçersiz konu genel olur");
  const kor = /ölüm|öl[üu]r|hastal|ayrıl|felaket|kaza|kanser|boşan|iflas|ceza|yasak|kesin(?:likle)?\s+(?:olacak|gelecek)/i;
  for (const konu of Object.keys(M.KONULAR)) for (const s1 of Object.keys(M.SEMBOLLER)) for (let g = 1; g <= 4; g++) {
    const f = M.fal({ konu, semboller: [s1], gun: "2026-11-0" + g }); assert.doesNotMatch(f, kor, `${konu}/${s1}: ${f}`); assert.match(f, /eğlence|hikâye|ciddiye alma/, "her falda eğlence uyarısı");
  }
  const uc = M.fal({ konu: "para", semboller: ["kus", "yol", "yuzuk", "ay", "dag"], gun: "x" }); assert.ok((uc.match(/\./g) || []).length < 12, "en çok 3 sembol yorumlanır");
});

/* ---- Maliyet hesabı ve site araması ---- */
const VERI = {
  hali: { aktif: true, fiyat: 45 }, sut: { aktif: true, fiyat: 40, ciftlik: "Örnek Çiftliği" },
  utu: { aktif: true, aksamEk: 20, kalemler: [{ ad: "Gömlek", fiyat: 60 }, { ad: "Pantolon", fiyat: 70 }, { ad: "Elbise", fiyat: "" }] },
  temizlik: { aktif: true, turler: [{ ad: "Ev temizliği", fiyat: 900 }] },
  urunler: [{ ad: "Süt", birim: "litre", fiyat: 30, aktif: true }, { ad: "Domates", birim: "kg", fiyat: 25, aktif: true }, { ad: "Peynir", birim: "kg", fiyat: "", aktif: true }, { ad: "Salatalık", birim: "kg", fiyat: 20, aktif: false }],
  firsatlar: [
    { isletme: "Moda Butik", baslik: "Kış montlarında indirim", kategori: "Giyim ve tekstil", oran: 40, mesafe: 6 },
    { isletme: "Şık Giyim", baslik: "Pantolon alana gömlek hediye", kategori: "Giyim ve tekstil", oran: 20, mesafe: 3 },
    { isletme: "Köşe Fırını", baslik: "Akşam ekmek yarı fiyat", kategori: "Fırın", oran: 50, mesafe: 4 },
    { isletme: "Pırıl Halı Yıkama", baslik: "Halı yıkamada %15 indirim", kategori: "Hizmet", oran: 15, mesafe: 8 }
  ]
};
const OGELER = [{ tip: "duyuru", baslik: "Duyuru", metin: "Cumartesi bahçe temizliği var, gönüllüler toplanıyor", link: "#gundem", t: 5 }, { tip: "etkinlik", baslik: "Komşu çay saati", metin: "Pazar 16:00 salonda", link: "#etkinlik", t: 4 },
  { tip: "firsat", baslik: "Köşe Fırını · %50", metin: "Akşam ekmek yarı fiyat", link: "#firsat", t: 3 }, { tip: "urun", baslik: "Domates", metin: "25 TL / kg", link: "#sepet", t: 1 }];

test("Maliyet hesabı: halı, ütü, süt, market, temizlik rakamları yönetimin girdiği fiyatlardan çıkar", () => {
  let c = M.coz("10 metrekare halıyı kaça yıkatırım?", VERI, OGELER);
  assert.equal(c.tur, "hesap"); assert.equal(c.toplam, 450); assert.equal(c.satirlar[0].miktar, "10 m²"); assert.match(c.notlar.join(" "), /ölçümden sonra/); assert.equal(c.oneriler[0].isletme, "Pırıl Halı Yıkama", "halı yıkama fırsatı da önerilir");
  assert.equal(M.coz("12,5 m² halı kaç para", VERI, []).toplam, 562.5);
  c = M.coz("5 gömlek 3 pantolon ütü ne kadar", VERI, []); assert.equal(c.toplam, 5 * 60 + 3 * 70); assert.equal(c.satirlar.length, 2);
  c = M.coz("5 gömlek ütü aynı akşam kaç tl", VERI, []); assert.equal(c.toplam, 5 * 60 + 5 * 20, "aynı akşam ek ücreti");
  c = M.coz("2 elbise ütü ne kadar", VERI, []); assert.equal(c.tur, "hesap"); assert.equal(c.satirlar[0].tutar, null); assert.match(c.notlar.join(" "), /henüz fiyat girmemiş/, "fiyat yoksa uydurmaz");
  c = M.coz("2,5 kg domates kaç lira", VERI, []); assert.equal(c.toplam, 62.5);
  c = M.coz("peynir kaç tl", VERI, []); assert.match(c.notlar.join(" "), /henüz fiyat girmemiş/);
  assert.notEqual(M.coz("3 kg salatalık kaç tl", VERI, []).tur, "hesap", "pasif ürün hesaplanmaz");
  c = M.coz("ev temizliği ne kadar", VERI, []); assert.equal(c.toplam, 900);
  c = M.coz("halı yıkama fiyatı", VERI, []); assert.equal(c.toplam, null); assert.match(c.notlar.join(" "), /kaç metrekare/, "miktar yoksa sorar");
});

test("Maliyet hesabı: süt için çiftlik ile market karşılaştırılır; hizmet istenirse yalnız çiftlik", () => {
  let c = M.coz("5 litre süt kaça gelir?", VERI, []); assert.equal(c.satirlar.length, 2); assert.equal(c.satirlar[0].tutar, 200); assert.equal(c.satirlar[1].tutar, 150); assert.match(c.notlar.join(" "), /Market\/pazar litrede 10,00? TL daha ucuz|Market\/pazar litrede 10 TL daha ucuz/); assert.equal(c.toplam, null, "iki alternatifin toplamı yok");
  c = M.coz("5 litre çiftlik sütü kaça gelir?", VERI, []); assert.equal(c.satirlar.length, 1); assert.equal(c.toplam, 200);
  c = M.coz("haftalık 3 litre taze süt kaç tl", VERI, []); assert.ok(c.satirlar.some(s => /Haftalık tekrar/.test(s.ad) && s.tutar === 480)); assert.equal(c.toplam, 120, "haftalık satır toplama eklenmez");
});

test("Hesap kapalı hizmeti ya da fiyatı olmayan hizmeti uydurmaz; hizmet kapalıysa hesap yok", () => {
  assert.notEqual(M.coz("10 m2 halı kaça yıkanır", { ...VERI, hali: { aktif: false, fiyat: 45 } }, []).tur, "hesap");
  const c = M.coz("10 m2 halı kaça yıkanır", { ...VERI, hali: { aktif: true, fiyat: "" } }, []); assert.equal(c.tur, "hesap"); assert.equal(c.satirlar[0].tutar, null); assert.equal(c.toplam, null);
});

test("Fırsat araması: 'en uygun kıyafeti nerede bulabilirim?' indirimi yüksek ve yakın olanı öne alır; bulamazsa uydurmaz", () => {
  const c = M.coz("En uygun kıyafeti nerede bulabilirim?", VERI, OGELER); assert.equal(c.tur, "firsat"); assert.deepEqual(c.sonuclar.map(f => f.isletme), ["Moda Butik", "Şık Giyim"]);
  assert.equal(M.coz("ucuz ekmek nerede var", VERI, OGELER).sonuclar[0].isletme, "Köşe Fırını");
  const y = M.coz("En uygun ilacı nerede bulabilirim?", VERI, OGELER); assert.equal(y.tur, "firsatYok"); assert.match(y.anahtar, /ilac/);
  assert.equal(M.coz("en uygun kıyafeti nerede bulabilirim", { ...VERI, firsatlar: [] }, []).tur, "firsatYok");
});

test("Site araması: Gündem, Etkinlik, ürün ve fırsat kayıtlarında bulur; bilgi bankası ve hesap önceliklidir", () => {
  let c = M.coz("bahçe temizliği ne zaman", VERI, OGELER); assert.equal(c.tur, "arama"); assert.equal(c.sonuclar[0].tip, "duyuru");
  assert.equal(M.coz("çay saati", VERI, OGELER).sonuclar[0].baslik, "Komşu çay saati");
  assert.equal(M.coz("Düello nasıl oynanır?", VERI, OGELER).tur, "bilgi");
  assert.equal(M.coz("Halı nasıl yıkatılır, yıkatmak istiyorum", VERI, OGELER).tur, "bilgi", "fiyat/miktar yoksa hesap değil, anlatım");
  assert.equal(M.coz("zebra giraffe", VERI, OGELER).tur, "yok");
  assert.equal(M.coz("", VERI, OGELER).tur, "yok");
});

test("Gizlilik: arama yalnızca verilen herkese açık öğelerde çalışır (kat, daire, telefon alanı yok)", () => {
  const html2 = html.slice(html.indexOf("function ogeTopla()"), html.indexOf("function kartHtml"));
  assert.doesNotMatch(html2, /profil|tumSakinler|tumHz|tumMgz|telefon|daire|hizmetSiparis|magazaSiparis|firsatOneri/i, "ogeTopla kişisel alanlara dokunmaz");
});

/* ---- Yönetim asistanı ve hesaplar: rol ve gizlilik ---- */
const YD = {
  aidat: 1500, bloklar: [{ ad: "A", daire: 12 }, { ad: "B", daire: 12 }, { ad: "C", daire: 12 }],
  sakinler: [{ ad: "Ayşe Yılmaz", blok: "C", kat: 5, daire: "12", durum: "Malik", telefon: "0532 111 22 33" }, { ad: "Ali Kaya", blok: "A", kat: 0, daire: "1", durum: "Kiracı", telefon: "0555 000 11 22" }, { ad: "Deniz Er", blok: "C", kat: 2, daire: "5", durum: "Malik", telefon: "" }],
  urunler: [{ id: "u1", ad: "Domates", birim: "kg", fiyat: 25 }, { id: "u2", ad: "Süt", birim: "litre", fiyat: 30 }, { id: "u3", ad: "Peynir", birim: "kg", fiyat: "" }],
  sepetler: [{ konum: { blok: "C", kat: 5, daire: "12" }, kalemler: { u1: 3, u2: 2 } }, { konum: { blok: "A", kat: 0, daire: "1" }, kalemler: { u1: 1, u3: 1 } }, { konum: { blok: "C", kat: 2, daire: "5" }, kalemler: { u1: 0 }, ozel: [] }],
  magaza: [{ konum: { blok: "C" }, ad: "Ekmek", adet: 2, fiyat: 10, durum: "yeni" }, { konum: { blok: "A" }, ad: "Kahve", adet: 1, fiyat: 99, durum: "iptal" }],
  hizmetler: [{ tur: "utu", durum: "yeni" }, { tur: "hali", durum: "yeni" }, { tur: "hali", durum: "teslim" }, { tur: "sut", durum: "onay" }]
};
const Y = (q, rol, D = YD) => M.coz(q, {}, [], D, rol);

test("Yönetici: daire ve kişi sorgusu (kat, daire, telefon) doğru kişiyi bulur", () => {
  let c = Y("C blok 5. kat 12. daire kim oturuyor", "yonetici"); assert.equal(c.tur, "hesap"); assert.equal(c.satirlar.length, 1); assert.match(c.satirlar[0].ad, /Ayşe Yılmaz · Malik/); assert.equal(c.satirlar[0].deger, "", "telefon istenmedi");
  c = Y("Ayşe Yılmaz'ın telefonu", "yonetici"); assert.equal(c.satirlar[0].deger, "0532 111 22 33"); assert.match(c.satirlar[0].miktar, /C Blok · 5\. kat · Daire 12/);
  c = Y("Deniz Er telefon numarası", "yonetici"); assert.equal(c.satirlar[0].deger, "telefon yok");
  c = Y("C blok 2. kat kim oturuyor", "yonetici"); assert.match(c.satirlar[0].ad, /Deniz Er/);
  c = Y("B blok 3. kat 7. daire kim", "yonetici"); assert.equal(c.satirlar.length, 0); assert.match(c.notlar[0], /kart oluşturmuş bir sakin görünmüyor/);
  assert.match(Y("Ali Kaya telefonu", "yonetici").notlar.join(" "), /yalnızca yönetime gösterilir/);
});

test("Sakin: komşuların kat, daire, telefon ve siparişlerini soramaz; kendi aidatını ve harcamasını görür", () => {
  for (const q of ["Ayşe Yılmaz'ın telefonu", "C blok 5. kat 12. daire kim oturuyor", "komşumun telefon numarası", "A blokta kim oturuyor", "Ali Kaya kiracı mı"]) {
    const c = Y(q, "sakin"); assert.equal(c.tur, "yetki", q); assert.doesNotMatch(JSON.stringify(c), /0532|0555|Ayşe|Ali Kaya/, "veri sızmaz: " + q);
  }
  assert.equal(Y("bu tur sipariş tutarı ne kadar", "sakin").tur === "hesap" && Y("bu tur sipariş tutarı ne kadar", "sakin").yonetim, false, "site geneli sipariş toplamı sakine verilmez");
  const ben = { ...YD, sakinler: undefined, sepetler: undefined, magaza: undefined, benMagaza: [{ ad: "Ekmek", adet: 2, fiyat: 10, durum: "yeni" }, { ad: "X", adet: 1, fiyat: 50, durum: "iptal" }], benSepet: { kalemler: { u1: 2, u3: 1 } } };
  const h = Y("bu ay harcamam ne kadar", "sakin", ben); assert.equal(h.tur, "hesap"); assert.equal(h.toplam, 20 + 50, "mağaza 20 + sepet 2 kg domates 50; iptal ve fiyatsız hariç"); assert.match(h.notlar.join(" "), /Fiyatı girilmemiş/);
  const a = Y("aidat 3 ay ne kadar", "sakin"); assert.equal(a.toplam, 4500); assert.ok(!a.satirlar.some(s => /Tüm hanelerin/.test(s.ad)), "sakin site toplamını görmez");
});

test("Aidat: tutar, ay sayısı, yıllık; yönetici tüm hanelerin toplamını görür; ödeme takibi olmadığını dürüstçe söyler", () => {
  let c = Y("yıllık aidat ne kadar", "yonetici"); assert.equal(c.toplam, 18000); const t = c.satirlar.find(s => /Tüm hanelerin/.test(s.ad)); assert.equal(t.tutar, 36 * 1500); assert.match(c.notlar.join(" "), /blok ayarlarındaki daire/);
  c = Y("aidat ödemeyenler kim", "yonetici"); assert.equal(c.tur, "bilgi"); assert.match(c.cevap, /ödeme takibi bu uygulamada henüz yok/);
  assert.equal(Y("aidat ne kadar", "sakin", { ...YD, aidat: "" }).tur, "bilgi", "tutar girilmemişse hazır cevap: yönetime sor"); assert.match(Y("aidat ne kadar", "sakin", { ...YD, aidat: "" }).cevap, /bilmiyorum/);
});

test("Yönetici: market ve gıda harcaması, en çok sipariş edilen, blok kırılımı, hizmet talepleri, hane sayısı", () => {
  let c = Y("bu tur sipariş tutarı ne kadar", "yonetici");
  const v = Object.fromEntries(c.satirlar.map(s => [s.ad, s.deger || s.tutar]));
  assert.equal(v["Toplu sipariş (bu tur): hane"], "2 hane", "sıfır adetli sepet sayılmaz"); assert.equal(v["Toplu sipariş (bu tur) tutarı"], 3 * 25 + 2 * 30 + 1 * 25); assert.equal(v["Mağaza siparişleri"], 20, "iptal hariç");
  assert.equal(c.toplam, 160 + 20); assert.equal(c.satirlar.find(s => /^En çok/.test(s.ad)).ad, "En çok: Domates"); assert.match(c.notlar.join(" "), /güncel fiyat/); assert.match(c.notlar.join(" "), /Fiyatı girilmemiş 1 kalem/);
  c = Y("blok blok market harcaması", "yonetici"); assert.ok(c.satirlar.some(s => s.ad === "C Blok" && s.tutar === 135)); assert.ok(c.satirlar.some(s => s.ad === "A Blok" && s.tutar === 25));
  c = Y("C blok sipariş tutarı", "yonetici"); assert.ok(c.satirlar.some(s => s.ad === "C Blok toplu sipariş" && s.tutar === 135));
  c = Y("bekleyen halı talepleri", "yonetici"); assert.deepEqual(c.satirlar.map(s => [s.ad, s.deger]), [["Halı yıkama", "1 talep"]]);
  c = Y("açık hizmet talepleri", "yonetici"); assert.equal(c.satirlar.find(s => s.ad === "Taze süt").deger, "1 talep");
  c = Y("kaç hane kayıtlı", "yonetici"); assert.equal(c.satirlar[0].deger, "3"); assert.equal(c.satirlar.find(s => s.ad === "C Blok").deger, "2 kayıt");
});

test("Yönetim asistanı: veri yoksa ya da rol verilmezse sakin gibi davranır (varsayılan güvenli)", () => {
  assert.equal(M.coz("Ayşe Yılmaz'ın telefonu", {}, [], YD).tur, "yetki", "rol yoksa sakin");
  assert.notEqual(M.coz("Düello nasıl oynanır?", {}, [], undefined).tur, "yetki");
});

test("Araç yıkama: tür seçilince tutar ve adet; tür yoksa seçenekler toplanmaz; fiyat yoksa uydurmaz", () => {
  const v = { arac: { aktif: true, turler: [{ ad: "Dış yıkama", fiyat: 250 }, { ad: "İç ve dış yıkama", fiyat: 400 }, { ad: "Detaylı temizlik", fiyat: "" }] } };
  let c = M.coz("2 araç iç ve dış yıkama kaç tl", v, []); assert.equal(c.toplam, 800); assert.equal(c.satirlar[0].miktar, "2 araç");
  c = M.coz("arabamı dış yıkama yaptırmak kaça", v, []); assert.equal(c.toplam, 250);
  c = M.coz("araç yıkama ne kadar", v, []); assert.equal(c.toplam, null, "seçenekler toplanmaz"); assert.equal(c.satirlar.length, 3); assert.match(c.notlar.join(" "), /seçenekler, toplanmaz/); assert.match(c.notlar.join(" "), /henüz fiyat girmemiş/);
  assert.equal(M.coz("Araç yıkama nasıl yapılır", v, []).id, "arac");
  assert.notEqual(M.coz("araç yıkama ne kadar", { arac: { ...v.arac, aktif: false } }, []).tur, "hesap");
});
