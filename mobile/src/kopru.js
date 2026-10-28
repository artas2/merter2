/* Yerel köprü: web arayüzü (public/native.js) bu nesneyi window.BSNative olarak bulur.
   esbuild ile www/kopru.js dosyasına paketlenir (scripts/hazirla.js). */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Purchases } from "@revenuecat/purchases-capacitor";

const Duvar = registerPlugin("BSDuvar");
const A = () => window.BS_AYAR || {};
const ANAHTAR = "bs-oturum";

/* Jeton: iOS'ta Keychain, Android'de şifreli depolama yerine Preferences kullanılır; jeton tek başına kişisel veri değildir
   ve sunucuda iptal edilebilir. Gerekirse capacitor-secure-storage ile değiştirilebilir (yalnız bu üç işlev). */
async function tokenOku() { return (await Preferences.get({ key: ANAHTAR })).value || null; }
async function tokenYaz(t) { await Preferences.set({ key: ANAHTAR, value: t }); }
async function tokenSil() { await Preferences.remove({ key: ANAHTAR }); }

const platform = Capacitor.getPlatform();
const rcAnahtar = () => (platform === "ios" ? A().revenuecatIos : A().revenuecatAndroid) || "";
let hazirKullanici = null;
const magaza = rcAnahtar() ? {
  async hazirla(aboneId) {
    if (hazirKullanici === aboneId) return;
    const { isConfigured } = await Purchases.isConfigured();
    if (!isConfigured) await Purchases.configure({ apiKey: rcAnahtar(), appUserID: aboneId });
    else await Purchases.logIn({ appUserID: aboneId });
    hazirKullanici = aboneId;
  },
  async fiyat() {
    const o = await Purchases.getOfferings();
    const p = o.current && o.current.availablePackages[0];
    return p ? p.product.priceString : "";
  },
  async satinAl() {
    const o = await Purchases.getOfferings();
    const p = o.current && (o.current.monthly || o.current.availablePackages[0]);
    if (!p) throw new Error("Abonelik ürünü mağazada bulunamadı.");
    try { await Purchases.purchasePackage({ aPackage: p }); return "tamam"; }
    catch (e) { if (e && (e.userCancelled || e.code === "1")) return "vazgecildi"; throw new Error("Satın alma tamamlanamadı: " + (e && e.message || "bilinmeyen hata")); }
  },
  async geriYukle() { await Purchases.restorePurchases(); }
} : null;

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
