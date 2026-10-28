# Y09: Enerji, su ve kaynak verimliliği

## Kategori özeti

Bu modül, sitede harcanan elektrik, ısı, su ve üretilen atığı okumayı ve azaltmayı öğretir. Sakin kendi sayacını okur, ortak alan tüketimini izler, bir tasarruf önerisinin kendini kaç ayda ödeyeceğini hesaplar ve atık ayrıştırmanın işleyip işlemediğini ölçer.

- **Faz:** 3 (karar)
- **Ön koşul:** Y02 ≥ 4 (tesisleri tanıma), Y04 ≥ 4 (aidat ve gider okuma)
- **Kapsamadığı konular:** gider dağıtım anahtarı ve bütçe (Y04), arıza bildirimi (Y05), teklif toplama ve sözleşme (Y10), kurula önerge sunma (Y07), hesap denetimi (Y08).

> Bu modüldeki tüm rakamlar **örnektir**. Kendi sitenizin faturası, birim fiyatı ve yönetim planı esas alınır.

---

### Y09.1 Sayaç ve pay ölçer okuma

#### 1. Tanım
Su, elektrik ve doğal gaz sayacının iki okuma arasındaki farkını bulmak; merkezi ısıtmada her peteğe takılan **pay ölçerin** (ısı payını gösteren küçük cihaz) birimini okuyup faturadaki payla karşılaştırmaktır.

#### 2. Site yaşamında önemi
Yanlış okunan sayaç, yanlış fatura demektir. Kaçak su ya da bozuk pay ölçer ancak düzenli okumayla fark edilir.

#### 3. Öğrenme hedefi
Sakin, kendi sayaçlarını bir ay boyunca okuyup günlük ortalama çıkarır ve ısınma payının nasıl hesaplandığını yeniden yapar.

#### 4. Ön koşul bilgiler
Sayaçların yeri (Y02), aidat ve fatura kalemleri (Y04). Birimler: su m³ (1 m³ = 1.000 litre), elektrik kWh, gaz m³ veya kWh.

#### 5. Temel ilkeler
- Tüketim = son okuma − önceki okuma. Kırmızı haneler genellikle ondalıktır.
- Tarih ve saatle birlikte yazın; fotoğraf çekin.
- Günlük ortalama = tüketim ÷ gün sayısı.

#### 6. İleri ilkeler
- Merkezi ısıtmada gider genellikle iki parçaya bölünür: m²'ye göre **sabit pay** ve pay ölçere göre **tüketim payı**. Oranlar ilgili yönetmelikte ve yönetim planında yazar; **güncel resmî kaynaktan ve sitenin yönetim planından doğrulayın.**
- Pay ölçer birimi kWh değildir; yalnızca daireler arası oranı gösterir.
- Hiç su kullanılmazken su sayacı dönüyorsa kaçak vardır.

#### 7. İyi ve kötü örnekler
- **İyi:** "1 Ekim 1.233,1 m³; 31 Ekim 1.245,6 m³ → 12,5 m³ / 30 gün ≈ 0,42 m³ (≈ 417 L) günde." (örnek)
- **Kötü:** "Bu ay faturam yüksek geldi, sayaç bozuk olmalı." Okuma ve karşılaştırma yok.

#### 8. Adım adım uygulama
1. Sayaçların ve pay ölçerlerin yerini bulun.
2. Ayın ilk ve son günü okuyun, fotoğraflayın.
3. Tüketimi ve günlük ortalamayı hesaplayın.
4. Isınma payını örnekle yeniden hesaplayın (örnek oranlar %30 sabit, %70 tüketim; toplam gider 100.000 TL):
   - Sabit pay: 30.000 × 100 m² ÷ 5.000 m² = **600 TL**
   - Tüketim payı: 70.000 × 1.200 birim ÷ 84.000 birim = **1.000 TL**
   - Toplam: **1.600 TL**
5. Sonucu faturayla karşılaştırın; fark varsa not edin.

#### 9. Bağımsız uygulama ödevi
Kendi su ve elektrik sayacınızı 30 gün boyunca haftada bir okuyun. Tablo yapın, günlük ortalamayı bulun, bir gece kaçak testi yapın.

#### 10. Değerlendirme rubriği
| 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Okuma yok | Okuma var, tarih yok | Doğru fark, ortalama yok | Fark, ortalama ve fatura karşılaştırması doğru | Ek olarak kaçak testi ve pay hesabı belgeli |

#### 11. Gerçek site bağlantısı (R1–R6)
R2'de kendi ısınma payınızı yeniden hesaplamak; R5'te tasarruf önerisinin önce/sonra ölçümü.

#### 12. Sık yapılan hatalar
Kırmızı haneleri tam sayı sanmak; farklı gün sayılarını karşılaştırmak; pay ölçer birimini kWh sanmak.

#### 13. İleri öğrenme kaynakları
Dağıtım şirketinin fatura açıklama sayfası, ısı pay ölçer firmasının okuma kılavuzu (firma adı verilmez), belediye su idaresinin kaçak testi rehberi.

#### 14. Başkasına öğretme uygulaması
Bir komşuyla sayacının başına gidin; okumayı ona yaptırın, farkı birlikte hesaplayın.

`Öğren: sayaç farkı ve pay ölçer mantığı → Uygula: 30 günlük okuma tablosu ve ısınma payı hesabı → Ölç: rubrik ≥ 3/4 → Kanıtla: R2 pay hesabı veya R5 önce/sonra ölçümü → Aktar: bir komşuya 10 dk'da kendi sayacını okut`

---

### Y09.2 Ortak alan tüketimini izleme

#### 1. Tanım
Merdiven, otopark, asansör, hidrofor (su basınç pompası) ve bahçe aydınlatması gibi ortak alanların elektrik ve su tüketimini aylık izlemek ve olağandışı artışı yakalamaktır.

#### 2. Site yaşamında önemi
Ortak alan faturası herkesin aidatına yansır. Gün boyu yanan bir lamba grubu ya da sızdıran bir bahçe vanası yıl boyu fark edilmeden para harcatabilir.

#### 3. Öğrenme hedefi
Sakin, ortak alan tüketimini 12 aylık tabloda gösterir, geçen yılın aynı ayıyla karşılaştırır ve gece "baz yük" ölçümü yapar.

#### 4. Ön koşul bilgiler
Y09.1 sayaç okuma; ortak alan sayaçlarının yeri (Y02); faturaların yönetimden istenmesi (Y04).

#### 5. Temel ilkeler
- Aynı ayı aynı ayla karşılaştırın (Ocak–Ocak); mevsim etkisi büyüktür.
- TL yerine önce kWh ve m³ bakın; fiyat değişse de tüketim gerçeği gösterir.
- Tüketimi kalemlere ayırın: aydınlatma, asansör, pompa, diğer.

#### 6. İleri ilkeler
- **Baz yük:** gece herkes uyurken bir saatlik tüketim. Örnek: 1,5 kWh/saat × 24 × 30 = **1.080 kWh/ay**; aylık 3.600 kWh'nin %30'u. Baz yük yüksekse sürekli çalışan bir cihaz vardır.
- Daire başına gösterge: 3.600 kWh ÷ 120 daire = 30 kWh/ay (örnek).

#### 7. İyi ve kötü örnekler
- **İyi:** "Ortak alan Ekim tüketimi 3.600 kWh, geçen Ekim 2.900 kWh; %24 artış. Otopark lambaları gündüz de yanıyor." (örnek; 700 ÷ 2.900 ≈ %24)
- **Kötü:** "Elektrik faturası 12.600 TL olmuş, çok pahalı." Fiyat ve tüketim ayrılmamış.

#### 8. Adım adım uygulama
1. Yönetimden son 12 ayın ortak alan faturalarını isteyin.
2. Her ay için kWh, m³ ve TL yazın.
3. Aynı ayları karşılaştırın, %10'dan büyük farkları işaretleyin (örnek eşik).
4. Gece 03.00'te sayacı okuyun, bir saat sonra tekrar okuyun.
5. Olası nedeni yerinde gözlemleyin; arızaysa Y05'e göre bildirin.

#### 9. Bağımsız uygulama ödevi
Sitenizin 12 aylık ortak alan tablosunu ve bir baz yük ölçümünü hazırlayın; en büyük üç tüketim kalemi için birer gözlem notu yazın.

#### 10. Değerlendirme rubriği
| 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Veri yok | Yalnızca TL | kWh/m³ tablosu var | Yıl karşılaştırması ve baz yük doğru | Ek olarak neden gözlemi ve önlem önerisi |

#### 11. Gerçek site bağlantısı (R1–R6)
R2'de enerji giderindeki sapmanın nedeni; R5'te önerinin çıkış noktası.

#### 12. Sık yapılan hatalar
Kasım'ı Temmuz'la karşılaştırmak; fiyat artışını tüketim artışı sanmak; teknik odaya izinsiz girmek (güvenlik: yalnızca görevliyle).

#### 13. İleri öğrenme kaynakları
Elektrik dağıtım faturası açıklaması, enerji verimliliğiyle ilgili kamu kurumlarının bina rehberleri (**güncel resmî kaynaktan doğrulayın**).

#### 14. Başkasına öğretme uygulaması
Kurulda tek sayfalık "12 ay ortak alan tüketimi" grafiğini 3 dakikada anlatın; dinleyenlerden en yüksek ayı bulmalarını isteyin.

`Öğren: ortak alan kalemleri ve baz yük → Uygula: 12 aylık kWh/m³ tablosu ve gece ölçümü → Ölç: rubrik ≥ 3/4 → Kanıtla: R2 sapma açıklaması veya R5 başlangıç ölçümü → Aktar: kurulda 3 dk'lık tüketim grafiği sunumu`

---

### Y09.3 Geri ödeme süresi hesabı

#### 1. Tanım
Bir tasarruf yatırımının (LED, sensör, perlatör, yalıtım) maliyetini yıllık tasarrufa bölerek kendini kaç yılda ödeyeceğini bulmaktır: **geri ödeme süresi = yatırım ÷ yıllık tasarruf.**

#### 2. Site yaşamında önemi
Kurulda "tasarruf sağlar" demek yetmez. Hesap, aidattan çıkacak paranın ne zaman geri döneceğini gösterir.

#### 3. Öğrenme hedefi
Sakin, bir öneri için yıllık tasarrufu ve geri ödeme süresini hesaplar, farklı varsayımla (duyarlılık) yeniden dener.

#### 4. Ön koşul bilgiler
Y09.1 ve Y09.2 ölçümleri; W, kW ve kWh farkı (1.000 W = 1 kW; kW × saat = kWh).

#### 5. Temel ilkeler
- Yatırıma malzeme, işçilik ve atık bertarafı dahil edilir.
- Tasarruf ölçülmüş tüketime dayanmalı; "katalogda %60 diyor" yeterli değildir.
- Her varsayım yazılır: çalışma saati, birim fiyat, adet.

#### 6. İleri ilkeler
- Basit geri ödeme fiyat artışını, faizi ve bakım maliyetini görmez; sonucu "yaklaşık" diye sunun.
- Ürün ömrü geri ödemeden kısa ise yatırım kârlı değildir.
- **Duyarlılık:** en iyimser ve en kötümser saatle iki hesap yapın.

#### 7. İyi ve kötü örnekler
- **İyi:** Aşağıdaki hesap, varsayımlarıyla birlikte.
- **Kötü:** "LED çok tasarruflu, hemen alalım." Ölçüm, maliyet ve süre yok.

#### 8. Adım adım uygulama
Örnek: 80 armatür, eskisi 36 W, yenisi 18 W; günde 12 saat; birim fiyat 3,50 TL/kWh; armatür 450 TL, işçilik 6.000 TL.
1. Güç farkı: 80 × (36 − 18) = 1.440 W = **1,44 kW**
2. Yıllık saat: 12 × 365 = **4.380 saat**
3. Yıllık tasarruf: 1,44 × 4.380 = **6.307,2 kWh** → × 3,50 = **22.075,20 TL**
4. Yatırım: 80 × 450 + 6.000 = **42.000 TL**
5. Geri ödeme: 42.000 ÷ 22.075,20 ≈ **1,9 yıl (≈ 23 ay)**
6. Duyarlılık (günde 8 saat): 1,44 × 2.920 = 4.204,8 kWh → 14.716,80 TL → ≈ **2,85 yıl**
7. Ömür kontrolü: 25.000 saat ÷ 4.380 ≈ 5,7 yıl > 1,9 yıl ✔ (tüm değerler örnek)

#### 9. Bağımsız uygulama ödevi
Sitenizden bir öneri seçin (ör. otopark sensörü, perlatör). Ölçülmüş tüketimle iki senaryolu geri ödeme hesabı yapın.

#### 10. Değerlendirme rubriği
| 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Hesap yok | Hesap var, varsayım yok | Doğru hesap, tek senaryo | Varsayımlar yazılı, iki senaryo | Ek olarak ömür kontrolü ve ölçüme dayalı veri |

#### 11. Gerçek site bağlantısı (R1–R6)
R5'in zorunlu kanıtı olan "geri ödeme hesabı". Teklif rakamları Y10.2 tablosundan gelir.

#### 12. Sık yapılan hatalar
W ile kWh'yi karıştırmak; işçiliği unutmak; tasarrufu TL yerine yüzdeyle bırakmak; sonucu kesin bir sözmüş gibi sunmak.

#### 13. İleri öğrenme kaynakları
Kamu kurumlarının enerji verimliliği hesaplama rehberleri; üretici teknik föyleri (W, ömür saati).

#### 14. Başkasına öğretme uygulaması
Komşuya boş bir hesap şablonu verin; kendi rakamlarıyla doldurmasını izleyin ve 5 adımı birlikte kontrol edin.

`Öğren: güç, enerji ve geri ödeme formülü → Uygula: iki senaryolu LED hesabı → Ölç: rubrik ≥ 3/4 → Kanıtla: R5 önerge ekindeki geri ödeme hesabı → Aktar: bir komşuya şablonla kendi hesabını yaptır`

---

### Y09.4 Atık ayrıştırma

#### 1. Tanım
Sitedeki atığı türlerine göre (ambalaj, cam, organik, karışık, pil, elektronik, bitkisel yağ) ayrı toplamak ve sistemin işleyip işlemediğini ölçmektir.

#### 2. Site yaşamında önemi
Yanlış atılan atık geri dönüşümü bozar, çöp alanını kirletir ve koku, haşere ile komşu şikâyetine yol açar.

#### 3. Öğrenme hedefi
Sakin, sitenin atık noktalarını haritalar, bir haftalık hatalı atım oranını ölçer ve bir iyileştirme önerir.

#### 4. Ön koşul bilgiler
Çöp alanının yeri (Y02), ortak yaşam kuralları (Y03). Belediyenin toplama günleri.

#### 5. Temel ilkeler
- Ambalaj temiz ve kuru atılır.
- Pil, elektronik ve bitkisel yağ evsel çöpe atılmaz; belediye veya yetkili toplama noktasına verilir.
- Kutu etiketi açık, resimli ve herkesin göreceği yerde olmalı.
- Sıfır atık uygulamaları ve belediye kuralları için **güncel resmî kaynaktan ve sitenin yönetim planından doğrulayın.**

#### 6. İleri ilkeler
- **Hatalı atım oranı:** örnek 20 torbadan 6'sı karışık → %30.
- **Kişi başı gösterge:** haftada 85 kg ambalaj ÷ 120 daire ≈ 0,71 kg/daire (örnek).
- Ölçüm sırasında torbaları açmayın; yalnızca görünür içeriği not edin, kişileri tespit etmeye çalışmayın.

#### 7. İyi ve kötü örnekler
- **İyi:** "Pazartesi 20 torbaya bakıldı, 6'sında yemek artığı vardı. Kutuya resimli etiket önerildi." (örnek)
- **Kötü:** "3. kattaki komşu yine çöpü yanlış attı." Kişiselleştirilmiş, ölçüm yok.

#### 8. Adım adım uygulama
1. Atık noktalarını krokiye işleyin.
2. Belediyeden toplama günlerini ve kabul edilen türleri öğrenin.
3. Bir hafta, aynı gün ve saatte görünür hatalı atımı sayın.
4. Oranı hesaplayın, en sık hatayı bulun.
5. Etiket, duyuru veya kutu yeri değişikliği önerin; dört hafta sonra yeniden ölçün.

#### 9. Bağımsız uygulama ödevi
Kendi blokunuzun atık noktasında iki ölçüm (başlangıç ve dört hafta sonra) yapın ve farkı raporlayın.

#### 10. Değerlendirme rubriği
| 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Gözlem yok | Genel izlenim | Tek ölçüm, oran doğru | İki ölçüm, öneri yazılı | Ek olarak ölçülmüş iyileşme ve kişisel veri korunmuş |

#### 11. Gerçek site bağlantısı (R1–R6)
R1 el kitabında atık kuralları; R5'te küçük atık projesi ve ölçülmüş sonuç.

#### 12. Sık yapılan hatalar
Kişileri suçlamak; tek günlük ölçümle karar vermek; belediyenin kabul etmediği türü ayrı toplamak.

#### 13. İleri öğrenme kaynakları
Belediyenin atık toplama sayfası; ilgili bakanlığın sıfır atık rehberleri (**güncel resmî kaynaktan doğrulayın**).

#### 14. Başkasına öğretme uygulaması
Yeni sakine 5 örnek atık gösterin, hangi kutuya gittiğini sorun; 4/5 doğru olana kadar tekrar edin.

`Öğren: atık türleri ve toplama yolları → Uygula: iki ölçümlü hatalı atım oranı → Ölç: rubrik ≥ 3/4 → Kanıtla: R5 atık projesi veya R1 el kitabı bölümü → Aktar: yeni sakine 5 örnekle ayrıştırmayı öğret`

---

## Puanlama tablosu (Y09)

| Puan | Modüle özel iş | Kanıt | Ölçüt |
|------|----------------|-------|-------|
| 1 | kWh, m³, pay ölçer, baz yük terimlerini tanır | Kısa test | %70 doğru |
| 2 | Fatura kalemlerini doğru türle eşler | 10 eşleştirme | 7/10 |
| 3 | Geri ödeme süresini kendi sözleriyle açıklar | Kısa açıklama | Rubrik ≥ 2/4 |
| 4 | Kontrol listesiyle sayaç okur ve fark bulur | Okuma tablosu | Rubrik ≥ 2,5/4 |
| 5 | Ortak alan tablosu ve geri ödeme hesabını az yardımla yapar | 2 uygulama + düzeltme | Rubrik ≥ 3/4 |
| 6 | Dört alt beceriyi yardımsız uygular | Uygulama kaydı + gerekçe | Rubrik ≥ 3/4, hata tekrarı yok |
| 7 | R5'te ölçüme dayalı tasarruf önerisi hazırlar | R5 dosyası (R2 destek) | Görev rubriği ≥ 3/4 |
| 8 | Yönetimin enerji/atık uygulamalarını gerekçeyle değerlendirir | 3 değerlendirme raporu (R5, R2 kapsamında) | İki değerlendirici uyumu |
| 9 | Sakinlere sayaç okuma veya geri ödeme hesabı öğretir | R5 + R6 oturum planı, ön/son test | Öğrenenlerin ≥ %70'i 6 puan |
| 10 | Siteye kalıcı bir tüketim izleme veya atık yöntemi kazandırır | R5 + R6 + uygulanmış rehber | Yönetim veya uzman onayı |

## Modül testi

1. Önceki okuma 1.233,1 m³, son okuma 1.245,6 m³. Tüketim kaç litre?
2. Pay ölçer birimi neyi gösterir?
3. Isınma gideri 100.000 TL, sabit pay %30, daire 100 m², toplam 5.000 m². Sabit pay kaç TL? (örnek)
4. Baz yük nedir, ne zaman ölçülür?
5. Ortak alan tüketimini neden aynı ayla karşılaştırırız?
6. 1,44 kW güç farkı, günde 12 saat. Yıllık kaç kWh tasarruf?
7. Yatırım 42.000 TL, yıllık tasarruf 22.075,20 TL. Geri ödeme yaklaşık kaç ay?
8. Ürün ömrü geri ödeme süresinden kısaysa ne sonuç çıkar?
9. Pil ve bitkisel yağ nereye verilir?
10. 20 torbadan 6'sı karışık. Hatalı atım oranı nedir?

**Cevap anahtarı:** 1) 12,5 m³ = 12.500 L. 2) Daireler arası ısı payı oranını; kWh değildir. 3) 30.000 × 100 ÷ 5.000 = 600 TL. 4) Gece kimse kullanmazken saatlik tüketim; sürekli çalışan cihazı gösterir. 5) Mevsim etkisini ayırmak için. 6) 1,44 × 4.380 = 6.307,2 kWh. 7) ≈ 1,9 yıl ≈ 23 ay. 8) Yatırım kendini ödemez. 9) Belediye veya yetkili toplama noktası. 10) %30.

## Ana rubrik (0–4)

| Ölçüt | 4 | 2 | 0 |
|-------|---|---|---|
| Ölçüm doğruluğu | Tarihli, fotoğraflı, birimleri doğru | Küçük birim hatası | Ölçüm yok |
| Hesap | Varsayımlar yazılı, iki senaryo | Tek senaryo | Hesap yok veya yanlış |
| Yorum | Neden ve önlem önerilmiş | Yalnızca tespit | Yorum yok |
| İletişim | Kişiselleştirilmemiş, veriler gizli | Anlaşılır | Suçlayıcı |

## Kanıt dosyası listesi

- 30 günlük sayaç okuma tablosu ve fotoğrafları
- Isınma payı yeniden hesabı
- 12 aylık ortak alan tüketim tablosu ve baz yük notu
- Geri ödeme hesabı (iki senaryo, varsayımlar)
- Atık ölçümü (başlangıç ve dört hafta sonra)

## Diğer modüllerle bağlantı

- **Y02:** sayaç ve tesis yerleri. **Y04:** fatura kalemleri ve dağıtım. **Y05:** kaçak ve arıza bildirimi.
- **Y07:** tasarruf önerisini önergeye çevirme. **Y10:** önerinin tekliflerini toplama ve karşılaştırma.
- **Y12:** projeyi yürütme. **Y13:** sakinlere aktarma. Görevler: R2 (○), R5 (●).
