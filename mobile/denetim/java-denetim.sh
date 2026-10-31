#!/usr/bin/env bash
# Android yerel kodunu (mobile/android/.../app/*.java) Android SDK olmadan denetler:
# gerçek Android 15 framework sınıflarına (Robolectric android-all, Maven Central) ve Capacitor imzalarıyla birebir aynı
# küçük taslaklara (denetim/taslak) karşı derler; ardından rastgele seçim ve günlük sıra testlerini çalıştırır.
# Gerçek derleme yerine geçmez: kaynaklar (res/), Gradle ve cihaz davranışı Android Studio'da ya da CI'da denenir.
set -euo pipefail
KOK="$(cd "$(dirname "$0")/.." && pwd)"
ONBELLEK="${ANDROID_ALL_JAR_KLASORU:-$HOME/.cache/bilincli-sakin}"
JAR="$ONBELLEK/android-all-15-robolectric-13954326.jar"
mkdir -p "$ONBELLEK"
if [ ! -f "$JAR" ]; then
  echo "android-all indiriliyor (yaklaşık 180 MB, bir kez)…"
  curl -fsSL -o "$JAR" https://repo1.maven.org/maven2/org/robolectric/android-all/15-robolectric-13954326/android-all-15-robolectric-13954326.jar
fi
CIKTI="$(mktemp -d)"; trap 'rm -rf "$CIKTI"' EXIT
javac -nowarn -d "$CIKTI" -cp "$JAR" $(find "$KOK/denetim/taslak" -name "*.java") "$KOK"/android/app/src/main/java/com/bilinclisakin/app/*.java
echo "Derleme: tamam"
javac -nowarn -d "$CIKTI" -cp "$CIKTI:$JAR" "$KOK"/denetim/test/*.java
java -cp "$CIKTI:$JAR" com.bilinclisakin.app.RastgeleDenet
TZ=Europe/Istanbul java -Duser.timezone=Europe/Istanbul -cp "$CIKTI:$JAR" com.bilinclisakin.app.SiraDenet
