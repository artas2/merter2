# Komut günlüğü (Retor Ustası)

Her komut, `docs/retorik-ustasi.md` şablonuyla yeniden yazılır ve 0–100 puanlanır. En yeni kayıt en üsttedir.

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
