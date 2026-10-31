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
