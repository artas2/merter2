# Komut günlüğü (Retor Ustası)

Her komut, `docs/retorik-ustasi.md` şablonuyla yeniden yazılır ve 0–100 puanlanır. En yeni kayıt en üsttedir.

---

## 2026-10-31 · Kedinin adı Minnoş; soruları yapay zekâ ile cevaplasın; kahve falı baksın; "Ona bu becerileri öğretin"

**Kullanıcının sözleri:** "Kedinin ismi minnoş olsun ve soruları aı ile cevaplasın ve kahve falı bakabilsin." · "Ona bu becerileri öğretin."

```
HEDEF       : Kedi Minnoş adını alsın; yapay zekâ ile soru cevaplasın; kahve falına baksın; bu beceriler ölçülerek "öğretilsin".
KAPSAM      : 1) Ad değişikliği (Bekçi Kedi → Minnoş) her yerde.
              2) Panel: Soru sor / Kahve falı. Soru-cevap: sunucuda Anthropic API bağlantısı (anahtar gelince), yoksa hazır bilgi bankası.
              3) Kahve falı: konu + 1-3 sembol + niyet; kapanan fincan animasyonu; AI ya da yerel fal.
              4) "Öğretmek": 35 konuluk bilgi bankası, fal bankası, ölçüm testleri (doğruluk, konu dışı, bağımsız küme, korkutucu söz yok).
KAPSAM DIŞI : Fincan fotoğrafını yorumlamak; sesli miyav.
KISITLAR    : Dürüstlük: yapay zekâ anahtarı yokken yapay zekâ gibi davranılmaz, kaynak etiketi gösterilir; anahtar sohbete yazılmaz, istemciye gitmez;
              gizlilik: soru maskelenir, saklanmaz; fal eğlencedir; önce sor (push, yayın).
BAŞARI      : Sahte Anthropic sunucusuyla istek biçimi, Premium kapısı, günlük sınır, Bekçi süzgeci testi; hazır bilgi bankası ≥ %90; tarayıcıda panel, fal, yedeğe geçiş.
VARSAYIMLAR : "aı" = yapay zekâ. "Öğretmek" = kural/bilgi bankası + ölçüm (modelin kendisi yeniden eğitilemez). Model: claude-haiku-5-5 (düşük gecikme ve maliyet).
BELİRSİZ    : Anahtarın verilmesi ve maliyet bütçesi (yok: yapay zekâ kapalı kalır); kahve falının dinî hassasiyetler açısından uygunluğu (gizlenebilir).
```

**Puan: 88 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 3, kısalık 3, dil 4.
- Ölçüm: bilgi bankası ilk ölçümde %83,3 (7 yanlış) çıktı; eşleştirme ve anahtar sözcükler düzeltilince aynı kümede %100. Bu küme ayarlamada kullanıldığı için bağımsız değil; ayarlamadan sonra yazılan 15 yeni soruluk ikinci kümede 15/15. Gerçek kullanıcı soruları ölçülmedi.

---

## 2026-10-31 · Bekçi Kedi: siteyi neşelendir, uygulamayı bize tanıtsın; dişi sokak kedisi

**Kullanıcının sözleri:** "Siteyi bir bekçi kedi animasyonuyla neşelendir. Ve bekçi kedi uygulamayı bize tanısın ilk başta. Bekçi kedi dişi bir sokak kedisi olabilir."

```
HEDEF       : Köşede animasyonlu bir maskot; ilk açılışta uygulamayı tanıtan tur.
KAPSAM      : Alaca (üç renkli, dişi) sokak kedisi, kendi SVG çizimimiz; nefes, göz kırpma, kuyruk, kulak oynatma; dokununca mırıltı ve kalpler;
              sayfaya göre kısa sözler; 9 adımlı tanıtım turu (Arena yoksa 7); Kartım'da gizle/göster/turu tekrarla.
KISITLAR    : Hareket azaltmaya uy; dokunma hedefi ≥ 44 px; otomasyon testlerini bozma; önce sor (push, yayın).
BAŞARI      : Tarayıcı testleri: kedi, animasyon adları, tur adımları, odak, Esc, gizle/göster, 320 ve 390 px.
VARSAYIMLAR : "Bekçi Kedi" adı kullanıcıdan; Bekçi sohbet botunun yüzü olarak da anlatılır. Alaca tüy seçildi (alaca kedilerin neredeyse hepsi dişidir).
              Kulaktaki çentik sokak kedilerinde bakım işaretidir (süs olarak çizildi).
BELİRSİZ    : Adı (şimdilik "Bekçi Kedi"); sesli miyav istenip istenmediği (eklenmedi).
```

**Puan: 90 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 3, dil 3.

---

## 2026-10-31 · Fırsatlarda firmanın sitesine bağlantı; büyük, köşesiz, akışkan düğme, tıklama animasyonu

**Kullanıcının sözleri:** "Fırsatlarda fırsatını sunduğumuz firmanın kendi sitesine de bağlanan link için yer gömedim. Bu tuş birazcık büyük olsun. Köşeleri bulunmasın. Ve yönlendirici akışkan bir desene sahip olsun. Ve müşteri tuşa tıklayınca animasyon görmek istiyorum."

```
HEDEF       : Fırsat kartında firmanın web sitesine giden bir düğme.
KAPSAM      : Fırsat formuna "Firmanın web sitesi" alanı (yalnızca https); düğme 60 px yüksek, tam yuvarlak, akan dalga ve kayan gradyan deseni;
              tıklayınca dalgacık, sıçrama ve ok animasyonu; site yeni sekmede açılır.
KISITLAR    : Güvenlik: yalnızca https, noopener; hareket azaltmada animasyon kapalı; sakin önerilerinde yönetim onaylamadan yayınlanmaz.
BAŞARI      : Test: düğme boyutu ve yuvarlaklığı, animasyon adları, tıklamada sınıf ve dalgacık, http/javascript: reddi.
VARSAYIMLAR : "Köşeleri bulunmasın" = tam yuvarlak (hap) biçim. "Yönlendirici" = yönlendiren düğme. Bağlantı sayfayı değiştirmez, yeni sekmede açılır.
```

**Puan: 87 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 3 ("gömedim" = yer ayırmadım diye okudum), kısıtlar 4, yapı 4, kısalık 4, dil 3.

---

## 2026-10-31 · İçerideki sohbeti denetleyecek bir bot; bu botu eğit

**Kullanıcının sözleri:** "İçerideki sohbeti denetleyecek bir bot gerek. Bu botu eğit."

```
HEDEF       : Sohbet mesajlarını denetleyen ve eğitilebilen bot (Bekçi).
KAPSAM      : Kurallar (küfür, hakaret, tehdit, reklam, bağırma, tekrar; yazım oyunlarına dayanıklı), kişisel bilgi maskeleme, eğitilen model,
              otomatik susturma, yönetimde Bekçi sekmesi (olaylar, doğru/yanlış alarm), eğitim betiği ve ölçüm.
KAPSAM DIŞI : Dış yapay zekâ servisi (mesajlar dışarı gitmez); Gündem gönderileri ve yorumlar (yalnızca sohbet).
KISITLAR    : Dürüstlük: doğruluk yalnızca ölçülen veriyle söylenir; geri alınamaz iş yok (susturma yönetimce kaldırılır); gizlilik: kayıtlar 90 gün.
BAŞARI      : Ayrı değerlendirme kümesinde izle dahil kesinlik ≥ %90, duyarlılık ≥ %90; engelleme kararında temiz mesaj engellenmez; "sık sık", "şikayet" gibi masum sözler geçer.
VARSAYIMLAR : "Eğit" = örneklerle model eğitmek + yönetim geri bildirimiyle iyileştirmek. Eğitim verisi sentez ve el yazımı (gerçek sohbet verisi yok).
BELİRSİZ    : Gerçek sohbetteki doğruluk (ölçülmedi); Gündem ve yorumların da denetlenip denetlenmeyeceği.
```

**Puan: 88 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 4 (verinin sentez olduğu açık yazıldı), kısıtlar 4, yapı 4, kısalık 3, dil 3.

---

## 2026-10-31 · Turnuva bölümüne Satranç, 101, Okey ve Tavla

**Kullanıcının sözleri:** "Turnuva bölümüne Satranç, 101, okey, Tavla ekleyelim."

```
HEDEF       : Turnuvada Satranç, 101, Okey ve Tavla oynanabilsin.
KAPSAM      : (Bu adım, kullanıcının seçimiyle) Satranç ve Tavla: canlı, süreli, sunucu yetkili; turnuva açılırken oyun seçimi;
              tahta ekranları, saat, zar, terfi penceresi, teslim; Mavi Öz ve şampiyonluk ödülü mevcut sisteme bağlı.
KAPSAM DIŞI : Okey ve 101 (4 kişilik): mevcut eleme ağacı 1'e 1 olduğundan 4'lü masa turu ayrı adımda yapılacak.
KISITLAR    : Premium; kurallar uydurulmaz (standart kurallar, doğrulama testi); önce sor (push, yayın); kendi çizimlerim.
BAŞARI      : Satranç hamle üretimi standart perft sayılarıyla eşleşir; rastgele tam oyunlar tutarlı biter; API ve tarayıcı testleri
              iki sakinin oyunu sonuna kadar oynadığını doğrular.
VARSAYIMLAR : Canlı süreli oynanış (kullanıcı seçti). Satranç beyaz/siyah rastgele. Tavla: standart kurallar, katlama zarı ve mars yok.
              Turnuvada beraberlik olmaz (renk değiştirip yeniden oyun, sonra saat).
BELİRSİZ    : Okey ve 101 için varyant (Türk okeyi kuralları, 101'de puanlama) ve 4'lü masa turnuva biçimi.
```

**Puan: 86 (baş usta).** Niyete sadakat 3 (dört oyundan ikisi bu adımda), ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 3, dil 4.

---

## 2026-10-31 · Arenayı ve ses efektlerini unutma

**Kullanıcının sözleri:** "Arenayı ve ses efektlerini unutma."

```
HEDEF       : Arena olaylarına ses efekti eklemek; arena işlerini eksiksiz bitirmek.
KAPSAM      : 1) 12 ses: rakip bulundu, kabul, geri sayım tıkı, başla, doğru, yanlış, galibiyet, yenilgi, beraberlik, ödül, Mavi Öz, süre doldu.
              2) Sesler cihazda sentezlenir (dosya ve lisans yok); aç/kapa düğmesi, tercih cihazda saklanır.
              3) Her ses 48 kHz'de ölçülür; ölçüm betiği ve test.
KISITLAR    : Kural 1 (ölçüp rakam ver); önce sor (push, yayın); ücretsiz.
BAŞARI      : True peak ≤ -3 dBTP, anlık yükseklik ≤ -18 LUFS (test); tarayıcı testi seslerin doğru anda çalındığını doğrular.
VARSAYIMLAR : -14 LUFS müzik/yayın akışı referansıdır; arayüz sesleri bilerek daha sessiz tutuldu.
              "Arenayı unutma" = arenadaki yarım işler (eşleşme, kimlik, görevler) bitirilsin.
BELİRSİZ    : Cihaz hoparlöründe algılanan ses düzeyi (yalnızca sayısal seviye ölçüldü).
```

**Puan: 86 (baş usta).**
- Niyete sadakat 3: "Arenayı unutma" belirsiz, yorumlandı.
- Ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 4, dil 4.

---

## 2026-10-31 · Hizmetlerimize halı yıkama ve çiftlikten taze süt

**Kullanıcının sözleri:** "Eklemesini istediğim diğer şey de, hizmetlerimiz kısmına halı yıkama ve taze süt çiftlikten."

```
HEDEF       : Hizmetler sayfasına "Halı yıkama" ve "Çiftlikten taze süt" eklemek.
KAPSAM      : 1) Halı: halı sayısı, tahmini m², toplama günü, not; tahmini tutar (TL/m²); durum Talep alındı → Toplandı → Hazır → Teslim.
              2) Süt: litre (1–10), teslim günü, "her hafta tekrarla", not; tutar (TL/litre); durum Sipariş alındı → Onaylandı → Teslim.
              3) Yönetim: Halı ve Süt sekmeleri (süt günlere göre toplam litre), ayarlarda fiyat, çiftlik adı, teslim günleri, son sipariş saati.
KAPSAM DIŞI : Ödeme almak; belirli bir çiftlik ya da firma seçmek.
KISITLAR    : Fiyat ve tedarikçi uydurulmaz (yönetim girer, boşsa "yönetimce belirlenir"); kişisel veri gizli; önce sor.
BAŞARI      : Claude sayfası testi 24/24; mevcut hizmet testleri bozulmaz; 320 px'de yatay kayma yok.
VARSAYIMLAR : "Hizmetlerimiz" = Hizmetler sayfası. Varsayılan teslim günleri Salı ve Cuma (yönetim değiştirir).
BELİRSİZ    : Tedarikçinin gıda satışı için gerekli kayıt ve izinleri (yönetim kontrol etmeli; uygulama doğrulamaz).
```

**Puan: 88 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 3, dil 3.

---

## 2026-10-31 · Günlük ve haftalık görevler

**Kullanıcının sözleri:** "Haftalık ve günlük olmak üzere görevler verebiliriz bu aşamada."

```
HEDEF       : Arenaya günlük ve haftalık görevler eklemek.
KAPSAM      : 3 günlük (2 düello, 1 galibiyet, 1 kart) ve 5 haftalık (10 düello, 5 galibiyet, 5 kart, kusursuz maç, turnuva maçı) görev;
              Görevler sekmesi, ilerleme çubuğu, yenilenme geri sayımı, "Ödülü al" ve sekmede alınabilir ödül rozeti.
KISITLAR    : İlerlemeyi sunucu hesaplar; ödül bir kez alınır; önce sor.
BAŞARI      : API testi: ödül iki kez alınamaz, tamamlanmadan alınamaz, ertesi gün sıfırlanır; tarayıcı testi ödül alır.
VARSAYIMLAR : Ödül Mavi Öz; gün Türkiye saatiyle 00:00'da, hafta pazartesi yenilenir.
BELİRSİZ    : Görev listesi ve ödül miktarları (değiştirilebilir).
```

**Puan: 87 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 3, kısıtlar 4, yapı 4, kısalık 4, dil 3.

---

## 2026-10-31 · Her eşleşmeden sonra Mavi Öz; istenirse profilde görünsün

**Kullanıcının sözleri:** "Her eşleşmeden sonra mavi öz ekleyelim." · "Mavi öz kazanımları profilde istenirse gösterilebilir."

```
HEDEF       : Eşleşmeli her düellodan sonra Mavi Öz vermek; sahibi isterse kartlarında göstermek.
KAPSAM      : Galibiyet 30, beraberlik 20, yenilgi 15; turnuva maçı +10, şampiyonluk +100; sonuç ekranında "+N Mavi Öz";
              Kimlik'te toplam ve "Mavi Öz'ü kartımda göster" anahtarı (Kartım, komşu kartı, eşleşme ekranı).
KAPSAM DIŞI : Mavi Öz harcama (mağaza) — istenmedi.
KISITLAR    : Antrenman öz vermez; aynı rakiple günde 3 maçtan sonrası vermez (hile önleme); varsayılan gizli; önce sor.
BAŞARI      : API testi: 30/15 miktarları, gizliyken başkası göremez, açınca görür.
VARSAYIMLAR : "Mavi Öz" adı kullanıcıdan; simgesi kendi çizimimiz (yontulmuş mavi damla). Miktarlar seçildi.
BELİRSİZ    : Mavi Öz'ün neye harcanacağı.
```

**Puan: 86 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 3, kısıtlar 4, yapı 3, kısalık 4, dil 3.

---

## 2026-10-31 · Turnuva kazananı bu ikonlardan elde etsin

**Kullanıcının sözleri:** "Turnuva sistemi kazananı bu ikonlardan elde etsin." (İstanbul ve Anadolu temalı 15 ikonluk görsel)

```
HEDEF       : Turnuva şampiyonlarına görseldeki 15 temadan simge vermek.
KAPSAM      : Galata Kulesi, Kız Kulesi, Ayasofya, Boğaz Köprüsü, Al Bayrak ve Lale, Karadeniz Çayı, Taş Köprü, Antep Fıstığı, Baklava,
              Zeugma Mozaiği, Demli Çay, Nazar Boncuğu, Vapur, İstanbul Silueti, Lale. Yönetici turnuvayı açarken ödülü seçer
              (boşsa sıradaki). Şampiyon onu, zaten varsa sıradaki eksik simgeyi kazanır. Kimlik'te "Turnuva koleksiyonu".
KISITLAR    : Ödülü yalnızca sunucu verir; önce sor.
BAŞARI      : API testi: şampiyon seçilen simgeyi kazanır, koleksiyon dışı ödül reddedilir; tarayıcı testi ödül kartını görür.
VARSAYIMLAR : Görsel bana dosya olarak gelmedi; aynı 15 tema kendi SVG çizimimle yapıldı (gece mavisi zemin, altın kurdele).
BELİRSİZ    : Asıl görselin kullanım hakkı ve dosyası (gelirse çizimlerin yerine konabilir).
```

**Puan: 84 (baş usta).**
- Niyete sadakat 3: görselin kendisi yerine çizim kullanıldı.
- Ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 3, dil 3.

---

## 2026-10-31 · 10 saniyelik bekleme ekranı; tepki yoksa en yakın diğer eşleşme

**Kullanıcının sözleri:** "Önce 10 saniye bir bekleme ekranı koy; eğer kullanıcı 10 saniye içinde tepki vermez ise en yakından diğer eşleşmeye yönel."

```
HEDEF       : Rakip bulununca 10 sn onay ekranı; yanıt vermeyeni düşürüp kabul edeni sıradaki rakibe yöneltmek.
KAPSAM      : Kabul et / Reddet; iki taraf da kabul edince maç. Yanıt vermeyen "Eşleşmeyi kaçırdın" görür;
              kabul eden kuyruğa döner ve sezon puanı en yakın bekleyenle hemen yeni teklif alır.
KISITLAR    : Kararı sunucu verir; önce sor.
BAŞARI      : API testi: zaman aşımında yönelme, en yakın puan seçimi, süresi dolan teklif kabul edilemez; tarayıcı testi iki senaryo.
VARSAYIMLAR : "En yakın" = sezon puanı en yakın (eşitlikte en uzun bekleyen). Reddetmek de yanıt vermemek sayılır.
BELİRSİZ    : "En yakın" konum anlamında mı (blok)? Puan seçildi.
```

**Puan: 87 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 3, dil 3.

---

## 2026-10-31 · Eşleşmeleri kazananlar ikon ve sembol elde etsin, profil kartında göstersin

**Kullanıcının sözleri:** "Eşleşmeleri kazananlar, bu tarz ikonlar, değişik semboller elde etsin. Ve bunları profil kartlarında gösterebilsin." (LoL "Kimliğini Kişiselleştir" ekran görüntüsü)

```
HEDEF       : Kazanılan simge, çerçeve, sembol ve unvanlarla kişiselleştirilebilen arena kimliği.
KAPSAM      : 10 simge, 6 çerçeve, 9 sembol, 9 unvan; koşullar (galibiyet, seri, kusursuz maç, kartlar, sezon, turnuva);
              Kimlik sekmesi (Simgeler / Çerçeveler / Semboller / Unvanlar, kilitlide koşul yazılı); en çok 3 sembol;
              sıralama, eşleşme, komşu kartı ve Kartım'da görünür.
KAPSAM DIŞI : Ekran görüntüsündeki oyunun görselleri ve adları (yalnızca ilham).
KISITLAR    : Ödülü sunucu verir; kat, daire ve telefon gösterilmez; önce sor.
BAŞARI      : API testi: sahip olunmayan seçilemez; tarayıcı testi seçimi profil kartında görür.
VARSAYIMLAR : "Profil kartı" = Kartım ve sıralamadan açılan komşu kartı.
```

**Puan: 88 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 3, kısıtlar 4, yapı 4, kısalık 3, dil 4.

---

## 2026-10-31 · Eşleştirme ekranı ekle ve süre sınırı koy, animasyonlu

**Kullanıcının sözleri:** "Eşleştirme ekranı ekle ve süre sınırı koy animasyonlu."

```
HEDEF       : Düello için animasyonlu, süre sınırlı tam ekran eşleştirme.
KAPSAM      : 60 sn arama sınırı ve geri sayan halka, radar damlaları; süre dolunca "Tekrar dene / Antrenman";
              eşleşince VS karşılaşma (iki oyuncu yandan kayar). Hareket azaltma tercihine uyulur; dokunma hedefi ≥ 44 px.
KISITLAR    : Önce sor (push, yayın); başka oyunun görseli yok.
BAŞARI      : API testi süre sınırı; tarayıcı testi halka, VS ve "Süre doldu" ekranını görür.
VARSAYIMLAR : Komut iki anlama gelebiliyordu (rakip eşleştirme / kart eşleştirme oyunu); soruma yanıt gelmedi, rakip eşleştirme seçildi.
BELİRSİZ    : Süre (60 sn) değiştirilebilir (ARENA_ESLESME_MS).
```

**Puan: 85 (baş usta).** Niyete sadakat 3 (iki anlamdan biri seçildi), ölçülebilirlik 4, belirsizlik 4, kısıtlar 4, yapı 4, kısalık 4, dil 3.

---

## 2026-10-31 · Rastgele aralıklarla değişsin, ekranlar aynı olmak zorunda değil

**Kullanıcının sözleri:** "Ekran aynısı olmak zorunda değil, sadece random aralıklar ile değişmesini istiyorum; bu ileride belirli bir sürede olabilir."

```
HEDEF       : Duvar kâğıdı rastgele aralıklarla, rastgele metinle değişsin; ileride sabit süreye geçilebilsin.
KAPSAM      : 1) Android "Rastgele aralıklarla" (önerilen): ana ve kilit ekranına birbirinden bağımsız rastgele metin;
                 süre Sık 15–60 dk / Orta 1–3 sa / Seyrek 3–8 sa ya da sabit 30 dk–24 sa.
              2) Rastgelelik deste mantığıyla: hepsi bir kez görünmeden tekrar yok, arka arkaya aynı metin yok.
              3) "Her açılışta yeni" de rastgele ve iki ekran bağımsız.
              4) iPhone Kestirmeler eylemine "Rastgele" seçeneği (varsayılan açık).
KISITLAR    : Önce sor (push, yayın); doğrulanmayanı yazma; ücretsiz.
BAŞARI      : Deste ve süre fonksiyonları testle doğrulanır (tekrar 0, sınırlar 15 dk–24 sa); arayüz testi seçimleri doğrular.
VARSAYIMLAR : "Ekran aynısı olmak zorunda değil" iki anlama da geldiği için ikisi de karşılandı:
              uygulamadaki günün metninden bağımsız, ana ve kilit ekranı da birbirinden bağımsız. Varsayılan: Orta (1–3 saat).
BELİRSİZ    : "Belirli süre"nin değeri (seçeneklerle bırakıldı); iPhone'da rastgele aralık mümkün değil (sabit saatler).
```

**Puan: 90 (baş usta).**
- Niyete sadakat 4, ölçülebilirlik 4, kısıtlar 4, yapı 4, dil 4.
- Belirsizlik 3: iki anlam açıkça yazıldı.
- Kısalık 3.

---

## 2026-10-31 · Duvar kâğıdı ve kilit ekranı Hikmet ile birlikte değişsin

**Kullanıcının sözleri (özet):** Ana sayfadaki günün ayeti/hadisi bölümünde duvar kâğıdı yapılabiliyor. Sayfa her değiştiğinde duvar kâğıdı ve kilit ekranı da değişsin; kişi telefonu her açtığında farklı bir hadis ya da ayet görsün.

```
HEDEF       : Hikmet metinleri değiştikçe telefonun ana ekranı ve kilit ekranı kendiliğinden değişsin.
KAPSAM      : 1) Android "Her açılışta yeni": canlı duvar kâğıdı, ekran her açıldığında sıradaki metin (kilitteyken kilit düzeni).
              2) Android "Her gün yeni": uygulamadaki günün ayeti/hadisi ile aynı sırada ana ve kilit ekranı.
              3) iPhone: Kestirmeler eylemi "Günün Hikmet görseli" ve kurulum adımları.
              4) Görseller telefonda bir kez üretilir; metin ya da site adı değişince yenilenir.
KAPSAM DIŞI : iPhone'da her kilit açılışında değişim (iOS izin vermiyor).
KISITLAR    : Yayın ve gönderme öncesi sor; doğrulanmayanı "doğrulanmadı" yaz; ücretsiz kalsın (duvar kâğıdı Merter'de ücretsiz).
BAŞARI      : Android kodu gerçek Android 15 sınıflarına karşı derlenir; günlük sıra Java ve uygulamada aynı;
              tarayıcı testi 46 görselin (23 × 2) 1080×1920 JPEG olarak üretildiğini doğrular.
VARSAYIMLAR : "Sayfa her değiştiğinde" = günün metni değiştiğinde (günlük) ya da her açılışta; ikisi de seçenek.
BELİRSİZ    : Samsung gibi bazı telefonların kilit ekranında üçüncü taraf canlı duvar kâğıdı gösterip göstermediği (doğrulanmadı).
SIRA        : Yerel Android → derleme denetimi → iOS → arayüz → test → belgeler → commit (push için sor).
```

**Puan: 88 (baş usta).**
- Niyete sadakat 4, ölçülebilirlik 4, kısıtlar 4, yapı 4, dil 4.
- Belirsizlik 3: Samsung kilit ekranı davranışı cihazda denenmeden bilinemiyor.
- Kısalık 3.

---

## 2026-10-30 · Kalıcı kurallar (ses/görüntü, sosyal medya, karakter, dürüstlük, geri alınamaz işler)

```
HEDEF       : Bu sohbetteki tüm işlerde beş kalıcı kurala uymak.
KAPSAM      : 1) Yayın sesi -23 LKFS ±1, 48 kHz, senkron ±10 ms, 4:2:2; müzik -14 LUFS, true peak < -1 dBTP; önce/sonra ölçüm.
              2) Kısa video 1080x1920 9:16 H.264+AAC 30 fps; platform sınırlarını güncel yardım sayfasından doğrula; yapay zekâ etiketi.
              3) Karakter içeriği: karakter dosyasına sadık kal; varsayılan "taslak"; yalnızca resmî API; token yazma; gerçek kişi taklidi yok.
              4) Doğrulanamayan spesifikasyonu uydurma, "doğrulanmadı" de.
              5) Gönderme, silme, yayınlama, ödeme öncesi sor.
KISITLAR    : Kalıcıdır; sonraki her komutun KISITLAR satırına eklenir.
BAŞARI      : Push, yayın ve silme işlemleri sorulmadan yapılmaz; ölçülmeyen rakam yazılmaz.
VARSAYIMLAR : 1–3 bu projede şimdilik ses, video ya da karakter üretimi olmadığı için uygulanacak iş yok; 4 ve 5 hemen geçerli.
              GitHub'a push ve Claude sayfasını yeniden yayınlama "yayınlama" sayılır.
```

**Puan: 92 (baş usta).** Niyete sadakat 4, ölçülebilirlik 4, belirsizlik 3, kısıtlar 4, yapı 4, kısalık 3, dil 4.

---

## 2026-10-30 · Arena, sezon, turnuva, sohbet, şikâyet, performans

**Kullanıcının sözleri (özet):**
- Şikâyet et düğmesini ekle.
- Bilgi kartları oluştur ve bu kartlarla, uygulamayı kullanan kat sakinleri arasında rastgele eşleşen yarışma düzenle.
- İki kişinin aynı anda çevrim içi olması gereken zamanlı özel turnuva sistemi kur.
- Last War oyunu gibi genel sezon mantığıyla çalışsın; sohbet penceresi açılabilsin.
- 1000'den fazla kişi aynı anda aktif olabilsin, bunu x100 yapabilecek performansla inşa et; Premium işlerdeki gibi uygula.
- Komutları yapay zekâya uyarla, her komutta tekrarla; bu birimi 0–100 retor ustası olarak eğit.
- İlk olarak site için yap.

```
HEDEF       : Site uygulamasına (Merter arayüzü + sunucu) bilgi kartlı yarışma, sezon, zamanlı turnuva, sohbet ve
              şikâyet düğmesi eklemek; 1000+ eşzamanlı kullanıcıyı ölçerek kanıtlamak.
KAPSAM      : 1) Şikâyet et: Gündem gönderisi, yorum ve sohbet mesajı; engelleme; yönetimde karar ekranı (Apple 1.2).
              2) Bilgi kartları (oku → kendini dene → öğren) ve rastgele eşleşmeli canlı düello (sunucu puanlar).
              3) Turnuva: belirli saatte, iki taraf da "hazırım" demeli; gelmeyen kaybeder.
              4) Sezon: 28 günlük sezon, kişisel sıralama, blok (A–E) takım sıralaması, unvanlar.
              5) Sohbet: site ve blok odaları.
              6) Premium kapısı (site öder modelinde herkese açık).
              7) 1000+ eşzamanlı yük testi; x100 için yol haritası.
              8) Bu günlük ve retor ustası belgesi.
KAPSAM DIŞI : Last War görselleri, markası, bayrak ve harita içerikleri (yalnızca ilham); x100'ün kurulumu ve ölçümü.
KISITLAR    : Ücretsiz önce; kişisel veri gizli (kat, daire ve telefon numarası gösterilmez); ölçülmeyen rakam yazılmaz;
              push ve yayın öncesi sor.
BAŞARI      : API ve tarayıcı testleri geçer; 1000 kişilik yük testinde hata 0 ve teslim p95 < 1 sn;
              Claude sayfası testleri bozulmaz.
VARSAYIMLAR : Kartlar okumak ücretsiz; düello, turnuva ve sohbet Premium. Soru 15 sn, 5 soru.
              Turnuva tek elemeli. 3 farklı şikâyette içerik kendiliğinden gizlenir.
BELİRSİZ    : x100'ün hedef ölçeği (eşzamanlı mı, kayıtlı mı?); hangi özelliklerin ücretsiz kalacağı;
              kartların içerik onayı.
SIRA        : Sunucu → testler → arayüz → tarayıcı testi → yük testi → belgeler → commit (push için sor).
```

**Puan: 84 (baş usta).**
- Niyete sadakat 4, kısıtlar 4, yapı 4, dil 3.
- Ölçülebilirlik 3: x100 hedefi ölçülebilir hale getirilemedi; yalnızca yol haritası.
- Belirsizlik 3: Premium kapsamı varsayımla seçildi.
- Kısalık 3.
