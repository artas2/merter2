# Retor Ustası: komutu yapay zekânın anlayacağı dile çevirme

**Görev.** Kullanıcının serbest yazdığı komutu, anlamını değiştirmeden, yapay zekânın hatasız uygulayacağı yapıya çevirmek. Her komutta tekrarlanır. Çeviri ve puan `docs/KOMUT-GUNLUGU.md` dosyasına yazılır.

**Temel kural.** Çevirmen niyeti değiştirmez, eksik bilgiyi uydurmaz. Emin olmadığı yeri "varsayım" ya da "belirsiz" diye işaretler.

## 1. Çeviri şablonu

```
HEDEF       : Tek cümle. Sonunda ne var olacak?
KAPSAM      : Yapılacak işler, maddeler halinde, ölçülebilir.
KAPSAM DIŞI : Bu komutta yapılmayacaklar.
KISITLAR    : Sabit kurallar (bütçe, platform, gizlilik, "önce sor" gibi).
BAŞARI      : Nasıl doğrulanacak (test, ölçüm, ekran görüntüsü).
VARSAYIMLAR : Komutta yazmayan ama işe başlamak için seçilen varsayılanlar.
BELİRSİZ    : Kullanıcıya sorulması ya da sonra netleştirilmesi gerekenler.
SIRA        : Önce ne, sonra ne.
```

## 2. Puanlama (0–100)

Her ölçüt 0–4 arası puanlanır, ağırlıkla çarpılır. Toplam 100'e ölçeklenir.

| Ölçüt | Ağırlık | 4 (usta) | 2 (yeterli) | 0 (yetersiz) |
|---|---|---|---|---|
| Niyete sadakat | 25 | Her istek karşılanmış, hiçbir şey eklenmemiş ya da çarpıtılmamış | Ana istek doğru, ayrıntı kayıp | Niyet değişmiş |
| Ölçülebilirlik | 15 | Her madde test ya da sayı ile doğrulanabilir | Kısmen | Belirsiz ifadeler ("güzel olsun") |
| Belirsizliği işaretleme | 15 | Varsayım ve belirsizler ayrı ve açık | Bazıları gizli kalmış | Varsayım gerçek gibi yazılmış |
| Kısıtların korunması | 15 | Kullanıcının kalıcı kuralları (önce sor, ücretsiz, gizlilik) eksiksiz | Biri eksik | Kural çiğnenmiş |
| Yapı ve sıra | 10 | Şablona uygun, sıralı | Dağınık ama tam | Yapısız |
| Kısalık | 10 | Gereksiz söz yok | Biraz uzun | Asıl iş kayboluyor |
| Dil | 10 | Sade, terimin yanında açıklaması var | Anlaşılır | Jargon, çeviri kokan cümleler |

**Seviyeler:** 0–39 çırak · 40–59 kalfa · 60–79 usta · 80–94 baş usta · 95–100 retor ustası.

## 3. Eğitim basamakları

| Puan | Beceri | Alıştırma |
|---|---|---|
| 0–20 | Komuttaki fiilleri ve nesneleri ayırır | 10 komutu "fiil + nesne" listesine çevir |
| 21–40 | Hedefi tek cümleyle yazar | Her komut için tek cümlelik HEDEF |
| 41–60 | Kapsam ile kapsam dışını ayırır | Komuttaki örnekleri (ör. bir oyun adı) istek mi, ilham mı diye ayır |
| 61–80 | Varsayım ve belirsizliği ayrı tutar | Her çeviride en az bir "varsayım" ya da "belirsiz" satırı; yoksa nedenini yaz |
| 81–94 | Kalıcı kuralları her komutta korur | Önceki mesajlardaki kuralları çıkar, her yeni çeviride KISITLAR'a ekle |
| 95–100 | Başarıyı ölçülebilir yapar, gereksizi atar | Her BAŞARI maddesine bir test ya da sayı bağla; çeviriyi kısalt |

## 4. Sık hatalar

- Örneği istek sanmak. "Last War oyunu gibi" bir ilham kaynağıdır: oyunun görselleri ve markası kopyalanmaz.
- Ölçülmemiş hedefi gerçekleşmiş yazmak ("x100 performans sağlandı").
- Ücret, gizlilik ve "önce sor" gibi kalıcı kuralları yeni komutta unutmak.
- Kullanıcının sözcüklerini gereksiz yere değiştirmek (ör. "Premium işlerde olduğu gibi" → "ücretli yap").
