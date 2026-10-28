#!/bin/sh
# Konteyner girişi: kalıcı disk (/data) çoğu platformda root sahipliğinde bağlanır.
# Root olarak başlarsak yalnızca veri klasörünün sahipliğini düzeltip uygulamayı yetkisiz "node" kullanıcısına devrederiz.
set -e
VERI_DIR="$(dirname "${DB_PATH:-/data/site-app.sqlite}")"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$VERI_DIR"
  chown -R node:node "$VERI_DIR"
  # İlk açılışta şema migration'ı (sunucu da açılışta yapar; burada hata erken görünür)
  setpriv --reuid=node --regid=node --init-groups -- node --disable-warning=ExperimentalWarning scripts/migrate.js
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
node --disable-warning=ExperimentalWarning scripts/migrate.js
exec "$@"
