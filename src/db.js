"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

/* Sıralı şema migration'ları. Yeni değişiklik = listeye yeni eleman ekle; eskileri değiştirme. */
const MIGRATIONS = [
  `CREATE TABLE sites (
     id INTEGER PRIMARY KEY,
     ad TEXT NOT NULL,
     plan TEXT NOT NULL DEFAULT 'temel' CHECK (plan IN ('temel','standart','kurumsal')),
     durum TEXT NOT NULL DEFAULT 'deneme' CHECK (durum IN ('deneme','aktif','askida')),
     deneme_bitis TEXT,
     ayarlar TEXT NOT NULL DEFAULT '{}',
     katalog TEXT NOT NULL DEFAULT '{"urunler":[],"tur":{"id":"","ad":"","sonTarih":"","teslim":"","acik":false}}',
     olusturma INTEGER NOT NULL
   );
   CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     telefon TEXT NOT NULL UNIQUE,
     platform_admin INTEGER NOT NULL DEFAULT 0,
     olusturma INTEGER NOT NULL
   );
   CREATE TABLE uyelikler (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     rol TEXT NOT NULL CHECK (rol IN ('site_yonetici','site_denetci','sakin')),
     olusturma INTEGER NOT NULL,
     PRIMARY KEY (user_id, site_id)
   );
   CREATE INDEX uyelik_site ON uyelikler(site_id);
   CREATE TABLE sessions (
     id_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
     csrf TEXT NOT NULL,
     bitis INTEGER NOT NULL,
     olusturma INTEGER NOT NULL
   );
   CREATE INDEX session_user ON sessions(user_id);
   CREATE TABLE otp (
     telefon TEXT PRIMARY KEY,
     kod_hash TEXT NOT NULL,
     bitis INTEGER NOT NULL,
     deneme INTEGER NOT NULL DEFAULT 0,
     olusturma INTEGER NOT NULL
   );
   CREATE TABLE davetler (
     kod TEXT PRIMARY KEY,
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     rol TEXT NOT NULL CHECK (rol IN ('site_yonetici','site_denetci','sakin')),
     max_kullanim INTEGER NOT NULL DEFAULT 1,
     kullanim INTEGER NOT NULL DEFAULT 0,
     bitis INTEGER,
     iptal INTEGER NOT NULL DEFAULT 0,
     aciklama TEXT NOT NULL DEFAULT '',
     olusturan INTEGER,
     olusturma INTEGER NOT NULL
   );
   CREATE INDEX davet_site ON davetler(site_id);
   CREATE TABLE profiller (
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     veri TEXT NOT NULL,
     guncelleme INTEGER NOT NULL,
     PRIMARY KEY (site_id, user_id)
   );
   CREATE TABLE sepetler (
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     tur TEXT NOT NULL DEFAULT '',
     blok TEXT NOT NULL DEFAULT '',
     kat INTEGER,
     daire TEXT NOT NULL DEFAULT '',
     kalemler TEXT NOT NULL DEFAULT '{}',
     notu TEXT NOT NULL DEFAULT '',
     guncelleme INTEGER NOT NULL,
     PRIMARY KEY (site_id, user_id)
   );
   CREATE TABLE puanlar (
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     scores TEXT NOT NULL DEFAULT '{}',
     kanit TEXT NOT NULL DEFAULT '{}',
     guncelleme INTEGER NOT NULL,
     PRIMARY KEY (site_id, user_id)
   );`,
  /* 2: paketler (temel | alisveris | tam) ve tur geçmişi. Eski planların hepsi "tam" olur. */
  `CREATE TABLE sites_yeni (
     id INTEGER PRIMARY KEY,
     ad TEXT NOT NULL,
     plan TEXT NOT NULL DEFAULT 'tam' CHECK (plan IN ('temel','alisveris','tam')),
     durum TEXT NOT NULL DEFAULT 'deneme' CHECK (durum IN ('deneme','aktif','askida')),
     deneme_bitis TEXT,
     ayarlar TEXT NOT NULL DEFAULT '{}',
     katalog TEXT NOT NULL DEFAULT '{"urunler":[],"tur":{"id":"","ad":"","sonTarih":"","teslim":"","acik":false}}',
     olusturma INTEGER NOT NULL
   );
   INSERT INTO sites_yeni (id, ad, plan, durum, deneme_bitis, ayarlar, katalog, olusturma)
     SELECT id, ad, 'tam', durum, deneme_bitis, ayarlar, katalog, olusturma FROM sites;
   DROP TABLE sites;
   ALTER TABLE sites_yeni RENAME TO sites;
   CREATE TABLE turlar (
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     tur_id TEXT NOT NULL,
     ad TEXT NOT NULL DEFAULT '',
     baslangic INTEGER NOT NULL,
     kapanis INTEGER,
     hane INTEGER,
     PRIMARY KEY (site_id, tur_id)
   );`,
  /* 3: sakin aboneliği (mağaza içi satın alma) ve site öder modeli. */
  `ALTER TABLE users ADD COLUMN abone_id TEXT;
   CREATE UNIQUE INDEX users_abone_id ON users(abone_id) WHERE abone_id IS NOT NULL;
   ALTER TABLE sites ADD COLUMN odeme_modeli TEXT NOT NULL DEFAULT 'sakin' CHECK (odeme_modeli IN ('sakin','site'));
   CREATE TABLE abonelikler (
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     saglayici TEXT NOT NULL,
     magaza TEXT NOT NULL DEFAULT '',
     urun TEXT NOT NULL DEFAULT '',
     durum TEXT NOT NULL CHECK (durum IN ('aktif','iptal_edildi','odeme_sorunu','suresi_doldu','iade')),
     bitis INTEGER,
     deneme INTEGER NOT NULL DEFAULT 0,
     ortam TEXT NOT NULL DEFAULT '',
     guncelleme INTEGER NOT NULL
   );`,
  /* 4: Merter arayüzü için belge deposu (artifact db karşılığı) ve fotoğraflar. veri NULL = silinmiş (değişiklik akışı için iz). */
  `CREATE TABLE belgeler (
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     koleksiyon TEXT NOT NULL,
     belge_id TEXT NOT NULL,
     veri TEXT,
     sira INTEGER NOT NULL,
     guncelleme INTEGER NOT NULL,
     PRIMARY KEY (site_id, koleksiyon, belge_id)
   );
   CREATE INDEX belgeler_sira ON belgeler(site_id, sira);
   CREATE TABLE belge_sira (site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE, sira INTEGER NOT NULL);
   CREATE TABLE varliklar (
     id TEXT PRIMARY KEY,
     site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     tip TEXT NOT NULL,
     veri BLOB NOT NULL,
     boyut INTEGER NOT NULL,
     olusturma INTEGER NOT NULL
   );`,
  /* 5: abonelik doğrudan mağazalarla (RevenueCat yok): mağaza kaydı kimliği; hesap kimliği artık UUID (StoreKit appAccountToken). */
  `ALTER TABLE abonelikler ADD COLUMN harici_id TEXT;
   CREATE UNIQUE INDEX abonelikler_harici ON abonelikler(magaza, harici_id) WHERE harici_id IS NOT NULL;
   UPDATE users SET abone_id = NULL WHERE abone_id NOT LIKE '%-%';`
];

function openDb(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec("CREATE TABLE IF NOT EXISTS schema_surum (surum INTEGER NOT NULL)");
  const row = db.prepare("SELECT surum FROM schema_surum").get();
  let surum = row ? row.surum : 0;
  if (!row) db.prepare("INSERT INTO schema_surum (surum) VALUES (0)").run();
  // Tablo yeniden oluşturan migration'lar için yabancı anahtarlar geçici olarak kapatılır (SQLite önerisi).
  if (surum < MIGRATIONS.length) db.exec("PRAGMA foreign_keys = OFF;");
  for (let i = surum; i < MIGRATIONS.length; i++) {
    db.exec("BEGIN");
    try { db.exec(MIGRATIONS[i]); db.prepare("UPDATE schema_surum SET surum = ?").run(i + 1); db.exec("COMMIT"); }
    catch (e) { db.exec("ROLLBACK"); db.exec("PRAGMA foreign_keys = ON;"); throw e; }
  }
  db.exec("PRAGMA foreign_keys = ON;");
  const fk = db.prepare("PRAGMA foreign_key_check").all();
  if (fk.length) throw new Error("Yabancı anahtar tutarsızlığı: " + JSON.stringify(fk.slice(0, 3)));
  return db;
}

function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { try { db.exec("ROLLBACK"); } catch (_) { /* yok */ } throw e; }
}

/* Bakım betikleri (kur-site, migrate, seed) konteynerde root kabuğundan (Render Shell, fly ssh) çalıştırılırsa,
   veritabanı dosyalarının root'a geçip sunucunun ("node" kullanıcısı) yazamaz hale gelmesini önlemek için
   yetkiyi veri klasörünün sahibine düşürür. */
function yetkiDusur(file) {
  if (typeof process.getuid !== "function" || process.getuid() !== 0) return false;
  try {
    const st = fs.statSync(path.dirname(path.resolve(file)));
    if (st.uid === 0) return false;
    process.setgid(st.gid); process.setuid(st.uid);
    return true;
  } catch (_) { return false; }
}

module.exports = { openDb, tx, MIGRATIONS, yetkiDusur };
