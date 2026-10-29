/* Yerel köprü: web arayüzü (public/native.js) bu nesneyi window.BSNative olarak bulur.
   esbuild ile www/kopru.js dosyasına paketlenir (scripts/hazirla.js). */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";

const Duvar = registerPlugin("BSDuvar");
const A = () => window.BS_AYAR || {};
const ANAHTAR = "bs-oturum";

/* Jeton: iOS'ta Keychain, Android'de şifreli depolama yerine Preferences kullanılır; jeton tek başına kişisel veri değildir
   ve sunucuda iptal edilebilir. Gerekirse capacitor-secure-storage ile değiştirilebilir (yalnız bu üç işlev). */
async function tokenOku() { return (await Preferences.get({ key: ANAHTAR })).value || null; }
async function tokenYaz(t) { await Preferences.set({ key: ANAHTAR, value: t }); }
async function tokenSil() { await Preferences.remove({ key: ANAHTAR }); }

const platform = Capacitor.getPlatform();
/* Mağaza satın alma: StoreKit 2 / Google Play Billing (ücretsiz, açık kaynak eklenti). Kanıt sunucuya gider, sunucu doğrular.
   g = /api/abonelik yanıtı: { hesapUuid, urun, androidPlan } */
const kanit = t => platform === "ios" ? (t.jwsRepresentation ? { platform: "ios", jws: t.jwsRepresentation } : null)
  : (t.purchaseToken ? { platform: "android", token: t.purchaseToken } : null);
const vazgecildi = e => /cancel/i.test(String((e && (e.code || e.message)) || ""));
const magaza = {
  async destekli() { try { return (await NativePurchases.isBillingSupported()).isBillingSupported; } catch (e) { return false; } },
  async fiyat(g) {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: [g.urun], productType: PURCHASE_TYPE.SUBS });
    return (products && products[0] && products[0].priceString) || "";
  },
  /* Kanıt döner; kullanıcı vazgeçerse null */
  async satinAl(g) {
    try {
      const t = await NativePurchases.purchaseProduct({ productIdentifier: g.urun, planIdentifier: g.androidPlan, productType: PURCHASE_TYPE.SUBS, appAccountToken: g.hesapUuid });
      const k = kanit(t); if (!k) throw new Error("Mağaza satın alma kaydı vermedi.");
      return k;
    } catch (e) { if (vazgecildi(e)) return null; throw new Error("Satın alma tamamlanamadı: " + ((e && e.message) || "bilinmeyen hata")); }
  },
  async geriYukle(g) {
    await NativePurchases.restorePurchases();
    const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
    return (purchases || []).filter(t => t.productIdentifier === g.urun).map(kanit).filter(Boolean);
  },
  yonet() { return NativePurchases.manageSubscriptions(); }
};

async function paylasDosya({ ad, metin, tip }) {
  const r = await Filesystem.writeFile({ path: ad, data: metin, directory: Directory.Cache, encoding: "utf8" });
  await Share.share({ title: ad, files: [r.uri], dialogTitle: "Dosyayı kaydet veya paylaş" });
}

const duvar = {
  /* Android: WallpaperManager ile ana ekran veya kilit ekranı. iOS buna izin vermez (eklenti "desteklenmiyor" döner). */
  ayarla: platform === "android" ? ({ base64, hedef }) => Duvar.ayarla({ base64, hedef }) : null,
  /* Android: Galeri (Resimler/Bilinçli Sakin). iOS: Fotoğraflar. */
  kaydet: ({ base64, ad }) => Duvar.kaydet({ base64, ad })
};

window.BSNative = { tokenOku, tokenYaz, tokenSil, magaza, paylasDosya, duvar };
