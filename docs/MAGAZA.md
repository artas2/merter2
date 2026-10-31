# App Store ve Google Play'e çıkış kılavuzu

Bu belge, **Bilinçli Sakin** mobil uygulamasını (klasör: `mobile/`) mağazalara göndermek için gereken her adımı listeler. Kodda hazır olanlar **✔**, sizin açmanız ya da karar vermeniz gerekenler **☐** ile işaretlidir.

**Tek uygulama, her site kendi adıyla.** Mağazada tek bir uygulama vardır: "Bilinçli Sakin" (`com.bilinclisakin.app`). Sakin telefon numarasıyla giriş yapar ve site yönetiminden aldığı davet koduyla sitesine katılır. Sonra uygulama o sitenin adını (ör. "Merter Çınar Evleri"), rengini, bloklarını ve ayarlarını gösterir. Yeni siteler için yeni uygulama yayımlanmaz; yalnızca sunucuda site açılır (`npm run kur:site`). Bu yol Apple'ın 4.2.6 kuralına (bir kuruluş adına şablondan üretilen kopya uygulamalar) takılmaz.

**Arayüz.** Telefondaki arayüz, claude.ai'de yayımlanan Merter Çınar Evleri sayfasının aynı kodudur (`merter/index.html`). Sayfa claude.ai'de `window.claude.use("db")` ile veri tutar. Uygulamada bu çağrıyı `merter/claude-uyum.js` karşılar ve veriyi sunucudaki belge deposuna (`src/belgeler.js`) yazar; depo 22 erişim kuralının aynısını uygular. Tarayıcıdan aynı arayüz `https://ALANADINIZ/m/` adresindedir. Site yöneticisi davet kodlarını ve üyeleri uygulamanın içinden yönetir: Sakinler › **Davetler ve üyeler**.

## 1. Durum özeti

| Konu | Durum |
|---|---|
| Android ve iOS projeleri (Capacitor 8) | ✔ `mobile/android`, `mobile/ios` |
| Uygulama içi satın alma, **üçüncü taraf hizmet olmadan** | ✔ iOS: StoreKit 2 imzalı kayıt sunucuda doğrulanır. Android: Google Play Developer API. Eklenti: `@capgo/native-purchases` (açık kaynak, ücretsiz) |
| Sakin başına aylık abonelik + "site öder" modeli | ✔ `src/abonelik.js`, `sites.odeme_modeli` |
| Davetler ve üyeler ekranı (uygulama içinde) | ✔ `merter/yonetim.js`, `merter/yonetim.css` |
| Mobil giriş (Bearer jeton, CORS) | ✔ |
| Uygulama içi hesap silme (Apple 5.1.1(v)) | ✔ Profil › Hesap ve abonelik › Hesabımı sil |
| Web'den hesap silme sayfası (Google Play şartı) | ✔ `/hesap-sil.html` |
| Gizlilik politikası, kullanım koşulları | ✔ şablon; ☐ hukukçu kontrolü ve köşeli parantezleri doldurma |
| İnceleme hesabı (SMS'siz giriş) | ✔ `INCELEME_TELEFON`, `INCELEME_KODU` |
| Yerel özellik: duvar kâğıdı (Android'de doğrudan ayarlama, iOS'ta Fotoğraflar'a kaydetme) | ✔ |
| Otomatik Hikmet duvar kâğıdı | ✔ Android: rastgele ya da sabit aralıkla (15 dk–24 sa), her açılışta (canlı duvar kâğıdı) ya da günlük; ana ve kilit ekranı ayrı ayrı. iOS: Kestirmeler eylemi (rastgele). Yerel kod `mobile/denetim/java-denetim.sh` ile Android 15 sınıflarına karşı denetlenir. ☐ Gerçek cihazda deneme (özellikle Samsung kilit ekranı) |
| Uygulama ikonları | ✔ `mobile/kaynak/` |
| Derleme hattı (GitHub Actions) | ✔ taslak `.github/workflows/mobil.yml`; ☐ sırlar, ilk çalıştırma |
| Sunucu (barındırma, alan adı, SMS sağlayıcısı) | ☐ birlikte değerlendirilecek |
| Bildirimler (push) | ☐ yok; Firebase (ücretsiz) ve Apple bildirim anahtarı gerekir |

Bu ortamda Android SDK indirilemediği ve iOS derlemesi Mac gerektirdiği için **derleme burada yapılmadı**. Gerçek derleme ilk kez GitHub Actions'ta ya da bir bilgisayarda (Android Studio / Xcode) yapılacak.

## 2. Hesaplar ve maliyet

Kodun ve satın alma doğrulamasının hiçbir parçası ücretli bir hizmete bağlı değildir. Mağazaların kendi ücretleri ise kaçınılmazdır:

| Hesap | Ücret | Not |
|---|---|---|
| **Apple Developer Program** | Yıllık 99 USD | App Store'da yayın için zorunlu. Kâr amacı gütmeyen kuruluşlar, eğitim ve devlet kurumları bazı ülkelerde ücret muafiyeti isteyebilir; ☐ Türkiye'nin ve kuruluşunuzun uygunluğunu Apple'ın "Fee waiver" sayfasından kontrol edin. Şirket adına açılırsa D-U-N-S numarası gerekir (ücretsiz). |
| **Google Play Console** | Bir kerelik 25 USD | Kişisel hesapta yayından önce 12 test kullanıcısıyla 14 gün kapalı test istenir; kuruluş hesabında istenmez (açarken güncel kuralı kontrol edin). |
| Google Cloud hizmet hesabı ve Pub/Sub | Ücretsiz | Abonelik doğrulaması ve bildirimleri için; bu kullanım ücretsiz kotanın çok altındadır. |
| App Store Server Notifications | Ücretsiz | |
| RevenueCat vb. | **Kullanılmıyor** | |

Mağaza komisyonu: küçük işletme programında (yıllık 1 milyon USD altı) Apple %15, Google abonelikler için %15. 100 TL'lik fiyatın içinde %20 KDV varsa ve mağaza KDV'yi tahsil edip ödüyorsa, KDV hariç 83,33 TL'den komisyon düşülünce yaklaşık 70,8 TL kalır (hesap panelinizden doğrulayın). **Site öder** modelinde ödeme mağaza dışında (aidatla) alındığından komisyon yoktur. Apple 3.1.3(b) buna izin verir, yeter ki aynı abonelik uygulama içinde de satın alınabilsin.

## 3. İlk yüklemeden önce verilecek kararlar

- ☐ **Uygulama kimliği**: `com.bilinclisakin.app`. İlk yüklemeden sonra **değiştirilemez**. Şirket alan adınız varsa ona göre seçin (ör. `com.firmaniz.sakin`): `mobile/capacitor.config.json` › `appId`, `android/app/build.gradle` › `applicationId`, Xcode › Bundle Identifier. Sunucuda `APPLE_BUNDLE_ID` ve `GOOGLE_PAKET_ADI` aynı değer olmalı.
- ☐ **Mağazadaki ad**: "Bilinçli Sakin" (30 karakter sınırı).
- ☐ **Premium'un içeriği**: Premium Gündem'i açar (fotoğraflı paylaşım, beğeni ve yorumlar, sonsuz kaydırma ve hikâye şeridi, gönderi sabitleme). Liste `merter/claude-uyum.js` › `PREMIUM_OZELLIK` içindedir. Apple, abonelik ekranında yazan her özelliğin çalışmasını ister. Ayet ve hadis metinleri bilinçli olarak herkese ücretsizdir.

## 4. Abonelik ürünü ve doğrulama

Her iki mağazada aynı ürün kimliği: **`bs_premium_aylik`**.

**App Store Connect**
1. Uygulama › Abonelikler: grup "Premium", ürün `bs_premium_aylik`, süre 1 ay, fiyat 100 TL'ye en yakın Türkiye fiyat noktası, Türkçe ad ve açıklama, inceleme ekran görüntüsü.
2. Uygulama › Uygulama Bilgileri › **App Store Server Notifications**: Sürüm 2. Üretim ve Sandbox adresi: `https://ALANADINIZ/api/abonelik/apple-bildirim`. Bildirimler Apple imzalıdır; sunucu imzayı doğrular, ayrıca anahtar gerekmez.
3. **Apple Root CA - G3** sertifikasını indirin: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer . Sunucuya koyun ve yolunu `APPLE_KOK_SERTIFIKA` ile verin. Sunucu her satın alma kaydının imza zincirini bu köke kadar doğrular.

**Google Play Console**
1. Para kazanma › Abonelikler: ürün `bs_premium_aylik`, temel plan kimliği **`aylik`** (otomatik yenilenen, 1 ay), Türkiye fiyatı 100 TL.
2. Google Cloud'da bir proje ve **hizmet hesabı** açın, JSON anahtarını indirin. Play Console › Kullanıcılar ve izinler › bu hizmet hesabını davet edin, "Finansal verileri görüntüleme" ve "Siparişleri ve abonelikleri yönetme" izinlerini verin. JSON dosyasının yolunu sunucuda `GOOGLE_HIZMET_HESABI` yapın.
3. **Gerçek zamanlı geliştirici bildirimleri**: Google Cloud Pub/Sub'da bir konu açın, Play Console › Para kazanma kurulumu'nda bu konuyu seçin. Konuya bir **itme (push) aboneliği** ekleyin, adresi `https://ALANADINIZ/api/abonelik/google-bildirim?anahtar=UZUN_RASTGELE_DEGER`. Aynı değeri sunucuda `GOOGLE_BILDIRIM_ANAHTARI` yapın.

**Nasıl çalışır:**
- Cihaz satın almayı sakinin rastgele hesap kimliğiyle (UUID) yapar. iOS'ta bu StoreKit `appAccountToken`, Android'de `obfuscatedAccountId` alanıdır.
- iOS'ta cihaz Apple'ın imzaladığı işlem kaydını, Android'de satın alma jetonunu sunucuya gönderir.
- Sunucu kaydı doğrular: iOS'ta imza zincirini, Android'de Google API yanıtını denetler. Kaydın uygulamaya, ürüne ve **o sakinin hesabına** ait olduğunu kontrol eder. Aynı mağaza kaydı başka hesaba bağlanamaz.
- Yenileme, iptal, ödeme sorunu ve iade bildirimlerle gelir. Sakin "Satın alımları geri yükle" ile kanıtı yeniden gönderebilir.

## 5. Sunucu ortam değişkenleri (abonelik ve inceleme)

| Değişken | Açıklama |
|---|---|
| `APPLE_KOK_SERTIFIKA` | Apple Root CA - G3 dosyasının yolu (`.cer` ya da `.pem`). Boşsa iOS satın alma kapalı |
| `APPLE_BUNDLE_ID` | `com.bilinclisakin.app` |
| `GOOGLE_HIZMET_HESABI` | Hizmet hesabı JSON dosyasının yolu (ya da JSON metni). Boşsa Android satın alma kapalı |
| `GOOGLE_PAKET_ADI` | `com.bilinclisakin.app` |
| `GOOGLE_BILDIRIM_ANAHTARI` | Pub/Sub itme adresindeki `anahtar` değeri |
| `ABONELIK_FIYAT_METNI` | Web'de gösterilen fiyat metni, varsayılan `100 TL / ay` |
| `INCELEME_TELEFON`, `INCELEME_KODU` | Mağaza incelemesi için SMS'siz giriş (6 haneli sabit kod). İnceleme bitince kaldırın |

Mağaza ayarı yoksa uygulama tamamen ücretsiz çalışır, Premium satın alma düğmesi görünmez. Site öder modeli: platform panelinden `PATCH /api/platform/siteler/:id` › `{"odemeModeli":"site"}`. Site askıya alınırsa sakinlerin Premium hakkı da durur.

## 6. Uygulamayı derleme

```bash
cd mobile
cp .env.ornek .env            # API_TABAN=https://ALANADINIZ
npm ci
npm run senkron               # merter/ → www/ ve Android/iOS projeleri
npm run android:ac            # Android Studio: Build › Generate Signed Bundle (AAB)
npm run ios:ac                # Xcode (Mac): Product › Archive › Distribute App
```

`API_TABAN` https olmak zorundadır. iOS'ta Xcode › Signing & Capabilities › **In-App Purchase** yeteneğini ekleyin.

**Android yükleme anahtarı** (bir kez üretin ve yedekleyin):
```bash
keytool -genkeypair -v -keystore upload.jks -alias bsakin -keyalg RSA -keysize 2048 -validity 10000
```
Google Play App Signing açık kalsın.

## 7. CI sırları (GitHub › Settings › Secrets and variables › Actions)

- **Variables:** `API_TABAN`
- **Android sırları:** `ANDROID_KEYSTORE_BASE64` (`base64 -w0 upload.jks`), `ANDROID_KEYSTORE_SIFRE`, `ANDROID_ANAHTAR_ADI`, `ANDROID_ANAHTAR_SIFRE`
- **iOS sırları:** `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8_BASE64`. App Store Connect › Kullanıcılar ve Erişim › Entegrasyonlar › API anahtarı, rol "App Manager".

GitHub Actions açık depolarda ücretsizdir. Özel depolarda aylık ücretsiz dakika vardır; macOS dakikaları 10 kat sayılır. iOS derlemesini bir Mac'te Xcode ile de yapabilirsiniz.

## 8. İnceleme notu (App Review / Play inceleme için)

> Giriş telefon numarası ve SMS koduyla yapılır. İnceleme için: telefon **[INCELEME_TELEFON]**, kod **[INCELEME_KODU]**. Ardından davet kodu **[DAVET KODU]** ile örnek siteye katılın. Premium: Gündem › "Premium'u incele" ya da Profil (sağ üstteki kişi simgesi) › Hesap ve abonelik (sandbox). Hesap silme: Profil › Hesap ve abonelik › Hesabımı sil. Yerel özellik: Hikmet › Duvar kâğıdı. Android'de ana ekran ya da kilit ekranı doğrudan ayarlanır, iOS'ta resim Fotoğraflar'a kaydedilir.

Bilinen riskler ve önlemler:
- **Apple 4.2 (yalnızca web sitesi sarmalayıcısı):** Dosyalar cihazdadır. Mağaza içi satın alma, duvar kâğıdı, Fotoğraflar ve yerel paylaşım vardır. Bildirimler eklenirse risk daha da azalır.
- **Apple 4.2.6 / 4.3:** Tek uygulama, siteler içinde ayrılır; her site için kopya uygulama yoktur.
- **Apple 3.1.1 ve 3.1.2:** Dijital abonelik yalnızca uygulama içi satın almayla satılır. Abonelik ekranında süre, fiyat, otomatik yenileme, iptal yolu, koşullar ve gizlilik bağlantıları, geri yükleme düğmesi vardır.
- **Hesap silme:** Uygulama içinden ve web'den (`/hesap-sil.html`).
- **Android izinleri:** `SET_WALLPAPER` (duvar kâğıdı) ve `RECEIVE_BOOT_COMPLETED` (günlük modda telefon yeniden başlayınca alarmı kurmak). Canlı duvar kâğıdı servisi yalnızca kullanıcı sistem ekranında onaylarsa etkinleşir.

## 9. Gizlilik formları

| Veri | Toplanıyor mu | Amaç | Kimliğe bağlı mı | İzleme |
|---|---|---|---|---|
| Telefon numarası | Evet | Hesap, giriş | Evet | Hayır |
| Ad (isteğe bağlı), konut ve hane bilgisi | Evet | Uygulama işlevi (site yönetimi) | Evet | Hayır |
| Satın alma geçmişi (abonelik durumu) | Evet | Uygulama işlevi | Evet | Hayır |
| Kullanıcı içeriği (sepet, gönderi, fotoğraf, yorum) | Evet | Uygulama işlevi | Evet | Hayır |
| Konum, kişiler, sağlık, finans, tarama geçmişi, reklam kimliği | Hayır | | | |

- Veriler aktarım sırasında şifrelenir (HTTPS); kullanıcı silme isteyebilir.
- Üçüncü taraf: yalnızca SMS sağlayıcısı (giriş kodu). Satın alma bilgisi Apple ve Google'dan doğrudan doğrulanır.
- iOS'ta fotoğraf izni yalnızca **ekleme** içindir. Gündem fotoğrafını kullanıcı kendisi seçer.

## 10. Mağaza metinleri (taslak)

- **Ad:** Bilinçli Sakin
- **Alt başlık (iOS, 30 karakter):** Sitenizin ortak yaşam alanı
- **Kısa açıklama (Google, 80 karakter):** Site sakinleri için duyuru, ortak alışveriş, hizmetler ve günün ayeti/hadisi.
- **Açıklama:**
  > Bilinçli Sakin, yaşadığınız siteyi tek uygulamada toplar. Site yönetiminizden aldığınız davet koduyla katılın; uygulama sitenizin adı ve ayarlarıyla açılır.
  > • Ortak market ve pazar sepeti: siparişinizi verin, site toplu alsın, daha uygun fiyata gelsin.
  > • Hizmetler: ütü ve ev temizliği siparişi.
  > • Duyurular, etkinlikler, turnuvalar ve sakin kartı.
  > • Fırsatlar ve Bugün: civardaki indirimler ve namaz vakitleri.
  > • Hikmet: her gün bir ayet ya da hadis; Arapça metni, anlamı ve kaynağıyla. Duvar kâğıdı yapın, WhatsApp'ta paylaşın.
  > • Premium Gündem: fotoğraflı paylaşım, beğeni, yorum ve hikâyeler.
  > Temel özellikler ücretsizdir. Premium aylık abonelikle sunulur; site yönetiminiz bedeli tüm sakinler için ödeyebilir.
- **Kategori:** Yaşam Tarzı. İkinci kategori (iOS): Yardımcı Programlar.
- **Yaş derecelendirmesi:** 4+ / Herkes. Gündem'de sakinler paylaşım ve yorum yapar; yönetici gizleyip silebilir. Kullanıcı içeriği olduğu için mağaza formunda "kullanıcı tarafından oluşturulan içerik" işaretlenmeli.
- **Ekran görüntüleri:** iPhone 6,9" (1320×2868) ve Android telefon.

## 11. Yayına kadar kalan işler

1. ☐ Barındırma ve alan adı (https, `PUBLIC_ORIGIN`).
2. ☐ Gerçek SMS sağlayıcısı.
3. ☐ Yasal metinlerin doldurulması ve hukukçu kontrolü (KVKK, mesafeli satış, abonelik).
4. ☐ Ayet ve hadis metinlerinin bir din görevlisince kontrolü.
5. ☐ Mağaza hesapları, abonelik ürünü, Apple kök sertifikası, Google hizmet hesabı ve Pub/Sub.
6. ☐ İlk derleme: Android'de kapalı test, iOS'ta TestFlight. Gerçek cihazda sandbox satın alma, geri yükleme, duvar kâğıdı ve hesap silme.
7. ☐ Önerilen: bildirimler (duyuru, sipariş turu kapanıyor) ve Gündem için içerik bildirme ("şikâyet et") düğmesi. Apple 1.2 kuralı, kullanıcı içeriği olan uygulamalarda bunu ister.
