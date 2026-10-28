"use strict";
/* Servis çalışanı: YALNIZCA aşağıdaki statik dosyaları önbelleğe alır.
   /api/*, /saglik, /manifest.webmanifest, /md/* ve listede olmayan her şey ağdan gelir ve ASLA önbelleğe yazılmaz
   (kişisel veri ve pakete bağlı içerik cihazda kalmasın). Çevrimdışı sayfa açılışında "bağlantı yok" ekranı gösterilir. */
const SURUM = "bsakin-statik-v3";
const STATIK = ["/styles.css", "/app.js", "/config.js", "/native.js", "/hikmet.js", "/fonts/amiri-400.woff2", "/shared.js", "/vendor/marked.min.js", "/cevrimdisi.html",
  "/ikon.svg", "/ikon-192.png", "/ikon-512.png", "/ikon-maskable-512.png", "/apple-touch-icon.png", "/aydinlatma.html", "/gizlilik.html", "/kosullar.html", "/hesap-sil.html"];
const STATIK_SET = new Set(STATIK);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(STATIK)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SURUM).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/saglik" || url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/md/")) return; // ağ, önbellek yok
  if (req.mode === "navigate") {
    // Sayfa: önce ağ (her zaman güncel), ağ yoksa "bağlantı yok" ekranı. Uygulama kabuğu kişisel veri içermez.
    e.respondWith(fetch(req).catch(() => caches.match("/cevrimdisi.html")));
    return;
  }
  if (!STATIK_SET.has(url.pathname) || url.search) return;
  // Statik dosya: önbellekten hızlı, arka planda tazele
  e.respondWith(caches.open(SURUM).then(async c => {
    const eski = await c.match(url.pathname);
    const ag = fetch(req).then(r => { if (r.ok && r.type === "basic") c.put(url.pathname, r.clone()); return r; }).catch(() => eski);
    return eski || ag;
  }));
});
