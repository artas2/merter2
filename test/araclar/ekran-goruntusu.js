"use strict";
/* Önce/sonra karşılaştırması için ekran görüntüsü aracı (test değil, elle çalıştırılır).
   node test/araclar/ekran-goruntusu.js <önek> [genislikler, ör. 390,320,1280] [koyu]
   Geçici veritabanına DEMO verisi kurar, sunucuyu başlatır, sakin ve yönetici ekranlarını kaydeder, sonra her şeyi siler. */
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright");

const KOK = path.join(__dirname, "..", "..");
const SS = path.join(KOK, "docs", "screenshots");
const onek = process.argv[2] || "ekran";
const genislikler = (process.argv[3] || "390").split(",").map(Number);
const koyuDa = process.argv[4] === "koyu";
const PORT = 4200 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const bekle = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bsakin-ekran-"));
  const env = { ...process.env, DB_PATH: path.join(tmp, "e.sqlite"), PORT: String(PORT), HOST: "127.0.0.1", SMS_PROVIDER: "konsol", NODE_ENV: "development", SESSION_SECRET: "ekran".repeat(10) };
  const seed = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/seed-demo.js"], { cwd: KOK, env, encoding: "utf8" });
  const davet = /Sakin davet kodu: ([A-Z0-9-]+)/.exec(seed.stdout)[1];
  let log = "";
  const srv = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], { cwd: KOK, env });
  srv.stdout.on("data", d => { log += d; }); srv.stderr.on("data", d => { log += d; });
  for (let i = 0; i < 100 && !log.includes("çalışıyor"); i++) await bekle(50);
  const browser = await chromium.launch();
  const kayit = [];
  async function giris(page, tel, kod) {
    await page.goto(BASE + "/");
    await page.fill("#g-tel", tel);
    await page.click('button:text-is("Kod gönder")');
    await page.waitForSelector("#g-kod");
    const e = "+90" + tel.replace(/\D/g, "").slice(1);
    let otp = null; for (let i = 0; i < 100 && !otp; i++) { const m = [...log.matchAll(/\[SMS:konsol\] (\+\d+) -> .*?(\d{6})/g)].filter(x => x[1] === e).pop(); otp = m && m[2]; if (!otp) await bekle(50); }
    await page.fill("#g-kod", otp);
    await page.click('button:text-is("Giriş yap")');
    if (kod) { await page.waitForSelector("#d-kod"); await page.fill("#d-kod", kod); await page.click('button:text-is("Katıl")'); }
    await page.waitForTimeout(600);
  }
  const ss = async (page, ad) => { const f = path.join(SS, `${onek}-${ad}.png`); await page.screenshot({ path: f, fullPage: !!process.env.TAM_SAYFA }); kayit.push(f); };
  const git = async (page, h) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(500); };
  // Her kullanıcı bir kez giriş yapar (OTP hız sınırları); oturum çerezi diğer genişlik/tema bağlamlarında yeniden kullanılır.
  const durumlar = {};
  for (const [ad, tel, kod] of [["sakin", "0500 000 00 01"], ["yonetici", "0500 000 00 00"], ["yeni", "0503 000 00 10", davet]]) {
    const c = await browser.newContext({ viewport: { width: 390, height: 780 } }); const p = await c.newPage();
    await giris(p, tel, kod); durumlar[ad] = await c.storageState(); await c.close();
  }
  const baglam = (ad, G, koyu) => browser.newContext({ storageState: durumlar[ad], viewport: { width: G, height: G >= 1000 ? 860 : 780 }, colorScheme: koyu ? "dark" : "light" });
  for (const G of genislikler) {
    for (const koyu of koyuDa ? [false, true] : [false]) {
      const tag = `${G}${koyu ? "-koyu" : ""}`;
      const ctx = await baglam("sakin", G, koyu); const p = await ctx.newPage();
      await p.goto(BASE + "/"); await p.waitForTimeout(700);
      await ss(p, `${tag}-ana`);
      await git(p, "#profil"); await ss(p, `${tag}-profil`);
      await git(p, "#sepet"); await ss(p, `${tag}-sepet`);
      const cb = await p.$(".cartbar button"); if (cb) { await cb.click(); await p.waitForTimeout(400); await ss(p, `${tag}-sepetim`); }
      await git(p, "#hesap"); await ss(p, `${tag}-hesap`);
      if (await p.$("#altbar")) { await git(p, "#diger"); await ss(p, `${tag}-diger`); }
      await ctx.close();
      const y = await baglam("yonetici", G, koyu); const yp = await y.newPage();
      await yp.goto(BASE + "/"); await yp.waitForTimeout(700);
      await git(yp, "#ozet"); await ss(yp, `${tag}-yonetim-ozet`);
      await git(yp, "#sakinler"); await ss(yp, `${tag}-yonetim-sakinler`);
      await y.close();
      const yeni = await baglam("yeni", G, koyu); const np = await yeni.newPage();
      await np.goto(BASE + "/"); await np.waitForTimeout(700);
      await ss(np, `${tag}-yeni-sakin`);
      await yeni.close();
    }
  }
  await browser.close(); srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(kayit.map(f => path.relative(KOK, f)).join("\n"));
})().catch(e => { console.error(e); process.exit(1); });
