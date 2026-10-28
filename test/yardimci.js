"use strict";
const http = require("node:http");
const { openDb } = require("../src/db");
const { createApp } = require("../src/app");
const { bellekProvider } = require("../src/sms");

const ADMIN_TEL = "+905000000099";

async function sunucuBaslat({ limitler, config = {} } = {}) {
  const db = openDb(":memory:");
  const sms = bellekProvider();
  const saat = { kayma: 0 };
  const app = createApp({ db, sms, config: { sessionSecret: "t".repeat(48), platformAdminTelefonlari: [ADMIN_TEL], now: () => Date.now() + saat.kayma, log: () => {},
    limitler: limitler || { otpIp: 1e6, dogrulaIp: 1e6, davetKullanici: 1e6, davetIp: 1e6 }, ...config } });
  const server = http.createServer(app.handler);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, app, db, sms, saat, kapat: () => new Promise(r => server.close(r)) };
}

class Istemci {
  constructor(ctx) { this.ctx = ctx; this.cerez = ""; this.csrf = ""; this.me = null; }
  async istek(method, yol, body, { csrf = true, basliklar = {}, ham } = {}) {
    const h = { ...basliklar };
    if (this.cerez) h.cookie = this.cerez;
    if (method !== "GET" && h["content-type"] === undefined) h["content-type"] = "application/json";
    if (method !== "GET" && csrf && this.csrf) h["x-csrf-token"] = this.csrf;
    const r = await fetch(this.ctx.base + yol, { method, headers: h, body: ham !== undefined ? ham : (method === "GET" ? undefined : JSON.stringify(body || {})) });
    const sc = r.headers.get("set-cookie");
    if (sc) { const m = sc.match(/sid=([^;]*)/); if (m) this.cerez = m[1] ? "sid=" + m[1] : ""; }
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (_) { /* csv vb. */ }
    return { status: r.status, body: json, text, headers: r.headers };
  }
  get(y, o) { return this.istek("GET", y, undefined, o); }
  post(y, b, o) { return this.istek("POST", y, b, o); }
  put(y, b, o) { return this.istek("PUT", y, b, o); }
  patch(y, b, o) { return this.istek("PATCH", y, b, o); }
  del(y, b, o) { return this.istek("DELETE", y, b, o); }
  async yenile() { const r = await this.get("/api/me"); this.me = r.body && r.body.user ? r.body : null; if (this.me) this.csrf = r.body.csrf; return r; }
  async giris(tel) {
    const a = await this.post("/api/auth/otp-iste", { telefon: tel });
    if (a.status !== 200) throw new Error("otp-iste " + a.status + " " + a.text);
    const kod = this.ctx.sms.sonKod(a.body.telefon);
    const b = await this.post("/api/auth/otp-dogrula", { telefon: tel, kod });
    if (b.status !== 200) throw new Error("otp-dogrula " + b.status + " " + b.text);
    await this.yenile();
    return this;
  }
  async katil(kod) { const r = await this.post("/api/davet/kullan", { kod }); if (r.status !== 200) throw new Error("katil " + r.status + " " + r.text); await this.yenile(); return r; }
}

/* İki site, yöneticiler, denetçi ve sakinlerle hazır ortam. Her telefon testte benzersiz olmalı (OTP dakika sınırı). */
let sayac = 0;
const tel = () => "+90501" + String(1000000 + (++sayac)).slice(-7);

async function ortam(ctx) {
  const admin = await new Istemci(ctx).giris(ADMIN_TEL.replace("+90", "0"));
  const sA = await admin.post("/api/platform/siteler", { ad: "Site A", plan: "tam" });
  const sB = await admin.post("/api/platform/siteler", { ad: "Site B", plan: "tam" });
  const yonA = await new Istemci(ctx).giris(tel()); await yonA.katil(sA.body.davetKodu);
  const yonB = await new Istemci(ctx).giris(tel()); await yonB.katil(sB.body.davetKodu);
  const davetA = (await yonA.post("/api/yonetim/davetler", { rol: "sakin", maxKullanim: 50, gun: 14 })).body.kod;
  const davetB = (await yonB.post("/api/yonetim/davetler", { rol: "sakin", maxKullanim: 50, gun: 14 })).body.kod;
  const denA = (await yonA.post("/api/yonetim/davetler", { rol: "site_denetci" })).body.kod;
  const sakinA1 = await new Istemci(ctx).giris(tel()); await sakinA1.katil(davetA);
  const sakinA2 = await new Istemci(ctx).giris(tel()); await sakinA2.katil(davetA);
  const sakinB1 = await new Istemci(ctx).giris(tel()); await sakinB1.katil(davetB);
  const denetciA = await new Istemci(ctx).giris(tel()); await denetciA.katil(denA);
  return { admin, siteA: sA.body.site, siteB: sB.body.site, yonA, yonB, sakinA1, sakinA2, sakinB1, denetciA, davetA, davetB };
}

const profilOrnek = (ek = {}) => ({ ad: "Örnek Sakin", telefon: "0500 000 00 00", blok: "A", kat: 2, daire: "5", durum: "Malik", tasinma: 2010,
  bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "Çalışıyor" }], yardim: false, yardimNot: "", kvkk: true, ek: {}, ...ek });

module.exports = { sunucuBaslat, Istemci, ortam, tel, profilOrnek, ADMIN_TEL };
