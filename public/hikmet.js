"use strict";
/* Hikmet: günün ayeti ve hadisi, Hikmet sayfası ve duvar kâğıdı. app.js ile aynı genel kapsamı kullanır (esc, ik, AYAR, ME, render, bildir, BS). */

/* Arapça metinler ve anlamlar, bilinen kısa ayet/hadislerden seçilmiştir; yayımdan önce bir din görevlisi ya da Diyanet kaynaklarıyla kontrol edilmelidir. */
const HK_TEMALAR={umut:"Umut",huzur:"Huzur",sukur:"Şükür",sabir:"Sabır",komsuluk:"Komşuluk",ilim:"İlim",bereket:"Bereket",temizlik:"Temizlik",kolaylik:"Kolaylık"};
const HK=[
 {id:"a1",tip:"ayet",tema:"umut",ar:"فَإِنَّ مَعَ الْعُسْرِ يُسْرًا إِنَّ مَعَ الْعُسْرِ يُسْرًا",tr:"Elbette zorluğun yanında bir kolaylık vardır. Gerçekten, zorluğun yanında bir kolaylık vardır.",kaynak:"İnşirâh, 94/5-6"},
 {id:"h1",tip:"hadis",tema:"komsuluk",ar:"لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",tr:"Hiçbiriniz, kendisi için istediğini kardeşi için de istemedikçe (gerçek anlamda) iman etmiş olmaz.",kaynak:"Buhârî, Îmân; Müslim, Îmân"},
 {id:"a2",tip:"ayet",tema:"huzur",ar:"أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",tr:"Dikkat edin! Kalpler ancak Allah'ı anmakla huzur bulur.",kaynak:"Ra'd, 13/28"},
 {id:"h2",tip:"hadis",tema:"temizlik",ar:"الطُّهُورُ شَطْرُ الْإِيمَانِ",tr:"Temizlik imanın yarısıdır.",kaynak:"Müslim, Tahâret"},
 {id:"a3",tip:"ayet",tema:"sukur",ar:"لَئِنْ شَكَرْتُمْ لَأَزِيدَنَّكُمْ",tr:"Eğer şükrederseniz, elbette size nimetimi artırırım.",kaynak:"İbrâhîm, 14/7 (ayetin bir bölümü)"},
 {id:"h3",tip:"hadis",tema:"komsuluk",ar:"مَا زَالَ جِبْرِيلُ يُوصِينِي بِالْجَارِ حَتَّى ظَنَنْتُ أَنَّهُ سَيُوَرِّثُهُ",tr:"Cebrail bana komşuyu o kadar tavsiye etti ki, onu mirasçı kılacak zannettim.",kaynak:"Buhârî, Edeb; Müslim, Birr"},
 {id:"a4",tip:"ayet",tema:"komsuluk",ar:"وَالْجَارِ ذِي الْقُرْبَىٰ وَالْجَارِ الْجُنُبِ",tr:"(…) Yakın komşuya ve uzak komşuya (iyilik edin).",kaynak:"Nisâ, 4/36 (ayetin bir bölümü)"},
 {id:"h4",tip:"hadis",tema:"kolaylik",ar:"يَسِّرُوا وَلَا تُعَسِّرُوا وَبَشِّرُوا وَلَا تُنَفِّرُوا",tr:"Kolaylaştırın, zorlaştırmayın; müjdeleyin, nefret ettirmeyin.",kaynak:"Buhârî, İlim; Müslim, Cihâd"},
 {id:"a5",tip:"ayet",tema:"sabir",ar:"إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",tr:"Şüphesiz Allah sabredenlerle beraberdir.",kaynak:"Bakara, 2/153 (ayetin bir bölümü)"},
 {id:"h5",tip:"hadis",tema:"komsuluk",ar:"مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلَا يُؤْذِ جَارَهُ",tr:"Allah'a ve ahiret gününe iman eden kimse komşusuna eziyet etmesin.",kaynak:"Buhârî, Edeb; Müslim, Îmân"},
 {id:"a6",tip:"ayet",tema:"komsuluk",ar:"وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ",tr:"İyilik ve takva üzere yardımlaşın.",kaynak:"Mâide, 5/2 (ayetin bir bölümü)"},
 {id:"h6",tip:"hadis",tema:"ilim",ar:"خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",tr:"Sizin en hayırlınız, Kur'an'ı öğrenen ve öğretendir.",kaynak:"Buhârî, Fezâilü'l-Kur'ân"},
 {id:"a7",tip:"ayet",tema:"bereket",ar:"وَكُلُوا وَاشْرَبُوا وَلَا تُسْرِفُوا",tr:"Yiyin, için, israf etmeyin.",kaynak:"A'râf, 7/31 (ayetin bir bölümü)"},
 {id:"h7",tip:"hadis",tema:"komsuluk",ar:"تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ",tr:"Kardeşinin yüzüne tebessüm etmen senin için sadakadır.",kaynak:"Tirmizî, Birr"},
 {id:"a8",tip:"ayet",tema:"sabir",ar:"لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",tr:"Allah, kimseye gücünün yeteceğinden fazlasını yüklemez.",kaynak:"Bakara, 2/286 (ayetin bir bölümü)"},
 {id:"h8",tip:"hadis",tema:"sabir",ar:"إِنَّمَا الصَّبْرُ عِنْدَ الصَّدْمَةِ الْأُولَىٰ",tr:"Asıl sabır, musibetin ilk sarsıntısı anındaki sabırdır.",kaynak:"Buhârî, Cenâiz; Müslim, Cenâiz"},
 {id:"a9",tip:"ayet",tema:"komsuluk",ar:"إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ فَأَصْلِحُوا بَيْنَ أَخَوَيْكُمْ",tr:"Müminler ancak kardeştirler. O halde kardeşlerinizin arasını düzeltin.",kaynak:"Hucurât, 49/10 (ayetin bir bölümü)"},
 {id:"h9",tip:"hadis",tema:"bereket",ar:"نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ",tr:"İki nimet vardır ki insanların çoğu bunların değerini bilmeyip aldanır: sağlık ve boş vakit.",kaynak:"Buhârî, Rikâk"},
 {id:"a10",tip:"ayet",tema:"ilim",ar:"وَقُلْ رَبِّ زِدْنِي عِلْمًا",tr:"De ki: Rabbim, ilmimi artır.",kaynak:"Tâhâ, 20/114 (ayetin bir bölümü)"},
 {id:"h10",tip:"hadis",tema:"sukur",ar:"مَنْ لَا يَشْكُرُ النَّاسَ لَا يَشْكُرُ اللَّهَ",tr:"İnsanlara teşekkür etmeyen, Allah'a şükretmiş olmaz.",kaynak:"Ebû Dâvûd, Edeb; Tirmizî, Birr"},
 {id:"a11",tip:"ayet",tema:"temizlik",ar:"إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ",tr:"Şüphesiz Allah, çokça tevbe edenleri sever, temizlenenleri de sever.",kaynak:"Bakara, 2/222 (ayetin bir bölümü)"},
 {id:"a12",tip:"ayet",tema:"huzur",ar:"وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",tr:"Kim Allah'a güvenip dayanırsa, O ona yeter.",kaynak:"Talâk, 65/3 (ayetin bir bölümü)"},
 {id:"a13",tip:"ayet",tema:"komsuluk",ar:"وَأَحْسِنُوا إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ",tr:"İyilik edin. Şüphesiz Allah iyilik edenleri sever.",kaynak:"Bakara, 2/195 (ayetin bir bölümü)"}
];
function hkRnd(seed){let s=0;for(const c of String(seed))s=(s*31+c.charCodeAt(0))>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const HK_SAHNE={
 umut:{gok:["#1b2a5e","#e8825a","#ffd89b"],f:(i,r)=>`<circle cx="200" cy="168" r="62" fill="#ffe7a8" opacity=".25"/><circle cx="200" cy="168" r="38" fill="#fff1c1"/><path d="M0 170Q70 140 140 165T280 160T400 172V240H0Z" fill="#2c3a63" opacity=".85"/><path d="M0 195Q90 168 180 192T400 190V240H0Z" fill="#162040"/>`},
 huzur:{gok:["#08122c","#14264f","#27447e"],f:(i,r)=>{let s="";for(let k=0;k<46;k++)s+=`<circle cx="${(r()*400).toFixed(0)}" cy="${(r()*150).toFixed(0)}" r="${(r()*1.4+.4).toFixed(1)}" fill="#fff" opacity="${(r()*.6+.3).toFixed(2)}"/>`;return s+`<mask id="m${i}"><rect width="400" height="240" fill="#fff"/><circle cx="318" cy="52" r="24" fill="#000"/></mask><circle cx="306" cy="58" r="26" fill="#f6e7b4" mask="url(#m${i})"/><rect y="170" width="400" height="70" fill="#0c1a3a"/><path d="M0 170H400" stroke="#6f8fd0" stroke-opacity=".5"/><path d="M290 176h40M270 190h80M300 204h30" stroke="#f6e7b4" stroke-opacity=".45" stroke-width="2"/>`}},
 sukur:{gok:["#6fb8dd","#bfe3c9","#f4f0c8"],f:(i,r)=>{let ray="";for(let k=0;k<9;k++){const a=k*Math.PI/9+Math.PI*.55;ray+=`<path d="M330 40L${(330+Math.cos(a)*260).toFixed(0)} ${(40+Math.sin(a)*260).toFixed(0)}" stroke="#fff6c9" stroke-opacity=".28" stroke-width="14"/>`}return ray+`<circle cx="330" cy="40" r="26" fill="#fff3b0"/><path d="M0 170Q100 130 200 165T400 150V240H0Z" fill="#7fb77e"/><path d="M0 200Q120 170 230 198T400 190V240H0Z" fill="#4f9a62"/><rect x="108" y="128" width="9" height="62" fill="#6b4a2e"/><circle cx="112" cy="116" r="30" fill="#3f8b50"/><circle cx="92" cy="130" r="20" fill="#4a9b5a"/><circle cx="134" cy="128" r="22" fill="#357a47"/>`}},
 komsuluk:{gok:["#2c1b4d","#c0586f","#f6b28a"],f:(i,r)=>{let h="";[[24,128,52,62],[88,112,60,78],[160,122,56,68],[228,106,64,84],[304,124,56,66]].forEach(([x,y,w,t],k)=>{h+=`<rect x="${x}" y="${y}" width="${w}" height="${t}" fill="#241a3d"/><path d="M${x-4} ${y}L${x+w/2} ${y-22}L${x+w+4} ${y}Z" fill="#171028"/>`;for(let a=0;a<2;a++)for(let b=0;b<Math.floor(t/26);b++)h+=`<rect x="${x+8+a*(w/2-2)}" y="${y+10+b*24}" width="12" height="14" rx="2" fill="#ffd27a" opacity="${r()>.25?1:.25}"/>`});return h+`<rect y="190" width="400" height="50" fill="#1a1230"/><path d="M0 214Q100 196 200 210T400 204" stroke="#ffd27a" stroke-opacity=".5" stroke-width="3" fill="none"/>`}},
 ilim:{gok:["#0b3a4a","#176a78","#58b1a8"],f:(i,r)=>{let s="";for(let k=0;k<16;k++)s+=`<circle cx="${(r()*400).toFixed(0)}" cy="${(r()*110).toFixed(0)}" r="${(r()*1.3+.5).toFixed(1)}" fill="#fff" opacity=".6"/>`;let ray="";for(let k=0;k<7;k++)ray+=`<path d="M200 150L${40+k*55} 0" stroke="#fff3b0" stroke-opacity=".12" stroke-width="22"/>`;return s+ray+`<path d="M200 150C170 128 120 126 76 142V206C120 192 170 194 200 214Z" fill="#fff8e6"/><path d="M200 150C230 128 280 126 324 142V206C280 192 230 194 200 214Z" fill="#f3ead2"/><path d="M200 150V214" stroke="#d9c89a" stroke-width="3"/><path d="M92 156q48-10 96 12M92 172q48-10 96 12M212 168q48-22 96-12M212 184q48-22 96-12" stroke="#c9b98c" stroke-width="2" fill="none"/>`}},
 bereket:{gok:["#d98e2b","#f2c35b","#fbe7a3"],f:(i,r)=>{let s=`<circle cx="320" cy="60" r="34" fill="#fff4c4" opacity=".9"/>`;for(let k=0;k<13;k++){const x=20+k*30+r()*10,h=70+r()*40,b=240;s+=`<path d="M${x.toFixed(0)} ${b}Q${(x+6).toFixed(0)} ${(b-h/2).toFixed(0)} ${(x+2).toFixed(0)} ${(b-h).toFixed(0)}" stroke="#8a5a14" stroke-width="2.5" fill="none"/>`;for(let g=0;g<5;g++)s+=`<ellipse cx="${(x+2+(g%2?5:-5)).toFixed(0)}" cy="${(b-h+g*9).toFixed(0)}" rx="3.6" ry="8" fill="#c98a1b" transform="rotate(${g%2?24:-24} ${(x+2).toFixed(0)} ${(b-h+g*9).toFixed(0)})"/>`}return s}},
 sabir:{gok:["#c8d4e6","#e9e1ef","#f8ecd9"],f:(i,r)=>`<path d="M0 150L70 80L120 120L190 56L270 128L330 88L400 140V150Z" fill="#5a6b8c"/><path d="M0 150L80 100L140 136L200 92L290 140L360 112L400 146V150Z" fill="#3d4d70"/><rect y="150" width="400" height="90" fill="#8fa5c8"/><path d="M0 150L70 220L120 180L190 244L270 172L330 212L400 160V150Z" fill="#3d4d70" opacity=".35"/><path d="M60 170h80M220 190h110M120 206h60" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`},
 temizlik:{gok:["#0f6e8c","#38b6c9","#bdeff0"],f:(i,r)=>{let s="";for(let k=0;k<3;k++)s+=`<path d="M0 ${150+k*28}Q60 ${132+k*28} 120 ${150+k*28}T240 ${150+k*28}T360 ${150+k*28}T480 ${150+k*28}V240H0Z" fill="#fff" opacity="${(.16+k*.1).toFixed(2)}"/>`;for(let k=0;k<7;k++){const x=40+k*52,y=40+r()*80;s+=`<path d="M${x} ${y-9}C${x+8} ${y+1} ${x+8} ${y+10} ${x} ${y+10}C${x-8} ${y+10} ${x-8} ${y+1} ${x} ${y-9}Z" fill="#fff" opacity=".55"/>`}for(let k=0;k<4;k++){const x=70+r()*260,y=30+r()*90;s+=`<path d="M${x} ${y-9}L${x+3} ${y-3}L${x+9} ${y}L${x+3} ${y+3}L${x} ${y+9}L${x-3} ${y+3}L${x-9} ${y}L${x-3} ${y-3}Z" fill="#fff" opacity=".8"/>`}return s}},
 kolaylik:{gok:["#79b6e0","#cfe9d0","#fff3c4"],f:(i,r)=>`<circle cx="200" cy="108" r="22" fill="#fff6c9"/><path d="M0 128Q100 96 200 122T400 110V240H0Z" fill="#8cc08a"/><path d="M0 168Q120 140 220 168T400 156V240H0Z" fill="#5fa56c"/><path d="M178 240C188 214 168 198 196 180C214 168 200 150 204 132" stroke="#f6e9bb" stroke-width="16" stroke-linecap="round" fill="none"/><path d="M178 240C188 214 168 198 196 180C214 168 200 150 204 132" stroke="#d9c58a" stroke-width="2" stroke-dasharray="6 8" fill="none"/>`}
};
function hkSahne(tema,id){
  const T=HK_SAHNE[tema]||HK_SAHNE.umut,i=String(id).replace(/\W/g,""),r=hkRnd(id);
  return `<svg class="hksahne" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.gok[0]}"/><stop offset=".55" stop-color="${T.gok[1]}"/><stop offset="1" stop-color="${T.gok[2]}"/></linearGradient>
   <pattern id="p${i}" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M22 3L27 15L39 11L33 22L39 33L27 29L22 41L17 29L5 33L11 22L5 11L17 15Z" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="1"/></pattern></defs>
   <rect width="400" height="240" fill="url(#g${i})"/>${T.f(i,r)}<rect width="400" height="240" fill="url(#p${i})"/></svg>`;
}
function hkSar(c,m,w){const k=String(m).split(/\s+/),s=[];let l="";k.forEach(x=>{const t=l?l+" "+x:x;if(l&&c.measureText(t).width>w){s.push(l);l=x}else l=t});if(l)s.push(l);return s}
function hkResim(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src})}
async function hkDuvarCiz(h,mod){
  const W=1080,H=1920,cv=document.createElement("canvas");cv.width=W;cv.height=H;const c=cv.getContext("2d");
  try{await document.fonts.load('64px "Amiri"',h.ar)}catch(e){}
  const sh=Math.round(W*240/400),y0=Math.round(H*.30);
  const svg=hkSahne(h.tema,h.id).replace('<svg class="hksahne"','<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+sh+'"');
  const im=await hkResim("data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg));
  c.drawImage(im,0,y0,W,sh);
  c.drawImage(cv,0,y0,W,1,0,0,W,y0);
  c.drawImage(cv,0,y0+sh-1,W,1,0,y0+sh,W,H-y0-sh);
  const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,"rgba(0,0,0,.25)");g.addColorStop(.5,"rgba(0,0,0,.45)");g.addColorStop(1,"rgba(0,0,0,.8)");c.fillStyle=g;c.fillRect(0,0,W,H);
  c.fillStyle="#fff";c.textAlign="center";c.textBaseline="alphabetic";c.shadowColor="rgba(0,0,0,.6)";c.shadowBlur=14;
  const mx=W-200;
  c.direction="rtl";c.font='400 68px "Amiri","Noto Naskh Arabic","Traditional Arabic",serif';const ar=hkSar(c,h.ar,mx);
  c.direction="ltr";c.font='400 44px system-ui,sans-serif';const tr=hkSar(c,h.tr,mx);
  const la=100,lt=62,hh=ar.length*la+30+tr.length*lt+30+40;
  let y=Math.max(300,Math.min(H-hh-160,Math.round(H*HK_DUVAR[mod].y-hh/2)))+70;
  c.direction="rtl";c.font='400 68px "Amiri","Noto Naskh Arabic","Traditional Arabic",serif';ar.forEach(s=>{c.fillText(s,W/2,y);y+=la});
  y+=10;c.direction="ltr";c.font='400 44px system-ui,sans-serif';tr.forEach(s=>{c.fillText(s,W/2,y);y+=lt});
  y+=26;c.font='500 34px ui-monospace,monospace';c.globalAlpha=.9;c.fillText(h.kaynak,W/2,y);
  if(AYAR.siteAdi){c.globalAlpha=.7;c.font='500 30px system-ui,sans-serif';c.fillText(AYAR.siteAdi,W/2,H-90)}
  return cv;
}
/* ---------- Arayüz (site-app) ---------- */
const HK_DUVAR = { ana: { ad: "Ana ekran", y: .5 }, kilit: { ad: "Kilit ekranı", y: .68 } };
let hkOff = 0, hkTema = "", hkDv = null;
const hkIdx = o => { const d = new Date(); const g = Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5) + (o || 0); return ((g % HK.length) + HK.length) % HK.length; };
const hkPremium = () => !!(ME && ME.abonelik && ME.abonelik.aktif);
function hkPaylasMetni(h) { return `${h.ar}\n\n${h.tr}\n— ${h.kaynak}${AYAR.siteAdi ? "\n(" + AYAR.siteAdi + ")" : ""}`; }
function hkAksiyon(h) {
  return `<div class="hkak"><a class="mini hk-wa" href="https://wa.me/?text=${encodeURIComponent(hkPaylasMetni(h))}" target="_blank" rel="noopener noreferrer">WhatsApp'ta paylaş</a>
    <button type="button" class="mini" data-hk-duvar="${h.id}">${hkPremium() ? "" : ik("lock", "ikon hk-kilit")}Duvar kâğıdı</button></div>`;
}
function hkKart(h, o) {
  o = o || {};
  return `<article class="hkk${o.hero ? " hero" : ""}" data-hk="${h.id}">${hkSahne(h.tema, h.id)}<div class="hkperde"></div><div class="hkic">
   <span class="hkrozet">${o.etiket || (h.tip === "ayet" ? "Ayet" : "Hadis")} · ${esc(HK_TEMALAR[h.tema])}</span>
   <p class="hkar" lang="ar" dir="rtl">${h.ar}</p><p class="hktr">${esc(h.tr)}</p><p class="hkkay">${esc(h.kaynak)}</p>${o.alt || ""}</div></article>`;
}
function hkHero() {
  const h = HK[hkIdx(hkOff)], bugun = hkOff === 0;
  const alt = `<div class="hkgez"><button type="button" class="mini" data-hk-gez="-1" aria-label="Önceki">‹</button><button type="button" class="mini" data-hk-gez="1" aria-label="Sonraki">›</button>${bugun ? "" : `<button type="button" class="mini" data-hk-gez="0">Bugün</button>`}<span style="flex:1"></span>${hkAksiyon(h)}<a class="mini" href="#hikmet">Tümü</a></div>`;
  return `<section class="hkhero" aria-label="Günün ayeti ve hadisi">${hkKart(h, { hero: true, etiket: bugun ? `Günün ${h.tip === "ayet" ? "ayeti" : "hadisi"}` : null, alt })}</section>`;
}
function viewHikmet() {
  const bg = HK[hkIdx(0)].id, l = HK.filter(h => !hkTema || h.tema === hkTema);
  return `<p class="eyebrow">Ayetler ve hadisler${AYAR.siteAdi ? " · " + esc(AYAR.siteAdi) : ""}</p><h2 class="title">Hikmet</h2>
   <div class="chips hk-temalar" role="group" aria-label="Konu"><button type="button" class="chip ${!hkTema ? "acc" : ""}" data-hk-tema="" aria-pressed="${!hkTema}">Tümü (${HK.length})</button>${Object.entries(HK_TEMALAR).map(([k, v]) => `<button type="button" class="chip ${hkTema === k ? "acc" : ""}" data-hk-tema="${k}" aria-pressed="${hkTema === k}">${v}</button>`).join("")}</div>
   ${l.map(h => hkKart(h, { etiket: h.id === bg ? "Bugünün " + (h.tip === "ayet" ? "ayeti" : "hadisi") : null, alt: hkAksiyon(h) })).join("")}
   <p class="lvl" style="margin:14px 0 0">Anlamlar serbest anlatımdır; resmî meal ve kaynak kontrolü için Diyanet İşleri Başkanlığı kaynaklarına bakınız. Görseller metne uygun, sade doğa ve yerleşim çizimleridir.</p>`;
}
function hkPencere(ic) {
  let el = document.getElementById("hkdv");
  if (!el) { el = document.createElement("div"); el.id = "hkdv"; el.className = "hkdv"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Duvar kâğıdı"); document.body.appendChild(el); }
  el.innerHTML = `<div class="hkdvk"><div class="hkdvb"><b>Duvar kâğıdı</b><button type="button" class="mini" data-hkdv="kapat" aria-label="Kapat">✕</button></div>${ic}</div>`;
  el.hidden = false; const k = el.querySelector("[data-hkdv=kapat]"); if (k) k.focus();
  return el;
}
function hkKapat() { const el = document.getElementById("hkdv"); if (el) el.hidden = true; hkDv = null; }
async function hkDuvarAc(id, mod) {
  const h = HK.find(x => x.id === id); if (!h) return; mod = mod || "ana";
  if (!hkPremium()) {
    hkPencere(`<p>Her ayet ve hadisi, telefonunuzun ana ekranı ve kilit ekranı için hazırlanmış bir görsel olarak kaydedin${BS.platform === "android" ? " ya da doğrudan duvar kâğıdı yapın" : ""}.</p>
      <p class="lvl">Bu özellik Premium aboneliğe dahildir. Metinleri okumak ve paylaşmak her zaman ücretsizdir.</p>
      <div class="confirm"><a class="btn pri" href="#abonelik" data-hkdv="kapat">Premium'u incele</a><button class="btn" type="button" data-hkdv="kapat">Vazgeç</button></div>`);
    return;
  }
  const d = BS.duvar(), android = BS.platform === "android" && d && d.ayarla;
  hkPencere(`<div class="chips" role="group">${Object.entries(HK_DUVAR).map(([k, v]) => `<button type="button" class="chip ${k === mod ? "acc" : ""}" data-hkdv="mod:${k}" aria-pressed="${k === mod}">${v.ad}</button>`).join("")}</div>
   <div class="hkdvr" id="hkdvr"><span class="lvl">Hazırlanıyor…</span></div>
   <div class="confirm">${android ? `<button type="button" class="btn pri" data-hkdv="ayarla" disabled>${mod === "kilit" ? "Kilit ekranı yap" : "Ana ekran yap"}</button>` : ""}
     <button type="button" class="btn ${android ? "" : "pri"}" data-hkdv="kaydet" disabled>${BS.native ? "Galeriye kaydet" : "İndir"}</button></div>
   <p class="lvl" style="margin:8px 0 0">${android ? "Ayarla düğmesi seçtiğiniz ekranı hemen değiştirir." : BS.platform === "ios" ? "iPhone uygulamaların duvar kâğıdını değiştirmesine izin vermez. Kaydettikten sonra Fotoğraflar'da resmi açın, Paylaş › <i>Duvar Kâğıdı Yap</i> deyin." : "Resmi indirin; sonra telefonunuzun galerisinden duvar kâğıdı olarak seçin."}</p>`);
  hkDv = { id, mod, cv: null };
  try {
    const cv = await hkDuvarCiz(h, mod);
    if (!hkDv || hkDv.id !== id || hkDv.mod !== mod) return;
    hkDv.cv = cv;
    const r = document.getElementById("hkdvr");
    if (r) { r.innerHTML = `<img alt="Duvar kâğıdı önizlemesi" src="${cv.toDataURL("image/jpeg", .7)}">`; document.querySelectorAll("#hkdv [data-hkdv=ayarla],#hkdv [data-hkdv=kaydet]").forEach(b => { b.disabled = false; }); }
  } catch (e) { const r = document.getElementById("hkdvr"); if (r) r.innerHTML = `<span class="lvl">Resim hazırlanamadı.</span>`; }
}
async function hkDuvarIslem(t) {
  if (!hkDv || !hkDv.cv) return;
  const ad = `hikmet-${hkDv.id}-${hkDv.mod}.png`, d = BS.duvar();
  try {
    if (d) {
      const base64 = hkDv.cv.toDataURL("image/png").split(",")[1];
      if (t === "ayarla") { await d.ayarla({ base64, hedef: hkDv.mod }); bildir(hkDv.mod === "kilit" ? "Kilit ekranı güncellendi." : "Ana ekran güncellendi."); }
      else { await d.kaydet({ base64, ad }); bildir("Galeriye kaydedildi."); }
      return;
    }
    const blob = await new Promise(r => hkDv.cv.toBlob(r, "image/png"));
    const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = ad; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000); bildir("Resim indirildi.");
  } catch (e) { bildir(e && e.message ? e.message : "İşlem tamamlanamadı."); }
}
function hikmetTikla(e) {
  const g = e.target.closest("[data-hk-gez]");
  if (g) { const v = +g.dataset.hkGez; hkOff = v === 0 ? 0 : hkOff + v; const y = window.scrollY; render(false); window.scrollTo(0, y); return true; }
  const t = e.target.closest("[data-hk-tema]");
  if (t) { hkTema = t.dataset.hkTema; const y = window.scrollY; render(false); window.scrollTo(0, y); return true; }
  const o = e.target.closest("[data-hk-duvar]"); if (o) { hkDuvarAc(o.dataset.hkDuvar, "ana"); return true; }
  const b = e.target.closest("[data-hkdv]");
  if (b) { const v = b.dataset.hkdv; if (v === "kapat") hkKapat(); else if (v === "kaydet" || v === "ayarla") hkDuvarIslem(v); else if (v.startsWith("mod:") && hkDv) hkDuvarAc(hkDv.id, v.slice(4)); return true; }
  if (e.target.id === "hkdv") { hkKapat(); return true; }
  return false;
}
document.addEventListener("keydown", e => { if (e.key === "Escape") { const el = document.getElementById("hkdv"); if (el && !el.hidden) hkKapat(); } });
