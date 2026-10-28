# App Store ve Google Play'e çıkış kılavuzu

Bu belge, **Merter Çınar Evleri** mobil uygulamasını (klasör: `mobile/`) mağazalara göndermek için gereken her adımı listeler.

**Uygulamanın yapısı.** Telefondaki arayüz, claude.ai'de yayımlanan Merter Çınar Evleri sayfasının aynı kodudur (`merter/index.html`). Sayfa claude.ai'de `window.claude.use("db")` ile veri tutar. Uygulamada bu çağrıyı `merter/claude-uyum.js` karşılar ve veriyi sunucudaki belge deposuna (`src/belgeler.js`) yazar. Depo, claude.ai sayfasındaki 22 erişim kuralının aynısını uygular. Tarayıcıdan aynı arayüz `https://ALANADINIZ/m/` adresindedir. Genel Bilinçli Sakin arayüzü (`public/`) ise `/` adresinde çalışmaya devam eder; site yönetimi davet kodlarını oradan (Yönetim › Üyeler ve davetler) üretir.

**Mağaza adı ve kimliği.** Uygulama adı "Merter Çınar Evleri", kimliği `com.bilinclisakin.mertercinar`. ☐ Apple'ın 4.2.6 kuralı: hazır bir şablondan bir kuruluş adına üretilen uygulamaları ancak **o kuruluşun kendi geliştirici hesabından** yayımlanırsa kabul eder. Bu yüzden Merter Çınar Evleri adıyla yayın için Apple Developer hesabını site yönetimi (ya da onu temsil eden tüzel kişi) adına açın. Uygulama sizin hesabınızdan yayımlanacak ve birden çok siteye satılacaksa, genel bir adla ("Bilinçli Sakin") tek uygulama yayımlayıp siteleri içinde ayırmak daha güvenlidir (`ARAYUZ=sakin`, `appId` değişikliği; bkz. bölüm 3). Kodda hazır olanlar **✔**, sizin açmanız ya da karar vermeniz gerekenler **☐** ile işaretlidir.

## 1. Durum özeti

| Konu | Durum |
|---|---|
| Android ve iOS projeleri (Capacitor 8) | ✔ `mobile/android`, `mobile/ios` |
| Uygulama içi satın alma (RevenueCat SDK + sunucu doğrulaması) | ✔ kodda; ☐ mağaza ürünleri ve RevenueCat hesabı |
| Sakin başına aylık abonelik + "site öder" modeli | ✔ `src/abonelik.js`, `sites.odeme_modeli` |
| Mobil giriş (Bearer jeton, CORS) | ✔ |
| Uygulama içi hesap silme (Apple 5.1.1(v)) | ✔ Diğer › Hesabım › Hesabımı sil |
| Web'den hesap silme sayfası (Google Play şartı) | ✔ `/hesap-sil.html` |
| Gizlilik politikası, kullanım koşulları | ✔ şablon; ☐ hukukçu kontrolü ve köşeli parantezleri doldurma |
| İnceleme hesabı (SMS'siz giriş) | ✔ `INCELEME_TELEFON`, `INCELEME_KODU` |
| Yerel özellik: duvar kâğıdı (Android'de doğrudan ayarlama, iOS'ta Fotoğraflar'a kaydetme) | ✔ |
| Uygulama ikonları | ✔ `mobile/kaynak/` (iOS 1024, Android mipmap ve uyarlanabilir ikon, Play 512) |
| Derleme hattı (GitHub Actions) | ✔ taslak `.github/workflows/mobil.yml`; ☐ depo ve sırlar |
| Sunucu (barındırma, alan adı, SMS sağlayıcısı) | ☐ birlikte değerlendirilecek |
| Bildirimler (push) | ☐ yok; Firebase ve APNs hesabı gerekir |
| Gündem, Fırsatlar, Hizmetler, Bugün, oyun kartı | ☐ yalnızca Claude sayfasında var; uygulamaya taşınacak |

Bu ortamda Android SDK indirilemediği (Google sunucusu engelli) ve iOS derlemesi Mac gerektirdiği için **derleme burada yapılmadı**. Java ve Swift kodu Capacitor'ın kaynak kodundaki imzalarla karşılaştırıldı. Gerçek derleme ilk kez GitHub Actions'ta ya da bir bilgisayarda (Android Studio / Xcode) yapılacak.

## 2. Açılması gereken hesaplar

1. **Apple Developer Program**: yıllık 99 USD. Şirket adına açılacaksa D-U-N-S numarası gerekir (ücretsiz, birkaç gün sürebilir). Ücretli uygulama sözleşmesi ile vergi ve banka bilgileri App Store Connect'te doldurulmadan abonelik satılamaz.
2. **Google Play Console**: bir kerelik 25 USD. ☐ Kişisel hesapla açılırsa Google, yayından önce en az 12 test kullanıcısıyla 14 gün kapalı test ister. Şirket hesabında bu şart yoktur (güncel kuralı açarken kontrol edin). Ödeme profili ve banka bilgisi gerekir.
3. **RevenueCat**: ücretsiz başlar; aylık izlenen gelir 2.500 USD'ye kadar ücret yok, üstünde gelirin %1'i (güncel fiyatı kontrol edin).

## 3. İlk yüklemeden önce verilecek kararlar

- ☐ **Uygulama kimliği**: şu an `com.bilinclisakin.mertercinar` (Android `applicationId`, iOS Bundle Identifier, `capacitor.config.json` › `appId`). Java paket adı `com.bilinclisakin.app` olarak kalır; bu bir sorun değildir. İlk yüklemeden sonra **değiştirilemez**. Şirket alan adınız varsa ona göre seçin (ör. `com.firmaniz.sakin`). Değiştirmek için: `mobile/capacitor.config.json` › `appId`, `android/app/build.gradle` › `namespace` ve `applicationId`, Java paket klasörü, Xcode › Bundle Identifier.
- ☐ **Mağazadaki ad**: "Merter Çınar Evleri" (30 karakter sınırı).
- ☐ **Premium'da ne olacak**: Merter uygulamasında Premium Gündem'i açar: fotoğraflı paylaşım, beğeni ve yorumlar, sonsuz kaydırma ve hikâye şeridi, gönderi sabitleme. Liste `merter/claude-uyum.js` › `PREMIUM_OZELLIK` içinde (genel arayüzde `public/shared.js` › `PREMIUM_OZELLIKLER`). Apple, abonelik ekranında yazan her özelliğin uygulamada çalışmasını ister; özellik eklendikçe listeye eklenmeli. Ayet ve hadis metinleri bilinçli olarak herkese ücretsizdir.

## 4. Abonelik ürünü

Her iki mağazada aynı ürün kimliğini kullanın: **`bs_premium_aylik`**.

**App Store Connect** › Uygulama › Abonelikler:
1. Abonelik grubu: "Premium".
2. Ürün: `bs_premium_aylik`, süre 1 ay.
3. Fiyat: 100 TL'ye en yakın Türkiye fiyat noktası. Apple fiyat noktalarını kendisi belirler; listeden seçin.
4. Türkçe görünen ad ve açıklama, inceleme ekran görüntüsü (Abonelik sayfası).

**Google Play Console** › Para kazanma › Abonelikler:
1. Ürün `bs_premium_aylik`.
2. Temel plan: aylık, otomatik yenilenir, Türkiye fiyatı 100 TL.

**RevenueCat**:
1. Proje açın, iOS uygulaması (bundle id) ve Android uygulaması (paket adı) ekleyin. Mağaza bağlantıları: App Store Connect için "In-App Purchase Key"; Google Play için hizmet hesabı JSON'u (RevenueCat bunları adım adım anlatır).
2. Entitlement: **`premium`** (sunucu bu adı arar; değiştirirseniz `REVENUECAT_HAK` ile bildirin).
3. Offering: `default`, içinde aylık paket olarak `bs_premium_aylik`.
4. Webhook: URL `https://ALANADINIZ/api/abonelik/webhook`. Authorization başlığına `Bearer ` ile başlayan uzun, rastgele bir değer yazın; aynı değer sunucuda `ABONELIK_WEBHOOK_ANAHTARI` olur (başındaki `Bearer ` olmadan).
5. Anahtarlar:
   - Gizli API anahtarı (`sk_…`, v1) yalnızca **sunucuya** konur: `REVENUECAT_API_ANAHTARI`.
   - Genel SDK anahtarları (`appl_…`, `goog_…`) **uygulamaya** konur: `mobile/.env`.

**Gelir örneği** (doğrulamak için hesap panelinize bakın): 100 TL'lik fiyatın içinde %20 KDV varsa ve mağaza KDV'yi tahsil edip ödüyorsa, KDV hariç tutar 83,33 TL olur. Küçük işletme programında (yıllık 1 milyon USD altı) komisyon Apple'da %15, Google'da abonelikler için %15'tir; geriye yaklaşık 70,8 TL kalır. Site öder modelinde ödeme mağaza dışında (aidatla) alındığından mağaza komisyonu yoktur. Apple 3.1.3(b) kuralı buna izin verir, yeter ki aynı abonelik uygulama içinde de satın alınabilsin.

## 5. Sunucu ortam değişkenleri (yeni)

| Değişken | Açıklama |
|---|---|
| `REVENUECAT_API_ANAHTARI` | RevenueCat gizli anahtarı (`sk_…`). Boşsa mağaza kapalıdır, uygulama "ücretsiz" çalışır |
| `REVENUECAT_HAK` | Entitlement adı, varsayılan `premium` |
| `ABONELIK_WEBHOOK_ANAHTARI` | RevenueCat webhook Authorization değeri (`Bearer ` hariç) |
| `ABONELIK_FIYAT_METNI` | Web'de gösterilen fiyat metni, varsayılan `100 TL / ay` |
| `INCELEME_TELEFON`, `INCELEME_KODU` | Mağaza incelemesi için SMS'siz giriş (6 haneli sabit kod). İnceleme bitince kaldırın ya da kodu değiştirin |

Site öder modelini platform panelinden açmak için: `PATCH /api/platform/siteler/:id` › `{"odemeModeli":"site"}`. Site askıya alınırsa sakinlerin Premium hakkı da durur.

## 6. Uygulamayı derleme

```bash
cd mobile
cp .env.ornek .env            # API_TABAN, REVENUECAT_IOS, REVENUECAT_ANDROID
npm ci
npm run senkron               # www/ üretir (public/ + köprü + ayarlar) ve cap sync
npm run android:ac            # Android Studio: Build › Generate Signed Bundle (AAB)
npm run ios:ac                # Xcode (Mac): Product › Archive › Distribute App
```

`API_TABAN` https olmak zorundadır; `scripts/hazirla.js` başka değeri reddeder.

**Android yükleme anahtarı** (bir kez üretin, yedekleyin; kaybolursa Google'dan sıfırlama istenir):
```bash
keytool -genkeypair -v -keystore upload.jks -alias bsakin -keyalg RSA -keysize 2048 -validity 10000
```
Google Play App Signing açık kalsın: asıl imza anahtarını Google saklar, sizinki yalnızca yükleme anahtarıdır.

## 7. CI sırları (GitHub › Settings › Secrets and variables › Actions)

- **Variables:** `API_TABAN`, `REVENUECAT_IOS`, `REVENUECAT_ANDROID`
- **Android sırları:** `ANDROID_KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `ANDROID_KEYSTORE_SIFRE`, `ANDROID_ANAHTAR_ADI`, `ANDROID_ANAHTAR_SIFRE`
- **iOS sırları:** `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8_BASE64`. App Store Connect › Kullanıcılar ve Erişim › Entegrasyonlar › API anahtarı, rol "App Manager".

İş akışı `mobil-v1.0.0` gibi bir etiketle ya da elle başlatılır. Önce tüm testleri çalıştırır, sonra Android AAB üretir ve iOS'u App Store Connect'e (TestFlight) yükler.

## 8. İnceleme notu (App Review / Play inceleme için)

> Giriş telefon numarası ve SMS koduyla yapılır. İnceleme için: telefon **[INCELEME_TELEFON]**, kod **[INCELEME_KODU]**. Giriş sonrası **[davet kodu]** ile sitesine katılın. Premium: Gündem › "Premium'u incele" ya da Profil › Hesap ve abonelik (sandbox). Hesap silme: Profil (sağ üstteki kişi simgesi) › Hesap ve abonelik › Hesabımı sil. Yerel özellik: Hikmet › Duvar kâğıdı. Android'de ana ekran ya da kilit ekranı doğrudan ayarlanır, iOS'ta resim Fotoğraflar'a kaydedilir.

Bilinen riskler ve alınan önlemler:
- **Apple 4.2 (yalnızca web sitesi sarmalayıcısı):** Uygulama dosyaları cihazın içindedir; mağaza içi satın alma, Fotoğraflar ve duvar kâğıdı gibi yerel özellikler, yerel paylaşım sayfası ve çevrimdışı açılış vardır. Bildirimler (push) eklenirse bu risk daha da azalır.
- **Apple 3.1.1:** Dijital abonelik yalnızca uygulama içi satın almayla satılır; uygulamada dış ödeme bağlantısı yoktur.
- **Apple 3.1.2:** Abonelik ekranında süre, fiyat, otomatik yenileme, iptal yolu, kullanım koşulları ve gizlilik bağlantıları vardır. Satın alımları geri yükleme düğmesi vardır.
- **Apple 5.1.1(v), Google hesap silme:** Uygulama içinden ve web'den (`/hesap-sil.html`) hesap silinebilir.

## 9. Gizlilik formları

**Apple App Privacy** ve **Google Data safety** için yanıt taslağı:

| Veri | Toplanıyor mu | Amaç | Kimliğe bağlı mı | İzleme |
|---|---|---|---|---|
| Telefon numarası | Evet | Hesap, giriş | Evet | Hayır |
| Ad (isteğe bağlı), konut ve hane bilgisi | Evet | Uygulama işlevi (site yönetimi) | Evet | Hayır |
| Satın alma geçmişi (abonelik durumu) | Evet | Uygulama işlevi | Evet | Hayır |
| Kullanıcı içeriği (sepet, puan kartı notları) | Evet | Uygulama işlevi | Evet | Hayır |
| Konum, kişiler, fotoğraflar, sağlık, finans, tarama geçmişi, reklam kimliği | Hayır | | | |

- Veriler aktarım sırasında şifrelenir (HTTPS).
- Kullanıcı silme isteyebilir (uygulama içinden ve web'den).
- Üçüncü taraf: SMS sağlayıcısı ve RevenueCat (hizmet sağlayıcı; "paylaşım" sayılmaz, formda nasıl işaretleneceğini kontrol edin).
- Fotoğraf izni (iOS) yalnızca **ekleme** içindir; uygulama Fotoğraflar'ı okumaz.

## 10. Mağaza metinleri (taslak)

- **Ad:** Merter Çınar Evleri
- **Alt başlık (iOS, 30 karakter):** Sitemizin ortak yaşam alanı
- **Kısa açıklama (Google, 80 karakter):** Site sakinleri için duyuru, ortak alışveriş, profil ve günün ayeti/hadisi.
- **Açıklama:**
  > Merter Çınar Evleri uygulaması, sitemizin günlük yaşamını tek yerde toplar.
  > • Ortak market ve pazar sepeti: siparişinizi verin, site toplu alsın, daha uygun fiyata gelsin.
  > • Duyurular ve iletişim: yönetimin numaralarına tek dokunuşla ulaşın.
  > • Profil: blok, kat, daire ve hane bilgisi; acil durumda kimin yardıma ihtiyacı olduğunu yönetim bilsin.
  > • Hikmet: her gün bir ayet ya da hadis; Arapça metni, anlamı ve kaynağıyla. WhatsApp'ta paylaşın.
  > • Hizmetler: ütü ve ev temizliği siparişi; görevli kapınızdan alır, teslim eder.
  > • Fırsatlar ve Bugün: civardaki indirimler, namaz vakitleri.
  > • Etkinlik, turnuva ve sakin kartı.
  > • Hikmet duvar kâğıtları: ayet ve hadisleri ana ekran ve kilit ekranı görseli yapın.
  > • Premium Gündem: fotoğraflı paylaşım, beğeni, yorum ve hikâyeler.
  > Temel özellikler ücretsizdir. Premium aylık abonelikle sunulur; site yönetiminiz bedeli tüm sakinler için ödeyebilir.
- **Kategori:** Yaşam Tarzı (Lifestyle). İkinci kategori (iOS): Yardımcı Programlar.
- **Yaş derecelendirmesi:** 4+ / Herkes. Kullanıcılar arası sohbet yoktur.
- **Ekran görüntüleri:** iPhone 6,9" (1320×2868) ve Android telefon. `npm run ekran` ve `test/mobil.e2e.test.js` dar ekran görüntüleri üretir; mağaza boyutlarına göre ayrı bir komut eklenebilir.

## 11. Yayına kadar kalan işler

1. ☐ Barındırma ve alan adı. Sunucu https olmalı, `PUBLIC_ORIGIN` ayarlanmalı.
2. ☐ Gerçek SMS sağlayıcısı (README: SMS sağlayıcı bağlama).
3. ☐ Yasal metinlerin doldurulması ve hukukçu kontrolü (KVKK, mesafeli satış, abonelik).
4. ☐ Ayet ve hadis metinlerinin, anlamlarının ve kaynaklarının bir din görevlisince kontrolü.
5. ☐ Mağaza hesapları, abonelik ürünü, RevenueCat.
6. ☐ İlk derleme: Android'de kapalı test, iOS'ta TestFlight. Gerçek cihazda satın alma (sandbox), duvar kâğıdı ve hesap silme denemesi.
7. ☐ Önerilen: bildirimler (duyuru, sipariş turu kapanıyor), Gündem ve Hizmetler modüllerinin uygulamaya taşınması.
