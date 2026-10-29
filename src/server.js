"use strict";
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");

function envYukle() {
  const f = path.join(__dirname, "..", ".env");
  if (fs.existsSync(f) && typeof process.loadEnvFile === "function") process.loadEnvFile(f);
}

function ayarlariOku(env = process.env) {
  const prod = env.NODE_ENV === "production";
  let secret = env.SESSION_SECRET || "";
  if (!secret) {
    if (prod) throw new Error("NODE_ENV=production iken SESSION_SECRET zorunludur (en az 32 karakter).");
    secret = crypto.randomBytes(32).toString("hex");
    console.warn("[uyarı] SESSION_SECRET tanımlı değil; geçici bir anahtar üretildi (geliştirme modu).");
  }
  if ((env.SMS_PROVIDER || "konsol") === "konsol" && prod && env.ALLOW_CONSOLE_SMS !== "1")
    throw new Error("Üretimde SMS_PROVIDER=konsol kullanılamaz. Gerçek bir sağlayıcı ayarlayın (README: SMS sağlayıcı bağlama).");
  return {
    port: Number(env.PORT || 3000),
    host: env.HOST || "0.0.0.0",
    dbPath: env.DB_PATH || path.join(__dirname, "..", "data", "site-app.sqlite"),
    config: {
      prod, sessionSecret: secret, trustProxy: env.TRUST_PROXY === "1", publicOrigin: env.PUBLIC_ORIGIN || "",
      platformAdminTelefonlari: String(env.PLATFORM_ADMIN_TELEFONLARI || "").split(",").map(s => s.trim()).filter(Boolean),
      incelemeHesabi: env.INCELEME_TELEFON ? { telefon: env.INCELEME_TELEFON, kod: env.INCELEME_KODU || "" } : null,
      abonelik: {
        apple: { kokSertifika: env.APPLE_KOK_SERTIFIKA || "", bundleId: env.APPLE_BUNDLE_ID || "" },
        google: { hizmetHesabi: env.GOOGLE_HIZMET_HESABI || "", paket: env.GOOGLE_PAKET_ADI || "", apiTaban: env.GOOGLE_API_TABAN || undefined },
        bildirimAnahtari: env.GOOGLE_BILDIRIM_ANAHTARI || "", fiyatMetni: env.ABONELIK_FIYAT_METNI || "100 TL / ay"
      }
    }
  };
}

function baslat() {
  envYukle();
  const { openDb } = require("./db");
  const { createSmsProvider } = require("./sms");
  const { createApp } = require("./app");
  const a = ayarlariOku();
  const db = openDb(a.dbPath);
  const sms = createSmsProvider(process.env);
  const app = createApp({ db, sms, config: a.config });
  const server = http.createServer(app.handler);
  server.headersTimeout = 20000; server.requestTimeout = 30000;
  server.listen(a.port, a.host, () => {
    console.log(`Bilinçli Sakin çalışıyor: http://localhost:${a.port} (veritabanı: ${a.dbPath}, SMS: ${sms.ad}, mod: ${a.config.prod ? "üretim" : "geliştirme"})`);
  });
  const kapat = () => { server.close(() => { try { db.close(); } catch (_) { /* yok */ } process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on("SIGINT", kapat); process.on("SIGTERM", kapat);
  return server;
}

if (require.main === module) baslat();
module.exports = { ayarlariOku, envYukle };
