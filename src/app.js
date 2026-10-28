"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const O = require("../public/shared.js");
const { tx } = require("./db");
const V = require("./validate");
const { Hata } = V;
const { createAbonelik } = require("./abonelik");
const { createBelgeler } = require("./belgeler");
const { merterSayfasi, merterDosyalari } = require("../merter/sablon");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MARKED_PATH = path.join(__dirname, "..", "node_modules", "marked", "marked.min.js");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const DAVET_ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROLLER = ["site_yonetici", "site_denetci", "sakin"];

/* ---------- Basit hız sınırlayıcı (bellek içi, tek süreç) ---------- */
function rateLimiter(now) {
  const kova = new Map();
  let sonTemizlik = 0;
  return function izinVer(anahtar, limit, pencereMs) {
    const t = now();
    if (t - sonTemizlik > 60000) { for (const [k, v] of kova) if (v.every(x => t - x > 3600000)) kova.delete(k); sonTemizlik = t; }
    const liste = (kova.get(anahtar) || []).filter(x => t - x < pencereMs);
    if (liste.length >= limit) { kova.set(anahtar, liste); return false; }
    liste.push(t); kova.set(anahtar, liste); return true;
  };
}

function csvHucre(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/formül enjeksiyonuna karşı
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csv(satirlar) { return "﻿" + satirlar.map(r => r.map(csvHucre).join(";")).join("\r\n") + "\r\n"; }
const trSayi = (n, d = 2) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: d, useGrouping: false });

function createApp(opts) {
  const { db, sms } = opts;
  const cfg = {
    prod: false, sessionSecret: "", platformAdminTelefonlari: [], trustProxy: false, publicOrigin: "",
    mobilOriginler: ["capacitor://localhost", "https://localhost", "http://localhost"], abonelik: {}, akisBekleMs: 25000,
    otpSureMs: 5 * 60 * 1000, otpMaxDeneme: 5, oturumSureMs: 30 * 24 * 3600 * 1000, now: () => Date.now(), log: console.log, ...opts.config
  };
  const L = { otpIp: 10, dogrulaIp: 30, davetKullanici: 10, davetIp: 30, ...(opts.config && opts.config.limitler) };
  if (!cfg.sessionSecret || cfg.sessionSecret.length < 32) throw new Error("SESSION_SECRET en az 32 karakter olmalı.");
  const now = cfg.now;
  const adminSet = new Set(cfg.platformAdminTelefonlari.map(V.telefonNormalize).filter(Boolean));
  const izin = rateLimiter(now);
  const mobilSet = new Set(cfg.mobilOriginler);
  /* Mağaza inceleme hesabı: Apple/Google incelemecileri SMS alamaz. Yalnızca ortam değişkeniyle açılır; bu numaraya SMS gönderilmez,
     sabit kod kabul edilir. Diğer numaraları etkilemez; hız sınırları aynen geçerlidir. */
  const inceleme = cfg.incelemeHesabi && V.telefonNormalize(cfg.incelemeHesabi.telefon) && /^\d{6}$/.test(cfg.incelemeHesabi.kod || "")
    ? { tel: V.telefonNormalize(cfg.incelemeHesabi.telefon), kod: cfg.incelemeHesabi.kod } : null;

  const hmac = s => crypto.createHmac("sha256", cfg.sessionSecret).update(s).digest("hex");
  const sha = s => crypto.createHash("sha256").update(s).digest("hex");
  const esit = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  /* ---------- Hazır sorgular (hepsi parametreli) ---------- */
  const q = {
    site: db.prepare("SELECT * FROM sites WHERE id = ?"),
    userByTel: db.prepare("SELECT * FROM users WHERE telefon = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    userEkle: db.prepare("INSERT INTO users (telefon, platform_admin, olusturma) VALUES (?, ?, ?)"),
    userAdmin: db.prepare("UPDATE users SET platform_admin = ? WHERE id = ?"),
    uyelik: db.prepare("SELECT * FROM uyelikler WHERE user_id = ? AND site_id = ?"),
    uyelikler: db.prepare("SELECT u.site_id, u.rol, s.ad, s.ayarlar FROM uyelikler u JOIN sites s ON s.id = u.site_id WHERE u.user_id = ? ORDER BY u.olusturma"),
    sessionGet: db.prepare("SELECT * FROM sessions WHERE id_hash = ?"),
    sessionEkle: db.prepare("INSERT INTO sessions (id_hash, user_id, site_id, csrf, bitis, olusturma) VALUES (?, ?, ?, ?, ?, ?)"),
    sessionSil: db.prepare("DELETE FROM sessions WHERE id_hash = ?"),
    sessionSite: db.prepare("UPDATE sessions SET site_id = ? WHERE id_hash = ?"),
    sessionTemizle: db.prepare("DELETE FROM sessions WHERE bitis < ?"),
    otpGet: db.prepare("SELECT * FROM otp WHERE telefon = ?"),
    otpYaz: db.prepare("INSERT INTO otp (telefon, kod_hash, bitis, deneme, olusturma) VALUES (?, ?, ?, 0, ?) ON CONFLICT(telefon) DO UPDATE SET kod_hash = excluded.kod_hash, bitis = excluded.bitis, deneme = 0, olusturma = excluded.olusturma"),
    otpDeneme: db.prepare("UPDATE otp SET deneme = deneme + 1 WHERE telefon = ?"),
    otpSil: db.prepare("DELETE FROM otp WHERE telefon = ?"),
    profilGet: db.prepare("SELECT veri, guncelleme FROM profiller WHERE site_id = ? AND user_id = ?"),
    profilYaz: db.prepare("INSERT INTO profiller (site_id, user_id, veri, guncelleme) VALUES (?, ?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET veri = excluded.veri, guncelleme = excluded.guncelleme"),
    profilSil: db.prepare("DELETE FROM profiller WHERE site_id = ? AND user_id = ?"),
    profillerSite: db.prepare("SELECT veri, guncelleme FROM profiller WHERE site_id = ?"),
    sepetGet: db.prepare("SELECT tur, kalemler, notu, guncelleme FROM sepetler WHERE site_id = ? AND user_id = ?"),
    sepetYaz: db.prepare(`INSERT INTO sepetler (site_id, user_id, tur, blok, kat, daire, kalemler, notu, guncelleme) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site_id, user_id) DO UPDATE SET tur = excluded.tur, blok = excluded.blok, kat = excluded.kat, daire = excluded.daire, kalemler = excluded.kalemler, notu = excluded.notu, guncelleme = excluded.guncelleme`),
    sepetKonum: db.prepare("UPDATE sepetler SET blok = ?, kat = ?, daire = ? WHERE site_id = ? AND user_id = ?"),
    sepetSil: db.prepare("DELETE FROM sepetler WHERE site_id = ? AND user_id = ?"),
    sepetlerTur: db.prepare("SELECT blok, kat, daire, kalemler, notu FROM sepetler WHERE site_id = ? AND tur = ?"),
    puanGet: db.prepare("SELECT scores, kanit FROM puanlar WHERE site_id = ? AND user_id = ?"),
    puanYaz: db.prepare("INSERT INTO puanlar (site_id, user_id, scores, kanit, guncelleme) VALUES (?, ?, ?, ?, ?) ON CONFLICT(site_id, user_id) DO UPDATE SET scores = excluded.scores, kanit = excluded.kanit, guncelleme = excluded.guncelleme"),
    ayarYaz: db.prepare("UPDATE sites SET ayarlar = ? WHERE id = ?"),
    katalogYaz: db.prepare("UPDATE sites SET katalog = ? WHERE id = ?"),
    davetGet: db.prepare("SELECT * FROM davetler WHERE kod = ?"),
    davetEkle: db.prepare("INSERT INTO davetler (kod, site_id, rol, max_kullanim, bitis, aciklama, olusturan, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    davetKullan: db.prepare("UPDATE davetler SET kullanim = kullanim + 1 WHERE kod = ? AND kullanim < max_kullanim"),
    davetlerSite: db.prepare("SELECT kod, rol, max_kullanim, kullanim, bitis, iptal, aciklama, olusturma FROM davetler WHERE site_id = ? ORDER BY olusturma DESC LIMIT 100"),
    davetIptal: db.prepare("UPDATE davetler SET iptal = 1 WHERE kod = ? AND site_id = ?"),
    uyeEkle: db.prepare("INSERT INTO uyelikler (user_id, site_id, rol, olusturma) VALUES (?, ?, ?, ?)"),
    uyeSil: db.prepare("DELETE FROM uyelikler WHERE user_id = ? AND site_id = ?"),
    uyeRol: db.prepare("UPDATE uyelikler SET rol = ? WHERE user_id = ? AND site_id = ?"),
    uyelerSite: db.prepare(`SELECT u.user_id, u.rol, u.olusturma, us.telefon, p.veri FROM uyelikler u JOIN users us ON us.id = u.user_id
      LEFT JOIN profiller p ON p.site_id = u.site_id AND p.user_id = u.user_id WHERE u.site_id = ? ORDER BY u.olusturma`),
    yoneticiSayisi: db.prepare("SELECT COUNT(*) n FROM uyelikler WHERE site_id = ? AND rol = 'site_yonetici'"),
    son7Gun: db.prepare("SELECT COUNT(*) n FROM uyelikler WHERE site_id = ? AND rol = 'sakin' AND olusturma >= ?"),
    turEkle: db.prepare("INSERT OR IGNORE INTO turlar (site_id, tur_id, ad, baslangic) VALUES (?, ?, ?, ?)"),
    turAd: db.prepare("UPDATE turlar SET ad = ? WHERE site_id = ? AND tur_id = ?"),
    turKapat: db.prepare("UPDATE turlar SET kapanis = ?, hane = ? WHERE site_id = ? AND tur_id = ?"),
    oncekiTurlar: db.prepare("SELECT ad, baslangic, kapanis, hane FROM turlar WHERE site_id = ? AND tur_id != ? AND hane IS NOT NULL ORDER BY kapanis DESC LIMIT 3"),
    davetOnizleme: db.prepare("SELECT d.*, s.ad AS site_ad, s.ayarlar FROM davetler d JOIN sites s ON s.id = d.site_id WHERE d.kod = ?")
  };

  /* ---------- Yardımcılar ---------- */
  function siteYukle(id) {
    const s = q.site.get(id);
    if (!s) return null;
    let ayar = {}, katalog = {};
    try { ayar = JSON.parse(s.ayarlar); } catch (_) { /* boş */ }
    try { katalog = JSON.parse(s.katalog); } catch (_) { /* boş */ }
    return { ...s, ayar: { ...O.varsayilanAyar(), ...ayar }, katalog: { urunler: Array.isArray(katalog.urunler) ? katalog.urunler : [], tur: { id: "", ad: "", sonTarih: "", teslim: "", acik: false, ...(katalog.tur || {}) } } };
  }
  function etkinDurum(site) {
    if (site.durum === "deneme" && site.deneme_bitis) {
      const b = Date.parse(site.deneme_bitis + "T23:59:59" + O.SITE_UTC_OFFSET);
      if (Number.isFinite(b) && b < now()) return "askida";
    }
    return site.durum;
  }
  function davetKoduUret() { let s = ""; for (let i = 0; i < 8; i++) s += DAVET_ALFABE[crypto.randomInt(DAVET_ALFABE.length)]; return s; }
  const davetGoster = k => k.slice(0, 4) + "-" + k.slice(4);
  function davetOlustur(siteId, rol, maxKullanim, gun, aciklama, olusturan) {
    for (let i = 0; i < 5; i++) {
      const kod = davetKoduUret();
      try { q.davetEkle.run(kod, siteId, rol, maxKullanim, now() + gun * 864e5, aciklama, olusturan, now()); return kod; }
      catch (e) { if (!/UNIQUE/.test(e.message)) throw e; }
    }
    throw new Error("Davet kodu üretilemedi");
  }
  const parse = (s, d) => { try { return JSON.parse(s); } catch (_) { return d; } };

  /* ---------- HTTP yardımcıları ---------- */
  function guvenlikBasliklari(res) {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (cfg.prod) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  function json(res, status, obj, ek = {}) {
    const b = JSON.stringify(obj);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...ek });
    res.end(b);
  }
  function cerezler(req) {
    const o = {};
    for (const p of String(req.headers.cookie || "").split(";")) { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }
    return o;
  }
  const CEREZ = "sid";
  function cerezYaz(res, deger, maxAgeSn) {
    res.setHeader("Set-Cookie", `${CEREZ}=${deger}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSn}${cfg.prod ? "; Secure" : ""}`);
  }
  function ip(req) {
    if (cfg.trustProxy) { const x = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(); if (x) return x; }
    return req.socket.remoteAddress || "?";
  }
  function govdeOku(req, sinir = 300 * 1024) {
    return new Promise((resolve, reject) => {
      let boyut = 0; const parcalar = [];
      req.on("data", c => { boyut += c.length; if (boyut > sinir) { reject(new Hata(413, "İstek çok büyük.")); req.destroy(); } else parcalar.push(c); });
      req.on("end", () => {
        const t = Buffer.concat(parcalar).toString("utf8");
        if (!t) return resolve({});
        try { resolve(JSON.parse(t)); } catch (_) { reject(new Hata(400, "Geçersiz JSON.")); }
      });
      req.on("error", reject);
    });
  }
  function beklenenOrigin(req) {
    if (cfg.publicOrigin) return cfg.publicOrigin.replace(/\/$/, "");
    const proto = cfg.trustProxy && req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim() : (req.socket.encrypted ? "https" : "http");
    return `${proto}://${req.headers.host}`;
  }

  /* ---------- Oturum ---------- */
  /* Mobil uygulama (Capacitor) çerez yerine "Authorization: Bearer" ile gelir. Jeton tarayıcının kendiliğinden
     eklediği bir şey olmadığından bu isteklerde CSRF riski yoktur. */
  function bearer(req) {
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(String(req.headers.authorization || ""));
    return m ? m[1] : null;
  }
  function oturumYukle(req) {
    const b = bearer(req);
    const sid = b || cerezler(req)[CEREZ];
    if (!sid || sid.length > 100) return null;
    const s = q.sessionGet.get(sha(sid));
    if (!s) return null;
    if (s.bitis < now()) { q.sessionSil.run(s.id_hash); return null; }
    const user = q.userById.get(s.user_id);
    if (!user) return null;
    return { s, user, bearer: !!b };
  }
  function oturumAc(res, user) {
    const sid = crypto.randomBytes(32).toString("base64url");
    const csrf = crypto.randomBytes(24).toString("base64url");
    const uy = q.uyelikler.all(user.id);
    q.sessionEkle.run(sha(sid), user.id, uy.length ? uy[uy.length - 1].site_id : null, csrf, now() + cfg.oturumSureMs, now());
    q.sessionTemizle.run(now());
    cerezYaz(res, sid, Math.floor(cfg.oturumSureMs / 1000));
    return sid;
  }

  /* ---------- Rotalar ---------- */
  const rotalar = [];
  /* yetki: null (herkese açık) | "giris" | "uye" | "yonetim" (yönetici+denetçi) | "yonetici" | "platform"
     yazma: true ise askıdaki sitede reddedilir */
  const rota = (method, yol, yetki, fn, ek = {}) => {
    const anahtarlar = [];
    const re = new RegExp("^" + yol.replace(/:(\w+)/g, (_, k) => { anahtarlar.push(k); return "([^/]+)"; }) + "$");
    rotalar.push({ method, re, anahtarlar, yetki, fn, ...ek });
  };

  function meYaniti(ctx) {
    const { user, s } = ctx;
    const uy = user.platform_admin ? [] : q.uyelikler.all(user.id);
    let aktif = null;
    const secili = uy.find(u => u.site_id === s.site_id) || null;
    if (secili) {
      const site = siteYukle(secili.site_id);
      const d = etkinDurum(site);
      aktif = { id: site.id, kimlik: BL.kimlik(site.id, user.id), ad: site.ayar.siteAdi || site.ad, rol: secili.rol, plan: site.plan, durum: d, denemeBitis: site.deneme_bitis, saltOkur: d === "askida",
        ozellikler: { alisveris: O.ozellikVar(site.plan, "alisveris"), egitim: O.ozellikVar(site.plan, "egitim") } };
    }
    return {
      user: { id: user.id, telefon: user.telefon, platformAdmin: !!user.platform_admin }, csrf: s.csrf,
      uyelikler: uy.map(u => ({ siteId: u.site_id, ad: parse(u.ayarlar, {}).siteAdi || u.ad, rol: u.rol })), aktifSite: aktif,
      abonelik: user.platform_admin ? null : abonelikDurumu(user, s)
    };
  }

  // --- Kimlik doğrulama ---
  rota("POST", "/api/auth/otp-iste", null, async ctx => {
    const ipA = ip(ctx.req);
    if (!izin("otp-ip:" + ipA, L.otpIp, 15 * 60000)) throw new Hata(429, "Çok fazla istek. Biraz sonra tekrar deneyin.");
    const tel = V.telefonNormalize(ctx.body.telefon);
    if (!tel) throw new Hata(400, "Geçerli bir cep telefonu numarası girin (5xx xxx xx xx).", "telefon");
    if (!izin("otp-tel-dk:" + tel, 1, 60000)) throw new Hata(429, "Yeni kod için 1 dakika bekleyin.");
    if (!izin("otp-tel-saat:" + tel, 5, 3600000)) throw new Hata(429, "Bu numara için çok fazla kod istendi. Bir saat sonra tekrar deneyin.");
    const incelemeMi = inceleme && tel === inceleme.tel;
    const kod = incelemeMi ? inceleme.kod : String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    q.otpYaz.run(tel, hmac(tel + ":" + kod), now() + cfg.otpSureMs, now());
    if (incelemeMi) { cfg.log("[inceleme hesabı] giriş kodu istendi"); return { ok: true, telefon: tel }; }
    try { await sms.gonder(tel, `Bilinçli Sakin giriş kodunuz: ${kod}. Kod 5 dakika geçerlidir. Kimseyle paylaşmayın.`); }
    catch (e) { cfg.log("[SMS hata]", e.message); q.otpSil.run(tel); throw new Hata(502, "SMS gönderilemedi. Biraz sonra tekrar deneyin."); }
    return { ok: true, telefon: tel };
  });
  rota("POST", "/api/auth/otp-dogrula", null, async ctx => {
    const ipA = ip(ctx.req);
    if (!izin("dogrula-ip:" + ipA, L.dogrulaIp, 15 * 60000)) throw new Hata(429, "Çok fazla deneme. Biraz sonra tekrar deneyin.");
    const tel = V.telefonNormalize(ctx.body.telefon);
    const kod = String(ctx.body.kod || "").replace(/\s/g, "");
    if (!tel || !/^\d{6}$/.test(kod)) throw new Hata(400, "Telefon ve 6 haneli kod gerekli.");
    const o = q.otpGet.get(tel);
    if (!o) throw new Hata(400, "Kod bulunamadı veya kullanıldı. Yeni kod isteyin.");
    if (o.bitis < now()) { q.otpSil.run(tel); throw new Hata(400, "Kodun süresi doldu. Yeni kod isteyin."); }
    if (o.deneme >= cfg.otpMaxDeneme) { q.otpSil.run(tel); throw new Hata(429, "Çok fazla hatalı deneme. Yeni kod isteyin."); }
    if (!esit(o.kod_hash, hmac(tel + ":" + kod))) {
      q.otpDeneme.run(tel);
      const kalan = cfg.otpMaxDeneme - o.deneme - 1;
      if (kalan <= 0) { q.otpSil.run(tel); throw new Hata(429, "Çok fazla hatalı deneme. Yeni kod isteyin."); }
      throw new Hata(400, `Kod hatalı. ${kalan} deneme hakkınız kaldı.`);
    }
    q.otpSil.run(tel);
    const isAdmin = adminSet.has(tel) ? 1 : 0;
    let user = q.userByTel.get(tel);
    if (!user) { q.userEkle.run(tel, isAdmin, now()); user = q.userByTel.get(tel); }
    else if (user.platform_admin !== isAdmin) { q.userAdmin.run(isAdmin, user.id); user = q.userById.get(user.id); }
    const sid = oturumAc(ctx.res, user);
    // Mobil uygulama çerez saklayamadığı için jetonu gövdede alır; tarayıcıya asla verilmez.
    return mobilIstek(ctx.req) ? { ok: true, token: sid } : { ok: true };
  });
  rota("POST", "/api/auth/cikis", "giris", ctx => {
    q.sessionSil.run(ctx.s.id_hash); cerezYaz(ctx.res, "", 0); return { ok: true };
  });
  rota("GET", "/api/me", null, ctx => {
    const o = oturumYukle(ctx.req);
    if (!o) return { user: null };
    ctx.s = o.s; ctx.user = o.user; return meYaniti(ctx);
  });
  rota("POST", "/api/site-sec", "giris", ctx => {
    const id = Number(ctx.body.siteId);
    if (!Number.isInteger(id) || !q.uyelik.get(ctx.user.id, id)) throw new Hata(403, "Bu sitenin üyesi değilsiniz.");
    q.sessionSite.run(id, ctx.s.id_hash); ctx.s.site_id = id; return meYaniti(ctx);
  });
  rota("POST", "/api/davet/kullan", "giris", ctx => {
    if (ctx.user.platform_admin) throw new Hata(403, "Platform yöneticisi hesapları siteye katılamaz. Sakin verisine erişim için ayrı bir hesap gerekmez.");
    if (!izin("davet:" + ctx.user.id, L.davetKullanici, 15 * 60000) || !izin("davet-ip:" + ip(ctx.req), L.davetIp, 15 * 60000)) throw new Hata(429, "Çok fazla deneme. Biraz sonra tekrar deneyin.");
    const kod = String(ctx.body.kod || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const d = kod.length === 8 ? q.davetGet.get(kod) : null;
    if (!d || d.iptal || (d.bitis && d.bitis < now()) || d.kullanim >= d.max_kullanim) throw new Hata(400, "Davet kodu geçersiz veya süresi dolmuş.");
    const site = siteYukle(d.site_id);
    if (!site) throw new Hata(400, "Davet kodu geçersiz veya süresi dolmuş.");
    if (etkinDurum(site) === "askida") throw new Hata(403, "Bu site şu anda askıda; yeni üye alınamıyor.");
    const mevcut = q.uyelik.get(ctx.user.id, d.site_id);
    if (!mevcut) {
      tx(db, () => {
        if (q.davetKullan.run(kod).changes !== 1) throw new Hata(400, "Davet kodu geçersiz veya süresi dolmuş.");
        q.uyeEkle.run(ctx.user.id, d.site_id, d.rol, now());
      });
    }
    q.sessionSite.run(d.site_id, ctx.s.id_hash); ctx.s.site_id = d.site_id;
    return { ...meYaniti(ctx), zatenUye: !!mevcut };
  });

  rota("GET", "/api/davet/onizleme/:kod", null, ctx => {
    if (!izin("onizleme-ip:" + ip(ctx.req), L.davetIp, 15 * 60000)) throw new Hata(429, "Çok fazla istek. Biraz sonra tekrar deneyin.");
    const kod = String(ctx.params.kod || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const d = kod.length === 8 ? q.davetOnizleme.get(kod) : null;
    if (!d || d.iptal || (d.bitis && d.bitis < now()) || d.kullanim >= d.max_kullanim) return { gecerli: false };
    return { gecerli: true, site: parse(d.ayarlar, {}).siteAdi || d.site_ad, kod: davetGoster(kod) };
  });

  // --- Site içeriği (üye) ---
  rota("GET", "/api/site/ayarlar", "uye", ctx => ({ ayarlar: ctx.site.ayar }));
  rota("PUT", "/api/site/ayarlar", "yonetici", ctx => {
    const a = V.ayarDogrula(ctx.body);
    q.ayarYaz.run(JSON.stringify(a), ctx.site.id);
    return { ayarlar: a };
  }, { yazma: true });
  rota("GET", "/api/katalog", "uye", ctx => ({ katalog: ctx.site.katalog, simdi: now() }), { ozellik: "alisveris" });
  rota("PUT", "/api/katalog", "yonetici", ctx => {
    const k = V.katalogDogrula(ctx.body);
    const eski = ctx.site.katalog.tur;
    const tur = { id: k.yeniTur ? "t" + now().toString(36) + crypto.randomBytes(2).toString("hex") : String(eski.id || ""), ...k.tur };
    if (tur.acik && !tur.id) throw new Hata(400, "Önce bir tur başlatın.");
    const katalog = { urunler: k.urunler, tur: { id: tur.id, ad: tur.ad, sonTarih: tur.sonTarih, teslim: tur.teslim, acik: tur.acik } };
    tx(db, () => {
      if (k.yeniTur && eski.id) {
        // Eski turun sipariş veren hane sayısı, sakinler sepetlerini yeni tura taşımadan önce kaydedilir.
        const hane = q.sepetlerTur.all(ctx.site.id, eski.id).filter(r => Object.values(parse(r.kalemler, {})).some(x => x > 0)).length;
        q.turEkle.run(ctx.site.id, eski.id, eski.ad || "", now());
        q.turKapat.run(now(), hane, ctx.site.id, eski.id);
      }
      if (tur.id) { q.turEkle.run(ctx.site.id, tur.id, tur.ad, now()); q.turAd.run(tur.ad, ctx.site.id, tur.id); }
      q.katalogYaz.run(JSON.stringify(katalog), ctx.site.id);
    });
    return { katalog, simdi: now() };
  }, { yazma: true, ozellik: "alisveris" });

  // --- Profil ---
  rota("GET", "/api/profil", "uye", ctx => {
    const r = q.profilGet.get(ctx.site.id, ctx.user.id);
    return { profil: r ? parse(r.veri, null) : null };
  });
  rota("PUT", "/api/profil", "uye", ctx => {
    const p = V.profilDogrula(ctx.body, ctx.site.ayar);
    p.guncelleme = now();
    tx(db, () => {
      q.profilYaz.run(ctx.site.id, ctx.user.id, JSON.stringify(p), now());
      q.sepetKonum.run(p.blok, p.kat, p.daire, ctx.site.id, ctx.user.id);
    });
    return { profil: p };
  }, { yazma: true });
  rota("DELETE", "/api/profil", "uye", ctx => {
    tx(db, () => { q.profilSil.run(ctx.site.id, ctx.user.id); q.sepetSil.run(ctx.site.id, ctx.user.id); });
    return { ok: true };
  }, { kvkk: true });

  // --- Puan kartı ---
  rota("GET", "/api/puan", "uye", ctx => {
    const r = q.puanGet.get(ctx.site.id, ctx.user.id);
    return { scores: r ? parse(r.scores, {}) : {}, kanit: r ? parse(r.kanit, {}) : {} };
  }, { ozellik: "egitim" });
  rota("PUT", "/api/puan", "uye", ctx => {
    const p = V.puanDogrula(ctx.body);
    q.puanYaz.run(ctx.site.id, ctx.user.id, JSON.stringify(p.scores), JSON.stringify(p.kanit), now());
    return p;
  }, { yazma: true, ozellik: "egitim" });

  // --- Sepet ---
  rota("GET", "/api/sepet", "uye", ctx => {
    const r = q.sepetGet.get(ctx.site.id, ctx.user.id);
    return { sepet: r ? { tur: r.tur, kalemler: parse(r.kalemler, {}), not: r.notu } : { tur: "", kalemler: {}, not: "" } };
  }, { ozellik: "alisveris" });
  rota("PUT", "/api/sepet", "uye", ctx => {
    const kat = ctx.site.katalog;
    const s = V.sepetDogrula(ctx.body, kat.urunler);
    const bos = !Object.keys(s.kalemler).length;
    if (!O.turAcik(kat.tur, now()) && !bos) throw new Hata(409, kat.tur.id ? "Bu tur siparişe kapalı." : "Açık bir alışveriş turu yok.");
    const pr = q.profilGet.get(ctx.site.id, ctx.user.id);
    if (!pr && !bos) throw new Hata(409, "Önce profilini oluştur.");
    const p = pr ? parse(pr.veri, {}) : {};
    q.sepetYaz.run(ctx.site.id, ctx.user.id, kat.tur.id || "", p.blok || "", Number.isInteger(p.kat) ? p.kat : null, p.daire || "", JSON.stringify(s.kalemler), s.not, now());
    return { sepet: { tur: kat.tur.id || "", kalemler: s.kalemler, not: s.not } };
  }, { yazma: true, ozellik: "alisveris" });

  // --- Yönetim: sakinler ve toplu sipariş ---
  function sakinListesi(site) {
    return q.profillerSite.all(site.id).map(r => parse(r.veri, null)).filter(p => p && p.blok)
      .sort((a, b) => a.blok.localeCompare(b.blok, "tr") || a.kat - b.kat || String(a.daire).localeCompare(String(b.daire), "tr", { numeric: true }));
  }
  function siparisVerisi(site) {
    const kat = site.katalog;
    const sepetler = kat.tur.id ? q.sepetlerTur.all(site.id, kat.tur.id).map(r => ({ blok: r.blok, kat: r.kat, daire: r.daire, kalemler: parse(r.kalemler, {}), not: r.notu }))
      .filter(d => Object.values(d.kalemler).some(x => x > 0)) : [];
    const ag = O.siparisToplam(sepetler, kat.urunler);
    const toplam = ag.reduce((t, a) => t + (a.u.fiyat !== "" ? a.q * a.u.fiyat : 0), 0);
    const teslimat = O.teslimatSirala(sepetler).map(d => {
      const o = O.sepetOzet(d.kalemler, kat.urunler);
      return { blok: d.blok, kat: d.kat, daire: d.daire, not: d.not, n: o.n, t: o.t,
        kalemler: Object.entries(d.kalemler).filter(([, x]) => x > 0).map(([id, x]) => { const u = kat.urunler.find(z => z.id === id); return u ? { id, ad: u.ad, q: x, birim: u.birim } : null; }).filter(Boolean) };
    });
    return { tur: kat.tur, hane: sepetler.length, urunler: ag.map(a => ({ id: a.u.id, ad: a.u.ad, kat: a.u.kat, alt: a.u.alt, birim: a.u.birim, fiyat: a.u.fiyat, q: a.q, h: a.h })), toplam, teslimat };
  }
  /* Pilot ölçümü: doluluk, blok bazında doluluk, tur sipariş sayıları, son 7 günde katılan sakinler */
  function ozetVerisi(site) {
    const sakinler = sakinListesi(site);
    const toplamDaire = Number.isInteger(site.ayar.toplamDaire) ? site.ayar.toplamDaire : null;
    const yuzde = (n, t) => t ? Math.round(n / t * 1000) / 10 : null;
    const blokSay = {};
    for (const p of sakinler) blokSay[p.blok] = (blokSay[p.blok] || 0) + 1;
    const tanimli = (site.ayar.bloklar || []).map(b => b.ad);
    const bloklar = [...new Set([...tanimli, ...Object.keys(blokSay)])].map(ad => {
      const b = (site.ayar.bloklar || []).find(x => x.ad === ad);
      const daire = b && Number.isInteger(b.daire) ? b.daire : null;
      return { blok: ad, hane: blokSay[ad] || 0, daire, doluluk: yuzde(blokSay[ad] || 0, daire) };
    });
    const ozet = {
      toplamDaire, profilHane: sakinler.length, doluluk: yuzde(sakinler.length, toplamDaire), bloklar,
      son7GunKatilan: q.son7Gun.get(site.id, now() - 7 * 864e5).n, alisveris: O.ozellikVar(site.plan, "alisveris"), plan: site.plan
    };
    if (ozet.alisveris) {
      const t = site.katalog.tur;
      ozet.acikTur = t.id ? { ad: t.ad, acik: O.turAcik(t, now()), hane: siparisVerisi(site).hane } : null;
      ozet.oncekiTurlar = q.oncekiTurlar.all(site.id, t.id || "").map(r => ({ ad: r.ad, baslangic: r.baslangic, kapanis: r.kapanis, hane: r.hane }));
    }
    return ozet;
  }
  rota("GET", "/api/yonetim/sakinler", "yonetim", ctx => ({ sakinler: sakinListesi(ctx.site) }));
  rota("GET", "/api/yonetim/siparis", "yonetim", ctx => siparisVerisi(ctx.site), { ozellik: "alisveris" });
  rota("GET", "/api/yonetim/ozet", "yonetim", ctx => ozetVerisi(ctx.site));
  rota("GET", "/api/yonetim/sakinler.csv", "yonetici", ctx => {
    const ek = O.ekAlanlar(ctx.site.ayar);
    const satir = [["Blok", "Kat", "Daire", "Oturma durumu", "Kişi sayısı", "Kategoriler", ...ek.map(a => a.label), "Ad", "Telefon", "Acil durumda yardım", "Yardım notu", "Taşınma yılı"]];
    for (const p of sakinListesi(ctx.site)) {
      satir.push([p.blok, O.katAd(p.kat), p.daire, p.durum, (p.bireyler || []).length, O.kategoriler(p, false).slice(1).join(", "), ...ek.map(a => (p.ek || {})[a.k] || ""),
        p.ad || "", p.telefon || "", p.yardim ? "Evet" : "Hayır", p.yardimNot || "", p.tasinma || ""]);
    }
    return { _ham: csv(satir), _dosya: "sakinler.csv" };
  });
  rota("GET", "/api/yonetim/siparis.csv", "yonetici", ctx => {
    const v = siparisVerisi(ctx.site);
    const liste = ctx.url.searchParams.get("liste") === "teslimat" ? "teslimat" : "urun";
    let satir;
    if (liste === "urun") {
      satir = [["Bölüm", "Tür", "Ürün", "Miktar", "Birim", "Hane", "Tahmini TL"]];
      for (const a of v.urunler) satir.push([a.kat === "market" ? "Market" : "Pazar", a.alt, a.ad, trSayi(a.q), a.birim, a.h, a.fiyat !== "" ? trSayi(a.q * a.fiyat) : ""]);
    } else {
      satir = [["Blok", "Kat", "Daire", "Ürünler", "Ürün sayısı", "Tahmini TL", "Not"]];
      for (const d of v.teslimat) satir.push([d.blok, O.katAd(d.kat), d.daire, d.kalemler.map(k => `${k.ad} ${trSayi(k.q)} ${k.birim}`).join(" · "), d.n, d.t ? trSayi(d.t) : "", d.not || ""]);
    }
    return { _ham: csv(satir), _dosya: liste === "urun" ? "siparis-urunler.csv" : "siparis-teslimat.csv" };
  }, { ozellik: "alisveris" });

  // --- Yönetim: davetler ve üyeler (yalnız yönetici) ---
  rota("GET", "/api/yonetim/davetler", "yonetici", ctx => ({
    davetler: q.davetlerSite.all(ctx.site.id).map(d => ({ kod: davetGoster(d.kod), rol: d.rol, maxKullanim: d.max_kullanim, kullanim: d.kullanim, bitis: d.bitis, iptal: !!d.iptal, aciklama: d.aciklama,
      gecerli: !d.iptal && d.kullanim < d.max_kullanim && (!d.bitis || d.bitis > now()) }))
  }));
  rota("POST", "/api/yonetim/davetler", "yonetici", ctx => {
    const b = ctx.body;
    const rol = b.rol === undefined || b.rol === "" ? "sakin" : b.rol;
    if (!ROLLER.includes(rol)) throw new Hata(400, "Geçersiz rol.");
    const max = b.maxKullanim === undefined ? 1 : V.int(b.maxKullanim, "Kullanım sayısı");
    if (max < 1 || max > 500) throw new Hata(400, "Kullanım sayısı 1 ile 500 arasında olmalı.");
    const gun = b.gun === undefined ? 14 : V.int(b.gun, "Geçerlilik süresi");
    if (gun < 1 || gun > 90) throw new Hata(400, "Geçerlilik 1 ile 90 gün arasında olmalı.");
    const aciklama = V.str(b.aciklama, 60, "Açıklama");
    const kod = davetOlustur(ctx.site.id, rol, max, gun, aciklama, ctx.user.id);
    return { kod: davetGoster(kod) };
  }, { yazma: true });
  rota("DELETE", "/api/yonetim/davetler/:kod", "yonetici", ctx => {
    const kod = String(ctx.params.kod).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (q.davetIptal.run(kod, ctx.site.id).changes !== 1) throw new Hata(404, "Davet bulunamadı.");
    return { ok: true };
  }, { yazma: true });
  rota("GET", "/api/yonetim/uyeler", "yonetici", ctx => ({
    uyeler: q.uyelerSite.all(ctx.site.id).map(u => { const p = u.veri ? parse(u.veri, null) : null; return { userId: u.user_id, telefon: u.telefon, rol: u.rol, katilim: u.olusturma, konum: p ? { blok: p.blok, kat: p.kat, daire: p.daire } : null, ben: u.user_id === ctx.user.id }; })
  }));
  rota("PATCH", "/api/yonetim/uyeler/:id", "yonetici", ctx => {
    const id = Number(ctx.params.id);
    if (!ROLLER.includes(ctx.body.rol)) throw new Hata(400, "Geçersiz rol.");
    if (id === ctx.user.id) throw new Hata(400, "Kendi rolünüzü değiştiremezsiniz.");
    if (!q.uyelik.get(id, ctx.site.id)) throw new Hata(404, "Üye bulunamadı.");
    q.uyeRol.run(ctx.body.rol, id, ctx.site.id);
    return { ok: true };
  }, { yazma: true });
  rota("DELETE", "/api/yonetim/uyeler/:id", "yonetici", ctx => {
    const id = Number(ctx.params.id);
    if (id === ctx.user.id) throw new Hata(400, "Kendinizi siteden çıkaramazsınız.");
    if (!q.uyelik.get(id, ctx.site.id)) throw new Hata(404, "Üye bulunamadı.");
    tx(db, () => {
      q.profilSil.run(ctx.site.id, id); q.sepetSil.run(ctx.site.id, id);
      db.prepare("DELETE FROM puanlar WHERE site_id = ? AND user_id = ?").run(ctx.site.id, id);
      BL.kisiSil(ctx.site.id, id);
      q.uyeSil.run(id, ctx.site.id);
      db.prepare("UPDATE sessions SET site_id = NULL WHERE user_id = ? AND site_id = ?").run(id, ctx.site.id);
    });
    return { ok: true };
  }, { yazma: true });

  // --- KVKK: hesap verisi ve silme ---
  rota("GET", "/api/hesap/veri", "giris", ctx => {
    const u = ctx.user;
    const uy = q.uyelikler.all(u.id).map(m => {
      const p = q.profilGet.get(m.site_id, u.id), s = q.sepetGet.get(m.site_id, u.id), pu = q.puanGet.get(m.site_id, u.id);
      return { site: parse(m.ayarlar, {}).siteAdi || m.ad, rol: m.rol, profil: p ? parse(p.veri, null) : null,
        sepet: s ? { tur: s.tur, kalemler: parse(s.kalemler, {}), not: s.notu, guncelleme: new Date(s.guncelleme).toISOString() } : null,
        puanKarti: pu ? { scores: parse(pu.scores, {}), kanit: parse(pu.kanit, {}) } : null };
    });
    const veri = { aciklama: "Bilinçli Sakin hesabınızda tutulan kişisel verilerin dökümüdür (KVKK m.11).", olusturma: new Date(now()).toISOString(),
      hesap: { telefon: u.telefon, kayit: new Date(u.olusturma).toISOString() }, siteler: uy };
    return { _ham: JSON.stringify(veri, null, 2), _dosya: "bilincli-sakin-verilerim.json", _tip: "application/json; charset=utf-8" };
  });
  rota("DELETE", "/api/hesap", "giris", ctx => {
    if (ctx.body.onay !== true) throw new Hata(400, "Silme onayı gerekli.");
    for (const m of q.uyelikler.all(ctx.user.id)) BL.kisiSil(m.site_id, ctx.user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(ctx.user.id); // profiller, sepetler, puanlar, üyelikler, oturumlar CASCADE ile silinir
    q.otpSil.run(ctx.user.telefon);
    cerezYaz(ctx.res, "", 0);
    return { ok: true, not: "Mağaza aboneliğiniz varsa yenilenmemesi için App Store ya da Google Play abonelik ayarlarından iptal edin." };
  });

  // --- Platform yöneticisi (satıcı): yalnızca site ve abonelik ---
  function siteOzet(s) {
    const n = db.prepare("SELECT COUNT(*) n FROM uyelikler WHERE site_id = ?").get(s.id).n;
    return { id: s.id, ad: s.ad, plan: s.plan, odemeModeli: s.odeme_modeli, durum: s.durum, etkinDurum: etkinDurum(s), denemeBitis: s.deneme_bitis, olusturma: s.olusturma, uyeSayisi: n, yoneticiSayisi: q.yoneticiSayisi.get(s.id).n };
  }
  rota("GET", "/api/platform/siteler", "platform", () => ({ siteler: db.prepare("SELECT * FROM sites ORDER BY id DESC").all().map(siteOzet) }));
  rota("POST", "/api/platform/siteler", "platform", ctx => {
    const ad = V.str(ctx.body.ad, 60, "Site adı", { zorunlu: true });
    const plan = ctx.body.plan || "tam";
    if (!O.PLANLAR[plan]) throw new Hata(400, "Geçersiz plan.");
    const gun = ctx.body.denemeGun === undefined ? 30 : V.int(ctx.body.denemeGun, "Deneme süresi");
    if (gun < 0 || gun > 365) throw new Hata(400, "Deneme süresi 0 ile 365 gün arasında olmalı.");
    const bitis = new Date(now() + gun * 864e5 + 3 * 3600e3).toISOString().slice(0, 10);
    const ayar = { ...O.varsayilanAyar(), siteAdi: ad.slice(0, 50) };
    const r = db.prepare("INSERT INTO sites (ad, plan, durum, deneme_bitis, ayarlar, olusturma) VALUES (?, ?, 'deneme', ?, ?, ?)").run(ad, plan, bitis, JSON.stringify(ayar), now());
    const id = Number(r.lastInsertRowid);
    const kod = davetOlustur(id, "site_yonetici", 1, 14, "İlk yönetici", ctx.user.id);
    return { site: siteOzet(q.site.get(id)), davetKodu: davetGoster(kod) };
  });
  rota("PATCH", "/api/platform/siteler/:id", "platform", ctx => {
    const s = q.site.get(Number(ctx.params.id));
    if (!s) throw new Hata(404, "Site bulunamadı.");
    const b = ctx.body;
    const plan = b.plan === undefined ? s.plan : b.plan;
    const durum = b.durum === undefined ? s.durum : b.durum;
    const denemeBitis = b.denemeBitis === undefined ? s.deneme_bitis : b.denemeBitis;
    if (!O.PLANLAR[plan]) throw new Hata(400, "Geçersiz plan.");
    if (!O.SITE_DURUM[durum]) throw new Hata(400, "Geçersiz durum.");
    if (denemeBitis !== null && denemeBitis !== "" && !(/^\d{4}-\d{2}-\d{2}$/.test(denemeBitis) && Number.isFinite(Date.parse(denemeBitis)))) throw new Hata(400, "Deneme bitiş tarihi YYYY-AA-GG olmalı.");
    const ad = b.ad === undefined ? s.ad : V.str(b.ad, 60, "Site adı", { zorunlu: true });
    const odeme = b.odemeModeli === undefined ? s.odeme_modeli : b.odemeModeli;
    if (!["sakin", "site"].includes(odeme)) throw new Hata(400, "Ödeme modeli 'sakin' ya da 'site' olmalı.");
    db.prepare("UPDATE sites SET ad = ?, plan = ?, durum = ?, deneme_bitis = ?, odeme_modeli = ? WHERE id = ?").run(ad, plan, durum, denemeBitis || null, odeme, s.id);
    return { site: siteOzet(q.site.get(s.id)) };
  });
  rota("POST", "/api/platform/siteler/:id/yonetici-davet", "platform", ctx => {
    const s = q.site.get(Number(ctx.params.id));
    if (!s) throw new Hata(404, "Site bulunamadı.");
    // Satıcının kendine yönetici erişimi açmasını önlemek için: yalnızca sitenin hiç yöneticisi yokken.
    if (q.yoneticiSayisi.get(s.id).n > 0) throw new Hata(409, "Bu sitenin yöneticisi var. Yeni yönetici davetini sitenin mevcut yöneticisi üretmelidir.");
    db.prepare("UPDATE davetler SET iptal = 1 WHERE site_id = ? AND rol = 'site_yonetici' AND kullanim < max_kullanim").run(s.id);
    return { davetKodu: davetGoster(davetOlustur(s.id, "site_yonetici", 1, 7, "Platformdan yönetici daveti", ctx.user.id)) };
  });

  function mobilIstek(req) { return mobilSet.has(req.headers.origin) && req.headers["x-istemci"] === "mobil"; }

  // --- Abonelik ---
  const AB = createAbonelik({ db, cfg, now });
  const abonelikDurumu = (user, s) => {
    const site = s && s.site_id ? q.site.get(s.site_id) : null;
    return AB.durum(user.id, site, site ? etkinDurum(site) : null);
  };
  rota("GET", "/api/abonelik", "giris", ctx => ({ abonelik: abonelikDurumu(ctx.user, ctx.s), aboneId: AB.aboneIdAl(ctx.user.id) }));
  rota("POST", "/api/abonelik/yenile", "giris", async ctx => {
    if (!AB.saglayici) throw new Hata(503, "Mağaza aboneliği henüz yapılandırılmadı.");
    if (!izin("ab-yenile:" + ctx.user.id, 10, 60000)) throw new Hata(429, "Çok sık denendi. Biraz sonra tekrar deneyin.");
    try { await AB.yenile(ctx.user.id); } catch (e) { cfg.log("[abonelik]", e.message); throw new Hata(502, "Mağazaya ulaşılamadı. Biraz sonra tekrar deneyin."); }
    return { abonelik: abonelikDurumu(ctx.user, ctx.s) };
  });
  rota("POST", "/api/abonelik/webhook", null, async ctx => {
    const beklenen = cfg.abonelik.webhookAnahtari || "";
    if (!beklenen || !esit(ctx.req.headers.authorization || "", "Bearer " + beklenen)) throw new Hata(401, "Yetkisiz.");
    try { return { ok: true, islenen: await AB.webhook(ctx.body) }; }
    catch (e) { cfg.log("[abonelik webhook]", e.message); throw new Hata(502, "Sağlayıcı sorgulanamadı."); }
  }, { sunucudanSunucuya: true });

  // --- Belge deposu (Merter arayüzü) ---
  const BL = createBelgeler({ db, now, sirri: cfg.sessionSecret, abonelikAktif: (userId, siteId) => {
    const site = q.site.get(siteId); return !!site && AB.durum(userId, site, etkinDurum(site)).aktif;
  } });
  rota("POST", "/api/db", "uye", ctx => {
    if (["set", "update", "delete"].includes(ctx.body.op)) {
      if (etkinDurum(ctx.site) === "askida") throw new Hata(403, "Site aboneliği askıda: şu anda yalnızca görüntüleme yapılabilir.");
      if (!izin("db-yaz:" + ctx.user.id, 120, 60000)) throw new Hata(429, "Çok fazla kayıt isteği. Biraz bekleyin.");
    }
    return BL.islem(ctx, ctx.body);
  }, { govdeSiniri: 600 * 1024 });
  rota("GET", "/api/db/akis", "uye", ctx => BL.akis(ctx, ctx.url.searchParams.has("sonra") ? Number(ctx.url.searchParams.get("sonra")) : -1, cfg.akisBekleMs));
  rota("POST", "/api/varlik", "uye", ctx => {
    if (!izin("varlik:" + ctx.user.id, 20, 3600000)) throw new Hata(429, "Saatte en çok 20 fotoğraf yüklenebilir.");
    return BL.varlikYukle(ctx, ctx.body);
  }, { yazma: true, govdeSiniri: 4 * 1024 * 1024 + 4096 });
  rota("DELETE", "/api/varlik/:id", "uye", ctx => BL.varlikSil(ctx, ctx.params.id));
  /* Fotoğraf: <img> başlık gönderemediği için 128 bit rastgele kimlik bağlantının kendisidir (yalnızca site üyelerinin
     görebildiği gönderilerde yazar). */
  function varlikSun(req, res, id) {
    const v = BL.varlik(id);
    if (!v) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": v.tip, "Content-Length": v.boyut, "Cache-Control": "private, max-age=31536000, immutable", "Cross-Origin-Resource-Policy": "cross-origin" });
    res.end(req.method === "HEAD" ? undefined : v.veri);
  }

  /* Merter Çınar Evleri arayüzü tarayıcıdan: /m/ (telefon uygulamasıyla aynı kod). Satır içi betik kullandığı için
     bu yolda CSP 'unsafe-inline' içerir; dış kaynak yüklenmez. */
  const M_DOSYA = merterDosyalari(path.join(__dirname, ".."));
  const M_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
  function merterSun(req, res, url) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    const p = decodeURIComponent(url.pathname).slice(3);
    res.setHeader("Content-Security-Policy", M_CSP);
    if (p === "") {
      const site = (() => { try { const o = oturumYukle(req); return o && o.s.site_id ? siteYukle(o.s.site_id) : null; } catch (_) { return null; } })();
      const html = merterSayfasi({ kok: "/m/", mobil: false, ayarJs: `window.BS_AYAR=${JSON.stringify({ siteAdi: (site && (site.ayar.siteAdi || site.ad)) || "Merter Çınar Evleri" }).replace(/</g, "\\u003c")};` });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache, private" });
      return res.end(req.method === "HEAD" ? undefined : html);
    }
    const dosya = Object.prototype.hasOwnProperty.call(M_DOSYA, p) ? M_DOSYA[p] : null;
    if (!dosya) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Bulunamadı"); }
    const veri = fs.readFileSync(dosya);
    res.writeHead(200, { "Content-Type": MIME[path.extname(dosya)] || "application/octet-stream", "Content-Length": veri.length, "Cache-Control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : veri);
  }

  /* ---------- İstek işleyici ---------- */
  async function apiIsle(req, res, url) {
    const method = req.method === "HEAD" ? "GET" : req.method;
    let r = null, params = {};
    let yolVar = false;
    for (const x of rotalar) {
      const m = url.pathname.match(x.re);
      if (!m) continue;
      yolVar = true;
      if (x.method !== method) continue;
      r = x; x.anahtarlar.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break;
    }
    if (!r) throw new Hata(yolVar ? 405 : 404, yolVar ? "Yöntem desteklenmiyor." : "Bulunamadı.");
    const ctx = { req, res, url, params, body: {} };
    const yazmaIstegi = method !== "GET";
    if (yazmaIstegi) {
      // CSRF 1: Origin / Sec-Fetch-Site kontrolü
      const origin = req.headers.origin;
      const mobil = mobilIstek(req);
      if (!r.sunucudanSunucuya) {
        if (origin && origin !== beklenenOrigin(req) && !mobil) throw new Hata(403, "Geçersiz kaynak (Origin).");
        if (req.headers["sec-fetch-site"] === "cross-site" && !mobil) throw new Hata(403, "Siteler arası istek reddedildi.");
      }
      const ct = String(req.headers["content-type"] || "");
      if (!/^application\/json\b/i.test(ct)) throw new Hata(415, "İstek gövdesi application/json olmalı.");
      ctx.body = await govdeOku(req, r.govdeSiniri);
      if (!V.isObj(ctx.body)) throw new Hata(400, "İstek gövdesi nesne olmalı.");
    }
    if (r.yetki) {
      const o = oturumYukle(req);
      if (!o) throw new Hata(401, "Oturum açmanız gerekiyor.");
      ctx.s = o.s; ctx.user = o.user;
      // CSRF 2: oturuma bağlı token başlığı
      if (o.bearer && req.headers.cookie && cerezler(req)[CEREZ]) throw new Hata(400, "Çerez ve jeton birlikte gönderilemez.");
      if (yazmaIstegi && !o.bearer && !esit(req.headers["x-csrf-token"] || "", o.s.csrf)) throw new Hata(403, "CSRF doğrulaması başarısız. Sayfayı yenileyin.");
      if (r.yetki === "platform") {
        if (!o.user.platform_admin) throw new Hata(403, "Bu işlem yalnızca platform yöneticisine açık.");
      } else if (r.yetki !== "giris") {
        if (o.user.platform_admin) throw new Hata(403, "Platform yöneticisi site verisine erişemez.");
        const siteId = o.s.site_id;
        const uy = siteId ? q.uyelik.get(o.user.id, siteId) : null;
        if (!uy) throw new Hata(403, "Bir siteye üye değilsiniz. Davet koduyla katılın.");
        ctx.uyelik = uy; ctx.site = siteYukle(siteId);
        if (r.yetki === "yonetici" && uy.rol !== "site_yonetici") throw new Hata(403, "Bu işlem yalnızca site yöneticisine açık.");
        if (r.yetki === "yonetim" && !["site_yonetici", "site_denetci"].includes(uy.rol)) throw new Hata(403, "Bu bölüm yalnızca site yönetimine açık.");
        if (r.ozellik && !O.ozellikVar(ctx.site.plan, r.ozellik)) throw new Hata(403, O.ozellikMesaj(r.ozellik));
        if (r.yazma && etkinDurum(ctx.site) === "askida") throw new Hata(403, "Site aboneliği askıda: şu anda yalnızca görüntüleme yapılabilir.");
      }
    }
    const sonuc = await r.fn(ctx);
    if (sonuc && sonuc._ham !== undefined) {
      res.writeHead(200, { "Content-Type": sonuc._tip || "text/csv; charset=utf-8", "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${sonuc._dosya}"` });
      res.end(req.method === "HEAD" ? undefined : sonuc._ham);
      return;
    }
    json(res, 200, sonuc);
  }

  /* Eğitim içerikleri yalnızca "tam" paketli bir sitenin üyelerine servis edilir. */
  function egitimIzni(req) {
    const o = oturumYukle(req);
    if (!o || o.user.platform_admin || !o.s.site_id || !q.uyelik.get(o.user.id, o.s.site_id)) return false;
    const s = q.site.get(o.s.site_id);
    return !!s && O.ozellikVar(s.plan, "egitim");
  }
  function statik(req, res, url) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    let p = decodeURIComponent(url.pathname);
    let dosya;
    if (p === "/vendor/marked.min.js") dosya = MARKED_PATH;
    else if (/^\/s\/[A-Za-z0-9-]{1,20}\/?$/.test(p)) dosya = path.join(PUBLIC_DIR, "nasil-kullanilir.html");
    else if (p.startsWith("/md/") && !egitimIzni(req)) { res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }); return res.end(O.ozellikMesaj("egitim")); }
    else {
      if (p === "/" || !path.extname(p)) p = "/index.html";
      dosya = path.join(PUBLIC_DIR, path.normalize(p).replace(/^([/\\])+/, ""));
      if (!dosya.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(404); return res.end(); }
    }
    fs.stat(dosya, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Bulunamadı"); }
      const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
      if (req.headers["if-none-match"] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(dosya)] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache", ETag: etag });
      if (req.method === "HEAD") return res.end();
      fs.createReadStream(dosya).pipe(res);
    });
  }

  /* Sağlık kontrolü: veritabanına basit bir sorgu. Kişisel veri döndürmez. */
  function saglik(req, res) {
    let ok = false;
    try { ok = db.prepare("SELECT 1 AS bir").get().bir === 1 && !!db.prepare("SELECT surum FROM schema_surum").get(); } catch (e) { cfg.log("[sağlık]", e.message); }
    json(res, ok ? 200 : 503, ok ? { durum: "ok", zaman: new Date(now()).toISOString() } : { durum: "hata" });
  }
  /* PWA manifest: oturum açılmış ve bir siteye üye ise ad/kısa ad/tema rengi o siteden gelir. */
  function manifest(req, res) {
    let ad = "Bilinçli Sakin", tema = O.TEMALAR.yesil.l[0];
    try {
      const o = oturumYukle(req);
      if (o && !o.user.platform_admin && o.s.site_id && q.uyelik.get(o.user.id, o.s.site_id)) {
        const s = siteYukle(o.s.site_id);
        if (s) { ad = s.ayar.siteAdi || s.ad; tema = (O.TEMALAR[s.ayar.tema] || O.TEMALAR.yesil).l[0]; }
      }
    } catch (_) { /* varsayılan */ }
    const kisa = ad.length <= 12 ? ad : ad.split(/\s+/)[0].slice(0, 12);
    const m = { name: ad === "Bilinçli Sakin" ? ad : `${ad} · Bilinçli Sakin`, short_name: kisa, lang: "tr", dir: "ltr", start_url: "/", scope: "/", display: "standalone",
      background_color: "#F4F6F5", theme_color: tema, description: "Site sakinleri için profil, ortak alışveriş ve eğitim uygulaması.",
      icons: [{ src: "/ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }, { src: "/ikon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
    res.writeHead(200, { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "no-cache, private", Vary: "Cookie" });
    res.end(JSON.stringify(m));
  }

  async function handler(req, res) {
    guvenlikBasliklari(res);
    let url;
    try { url = new URL(req.url, "http://x"); } catch (_) { res.writeHead(400); return res.end(); }
    if (url.pathname === "/saglik") return saglik(req, res);
    if (url.pathname === "/manifest.webmanifest") return manifest(req, res);
    if (url.pathname === "/m") { res.writeHead(301, { Location: "/m/" }); return res.end(); }
    if (url.pathname.startsWith("/m/")) return merterSun(req, res, url);
    const vm = /^\/api\/varlik\/([0-9a-f]{32})$/.exec(url.pathname);
    if (vm && (req.method === "GET" || req.method === "HEAD")) return varlikSun(req, res, vm[1]);
    if (!url.pathname.startsWith("/api/")) return statik(req, res, url);
    if (mobilSet.has(req.headers.origin)) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin); res.setHeader("Vary", "Origin");
      if (req.method === "OPTIONS") {
        res.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Istemci", "Access-Control-Max-Age": "600" });
        return res.end();
      }
    }
    try { await apiIsle(req, res, url); }
    catch (e) {
      if (e instanceof Hata) { if (!res.headersSent) json(res, e.status, { hata: e.message, alan: e.alan }); }
      else { cfg.log("[HATA]", e && e.stack || e); if (!res.headersSent) json(res, 500, { hata: "Sunucu hatası." }); }
    }
  }

  return { handler, db, sms, cfg, siteYukle, davetOlustur, davetGoster };
}

module.exports = { createApp, csv };
