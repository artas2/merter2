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
   UPDATE users SET abone_id = NULL WHERE abone_id NOT LIKE '%-%';`,
  /* 6: Arena (bilgi yarışması, sezon, turnuva), sohbet, şikâyet, engel ve susturma. */
  `CREATE TABLE sezonlar (
     id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     ad TEXT NOT NULL, baslangic INTEGER NOT NULL, bitis INTEGER NOT NULL
   );
   CREATE INDEX sezonlar_site ON sezonlar(site_id, bitis);
   CREATE TABLE sezon_puan (
     sezon_id INTEGER NOT NULL REFERENCES sezonlar(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     site_id INTEGER NOT NULL, blok TEXT NOT NULL DEFAULT '', ad TEXT NOT NULL DEFAULT '',
     puan INTEGER NOT NULL DEFAULT 0, mac INTEGER NOT NULL DEFAULT 0, galibiyet INTEGER NOT NULL DEFAULT 0,
     gun TEXT NOT NULL DEFAULT '', gun_puan INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (sezon_id, user_id)
   );
   CREATE INDEX sezon_puan_sira ON sezon_puan(sezon_id, puan DESC);
   CREATE TABLE kart_ogrenme (site_id INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kart_id TEXT NOT NULL, zaman INTEGER NOT NULL, PRIMARY KEY (site_id, user_id, kart_id));
   CREATE TABLE turnuvalar (
     id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     ad TEXT NOT NULL, baslangic INTEGER NOT NULL, tur_araligi_ms INTEGER NOT NULL, max_kisi INTEGER NOT NULL,
     durum TEXT NOT NULL DEFAULT 'kayit' CHECK (durum IN ('kayit','oynaniyor','bitti','iptal')),
     sezon_id INTEGER, sampiyon INTEGER, olusturan INTEGER, olusturma INTEGER NOT NULL
   );
   CREATE INDEX turnuvalar_site ON turnuvalar(site_id, durum);
   CREATE TABLE turnuva_katilim (
     turnuva_id INTEGER NOT NULL REFERENCES turnuvalar(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     tohum INTEGER NOT NULL, zaman INTEGER NOT NULL, PRIMARY KEY (turnuva_id, user_id)
   );
   CREATE TABLE maclar (
     id TEXT PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     tur TEXT NOT NULL CHECK (tur IN ('canli','antrenman','turnuva')), turnuva_mac_id INTEGER,
     a_user INTEGER REFERENCES users(id) ON DELETE SET NULL, b_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
     t0 INTEGER NOT NULL, soru_ms INTEGER NOT NULL, ara_ms INTEGER NOT NULL, sorular TEXT NOT NULL,
     bitti INTEGER NOT NULL DEFAULT 0, a_puan INTEGER NOT NULL DEFAULT 0, b_puan INTEGER NOT NULL DEFAULT 0, kazanan INTEGER,
     sezon_id INTEGER, olusturma INTEGER NOT NULL
   );
   CREATE INDEX maclar_a ON maclar(a_user, bitti); CREATE INDEX maclar_b ON maclar(b_user, bitti);
   CREATE TABLE mac_cevap (
     mac_id TEXT NOT NULL REFERENCES maclar(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, soru_no INTEGER NOT NULL,
     secim INTEGER NOT NULL, sure_ms INTEGER NOT NULL, dogru INTEGER NOT NULL, puan INTEGER NOT NULL,
     PRIMARY KEY (mac_id, user_id, soru_no)
   );
   CREATE TABLE turnuva_mac (
     id INTEGER PRIMARY KEY, turnuva_id INTEGER NOT NULL REFERENCES turnuvalar(id) ON DELETE CASCADE,
     tur INTEGER NOT NULL, sira INTEGER NOT NULL,
     a_user INTEGER REFERENCES users(id) ON DELETE SET NULL, b_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
     slot INTEGER NOT NULL, a_hazir INTEGER NOT NULL DEFAULT 0, b_hazir INTEGER NOT NULL DEFAULT 0,
     durum TEXT NOT NULL DEFAULT 'bekle' CHECK (durum IN ('bekle','oynuyor','bitti')),
     kazanan INTEGER, neden TEXT NOT NULL DEFAULT '', mac_id TEXT
   );
   CREATE INDEX turnuva_mac_t ON turnuva_mac(turnuva_id, tur, sira);
   CREATE TABLE sohbet (
     id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE, oda TEXT NOT NULL,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kim TEXT NOT NULL, ad TEXT NOT NULL, blok TEXT NOT NULL DEFAULT '',
     metin TEXT NOT NULL, zaman INTEGER NOT NULL, gizli INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX sohbet_oda ON sohbet(site_id, oda, id);
   CREATE TABLE sikayetler (
     id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     bildiren INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, hedef_tur TEXT NOT NULL, hedef_ref TEXT NOT NULL,
     hedef_user INTEGER REFERENCES users(id) ON DELETE SET NULL, sebep TEXT NOT NULL, aciklama TEXT NOT NULL DEFAULT '',
     ozet TEXT NOT NULL DEFAULT '', durum TEXT NOT NULL DEFAULT 'acik' CHECK (durum IN ('acik','kapandi')),
     karar TEXT NOT NULL DEFAULT '', zaman INTEGER NOT NULL, UNIQUE (site_id, bildiren, hedef_tur, hedef_ref)
   );
   CREATE INDEX sikayetler_site ON sikayetler(site_id, durum, id);
   CREATE TABLE engeller (site_id INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     engellenen INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (site_id, user_id, engellenen));
   CREATE TABLE susturmalar (site_id INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     bitis INTEGER NOT NULL, neden TEXT NOT NULL DEFAULT '', PRIMARY KEY (site_id, user_id));`,
  /* 7: Arena kimliği (simge, çerçeve, sembol, unvan), kalıcı arena istatistikleri ve Mavi Öz, sezon sonu ödül işareti,
     turnuvanın şampiyonluk ödülü (koleksiyon simgesi). */
  `CREATE TABLE kazanimlar (site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kod TEXT NOT NULL, zaman INTEGER NOT NULL, kaynak TEXT NOT NULL DEFAULT '', PRIMARY KEY (site_id, user_id, kod));
   CREATE TABLE arena_gorunum (site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     simge TEXT NOT NULL, cerceve TEXT NOT NULL, semboller TEXT NOT NULL DEFAULT '[]', unvan TEXT NOT NULL, oz_goster INTEGER NOT NULL DEFAULT 0, guncelleme INTEGER NOT NULL, PRIMARY KEY (site_id, user_id));
   CREATE TABLE arena_istatistik (site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     mac INTEGER NOT NULL DEFAULT 0, galibiyet INTEGER NOT NULL DEFAULT 0, seri INTEGER NOT NULL DEFAULT 0, en_seri INTEGER NOT NULL DEFAULT 0, kusursuz INTEGER NOT NULL DEFAULT 0,
     mavi_oz INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (site_id, user_id));
   CREATE TABLE oz_kayit (site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kaynak TEXT NOT NULL, miktar INTEGER NOT NULL, zaman INTEGER NOT NULL, PRIMARY KEY (site_id, user_id, kaynak));
   ALTER TABLE sezonlar ADD COLUMN odullendi INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE turnuvalar ADD COLUMN odul TEXT NOT NULL DEFAULT '';`,
  /* 8: Turnuvada masa oyunları (satranç, tavla): turnuvanın oyunu ve canlı oyun kayıtları */
  `ALTER TABLE turnuvalar ADD COLUMN oyun TEXT NOT NULL DEFAULT 'bilgi';
   CREATE TABLE oyun_maclar (
     id TEXT PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE, oyun TEXT NOT NULL,
     a_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, b_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     turnuva_mac_id INTEGER, durum TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 1, bitti INTEGER NOT NULL DEFAULT 0, sonuc TEXT, neden TEXT NOT NULL DEFAULT '',
     tekrar INTEGER NOT NULL DEFAULT 0, sure_a INTEGER NOT NULL, sure_b INTEGER NOT NULL, son INTEGER NOT NULL, olusturma INTEGER NOT NULL
   );
   CREATE INDEX oyun_maclar_a ON oyun_maclar(a_user, bitti); CREATE INDEX oyun_maclar_b ON oyun_maclar(b_user, bitti);`,
  /* 9: Bekçi (sohbet denetim botu): olay kaydı. Özet ve normalleştirilmiş metin 90 gün sonra silinir; geri bildirim eğitime girer. */
  `CREATE TABLE bekci_olay (
     id INTEGER PRIMARY KEY AUTOINCREMENT, site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, oda TEXT NOT NULL, zaman INTEGER NOT NULL,
     karar TEXT NOT NULL CHECK (karar IN ('izle','engelle','maske')), skor INTEGER NOT NULL, turler TEXT NOT NULL DEFAULT '[]',
     ozet TEXT NOT NULL DEFAULT '', norm TEXT NOT NULL DEFAULT '', mesaj_id INTEGER, geri INTEGER
   );
   CREATE INDEX bekci_olay_site ON bekci_olay(site_id, id); CREATE INDEX bekci_olay_kisi ON bekci_olay(site_id, user_id, zaman);`
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
