# Performans ve ölçekleme

Bu belgede ölçülen her rakam `scripts/yuk-testi.js` ile alınmıştır. Ölçülmeyen değerler "tahmin" ya da "doğrulanmadı" olarak işaretlidir.

## Mimari (tek sunucu süreci)

- **Sohbet:** Mesajlar canlı akışla (SSE) gelir. Her sakin tek bir açık bağlantı tutar.
  - Yeni mesajlar 100 ms'lik pencerelerde toplanır, bir kez JSON'a çevrilir ve odadaki tüm bağlantılara aynı metin yazılır.
  - Akış açılamazsa istemci uzun yoklamaya geçer. Uzun yoklamada da aynı `(oda, sonra)` yanıtı bir kez hesaplanıp paylaşılır.
- **Düello:** Durum, zamandan hesaplanır. Sunucuda her maç için ayrı zamanlayıcı yoktur. İstemci uzun yoklamayla bekler; sürüm değişince (cevap geldi ya da faz değişti) uyanır.
- **Eşleşme kuyruğu, çevrim içi sayacı, olay merkezi (`src/hub.js`):** Bellek içi, süreç başına.
- **Veritabanı:** Node 22 `node:sqlite` (WAL). Bütün sorgular hazır deyimlerdir.
- **Site ayarları:** Ayar ve katalog JSON'u yalnızca değiştiğinde yeniden ayrıştırılır (`siteYukle` önbelleği).

## Ölçüm yöntemi

```bash
node scripts/yuk-testi.js --kisi 1000 --sure 90            # canlı akış (varsayılan)
node scripts/yuk-testi.js --kisi 1000 --sure 90 --yoklama  # uzun yoklama ile karşılaştırma
```

- **Senaryo (en kötü durum):** Tüm sakinler aynı sitede ve aynı sohbet odasında.
  - Herkes sohbeti dinler ve 30 saniyede bir arena özetini çeker.
  - Sakinlerin %10'u 8–20 saniyede bir mesaj yazar.
  - %40'ı art arda düello oynar: eşleşme, 5 soru, cevap.
- **Süreler:** Testte soru 5 sn, ara 1 sn. Üretimde soru 15 sn olduğundan yük daha düşüktür.
- **Makine:** 4 çekirdek Intel Xeon 2,8 GHz, 16 GB bellek, Node v22.22.0.
- **Önemli sınırlama:** Yük üreten istemciler ve sunucu **aynı makinede** çalıştı. İstemciler de işlemci harcadığı için sonuçlar temkinlidir.
- **Gecikme tanımı:** "Teslim gecikmesi", mesajın yazıldığı an ile her dinleyicinin ekranına ulaştığı an arasındaki süredir.

## Sonuçlar (2026-10-30)

### Önce ve sonra: 1000 eşzamanlı sakin, 90 sn

| | Uzun yoklama (ilk sürüm) | Canlı akış + ayar önbelleği |
|---|---|---|
| Sunucu işlemcisi (tek çekirdek) | %94 | %30 |
| Sunucuya gelen istek / sn | 3681 | 417 |
| Mesaj teslim gecikmesi p50 / p95 / p99 | 295 / 1081 / 3813 ms | 107 / 125 / 174 ms |
| Mesaj gönderme p95 / p99 | 937 / 3707 ms | 9 / 82 ms |
| Düello cevabı p95 / p99 | 509 / 3840 ms | 9 / 20 ms |
| Arena özeti p95 / p99 | 632 / 3809 ms | 9 / 25 ms |
| Biten maç / verilen cevap | 798 / 5299 | 800 / 5272 |
| Saniyede teslim edilen mesaj | 7082 | 7303 |
| En yüksek bellek (RSS) | 186 MB | 137 MB |
| Hata | 5 bağlantı sıfırlama | 0 |

### Tek sürecin sınırı

| Eşzamanlı sakin | İşlemci | Teslim p50 / p95 / p99 | Mesaj gönderme p95 | Bellek | Hata | Değerlendirme |
|---|---|---|---|---|---|---|
| 1000 | %30 | 107 / 125 / 174 ms | 9 ms | 137 MB | 0 | Rahat |
| 3000 | %83 | 134 / 885 / 1898 ms | 302 ms | 300 MB | 11 bağlantı sıfırlama | Sınırda |
| 5000 | %95 | 1117 / 6713 / 15368 ms | 8,6 sn | 391 MB | 936 | Kaldırmıyor |

Yorum:
- **1000+ eşzamanlı aktif kullanıcı:** Tek süreçte rahatça karşılanıyor (en kötü durum senaryosunda).
- **Gerçek bir site:** Merter Çınar Evleri 60 dairedir; tek bir sitede 1000 kişinin aynı anda bulunması beklenmez. Bu yüzden tek süreç, tahminen onlarca siteyi birlikte taşır. Bu tahmin ölçülmedi.
- **Doygunluk noktası:** Bu makinede saniyede yaklaşık 33.000 mesaj teslimi (3000 ve 5000 kişide aynı). Sınırı belirleyen, tek odadaki dinleyici sayısı ile mesaj sıklığının çarpımı.

## x100 hedefi (yaklaşık 100.000 eşzamanlı): yol haritası

**Bu bölüm henüz kurulmadı ve ölçülmedi.**

Tek süreç birkaç bin eşzamanlı kişide doyuyor; x100 için yatay ölçekleme gerekir.

**Siteleri sunuculara bölmek.** Siteler birbirinden bağımsızdır: sohbet, düello, sezon ve turnuva hep tek bir site içinde kalır. Bu yüzden en sade yol şudur:
- Her site tek bir sunucu sürecine ("parça") atanır. Süreç başına 1000–2000 eşzamanlı kişilik pay bırakılır.
- Ön tarafta bir yönlendirici (ör. Nginx ya da bulut yük dengeleyicisi) isteği oturumdaki site kimliğine göre doğru parçaya gönderir.
- Her parçanın kendi SQLite dosyası, kendi olay merkezi ve kendi eşleşme kuyruğu olur. Ortak bir veritabanına ya da Redis'e gerek kalmaz.
- Giriş ve abonelik gibi site dışı işler küçük bir merkezî hizmette toplanır.
- **Kaba hesap (tahmin):** 100.000 eşzamanlı kişi için 50–100 parça. 4 çekirdekli bir makinede 3–4 parça çalışabilir.

**Alternatif yol.**
- PostgreSQL ve Redis Pub/Sub kullanılır, uygulama örnekleri durumsuz olur. `src/hub.js` arayüzü (`bekle`, `bildir`) Redis ile aynı biçimde uygulanabilir.
- Eşleşme kuyruğu Redis'e, çevrim içi sayacı Redis'teki süreli anahtarlara taşınır.

**Yapılması gerekenler (ikisinde de):**
1. Site → parça eşlemesi ve yönlendirici.
2. Oturum ve abonelik için merkezî hizmet.
3. Parçalar arası taşıma aracı.
4. Her parçada bu yük testinin tekrarlanması.
5. Ayrı makinelerde (istemci ≠ sunucu) ölçüm.

## Bilinen sınırlar (bugün)

- Bellek içi durum (eşleşme kuyruğu, çevrim içi, sohbet akış aboneleri) süreç yeniden başlayınca sıfırlanır. İstemciler kendiliğinden yeniden bağlanır, ama kuyruktaki eşleşme kaybolur.
- Tek SQLite yazarı vardır. Ölçülen yükte yazma darboğaz değildi; çok daha yüksek yazma oranlarında olabilir.
- Hız sınırlayıcı bellek içidir ve süreç başınadır.
