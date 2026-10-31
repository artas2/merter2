"use strict";
/* Yük testi: N eşzamanlı sakin aynı sitede (en kötü durum: hepsi tek sitede, tek oda).
   Kullanım: node scripts/yuk-testi.js --kisi 1000 --sure 90 [--konusan 0.1] [--duello 0.4]
   - Sunucu ayrı süreçte, geçici veritabanıyla başlar. Kullanıcılar ve oturumlar doğrudan veritabanına yazılır (SMS yok).
   - Her sakin: site sohbetini uzun yoklamayla dinler, 30 sn'de bir arena özetini çeker.
     "konusan" oranı kadar sakin 8–20 sn'de bir mesaj yazar; "duello" oranı kadar sakin art arda düello oynar.
   - Ölçülen: istek gecikmeleri (p50/p95/p99), hata sayısı, mesajın yazılmasından diğer sakinlere ulaşmasına kadar geçen süre,
     tamamlanan maç ve cevap sayısı, sunucu sürecinin CPU ve bellek kullanımı.
   İstemciler ve sunucu aynı makinede çalıştığı için sonuçlar temkinlidir (istemciler de CPU harcar). */
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const arg = (ad, v) => { const i = process.argv.indexOf("--" + ad); return i > 0 ? Number(process.argv[i + 1]) : v; };
const YOKLAMA = process.argv.includes("--yoklama");
const KISI = arg("kisi", 1000), SURE = arg("sure", 90) * 1000, KONUSAN = arg("konusan", 0.1), DUELLO = arg("duello", 0.4);
const PORT = 4700 + Math.floor(Math.random() * 200), SIRRI = "yuk-testi-".repeat(5);
const KOK = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-yuk-"));
const DB_PATH = path.join(tmp, "yuk.sqlite");

function kur() {
  const { openDb } = require("../src/db");
  const { kur: siteKur } = require("./kur-site.js");
  const db = openDb(DB_PATH), now = Date.now();
  const r = siteKur(["--ad", "Yük Sitesi", "--bloklar", "A,B,C,D,E", "--daire", "200", "--kat", "0-20"], { db, now });
  db.prepare("UPDATE sites SET odeme_modeli = 'site', durum = 'aktif' WHERE id = ?").run(r.siteId);
  const kimlik = u => "u" + crypto.createHmac("sha256", SIRRI).update(`kimlik:${r.siteId}:${u}`).digest("hex").slice(0, 20);
  const uEkle = db.prepare("INSERT INTO users (telefon, platform_admin, olusturma) VALUES (?, 0, ?)");
  const uyEkle = db.prepare("INSERT INTO uyelikler (user_id, site_id, rol, olusturma) VALUES (?, ?, 'sakin', ?)");
  const sEkle = db.prepare("INSERT INTO sessions (id_hash, user_id, site_id, csrf, bitis, olusturma) VALUES (?, ?, ?, 'x', ?, ?)");
  const bEkle = db.prepare("INSERT INTO belgeler (site_id, koleksiyon, belge_id, veri, sira, guncelleme) VALUES (?, 'sakinler', ?, ?, ?, ?)");
  const kisiler = [];
  db.exec("BEGIN");
  for (let i = 0; i < KISI; i++) {
    const id = Number(uEkle.run("+90599" + String(1000000 + i).slice(-7), now).lastInsertRowid);
    uyEkle.run(id, r.siteId, now);
    const tok = crypto.randomBytes(32).toString("base64url");
    sEkle.run(crypto.createHash("sha256").update(tok).digest("hex"), id, r.siteId, now + 864e5, now);
    bEkle.run(r.siteId, kimlik(id), JSON.stringify({ ad: "Sakin " + i, blok: "ABCDE"[i % 5], kat: 1, daire: String(i % 200 + 1), durum: "Malik" }), 100 + i, now);
    kisiler.push({ id, tok });
  }
  db.prepare("UPDATE belge_sira SET sira = ? WHERE site_id = ?").run(100 + KISI, r.siteId);
  db.exec("COMMIT"); db.close();
  return kisiler;
}

const ajan = new http.Agent({ keepAlive: true, maxSockets: Infinity, keepAliveMsecs: 30000 });
const olcum = new Map(), hatalar = new Map();
let istekSay = 0;
function kaydet(ad, ms) { let a = olcum.get(ad); if (!a) { a = []; olcum.set(ad, a); } a.push(ms); }
function istek(tok, method, yol, body, etiket) {
  return new Promise(coz => {
    const t0 = performance.now(), veri = body ? JSON.stringify(body) : null;
    const r = http.request({ host: "127.0.0.1", port: PORT, method, path: yol, agent: ajan,
      headers: { Authorization: "Bearer " + tok, Origin: "capacitor://localhost", "X-Istemci": "mobil", ...(veri ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(veri) } : {}) } }, res => {
      const p = []; res.on("data", c => p.push(c)); res.on("end", () => {
        istekSay++; const ms = performance.now() - t0;
        if (etiket) kaydet(etiket, ms);
        let j = null; try { j = JSON.parse(Buffer.concat(p).toString()); } catch (_) { /* boş */ }
        if (res.statusCode >= 500 || (res.statusCode >= 400 && res.statusCode !== 409 && res.statusCode !== 429)) hatalar.set(`${etiket || yol.split("?")[0]} ${res.statusCode}`, (hatalar.get(`${etiket || yol.split("?")[0]} ${res.statusCode}`) || 0) + 1);
        coz({ s: res.statusCode, j });
      });
    });
    r.on("error", e => { hatalar.set("ağ " + e.code, (hatalar.get("ağ " + e.code) || 0) + 1); coz({ s: 0, j: null }); });
    r.setTimeout(40000, () => r.destroy(new Error("zaman aşımı")));
    if (veri) r.write(veri); r.end();
  });
}
const yuzde = (a, p) => { if (!a || !a.length) return null; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]); };
const bekle = ms => new Promise(r => setTimeout(r, ms));
let calisiyor = true;
const teslim = []; let maclarBitti = 0, cevaplar = 0, gonderilen = 0;

async function dinleyici(k) {
  let sonra = null, surum = 0;
  while (calisiyor) {
    const q = sonra === null ? "" : `?sonra=${sonra}&surum=${surum}&bekle=1`;
    const r = await istek(k.tok, "GET", "/api/sohbet/oda/site" + q, null, sonra === null ? "sohbet ilk okuma" : null);
    if (r.s !== 200) { await bekle(1000); continue; }
    const simdi = Date.now();
    if (sonra !== null) for (const m of r.j.mesajlar) { const t = /t=(\d+)/.exec(m.metin); if (t && teslim.length < 2e6) teslim.push(simdi - Number(t[1])); }
    sonra = r.j.sonId; surum = r.j.surum;
  }
}
/* Canlı akış (SSE): tek bağlantı açık kalır, mesajlar itilir */
const akislar = new Set();
function dinleyiciAkis(k) {
  return new Promise(bitti => {
    const ac = () => {
      if (!calisiyor) return bitti();
      const t0 = performance.now();
      const r = http.request({ host: "127.0.0.1", port: PORT, method: "GET", path: "/api/sohbet/oda/site/akis", agent: false,
        headers: { Authorization: "Bearer " + k.tok, Origin: "capacitor://localhost", "X-Istemci": "mobil" } }, res => {
        istekSay++;
        if (res.statusCode !== 200) { hatalar.set("akış " + res.statusCode, (hatalar.get("akış " + res.statusCode) || 0) + 1); res.resume(); return setTimeout(ac, 1000); }
        let tampon = "", ilk = true; akislar.add(r);
        res.setEncoding("utf8");
        res.on("data", d => {
          tampon += d; let i;
          while ((i = tampon.indexOf("\n\n")) >= 0) {
            const o = tampon.slice(0, i); tampon = tampon.slice(i + 2);
            const v = o.split("\n").filter(l => l.startsWith("data: ")).map(l => l.slice(6)).join("");
            if (!v) continue;
            const simdi = Date.now(), j = JSON.parse(v);
            if (ilk) { kaydet("sohbet akış açılış", performance.now() - t0); ilk = false; continue; }
            for (const m of j.mesajlar) { const t = /t=(\d+)/.exec(m.metin); if (t && teslim.length < 3e6) teslim.push(simdi - Number(t[1])); }
          }
        });
        res.on("end", () => { akislar.delete(r); if (calisiyor) setTimeout(ac, 500); else bitti(); });
      });
      r.on("error", e => { akislar.delete(r); if (calisiyor) { hatalar.set("akış ağ " + e.code, (hatalar.get("akış ağ " + e.code) || 0) + 1); setTimeout(ac, 1000); } else bitti(); });
      r.end();
    };
    ac();
  });
}
async function konusan(k) {
  await bekle(Math.random() * 10000);
  while (calisiyor) {
    const r = await istek(k.tok, "POST", "/api/sohbet/oda/site", { metin: `Merhaba komşular t=${Date.now()}` }, "sohbet mesaj gönder");
    if (r.s === 200) gonderilen++;
    await bekle(8000 + Math.random() * 12000);
  }
}
async function ozetci(k) {
  await bekle(Math.random() * 30000);
  while (calisiyor) { await istek(k.tok, "GET", "/api/arena/ozet", null, "arena özet"); await bekle(30000); }
}
async function duellocu(k) {
  await bekle(Math.random() * 5000);
  while (calisiyor) {
    let r = await istek(k.tok, "POST", "/api/arena/esles", {}, "eşleşme isteği");
    let mac = r.j && r.j.durum === "mac" ? r.j.macId : null;
    // Rakip bulununca 10 sn içinde "Kabul" (gerçek kullanıcı gibi); bilinen durum uzun yoklamaya iletilir
    while (!mac && calisiyor && r.j) {
      if (r.j.durum === "mac") { mac = r.j.macId; break; }
      if (r.j.durum === "teklif" && !r.j.benKabul) { r = await istek(k.tok, "POST", "/api/arena/esles/kabul", { teklifId: r.j.teklifId }, "eşleşme kabulü"); continue; }
      if (!["bekliyor", "teklif"].includes(r.j.durum)) break;
      r = await istek(k.tok, "GET", "/api/arena/esles?bilinen=" + encodeURIComponent(r.j.anahtar || ""), null, null);
    }
    if (!mac) continue;
    let ver = "", cevaplanan = new Set();
    while (calisiyor) {
      const g = await istek(k.tok, "GET", `/api/arena/mac/${mac}${ver === "" ? "" : "?ver=" + ver}`, null, null);
      if (!g.j || g.s !== 200) { await bekle(500); continue; }
      ver = g.j.ver;
      if (g.j.bitti) { maclarBitti++; break; }
      if (g.j.soru && !g.j.soru.cevapladim && !cevaplanan.has(g.j.soru.no)) {
        cevaplanan.add(g.j.soru.no); const no = g.j.soru.no;
        await bekle(500 + Math.random() * 2500);
        const c = await istek(k.tok, "POST", `/api/arena/mac/${mac}/cevap`, { soruNo: no, secim: Math.floor(Math.random() * 4) }, "düello cevap");
        if (c.s === 200) cevaplar++;
      }
    }
  }
}

function surecOlc(pid) {
  try {
    const st = fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ");
    const cpu = (Number(st[11]) + Number(st[12])) / 100, rss = Number(fs.readFileSync(`/proc/${pid}/statm`, "utf8").split(" ")[1]) * 4096;
    return { cpu, rss };
  } catch (_) { return null; }
}

(async () => {
  console.log(`Kurulum: ${KISI} sakin…`);
  const kisiler = kur();
  const env = { ...process.env, DB_PATH, PORT: String(PORT), HOST: "127.0.0.1", SESSION_SECRET: SIRRI, NODE_ENV: "development", SMS_PROVIDER: "konsol",
    ARENA_SORU_MS: "5000", ARENA_ARA_MS: "1000", ARENA_GERI_SAYIM_MS: "1000" };
  const s = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], { cwd: KOK, env });
  let slog = ""; s.stdout.on("data", d => { slog += d; }); s.stderr.on("data", d => { slog += d; });
  for (let i = 0; i < 100 && !slog.includes("çalışıyor"); i++) await bekle(50);
  console.log(`Sunucu hazır (pid ${s.pid}). ${SURE / 1000} sn yük: ${KISI} dinleyici, ${Math.round(KISI * KONUSAN)} konuşan, ${Math.round(KISI * DUELLO)} düellocu.`);
  const bas = surecOlc(s.pid), t0 = Date.now(), ornek = [];
  const zam = setInterval(() => { const m = surecOlc(s.pid); if (m) ornek.push({ t: Date.now(), ...m }); }, 2000);
  const isler = [];
  kisiler.forEach((k, i) => {
    isler.push(YOKLAMA ? dinleyici(k) : dinleyiciAkis(k), ozetci(k));
    if (i < KISI * KONUSAN) isler.push(konusan(k));
    else if (i < KISI * (KONUSAN + DUELLO)) isler.push(duellocu(k));
  });
  await bekle(SURE); calisiyor = false;
  for (const r of akislar) r.destroy();
  const son = surecOlc(s.pid); clearInterval(zam);
  const sure = (Date.now() - t0) / 1000;
  // Uzun yoklamalar en geç 20 sn içinde döner
  await Promise.race([Promise.all(isler), bekle(25000)]);
  s.kill("SIGTERM");
  const cpuYuzde = bas && son ? Math.round((son.cpu - bas.cpu) / sure * 100) : null;
  const sonuc = {
    tarih: new Date().toISOString(), makine: { cpu: os.cpus().length + " çekirdek " + os.cpus()[0].model.trim(), bellek: Math.round(os.totalmem() / 2 ** 30) + " GB", node: process.version },
    kisi: KISI, sohbetYontemi: YOKLAMA ? "uzun yoklama" : "canlı akış (SSE)", sureSn: Math.round(sure), istek: istekSay, istekSaniye: Math.round(istekSay / sure),
    gecikmeMs: Object.fromEntries([...olcum].map(([k, a]) => [k, { adet: a.length, p50: yuzde(a, 50), p95: yuzde(a, 95), p99: yuzde(a, 99) }])),
    sohbet: { gonderilen, teslim: teslim.length, teslimSaniye: Math.round(teslim.length / sure), gecikmeMs: { p50: yuzde(teslim, 50), p95: yuzde(teslim, 95), p99: yuzde(teslim, 99) } },
    duello: { biten: maclarBitti, cevap: cevaplar },
    sunucu: { cpuYuzde, enYuksekRssMB: Math.round(Math.max(...ornek.map(o => o.rss), son ? son.rss : 0) / 2 ** 20) },
    hatalar: Object.fromEntries(hatalar)
  };
  console.log(JSON.stringify(sonuc, null, 2));
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})();
