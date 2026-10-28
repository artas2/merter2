"use strict";
/* Şema migration'larını uygular ve sürümü yazar. Sunucu her açılışta zaten çalıştırır; bu betik elle/CI için.
   node scripts/migrate.js   (DB_PATH ortam değişkenini kullanır) */
const path = require("node:path");
const { envYukle } = require("../src/server");
envYukle();
const { openDb, MIGRATIONS } = require("../src/db");
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data", "site-app.sqlite");
require("../src/db").yetkiDusur(dbPath);
const db = openDb(dbPath);
console.log(`Şema sürümü ${db.prepare("SELECT surum FROM schema_surum").get().surum}/${MIGRATIONS.length} · ${dbPath}`);
db.close();
