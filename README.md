# Bilinçli Sakin

Site sakinleri için tek uygulama (iOS / Android), tarayıcı sürümü ve sunucu. Her site (ilk site: Merter Çınar Evleri, 5 blok × 12 daire) davet koduyla katılınan, kendi adı ve ayarlarıyla açılan ayrı bir alandır.

| Klasör | İçerik |
|---|---|
| `merter/` | Uygulama arayüzü (Ana sayfa, Gündem, Sepet, Hizmetler, Etkinlik ve turnuva, Fırsatlar, Bugün, Hikmet, sakin kartı; yönetici için Davetler ve üyeler). claude.ai Merter Çınar Evleri sayfasıyla aynı kod; `claude-uyum.js` onu sunucuya bağlar |
| `mobile/` | Capacitor 8 projeleri (`android/`, `ios/`), yerel köprü (mağaza satın alma, duvar kâğıdı, oturum) |
| `src/` | Node 22 sunucu: giriş (SMS kodu), siteler ve roller, belge deposu (`belgeler.js`, 22 erişim kuralı), abonelik (`abonelik.js`: App Store ve Google Play doğrudan, üçüncü taraf yok) |
| `public/` | Genel Bilinçli Sakin arayüzü ve yönetim paneli (davet kodları, üyeler, platform yönetimi), yasal sayfalar |
| `docs/MAGAZA.md` | App Store ve Google Play adım adım yayın kılavuzu |

## Minnoş (bekçi kedi: maskot, tanıtım, soru-cevap, kahve falı)

Köşede nefes alan, göz kırpan, kuyruk sallayan alaca bir dişi sokak kedisi (kendi çizimimiz). Dokunursan mırıldar; ilk açılışta uygulamayı adım adım tanıtır (Arena açıksa Arena ve sohbet denetimini de anlatır). Kartım sayfasından gizlenir, geri çağrılır, tur yeniden izlenir.

- **Maliyet hesabı:** "10 m² halıyı kaça yıkatırım?", "5 gömlek 3 pantolon ütü ne kadar?", "5 litre süt kaça gelir?", "2,5 kg domates" gibi sorularda Minnoş tutarı **yönetimin girdiği fiyatlardan kodla** hesaplar (satır satır tablo, toplam, "tahmini" uyarısı). Fiyat girilmemişse uydurmaz, "yönetim henüz fiyat girmemiş" der. Süt için çiftlik ile market/pazar fiyatını karşılaştırır, aradaki farkı söyler. Halı için çevredeki halı yıkama fırsatlarını da önerir. Yapay zekâ rakam üretmez.
- **Hesaplar:** Aidat (Ayarlar'da aylık tutar girilir; Minnoş aylık, N aylık ve yıllık tutarı, yöneticiye tüm hanelerin toplamını hesaplar; ödeme takibi ve tahsilat yoktur), kendi market/gıda harcaman (mağaza siparişleri + bu turun sepeti), araç yıkama (tür × adet).
- **Yönetim asistanı (yalnızca yönetici rolü):** "C blok 5. kat 12. daire kim oturuyor?", "Ali Kaya'nın telefonu", "bu tur sipariş tutarı" (hane sayısı, hane başı ortalama, en çok sipariş edilen, blok kırılımı, mağaza siparişleri), "bekleyen halı talepleri", "kaç hane kayıtlı". Sakin aynı soruları sorarsa Minnoş komşu verisinin gizli olduğunu söyler; rol verilmezse sakin sayılır. Bu veriler yapay zekâ servisine gönderilmez.
- **Her hizmette farklı Minnoş:** Ütü, ev temizliği, halı, araç ve süt sayfalarında Minnoş hizmete özel eşyayla (ütü, süpürge, rulo halı, köpük, süt şişesi), ayrı bir sözle ve formdaki değerlerden kurulan hızlı sorularla çıkar.
- **Bekleme ekranları:** Veri beklerken (Arena, kartlar, sıralama, görevler, maç, turnuva, sohbet, oyun, Minnoş) Minnoş gelip kendini yere atar (flop pozu, kuyruk, nefes, "zzz"); altta ilk %95 hızlı, son %5 yavaş sinematik çubuk ve kısa fırsat/indirim özetleri döner (en yüksek indirim önde, yakında bitenler belirtilir). Hareket azaltmada animasyonsuz.
- **Komşu rehberi (kişinin kendi kararı):** Kartım > "Komşu rehberi": varsayılan **kapalı**. Açılırsa kısa ad görünür (ör. "Ayşe Y."); blok/kat/daire ve telefon ayrı ayrı açılır, istenince kapatılır. Minnoş komşulara yalnızca açılan alanları gösterir; paylaşmayan komşu hakkında hiçbir şey söylemez, siparişleri ve aidatı hiçbir koşulda göstermez. Yönetim, site işleri için kart bilgilerini zaten görür. Not: eski sürümlerde etkinlik katılım belgesine konum yazılıyordu ve bu belgeyi her üye okuyabiliyordu; artık yazılmıyor (kişi kaydını bir sonraki güncellemesinde belgeden silinir).
- **Sinematik yükleme:** Bekleme anlarında çubuk ilk %95'e yaklaşık 0,7 saniyede hızla, son %5'e yaklaşık 1,1 saniyede yavaş ve sinematik gider; iş bitmeden %100 olmaz (kahve falında kullanılıyor).
- **Site araması:** "En uygun kıyafeti nerede bulabilirim?" gibi sorularda Fırsatlar'da (indirim oranı yüksek ve yakın olan önde), ayrıca Gündem, Etkinlik, Hizmetler ve Sepet ürünlerinde arar; bulamazsa "bulamadım" der. Yalnızca herkese açık içerik taranır; komşuların kat, daire, telefon ve siparişleri aranmaz.
- **Soru-cevap:** Hazır bilgi bankası (34 konu: uygulamanın her bölümü, gizlilik, Premium, düello, turnuva, Mavi Öz, görevler, sohbet, Bekçi…) her yerde çalışır, Claude sayfasında da. Bilmediğini uydurmaz ("bilgi bankamda yok", "aidatı bilmiyorum, yönetime sor"). **Yapay zekâ:** sunucuya `ANTHROPIC_API_KEY` verilirse Premium sakinlerin soruları Anthropic Messages API'siyle cevaplanır (varsayılan model `claude-haiku-5-5`, `MINNOS_MODEL` ile değişir; günde 25 soru/kişi). Soru önce Bekçi'den geçer, telefon/IBAN/TC/e-posta maskelenir, soru ve cevap saklanmaz, anahtar istemciye gitmez. Yapay zekâ yalnızca hesap, arama ve bilgi bankasının cevaplayamadığı sorularda çağrılır (maliyet ve gizlilik için). Anahtar yoksa ya da servis yanıt vermezse ekranda "Hazır cevap" yazar; hazır cevap yapay zekâ gibi gösterilmez. Kod: `src/minnos.js`, motor: `merter/index.html` (işaretli blok), testler: `test/minnos*.test.js`.
- **Kahve falı:** Konu seçilir, fincanda görülen 1–3 sembol (16 sembol) seçilir, isteğe bağlı niyet yazılır; fincan kapanma animasyonundan sonra fal gelir. Yapay zekâ açıksa fal ona yazdırılır, değilse yerel fal bankasından (aynı seçim aynı gün aynı falı verir). Fal bir **eğlencedir**; her falda bunu söyler, korkutucu ya da kesin tahmin vermez. Fincan fotoğrafı yorumlanmaz. Dinî hassasiyeti olanlar için kolayca gizlenir.
- Hareket azaltma tercihine uyar; test sürücülerinde kendiliğinden açılmaz.

## Fırsatlar

Hizmetlere araç yıkama da eklendi (tür, araç tipi, gün, saat, otopark yeri; yönetim randevuyu onaylar).

Her fırsata isteğe bağlı firma web sitesi (yalnızca https) eklenir; kartta büyük, tam yuvarlak, akan dalga desenli "Firmanın sitesine git" düğmesi çıkar, tıklayınca dalgacık ve sıçrama animasyonu oynar.

## Arena (bilgi yarışması, sezon, turnuva, sohbet)

- **Bilgi kartları:** Okunur, "kendini dene" ile öğrenilir (ücretsiz).
- **Canlı düello:** Tam ekran eşleştirme (60 sn arama sınırı, animasyonlu halka). Rakip bulununca iki taraf 10 sn içinde "Kabul et" der; yanıt vermeyen düşer, kabul eden sezon puanı en yakın sıradaki rakibe yönelir. VS karşılaşma, 5 soru, sunucu puanlar.
- **Arena kimliği:** Kazandıkça simge, çerçeve, sembol (en çok 3) ve unvan açılır; sıralamada, eşleşme ekranında, komşu kartında ve Kartım'da görünür. Ödülü yalnızca sunucu verir.
- **Turnuvada Satranç ve Tavla:** Yönetici turnuvayı açarken oyunu seçer (Bilgi yarışması, Satranç, Tavla). Oyun canlı ve süreli oynanır (satranç 5 dk + 3 sn/hamle, tavla 6 dk + 5 sn/hamle); hamleyi ve zarı sunucu belirler. Satrançta rok, geçerken alma, terfi, mat, pat, üç tekrar, 50 hamle; tavlada vurma, bar, toplama, çift zar ve "en çok zarı oyna" kuralı. Turnuvada beraberlik olmaz: satranç berabere biterse renkler değişerek en çok 2 kez yeniden oynanır, hâlâ berabereyse saatinde daha çok süresi kalan kazanır. Kod: `src/satranc.js`, `src/tavla.js`, `src/oyun.js`, `merter/oyun.js`. Okey ve 101 (4 kişilik) henüz yok.
- **Turnuva koleksiyonu:** 15 İstanbul ve Anadolu simgesi (Galata Kulesi, Kız Kulesi, Ayasofya, Boğaz Köprüsü, çay, lale, nazar boncuğu, vapur…). Her turnuvanın ödül simgesini şampiyon kazanır.
- **Mavi Öz:** Her eşleşmeli düellodan sonra (galibiyet 30, beraberlik 20, yenilgi 15; turnuva maçı +10, şampiyonluk +100). Sahibi isterse kartlarında görünür.
- **Görevler:** 3 günlük, 5 haftalık görev; ilerleme sunucuda hesaplanır, ödül (Mavi Öz) bir kez alınır.
- **Ses efektleri:** Cihazda sentezlenir (dosya yok); aç/kapa düğmesi. Seviye ölçümü: `node scripts/ses-olc.js` (hedef ≤ -3 dBTP, ≤ -18 LUFS).
- **Sezon:** 28 gün; kişisel sıralama ve blok savaşı.
- **Turnuva:** Belirli saatlerde oynanır; iki taraf da "hazırım" demelidir.
- **Sohbet:** Site ve blok odaları, canlı akış (SSE).
- **Bekçi (sohbet denetim botu):** Mesajları gönderilmeden önce yerelde denetler (dış servis yok). Küfür, tehdit, hakaret, reklam/bağlantı, bağırma ve tekrar (flood); yazım oyunlarına dayanıklı (s1kt1r, s i k t i r, uzatma). Kesin ihlal engellenir ve sebebi söylenir; şüpheli mesaj gönderilir ama yönetimde işaretlenir; IBAN, geçerli TC kimlik no ve e-posta gizlenir. 24 saatte 3 engelde 1 saat, 6 engelde 24 saat otomatik susturma. **Eğitim:** karakter n-gram Naive Bayes modeli (`data/bekci-model.json`); yönetimin "doğru/yanlış alarm" geri bildirimleri sonraki eğitime girer (`npm run bekci:egit`, `--db` ile). Ölçüm (sentetik, ayrı değerlendirme kümesi): engelleme kararında yanlış alarm 0; gerçek sohbet verisiyle ölçülmedi. Kod: `src/bekci.js`, `scripts/bekci-egit.js`.
- **Şikâyet ve engelleme:** Gündem'de ve sohbette.

Düello, turnuva ve sohbet Premium'dur. Kod: `src/arena.js`, `src/kazanim.js`, `src/gorevler.js`, `src/sohbet.js`, `merter/arena.js`, `merter/simgeler.js`, `merter/ses.js`. Ölçülen kapasite ve x100 yol haritası: **[docs/PERFORMANS.md](docs/PERFORMANS.md)** (`npm run yuk -- --kisi 1000 --sure 90`). Komutların yapay zekâ diline çevrilmesi: [docs/retorik-ustasi.md](docs/retorik-ustasi.md), [docs/KOMUT-GUNLUGU.md](docs/KOMUT-GUNLUGU.md).

## Hızlı başlangıç

```bash
npm ci
cp .env.example .env          # geliştirme için SESSION_SECRET yeterli; SMS konsola yazılır
npm run kur:site -- --ad "Merter Çınar Evleri" --bloklar A,B,C,D,E --daire 12 --kat 0-5
npm start                     # http://localhost:3000/m/  (Merter arayüzü)
```
Kurulum komutunun verdiği **yönetici davet kodu** ile `/m/` adresinden giriş yapın. Sakin davet kodlarını yönetici uygulamada Sakinler › **Davetler ve üyeler** ekranından üretir ve WhatsApp'tan gönderir.

**Telefon uygulaması:**
```bash
cd mobile && npm ci
cp .env.ornek .env            # API_TABAN=https://sunucunuz
npm run senkron               # merter/ → www/ ve Android/iOS projelerine kopyalar
npm run android:ac            # Android Studio
npm run ios:ac                # Xcode (Mac)
```

**Testler:** `npm test` (birim, API, erişim kuralları, abonelik, Playwright ile uçtan uca; `mobile/` içinde `npm ci` gerekir).

---

## Bilinçli Sakin (genel arayüz ve sunucu) ayrıntıları

Site ve apartman sakinleri için eğitim haritası, puan kartı, sakin profili ve ortak market/pazar sepeti. claude.ai artifact prototipinin (`site-yonetimi/index.html`) bağımsız, satılabilir sürümüdür: her site ayrı bir kiracıdır, sakinler telefon + tek kullanımlık kodla giriş yapar, satıcı (platform yöneticisi) sakin verisini göremez.

## Mimari

```
src/
  server.js      giriş noktası: .env okur, veritabanını açar, HTTP sunucusunu başlatır
  app.js         istek işleyici: rotalar, oturum, CSRF, rol/kiracı kontrolleri, statik dosyalar, CSV
  db.js          node:sqlite bağlantısı + sıralı şema migration'ları (schema_surum tablosu)
  validate.js    sunucu tarafı doğrulama (prototipteki sınırların aynısı; aşan veri 400 ile reddedilir)
  sms.js         SMS sağlayıcı arayüzü: konsol (geliştirme), webhook, netgsm (şablon), bellek (test)
public/
  index.html, app.js, styles.css   çerçevesiz ön yüz (prototipin görünümleri ve iş mantığı)
  shared.js      sunucu ve tarayıcının ortak kullandığı sabitler ve kurallar (modüller, TEMALAR, HAZIR_ALANLAR,
                 ORNEK_KATALOG, kategoriler, önerilen yol, tur açık/kapalı, sipariş toplama, sıralama)
  aydinlatma.html  KVKK aydınlatma metni şablonu
  nasil-kullanilir.html, nasil.js, nasil.css   sakinler için tek sayfalık "Nasıl kullanılır" (/s/DAVETKODU), yazdırılabilir
  md/            eğitim içerikleri (00-ana-cerceve, 19-site-gorevleri, modul-Y01…Y13)
scripts/seed-demo.js   "Çınar Evleri DEMO" örnek verisi
test/          api.test.js, paket.test.js (node --test), e2e.test.js (Playwright), yardimci.js
docs/screenshots/      uçtan uca testin ürettiği ekran görüntüleri (390 px, 320 px, koyu mod)
```

- Tek bağımlılık: `marked` (yerelden `/vendor/marked.min.js` olarak servis edilir). HTTP için `node:http`, veritabanı için Node 22'nin yerleşik `node:sqlite` modülü kullanılır.
- Veri modeli: `sites` (plan = paket, durum, deneme_bitis, ayarlar JSON, katalog+tur JSON), `turlar` (tur geçmişi ve kapanıştaki sipariş sayısı), `users` (telefon), `uyelikler` (kullanıcı–site–rol), `sessions`, `otp`, `davetler`, `profiller`, `sepetler`, `puanlar`. Site verisi taşıyan her tabloda `site_id` vardır ve her sorgu oturumdaki aktif site ile sınırlanır; site kimliği istemciden alınmaz.
- Bir telefon numarası birden çok siteye üye olabilir (ör. profesyonel yönetici); oturumda bir "aktif site" tutulur, yalnızca üye olunan sitelere geçilebilir.
- Yazı tipleri: prototipteki Google Fonts kaldırıldı (CSP `'self'`); tokenlardaki sistem yazı tipi yedekleri kullanılır. Renk tokenları, açık/koyu tema ve site teması (TEMALAR) aynen korundu.
- Prototipteki canlı senkron (onSnapshot) yerine görünüme girerken veri çekilir; toplu sipariş ve sakin listesinde "Yenile" düğmesi vardır.

## Mobil uygulama (App Store / Google Play)

`mobile/` klasörü Capacitor 8 ile Android ve iOS projelerini içerir. Web dosyaları uygulamanın içine gömülür; API'ye `Authorization: Bearer` jetonuyla gidilir (`public/native.js`, `mobile/src/kopru.js`). Sakin aboneliği (aylık, uygulama içi satın alma) üçüncü taraf hizmet olmadan doğrulanır. iOS'ta StoreKit 2 imzalı işlem kaydının sertifika zinciri sunucuda Apple köküne kadar denetlenir. Android'de Google Play Developer API kullanılır. Ayrıntı: `src/abonelik.js`. Site yönetimi bedeli aidatla ödeyecekse `odeme_modeli = 'site'` seçilir. Mağaza adımları, ortam değişkenleri, gizlilik formları ve inceleme notu: **[docs/MAGAZA.md](docs/MAGAZA.md)**.

## Sakin arayüzü

Arayüz her yaştan sakin ve telefon için tasarlandı.
- **Ana sayfa:** Üstte site adı ve kişisel selam ("Merhaba, A Blok 5. kat 12") yer alır. Altında büyük dokunmatik kartlar bulunur:
  - Sepetim: açık tur, kalan süre, ürün sayısı ve tahmini tutar.
  - Profilim: profil eksikse "2 dakikada tamamla" uyarısı.
  - Duyuru.
  - İletişim: numaralar için "Ara" ve "Kopyala".
  - Öğren: yalnız Tam pakette; önerilen yol.
  Profili olmayan sakin önce 3 adımlı bir karşılama görür.
- **Gezinme:** Telefonda (<768 px) altta sabit sekme çubuğu vardır: Ana sayfa · Sepet · Profil · Diğer. Çubuk güvenli alan boşluklarına uyar ve sepetteki ürün sayısı rozetle gösterilir. Masaüstünde üst menü kullanılır. Yönetici ve denetçi ekranları (Özet, Sakinler, Toplu sipariş, Katalog, Site ayarları, Üyeler) "Yönetim" menüsünde toplanır; telefonda buna "Diğer › Yönetim paneli" ile ulaşılır. Böylece sakin ekranı sade kalır.
- **Görsel dil:**
  - Boşluk ölçeği 4/8/12/16/24/32 px, gövde yazısı 16 px, dokunma hedefleri en az 44 px, köşeler yumuşak.
  - İkonlar satır içi SVG'dir; ikon kütüphanesi yok, CSP yalnızca `'self'`.
  - Ürünler renkli kare harf kutucuklarıyla gösterilir. Sepete eklemede "… sepete eklendi" bildirimi çıkar.
  - Boş durumlar açıklayıcı ve dostça metinlerle karşılanır; yüklenirken iskelet gösterilir.
  - Site teması (vurgu rengi) açık ve koyu modda her yerde uygulanır.
- **Erişilebilirlik:**
  - Kontrast: tüm tema tokenları ve 6 site teması WCAG AA (≥4,5:1). Bu otomatik testle kontrol edilir: `test/erisilebilirlik.test.js`.
  - Klavye: görünür odak halkası ve "İçeriğe geç" bağlantısı var.
  - Ekran okuyucu: `aria-label` ve `aria-current` kullanıldı; bildirimler `aria-live` ile duyurulur.
  - Hareket: `prefers-reduced-motion` tercihinde animasyonlar kapanır.
  - Yazı boyutu: değerler rem cinsindendir. Kök yazı boyutu %200'de ve 640 px genişlikte (1280 px'te %200 yakınlaştırma) yatay kayma olmadığı testle doğrulanır.
- **PWA:**
  - `manifest.webmanifest` sunucudan üretilir. Oturum açmış üyeye site adını, kısa adı ve tema rengini verir.
  - İkonlar: SVG, 192 ve 512 PNG, maskable 512, Apple dokunma ikonu.
  - "Ana ekrana ekle" ipucu Ana sayfada ve "Diğer" sayfasında yer alır. Android'de "Uygulamayı yükle" düğmesi, iOS'ta Safari Paylaş › Ana Ekrana Ekle açıklaması gösterilir.
  - Servis çalışanı (`public/sw.js`) **yalnızca** listelenen statik dosyaları önbelleğe alır. `/api/*`, `/md/*`, manifest, `/saglik` ve sayfa gezintileri asla önbelleğe yazılmaz.
  - Çevrimdışıyken sayfa açılınca "Bağlantı yok" ekranı (`cevrimdisi.html`) gelir.
- **Ekran görüntüleri:**
  - `docs/screenshots/once-390-*`: değişiklik öncesi.
  - `docs/screenshots/sonra-{390,390-koyu,320,320-koyu,1280,1280-koyu}-*`: değişiklik sonrası, ekran boyu.
  - `sonra-tam-390-*`: tam sayfa.

## Paketler

`sites.plan` sitenin paketidir; yalnızca platform yöneticisi (satıcı) panelden değiştirir. Paketler birbirini kapsar:

| Paket | İçerik |
|---|---|
| `temel` (Temel) | Sakin profilleri, kategoriler, tahliye listesi, duyuru / karşılama / iletişim, site ayarları, üyeler ve davetler, sakin listesi CSV, Özet kartı, KVKK, Hesabım |
| `alisveris` (Alışveriş) | Temel + sepet, katalog ve tur, toplu sipariş, tedarikçi listesi, sipariş CSV |
| `tam` (Tam) | Alışveriş + eğitim modülleri (Harita, modül sayfaları, Görevler, Çerçeve) ve puan kartı |

- Kapı hem sunucuda hem arayüzdedir. Pakette olmayan uçlar `403` ve "Bu özellik Alışveriş/Tam paketinde…" mesajı döner (sepet, katalog, sipariş, sipariş CSV, puan kartı). Eğitim Markdown dosyaları (`/md/*`) yalnızca Tam paketli bir sitenin oturum açmış üyelerine servis edilir.
- Arayüzde ilgili sekmeler gizlenir. Doğrudan bağlantıyla gelinirse ya da Ana sayfada "Bu özellik X paketinde" kartı gösterilir. Tam dışındaki paketlerde "Harita" sekmesinin yerinde "Ana sayfa" (duyuru, iletişim, profil özeti) vardır.
- Deneme süresinde site seçilen paketin özelliklerini kullanır. Yeni site varsayılan olarak `tam` açılır. Migration 2, eski kayıtların (temel/standart/kurumsal) hepsini `tam` yapar. DEMO seed de `tam` paketindedir.
- Paket düşürülünce veriler silinmez (ör. sepetler, puanlar); yalnızca erişim kapanır, KVKK dışa aktarımında görünmeye devam eder.

## Özet (pilot ölçümü)

Yönetici ve denetçi (salt-okur) için "Özet" sekmesi, ilk hafta kontrolü içindir:
- Profil dolduran hane / toplam daire = doluluk %. Toplam daire Site ayarlarında isteğe bağlıdır (1–5000); girilmemişse yüzde yerine hane sayısı gösterilir.
- Blok bazında profil dolduran hane. Blok satırına isteğe bağlı "Daire sayısı" girilmişse blok doluluk yüzdesi de gösterilir.
- Açık turda sipariş veren hane sayısı ve önceki 3 turun sipariş veren hane sayıları. Tur geçmişi bu sürümle tutulmaya başlar: yönetici "Yeni tur başlat" deyince eski turun hane sayısı `turlar` tablosuna yazılır. Bu sürümden önceki turların geçmişi yoktur.
- Son 7 günde katılan sakin sayısı (yalnız `sakin` rolü).

## Nasıl kullanılır sayfası

`/s/DAVETKODU` adresi sakinler için tek sayfalık, büyük yazılı bir kılavuz açar. Sayfada site adı, davet kodu ve 5 adım yer alır: davet kodu → telefonla giriş → profil → sepet → veriyi indirme / silme. Yazdırmaya uygundur (`@media print`), A4'e basılıp panoya asılabilir.
- Site adı `GET /api/davet/onizleme/:kod` ucundan alınır. Bu uç oturum gerektirmez, IP başına hız sınırlıdır ve yalnızca geçerli kodlar için site adını döndürür.
- Sayfadaki "Uygulamayı aç" bağlantısı `/?davet=KOD` adresine gider. İlk girişte davet kodu kutusu kendiliğinden dolar.
- Yönetici "Üyeler" sekmesinde her sakin davetinin yanındaki **Bağlantı ve kodu kopyala** düğmesiyle bağlantıyı ve kodu birlikte kopyalar. Pano izni yoksa metin ekranda seçilebilir olarak gösterilir.

## Roller

| Rol | Yapabildikleri |
|---|---|
| `platform_admin` (satıcı) | Site oluşturur (ilk yönetici davet kodu üretilir), paket / durum (deneme, aktif, askıda) / deneme bitiş tarihini değiştirir. Yeni yönetici davetini **yalnızca sitenin hiç yöneticisi yokken** üretebilir; yeni davet üretilince kullanılmamış eski yönetici davetleri iptal olur. Sakin profili, sepet, puan, üye telefonları gibi kişisel verileri **göremez**; siteye davetle katılamaz. `PLATFORM_ADMIN_TELEFONLARI` ile tanımlanır. |
| `site_yonetici` | Özet, site ayarları (ad, tema, toplam daire, karşılama, duyuru, iletişim, bloklar/kat aralıkları/daire sayısı, profil soruları, gizli modüller), katalog ve tur, sakin listesi, toplu sipariş, CSV dışa aktarım, davet kodları, üye rolü değiştirme / siteden çıkarma. |
| `site_denetci` | Özet kartını, sakin listesini ve toplu siparişi salt-okur görür. Yazamaz, CSV indiremez. |
| `sakin` | Kendi profili, sepeti, puan kartı; KVKK verisini indirme ve silme. |

Askıdaki (veya deneme süresi dolmuş) sitede tüm site rolleri salt-okurdur; KVKK silme ve dışa aktarma açık kalır.

## Kurulum

Gereken: Node.js 22.5+ (geliştirmede 22.22 ile denendi).

```bash
cd site-app
npm install
cp .env.example .env        # değerleri düzenleyin
npm run seed:demo           # isteğe bağlı: "Çınar Evleri DEMO" sitesi
npm start                   # http://localhost:3000
```

- İlk çalıştırmada şema otomatik oluşturulur/güncellenir. Veritabanı yolu `DB_PATH` ile ayarlanır (varsayılan `./data/site-app.sqlite`).
- Geliştirme modunda SMS gönderilmez; giriş kodu sunucu loguna `[SMS:konsol] +90… -> … kodunuz: 123456` biçiminde yazılır.
- DEMO girişleri: yönetici `0500 000 00 00`, denetçi `0500 000 00 09`, örnek sakinler `0500 000 00 01…04`. Davet kodu seed çıktısında yazar. Bu numaralar kurmacadır.
- Platform paneli için `.env` içinde `PLATFORM_ADMIN_TELEFONLARI` numaranızı yazın ve o numarayla giriş yapın.

İlk gerçek site: platform yöneticisi "Siteler" ekranından site oluşturur → çıkan yönetici davet kodunu site yöneticisine iletir → yönetici telefonla girip kodu girer → "Üyeler" sekmesinden sakin davet kodu üretip (ör. 100 kullanım, 14 gün) panoya / WhatsApp grubuna koyar.

### Testler

```bash
npm test            # API + paket + kurulum + erişilebilirlik + uçtan uca testlerin hepsi (son çalıştırma: 88 test, hepsi geçti)
npm run test:api    # yalnız api.test.js (bellek içi SQLite)
npm run test:e2e    # yalnız Playwright (gerçek sunucu süreci + Chromium)
```

`npm run ekran -- sonra 390,320,1280 koyu` geçici bir DEMO veritabanıyla ekran görüntüsü alır (`docs/screenshots/sonra-*`; `TAM_SAYFA=1` ile tam sayfa). `npm run ikon:uret` PWA ikonlarını `public/ikon.svg`'den yeniden üretir.

E2E testi Playwright ve Chromium'un kurulu olmasını bekler (`require('playwright')`). Ekran görüntüleri `docs/screenshots/` altına yazılır: `390-*`, `320-*` (temel paket görünümü dahil), `koyu-*` (koyu mod: nasıl kullanılır, harita, sepet, profil, özet).

## Yeni site kurulumu

Gerçek bir site için, sakin verisi olmadan, sunucuda tek komutla kurulum:

```bash
DB_PATH=/data/site-app.sqlite npm run kur:site -- --ad "Merter Çınar Evleri" --bloklar A,B,C,D,E --daire 12 --kat 0-5 --plan tam
```

| Seçenek | Anlamı |
|---|---|
| `--ad` (zorunlu) | Site adı, 1–50 karakter. Aynı adlı site varsa betik hiçbir şey değiştirmez ve 0 koduyla çıkar. |
| `--bloklar` (zorunlu) | Virgülle blok adları (en fazla 30, büyük harfe çevrilir). |
| `--daire` (zorunlu) | Blok başına daire sayısı (1–1000). Toplam daire = blok sayısı × daire (en fazla 5000). |
| `--kat` (zorunlu) | `enAlt-enÜst`, ör. `0-5` ya da `-1-8` (-5…80). |
| `--plan` | `temel`, `alisveris` ya da `tam` (varsayılan `tam`). |
| `--deneme-gun` | Deneme süresi, 0–365 gün (varsayılan 30). |

Betiğin yaptıkları:
- Siteyi `deneme` durumunda açar ve bloklara kat aralığıyla daire sayısını yazar. Profilde "Daire no" bu sayede 1…N listesinden seçilir; sunucu da bu aralık dışındaki numarayı 400 ile reddeder.
- `toplamDaire` değerini (örnekte 60) yazar; Özet'teki doluluk yüzdesi bundan hesaplanır.
- Fiyatsız örnek katalog yükler. Sakin, fiyat ve tur oluşturmaz.
- Tek kullanımlık, 7 gün geçerli bir **site yöneticisi davet kodu** üretir ve konsola yazar. Kodu yöneticiye güvenli bir kanaldan iletin.

Hatalı argümanda açıklayıcı bir mesaj ve kullanım satırı yazar, 1 koduyla çıkar. Sonraki adımlar:
1. Yönetici telefonla girip kodu kullanır.
2. "Üyeler"den sakin davet kodu üretir ve "Bağlantı ve kodu kopyala" ile `/s/KOD` sayfasını paylaşır.
3. Fiyatları ve ilk turu "Sepet › Katalog"dan girer.

Bu akış `test/kurulum.e2e.test.js` ile geçici bir veritabanında uçtan uca denenir. Ekran görüntüleri `docs/screenshots/merter-*.png` altındadır.

## Yayına alma

### Ortam değişkenleri (üretim)
- `NODE_ENV=production` → çerez `Secure`, HSTS açık; `SESSION_SECRET` zorunlu (en az 32 karakter).
- `SMS_PROVIDER` gerçek bir sağlayıcı olmalı (konsol üretimde başlatmayı reddeder).
- Ters vekil arkasında `TRUST_PROXY=1` ve `PUBLIC_ORIGIN=https://alanadiniz` verin (IP hız sınırı ve Origin kontrolü için).

### Docker

`Dockerfile` (node:22-slim, yalnız üretim bağımlılıkları), `.dockerignore` ve `docker-entrypoint.sh` hazırdır.
- Veritabanı `DB_PATH=/data/site-app.sqlite` yolundadır; `/data` bir `VOLUME`'dur.
- Kalıcı diskler çoğu platformda root sahipliğinde bağlanır. Giriş betiği bu yüzden root olarak başlar, yalnızca `/data` sahipliğini düzeltir, şema migration'ını çalıştırır (`scripts/migrate.js`) ve uygulamayı `setpriv` ile yetkisiz `node` kullanıcısına devreder. Node süreci PID 1 olarak uid 1000 ile çalışır.
- `HEALTHCHECK` `/saglik` ucunu yoklar. Bu uç veritabanına `SELECT 1` ve şema sürümü sorgusu yapar; 200 `{"durum":"ok"}` ya da 503 döner.

```bash
docker build -t bilincli-sakin .
docker volume create sakin-veri
docker run -d --name sakin -p 3000:3000 -v sakin-veri:/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) -e SMS_PROVIDER=webhook -e SMS_WEBHOOK_URL=https://… \
  -e PLATFORM_ADMIN_TELEFONLARI=+905… -e PUBLIC_ORIGIN=https://sakin.ornek.com -e TRUST_PROXY=1 bilincli-sakin
docker exec sakin node --disable-warning=ExperimentalWarning scripts/kur-site.js --ad "Merter Çınar Evleri" --bloklar A,B,C,D,E --daire 12 --kat 0-5 --plan tam
```

Bakım betikleri (`kur-site`, `migrate`, `seed-demo`) root kabuğundan çalıştırılırsa yetkiyi kendiliğinden veri klasörünün sahibine (`node`) düşürür. Böylece veritabanı dosyaları root'a geçip sunucuyu yazamaz hale getirmez.

### Render

`render.yaml` (Blueprint) hazırdır:
- Docker runtime, `/data` kalıcı disk (1 GB), `healthCheckPath: /saglik` ve tek örnek kullanır.
- `SESSION_SECRET` `generateValue` ile üretilir. Diğer değişkenler blueprint'te sabittir: `NODE_ENV=production`, `TRUST_PROXY=1`, `DB_PATH`.
- `PUBLIC_ORIGIN`, `PLATFORM_ADMIN_TELEFONLARI` ve SMS değişkenleri `sync: false`'tur; panelden girilir.
- Kalıcı disk ücretli plan ister (Starter).

Adımlar:
1. Render › New › Blueprint › depoyu seçin.
2. `sync: false` değerlerini doldurun ve dağıtın.
3. Özel alan adı ekleyip `PUBLIC_ORIGIN` değerini ona göre güncelleyin.
4. Merter kurulumu için servis sayfasından **Shell** sekmesini açın:
   ```bash
   cd /app && node --disable-warning=ExperimentalWarning scripts/kur-site.js --ad "Merter Çınar Evleri" --bloklar A,B,C,D,E --daire 12 --kat 0-5 --plan tam
   ```
   Çıktıdaki yönetici davet kodunu yöneticiye iletin.

### Fly.io

`fly.toml` hazırdır: `fra` bölgesi, `/data` volume'u, `/saglik` kontrolü, tek makine.

```bash
fly launch --no-deploy --copy-config
fly volumes create sakin_veri --region fra --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) SMS_PROVIDER=webhook SMS_WEBHOOK_URL=https://… PLATFORM_ADMIN_TELEFONLARI=+905… PUBLIC_ORIGIN=https://bilincli-sakin.fly.dev
fly deploy
fly ssh console -C 'sh -c "cd /app && node --disable-warning=ExperimentalWarning scripts/kur-site.js --ad \"Merter Çınar Evleri\" --bloklar A,B,C,D,E --daire 12 --kat 0-5 --plan tam"'
```

### Railway

Railway `Dockerfile`'ı kendiliğinden kullanır.
1. Yeni proje oluşturun ve depoyu bağlayın.
2. Servise bir **Volume** ekleyin; bağlama yolu `/data` olsun.
3. Değişkenleri girin: `SESSION_SECRET`, `NODE_ENV=production`, `TRUST_PROXY=1`, `PUBLIC_ORIGIN`, SMS değişkenleri, `PLATFORM_ADMIN_TELEFONLARI`.
4. Settings › Healthcheck Path değerini `/saglik` yapın ve replika sayısını 1'de bırakın.
5. Kurulum komutunu servis menüsündeki shell'den, Render'daki komutla aynı şekilde çalıştırın. Railway CLI ile: `railway ssh` ya da `railway run`.

Hepsinde uygulama tek süreçte çalışmalıdır (SQLite + bellek içi hız sınırı); yatay ölçekleme yapmayın. İlk açılışta şema otomatik oluşturulur; sonraki sürümlerdeki migration'lar da açılışta uygulanır.

### VPS + Nginx + HTTPS
```bash
# Node 22 kurulu Ubuntu
sudo useradd -r -m sakin && sudo -u sakin git clone … /home/sakin/site-app   # veya dosyaları kopyalayın
cd /home/sakin/site-app && sudo -u sakin npm ci --omit=dev
```
`/etc/systemd/system/bilincli-sakin.service`:
```ini
[Unit]
Description=Bilinçli Sakin
After=network.target
[Service]
User=sakin
WorkingDirectory=/home/sakin/site-app
EnvironmentFile=/home/sakin/site-app/.env
Environment=NODE_ENV=production
ExecStartPre=/usr/bin/node --disable-warning=ExperimentalWarning scripts/migrate.js
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/server.js
Restart=always
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/sakin/site-app/data
PrivateTmp=true
[Install]
WantedBy=multi-user.target
```
Nginx (`/etc/nginx/sites-available/sakin`):
```nginx
server {
  server_name sakin.ornek.com;
  client_max_body_size 1m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location = /sw.js { proxy_pass http://127.0.0.1:3000; add_header Cache-Control "no-cache"; }
  listen 80;
}
```
```bash
sudo ln -s /etc/nginx/sites-available/sakin /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d sakin.ornek.com       # Let's Encrypt HTTPS
sudo systemctl enable --now bilincli-sakin
```
`.env`: `HOST=127.0.0.1`, `TRUST_PROXY=1`, `PUBLIC_ORIGIN=https://sakin.ornek.com`, `DB_PATH=/home/sakin/site-app/data/site-app.sqlite`. Sağlık kontrolü: `curl -fsS https://sakin.ornek.com/saglik`. Merter kurulumu: `cd /home/sakin/site-app && sudo -u sakin npm run kur:site -- --ad "Merter Çınar Evleri" --bloklar A,B,C,D,E --daire 12 --kat 0-5 --plan tam`.

### Yedekleme
SQLite WAL modundadır; çalışırken tutarlı yedek için:
```bash
sqlite3 /data/site-app.sqlite ".backup '/yedek/site-app-$(date +%F).sqlite'"
```
Bunu günlük cron ile çalıştırın, yedekleri şifreleyip sunucu dışına taşıyın (ör. `age`/`gpg` + nesne depolama) ve eski yedekleri saklama politikanıza göre silin. Geri yüklemeyi düzenli deneyin. KVKK: silinen hesaplar yedeklerde saklama süresi boyunca kalır; bunu aydınlatma metninde belirtin.

## SMS sağlayıcı bağlama

`src/sms.js` her sağlayıcıdan `{ ad, async gonder(telefon, mesaj) }` bekler. Telefon E.164 biçimindedir (`+905xxxxxxxxx`).

- `SMS_PROVIDER=webhook`: `SMS_WEBHOOK_URL` adresine `{"telefon","mesaj"}` JSON POST eder (`SMS_WEBHOOK_TOKEN` varsa `Authorization: Bearer`). Kendi ağ geçidinizi ya da bir otomasyon aracını bağlamanın en kolay yolu.
- `SMS_PROVIDER=netgsm`: NetGSM için şablon. **Doğrulanmadı** — canlıya almadan önce sağlayıcının güncel API belgesiyle uç noktayı, parametreleri ve başarı kodlarını kontrol edin. Gönderici başlığı (`NETGSM_BASLIK`) BTK onaylı olmalıdır.
- Başka sağlayıcı (İleti Merkezi, Twilio vb.): `createSmsProvider` içine bir dal ekleyin.

OTP kuralları: 6 hane, 5 dakika geçerli, en fazla 5 hatalı deneme (sonra kod silinir), numara başına dakikada 1 / saatte 5 kod, IP başına 15 dakikada 10 kod isteği ve 30 doğrulama. Kodlar veritabanında HMAC özeti olarak tutulur.

## Güvenlik notları

- **Kiracı izolasyonu:** site kimliği yalnız sunucu tarafı oturumdan gelir; her sorgu `site_id` ile parametrelidir. Üye, rol ve davet işlemleri de site ile sınırlıdır (başka sitenin kaydı 404 döner). Testlerle kanıtlanır.
- **Oturum:** 32 baytlık rastgele kimlik, `HttpOnly; SameSite=Lax; Path=/` (+ üretimde `Secure`), veritabanında SHA-256 özeti, 30 gün.
- **CSRF:** yazma isteklerinde (1) oturuma bağlı `X-CSRF-Token` başlığı, (2) Origin / `Sec-Fetch-Site` kontrolü, (3) `application/json` zorunluluğu (siteler arası formları ve CORS'suz istekleri engeller).
- **Başlıklar:** CSP (`default-src 'self'; script-src 'self'`; satır içi stiller için `style-src 'unsafe-inline'` — prototip satır içi `style` kullanır), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Permissions-Policy`, üretimde HSTS.
- **Girdi/çıktı:** tüm girdiler sunucuda doğrulanır (uzunluklar, kat -5…80, birey ≤ 12, blok/kat listeden, kg için 0,5 adım, miktar ≤ 99, ürün ≤ 300…). Kullanıcı verisi HTML'e yalnızca `esc()` ile yazılır; Markdown yalnızca uygulamayla gelen statik dosyalardan işlenir. Tüm SQL parametrelidir. CSV hücreleri formül enjeksiyonuna karşı korunur (`=,+,-,@` ile başlayana `'` eklenir).
- **KVKK:** TC kimlik, doğum tarihi, tanı, gelir alanı yoktur. Hanedeki bireyler için yalnızca yakınlık, yaş grubu ve iş durumu tutulur; profilde tanımsız alanlar sunucuda atılır. Siteye özel sorular en fazla 8 tanedir. Etiketi kimlik numarası, doğum tarihi, sağlık/tanı/ilaç, gelir/maaş, din, etnik köken, siyasi görüş, sendika, sabıka, cinsel yaşam, biyometrik veri, kan grubu gibi hassas bilgileri soran sorular sunucuda reddedilir. Bu bir anahtar kelime filtresidir; dolaylı ifadeleri yakalamayabilir, serbest metin alanlarına (ad, yardım notu, sipariş notu) yazılanları engellemez. Sakin "Hesabım"dan tüm verisini JSON indirir; profilini (o sitedeki sepetle birlikte) veya hesabını tamamen siler. Aydınlatma metni `public/aydinlatma.html` bir şablondur — **hukukçuya kontrol ettirin.** Site yönetimi veri sorumlusu, satıcı veri işleyendir; aralarında veri işleme sözleşmesi yapın.

## Bilinen sınırlar

- "Satıcı sakin verisini görmez" iddiası uygulama ve panel düzeyinde doğrudur. Ancak sunucuyu ve veritabanı dosyasını işleten taraf (barındırma / satıcı) dosyaya teknik olarak erişebilir. Veritabanı şifrelenmez. Bu durum veri işleme sözleşmesi ve erişim kayıtlarıyla yönetilmelidir.
- Satıcı yeni site oluştururken ilk yönetici davet kodunu görür. Kodu yöneticiye teslim etmeden kendisi kullanması teknik olarak engellenmez; o durumda gerçek yönetici kodu kullanamaz ve durumu fark eder.
- Paket düşürülünce sekmeler kapanır ama mevcut sepet ve puan verileri veritabanında kalır.
- Docker imajı bu ortamda derlendi ve çalıştırıldı (healthy, `/saglik` 200, node uid 1000, `kur-site` çalıştı). Ancak Docker Hub hız sınırı nedeniyle temel imaj `mirror.gcr.io` aynasından çekildi. Render, Fly ve Railway üzerinde gerçek dağıtım **yapılmadı**: `render.yaml` ve `fly.toml` platform belgelerine göre yazıldı, hesapla doğrulanmadı.
- PWA kurulumu ("Ana ekrana ekle") gerçek iOS/Android cihazlarda denenmedi; manifest, ikonlar, servis çalışanı ve çevrimdışı ekran Chromium'da test edildi.

- Ödeme / faturalama entegrasyonu yok; abonelik alanlarını platform yöneticisi elle yönetir.
- Hız sınırlayıcı bellek içidir ve tek süreç varsayar; yeniden başlatmada sıfırlanır.
- Canlı güncelleme yok (WebSocket/SSE); veriler sayfa/sekme açılışında ve "Yenile" ile alınır. İki yönetici aynı anda katalog düzenlerse son kaydeden kazanır.
- Tur saatleri Türkiye saatine (UTC+3) göre yorumlanır; başka saat dilimi desteği yok.
- NetGSM ve webhook sağlayıcıları gerçek bir hesapla denenmedi; yalnız konsol ve bellek sağlayıcıları testlerde çalıştırıldı.
- `node:sqlite` Node 22'de "deneysel" işaretlidir (uyarı `--disable-warning` ile gizlenir).
- Hesap silindiğinde sitenin son yöneticisi giderse site yöneticisiz kalır; platform yöneticisi yeni yönetici daveti üretmelidir.
- Bir sakin birden çok sitede ayrı profil/puan kartı tutar (puanlar site bazındadır).
- Erişilebilirlik ve tarayıcı uyumluluğu yalnızca Chromium (Playwright) ile denendi.
