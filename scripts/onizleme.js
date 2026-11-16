"use strict";
/* Önizleme sunucusu (yalnızca geliştirme): merter/index.html arayüzünü girişsiz, tarayıcıda saklanan DEMO veriyle açar.
   Gerçek sunucu, SMS girişi ve Arena burada yoktur; veriler kurmacadır ve yalnızca bu tarayıcıda (localStorage) durur.
   Kullanım: node scripts/onizleme.js [port]   →  /  (sakin)   /?rol=yonetici  (yönetici)   /?sifirla=1  (demo veriyi sıfırla) */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const KAYNAK = path.join(__dirname, "..", "merter", "index.html");
const PORT = +(process.argv[2] || process.env.PORT || 4173);

const DEMO = {
  "ayarlar/site": { hikmet: true, siteAdi: "Merter Çınar Evleri", tema: "yesil", karsilama: "ÖNİZLEME: veriler örnektir.", duyuru: "", aidat: 2500, isDurumuSor: true, telefonZorunlu: false, hazir: [], ozel: [], gizliModul: [],
    iletisim: [{ ad: "Yönetim ofisi (DEMO)", tel: "0500 000 00 99" }], bloklar: ["A", "B", "C", "D", "E"].map(ad => ({ ad, minKat: 0, maxKat: 5, daire: 12 })) },
  "ayarlar/katalog": { tur: { id: "t-demo", ad: "Cumartesi pazarı (DEMO)", sonTarih: "", teslim: "Cumartesi 14:00, blok girişleri", acik: true }, urunler: [
    { id: "p1", ad: "Domates", kat: "pazar", alt: "Sebze", birim: "kg", fiyat: 30, aktif: true }, { id: "p2", ad: "Elma", kat: "pazar", alt: "Meyve", birim: "kg", fiyat: 35, aktif: true },
    { id: "m1", ad: "Süt", kat: "market", alt: "Süt ve kahvaltılık", birim: "litre", fiyat: 35, aktif: true }, { id: "m2", ad: "Ekmek", kat: "market", alt: "Temel gıda", birim: "adet", fiyat: 12.5, aktif: true },
    { id: "k1", ad: "Dana kıyma", kat: "kasap", alt: "Dana", birim: "kg", fiyat: "", tedarikci: "Anlaşmalı kasap (DEMO)", aktif: true }, { id: "k2", ad: "Piliç but", kat: "kasap", alt: "Tavuk ve hindi", birim: "kg", fiyat: "", tedarikci: "Anlaşmalı kasap (DEMO)", aktif: true }] },
  "sakinler/demo-sakin": { ad: "Örnek Sakin", telefon: "", blok: "C", kat: 5, daire: "12", durum: "Malik", tasinma: 2015, bireyler: [{ yakinlik: "Kendisi", yas: "18–64", is: "" }], yardim: false, yardimNot: "", kvkk: true, ek: {} }
};

function sayfa() {
  const govde = fs.readFileSync(KAYNAK, "utf8");
  const stub = `<script>
(function(){
  const q=new URLSearchParams(location.search),admin=q.get("rol")==="yonetici",uid=admin?"demo-yonetici":"demo-sakin",AN="bss-onizleme-depo";
  if(q.get("sifirla")){try{localStorage.removeItem(AN)}catch(e){}}
  let store;try{store=JSON.parse(localStorage.getItem(AN)||"null")}catch(e){}
  if(!store||typeof store!=="object")store=${JSON.stringify(DEMO)};
  const yaz=()=>{try{localStorage.setItem(AN,JSON.stringify(store))}catch(e){}},subs=[];
  const OZEL=["sakinler","sepetler","magazaSiparis","firsatOneri","hizmetSiparis"];
  const oku=p=>{if(admin)return true;const [c,id]=p.split("/");return OZEL.includes(c)?id===uid:true};
  const yazar=p=>{if(admin)return true;const [c,id]=p.split("/");if(c==="ayarlar"||c==="lisans")return false;return id===uid||!OZEL.includes(c)};
  const snap=p=>{const ex=(p in store)&&oku(p);return {id:p.split("/").pop(),exists:ex,data:()=>ex?JSON.parse(JSON.stringify(store[p])):undefined,metadata:{}}};
  const fire=()=>{yaz();subs.forEach(s=>s())},red=()=>Promise.reject({code:"invalid_argument",message:"denied"});
  const merge=(a,b)=>{for(const k in b){if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==="object")merge(a[k],b[k]);else a[k]=JSON.parse(JSON.stringify(b[k]))}return a};
  const db={doc:p=>({get:async()=>snap(p),set:async d=>{if(!yazar(p))return red();store[p]=JSON.parse(JSON.stringify(d));fire()},
      update:async d=>{if(!yazar(p)||!(p in store))return red();merge(store[p],d);fire()},delete:async()=>{if(!yazar(p))return red();delete store[p];fire()},
      onSnapshot:n=>{const f=()=>n(snap(p));subs.push(f);setTimeout(f,0);return()=>{}}}),
    collection:c=>({onSnapshot:n=>{const f=()=>n({docs:Object.keys(store).filter(k=>k.startsWith(c+"/")&&k.split("/").length===2&&oku(k)).map(snap)});subs.push(f);setTimeout(f,0);return()=>{}}})};
  window.claude={use:async n=>n==="db"?db:n==="user"?{id:async()=>uid,canEdit:async()=>admin,isOwner:async()=>admin}:null};
  addEventListener("DOMContentLoaded",()=>{const b=document.createElement("div");b.style.cssText="position:sticky;top:0;z-index:99;background:#17181A;color:#F4F2EC;font:13px/1.4 system-ui,sans-serif;padding:8px 12px;display:flex;gap:12px;flex-wrap:wrap;align-items:center";
    b.innerHTML="<b>ÖNİZLEME · demo veri</b><span>"+(admin?"Yönetici":"Sakin")+" görünümü</span><a style='color:#D8C08C' href='"+(admin?"./":"./?rol=yonetici")+"'>"+(admin?"Sakin olarak aç":"Yönetici olarak aç")+"</a><a style='color:#D8C08C' href='./?sifirla=1"+(admin?"&rol=yonetici":"")+"'>Demo veriyi sıfırla</a>";document.body.prepend(b)});
})();
</script>`;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bilinçli Sakin · Önizleme</title><style>[hidden]{display:none!important}body{margin:0}</style></head><body>${stub}${govde}</body></html>`;
}

http.createServer((req, res) => {
  const yol = new URL(req.url, "http://x").pathname;
  if (yol === "/" || yol === "/index.html") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return res.end(sayfa()); }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); res.end("Bulunamadı");
}).listen(PORT, "0.0.0.0", () => console.log(`Önizleme: http://localhost:${PORT}/  (yönetici: /?rol=yonetici)`));
