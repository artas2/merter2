import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - Hikmet duvar kâğıdı (yerel eklenti)
// iOS uygulamaların duvar kâğıdını değiştirmesine izin vermez; resim Fotoğraflar'a kaydedilir,
// kullanıcı oradan Paylaş › Duvar Kâğıdı Yap ile ayarlar.
import Photos

@objc(BSDuvarPlugin)
public class BSDuvarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BSDuvarPlugin"
    public let jsName = "BSDuvar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ayarla", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "kaydet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "havuzYaz", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "havuzBitir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "otomatikAyarla", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "otomatikDurum", returnType: CAPPluginReturnPromise)
    ]

    @objc func ayarla(_ call: CAPPluginCall) {
        call.unavailable("iOS uygulamaların duvar kâğıdını değiştirmesine izin vermez.")
    }

    @objc func kaydet(_ call: CAPPluginCall) {
        guard let b = call.getString("base64"), let d = Data(base64Encoded: b), let resim = UIImage(data: d) else {
            call.reject("Resim çözülemedi."); return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { durum in
            guard durum == .authorized || durum == .limited else {
                call.reject("Fotoğraflar'a kaydetme izni verilmedi. Ayarlar › Bilinçli Sakin › Fotoğraflar'dan izin verebilirsiniz."); return
            }
            PHPhotoLibrary.shared().performChanges({ PHAssetChangeRequest.creationRequestForAsset(from: resim) }) { tamam, hata in
                if tamam { call.resolve() } else { call.reject(hata?.localizedDescription ?? "Kaydedilemedi.") }
            }
        }
    }
}

// MARK: - Otomatik Hikmet görseli (Kestirmeler ile)
// iOS duvar kâğıdını uygulamaların değiştirmesine izin vermez. Uygulama görselleri Documents/hikmet içine yazar;
// Kestirmeler'deki "Günün Hikmet görseli" eylemi bunları verir, kullanıcı "Duvar Kâğıdını Ayarla" ile otomasyon kurar.
enum HikmetHavuz {
    static var klasor: URL {
        let u = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("hikmet", isDirectory: true)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }
    static var ayar: [String: Any] {
        guard let d = try? Data(contentsOf: klasor.appendingPathComponent("havuz.json")),
              let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return [:] }
        return j
    }
    static var adet: Int { (ayar["n"] as? Int) ?? 0 }
    /* Uygulamadaki "Günün ayeti/hadisi" ile aynı: (yerel gün sayısı) mod n */
    static func gunIndeksi(_ n: Int, _ tarih: Date = Date()) -> Int {
        let saniye = tarih.timeIntervalSince1970 + Double(TimeZone.current.secondsFromGMT(for: tarih))
        let gun = Int(floor(saniye / 86400))
        return ((gun % n) + n) % n
    }
}

extension BSDuvarPlugin {
    @objc func havuzYaz(_ call: CAPPluginCall) {
        guard let ad = call.getString("ad"), ad.range(of: "^(ana|kilit)-[0-9]{1,3}\\.jpg$", options: .regularExpression) != nil,
              let b = call.getString("base64"), let d = Data(base64Encoded: b) else { call.reject("Geçersiz dosya."); return }
        do { try d.write(to: HikmetHavuz.klasor.appendingPathComponent(ad), options: .atomic); call.resolve() }
        catch { call.reject("Görsel yazılamadı.") }
    }
    @objc func havuzBitir(_ call: CAPPluginCall) {
        let n = call.getInt("n") ?? 0
        guard n > 0, n < 1000 else { call.reject("Geçersiz adet."); return }
        var a = HikmetHavuz.ayar; a["n"] = n; a["surum"] = call.getString("surum") ?? ""
        if let d = try? JSONSerialization.data(withJSONObject: a) { try? d.write(to: HikmetHavuz.klasor.appendingPathComponent("havuz.json"), options: .atomic) }
        call.resolve(durum())
    }
    @objc func otomatikAyarla(_ call: CAPPluginCall) {
        let mod = call.getString("mod") ?? "kapali"
        guard ["gunluk", "kapali"].contains(mod) else { call.reject("iPhone'da yalnızca günlük mod (Kestirmeler ile) kullanılabilir."); return }
        var a = HikmetHavuz.ayar; a["mod"] = mod
        if let d = try? JSONSerialization.data(withJSONObject: a) { try? d.write(to: HikmetHavuz.klasor.appendingPathComponent("havuz.json"), options: .atomic) }
        call.resolve(durum())
    }
    @objc func otomatikDurum(_ call: CAPPluginCall) { call.resolve(durum()) }
    private func durum() -> [String: Any] {
        let a = HikmetHavuz.ayar
        return ["platform": "ios", "mod": (a["mod"] as? String) ?? "kapali", "n": (a["n"] as? Int) ?? 0, "surum": (a["surum"] as? String) ?? "", "canli": false]
    }
}

import AppIntents
import UniformTypeIdentifiers

@available(iOS 16.0, *)
enum HikmetEkran: String, AppEnum {
    case ana, kilit
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Ekran"
    static var caseDisplayRepresentations: [HikmetEkran: DisplayRepresentation] = [.ana: "Ana ekran", .kilit: "Kilit ekranı"]
}

@available(iOS 16.0, *)
enum HikmetHata: Error, CustomLocalizedStringResourceConvertible {
    case havuzYok
    var localizedStringResource: LocalizedStringResource { "Önce uygulamada Hikmet › Otomatik duvar kâğıdı bölümünü açın." }
}

@available(iOS 16.0, *)
struct HikmetGorselIntent: AppIntent {
    static var title: LocalizedStringResource = "Günün Hikmet görseli"
    static var description = IntentDescription("Günün ayeti ya da hadisinin duvar kâğıdı görselini verir. \"Duvar Kâğıdını Ayarla\" eylemiyle birlikte kullanın.")
    @Parameter(title: "Ekran", default: .kilit) var ekran: HikmetEkran
    @Parameter(title: "Her çalışmada sıradaki", default: false) var siradaki: Bool

    func perform() async throws -> some IntentResult & ReturnsValue<IntentFile> {
        let n = HikmetHavuz.adet
        guard n > 0 else { throw HikmetHata.havuzYok }
        var i = HikmetHavuz.gunIndeksi(n)
        if siradaki {
            let d = UserDefaults.standard
            i = (d.object(forKey: "bsHikmetSira") == nil ? i : (d.integer(forKey: "bsHikmetSira") + 1)) % n
            d.set(i, forKey: "bsHikmetSira")
        }
        let url = HikmetHavuz.klasor.appendingPathComponent("\(ekran.rawValue)-\(i).jpg")
        guard let veri = try? Data(contentsOf: url) else { throw HikmetHata.havuzYok }
        return .result(value: IntentFile(data: veri, filename: url.lastPathComponent, type: .jpeg))
    }
}

@available(iOS 16.0, *)
struct BSKisayollar: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: HikmetGorselIntent(), phrases: ["\(.applicationName) günün hikmet görseli"])
    }
}

class BSViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BSDuvarPlugin())
    }
}
