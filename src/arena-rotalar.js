"use strict";
/* Arena, sohbet, şikâyet ve engel rotaları. Premium kapısı: düello, sezon puanlı oyun, turnuva ve sohbet Premium'dur
   (site öder modelinde tüm sakinlere açıktır). Bilgi kartları, şikâyet ve engelleme herkese açıktır. */
const { Hata } = require("./validate");
const PREMIUM_MESAJ = "Bu özellik Premium'a dahildir. Profil › Hesap ve abonelik'ten inceleyebilirsiniz; site yönetiminiz tüm sakinler için de açabilir.";

function arenaRotalari({ rota, izin, AR, SH, premiumMu, GR, BK, MN }) {
  const premium = ctx => { if (!premiumMu(ctx)) throw new Hata(403, PREMIUM_MESAJ, "premium"); };
  const yonetimMi = ctx => ["site_yonetici", "site_denetci"].includes(ctx.uyelik.rol);
  const sayi = (v, ad) => { const n = Number(v); if (!Number.isInteger(n)) throw new Hata(400, `Geçersiz ${ad}.`); return n; };
  const sk = ctx => ctx.site.id, uk = ctx => ctx.user.id;

  // --- Özet ve kartlar (herkese açık) ---
  rota("GET", "/api/arena/ozet", "uye", ctx => ({ ...AR.ozet(sk(ctx), uk(ctx)), premium: premiumMu(ctx), yonetim: yonetimMi(ctx), gorevAlinabilir: GR.alinabilir(sk(ctx), uk(ctx)) }));
  /* Günlük ve haftalık görevler: ilerleme sunucuda hesaplanır, ödül (Mavi Öz) bir kez alınır */
  rota("GET", "/api/arena/gorevler", "uye", ctx => GR.liste(sk(ctx), uk(ctx)));
  rota("POST", "/api/arena/gorev/:kod/al", "uye", ctx => GR.al(sk(ctx), uk(ctx), ctx.params.kod), { yazma: true });
  rota("GET", "/api/arena/kartlar", "uye", ctx => AR.kartlar(sk(ctx), uk(ctx)));
  rota("POST", "/api/arena/kart/:id/ogrendim", "uye", ctx => {
    if (!izin("kart:" + uk(ctx), 60, 60000)) throw new Hata(429, "Çok hızlı. Biraz yavaşlayın.");
    return AR.kartOgrendi(sk(ctx), uk(ctx), ctx.params.id);
  }, { yazma: true });
  /* Arena kimliği: kazanılan simge, çerçeve, sembol, unvan. Ödülü sunucu verir; seçim yalnızca sahip olunanlardan. */
  rota("GET", "/api/arena/kimlik", "uye", ctx => AR.kimlikGetir(sk(ctx), uk(ctx)));
  rota("PUT", "/api/arena/kimlik", "uye", ctx => AR.kimlikSec(sk(ctx), uk(ctx), ctx.body || {}), { yazma: true });
  rota("GET", "/api/arena/siralama", "uye", ctx => ({ ...AR.siralama(sk(ctx), uk(ctx)), gecmisSezonlar: AR.gecmisSezonlar(sk(ctx)) }));

  // --- Düello (Premium) ---
  rota("POST", "/api/arena/esles", "uye", ctx => { premium(ctx); if (!izin("esles:" + uk(ctx), 30, 60000)) throw new Hata(429, "Çok sık denendi."); return AR.esles(sk(ctx), uk(ctx)); }, { yazma: true });
  rota("GET", "/api/arena/esles", "uye", ctx => { premium(ctx); return AR.eslesBekle(sk(ctx), uk(ctx), ctx.req, ctx.url.searchParams.get("bilinen") || undefined); });
  rota("POST", "/api/arena/esles/kabul", "uye", ctx => { premium(ctx); return AR.eslesKabul(sk(ctx), uk(ctx), ctx.body && ctx.body.teklifId); }, { yazma: true });
  rota("DELETE", "/api/arena/esles", "uye", ctx => AR.eslesIptal(sk(ctx), uk(ctx)));
  rota("POST", "/api/arena/antrenman", "uye", ctx => { premium(ctx); if (!izin("antr:" + uk(ctx), 20, 3600000)) throw new Hata(429, "Saatte en çok 20 antrenman."); return AR.antrenman(sk(ctx), uk(ctx)); }, { yazma: true });
  rota("GET", "/api/arena/mac/:id", "uye", ctx => AR.macBekle(sk(ctx), uk(ctx), ctx.params.id, ctx.url.searchParams.has("ver") ? ctx.url.searchParams.get("ver") : undefined, ctx.req));
  rota("POST", "/api/arena/mac/:id/cevap", "uye", ctx => AR.macCevap(sk(ctx), uk(ctx), ctx.params.id, ctx.body.soruNo, ctx.body.secim), { yazma: true });

  // --- Turnuva (katılım Premium; yönetim oluşturur) ---
  rota("GET", "/api/arena/turnuvalar", "uye", ctx => AR.turnuvaListe(sk(ctx), uk(ctx)));
  /* Masa oyunları (satranç, tavla): turnuva maçı canlı oynanır; hamleyi sunucu doğrular */
  rota("GET", "/api/arena/oyun/:id", "uye", ctx => { premium(ctx); const b = ctx.url.searchParams.has("ver") ? ctx.url.searchParams.get("ver") : undefined; return AR.OY.bekle(sk(ctx), uk(ctx), ctx.params.id, b, ctx.req); });
  rota("GET", "/api/arena/oyun-yeni/:id", "uye", ctx => { premium(ctx); return AR.OY.yeni(sk(ctx), uk(ctx), ctx.params.id); });
  rota("POST", "/api/arena/oyun/:id/hamle", "uye", ctx => { premium(ctx); if (!izin("oyun:" + uk(ctx), 240, 60000)) throw new Hata(429, "Çok sık denendi."); return AR.OY.hamle(sk(ctx), uk(ctx), ctx.params.id, ctx.body || {}); }, { yazma: true });
  rota("POST", "/api/arena/oyun/:id/teslim", "uye", ctx => { premium(ctx); return AR.OY.teslim(sk(ctx), uk(ctx), ctx.params.id); }, { yazma: true });
  rota("POST", "/api/arena/turnuvalar", "yonetici", ctx => AR.turnuvaOlustur(sk(ctx), uk(ctx), ctx.body), { yazma: true });
  rota("GET", "/api/arena/turnuva/:id", "uye", ctx => {
    const id = sayi(ctx.params.id, "turnuva");
    return ctx.url.searchParams.get("bekle") === "1" ? AR.turnuvaBekle(sk(ctx), uk(ctx), id, ctx.req) : AR.turnuvaDetay(sk(ctx), uk(ctx), id);
  });
  rota("POST", "/api/arena/turnuva/:id/katil", "uye", ctx => { premium(ctx); return AR.turnuvaKatil(sk(ctx), uk(ctx), sayi(ctx.params.id, "turnuva")); }, { yazma: true });
  rota("DELETE", "/api/arena/turnuva/:id/katil", "uye", ctx => AR.turnuvaAyril(sk(ctx), uk(ctx), sayi(ctx.params.id, "turnuva")), { yazma: true });
  rota("DELETE", "/api/arena/turnuva/:id", "yonetici", ctx => AR.turnuvaIptal(sk(ctx), sayi(ctx.params.id, "turnuva")), { yazma: true });
  rota("POST", "/api/arena/turnuva/:id/mac/:mid/hazir", "uye", ctx => { premium(ctx); return AR.turnuvaHazir(sk(ctx), uk(ctx), sayi(ctx.params.id, "turnuva"), sayi(ctx.params.mid, "maç")); }, { yazma: true });

  // --- Sohbet (Premium) ---
  rota("GET", "/api/sohbet", "uye", ctx => ({ ...SH.odalar(sk(ctx), uk(ctx)), premium: premiumMu(ctx), yonetim: yonetimMi(ctx) }));
  rota("GET", "/api/sohbet/oda/:oda", "uye", ctx => {
    premium(ctx); const p = ctx.url.searchParams;
    return SH.oku(sk(ctx), uk(ctx), ctx.params.oda, p.get("sonra"), p.get("surum"), p.get("bekle") === "1", ctx.req);
  });
  /* Canlı akış: text/event-stream. Bağlantı açık kaldıkça yeni mesajlar itilir; istemci koparsa yeniden bağlanır. */
  rota("GET", "/api/sohbet/oda/:oda/akis", "uye", ctx => { premium(ctx); SH.akisAc(sk(ctx), uk(ctx), ctx.params.oda, ctx.req, ctx.res); return { _akis: true }; });
  rota("POST", "/api/sohbet/oda/:oda", "uye", ctx => {
    premium(ctx);
    if (!izin("sohbet:" + uk(ctx), 20, 60000)) throw new Hata(429, "Dakikada en çok 20 mesaj gönderilebilir.");
    return SH.gonder(sk(ctx), uk(ctx), ctx.params.oda, ctx.body.metin);
  }, { yazma: true });
  rota("DELETE", "/api/sohbet/mesaj/:id", "uye", ctx => SH.mesajSil(sk(ctx), uk(ctx), yonetimMi(ctx), ctx.params.id), { yazma: true });

  // --- Şikâyet ve engel (herkese açık) ---
  rota("POST", "/api/sikayet", "uye", ctx => {
    if (!izin("sikayet:" + uk(ctx), 20, 3600000)) throw new Hata(429, "Saatte en çok 20 şikâyet gönderilebilir.");
    return SH.sikayet(sk(ctx), uk(ctx), ctx.body);
  });
  rota("GET", "/api/engel", "uye", ctx => SH.engeller(sk(ctx), uk(ctx)));
  rota("POST", "/api/engel", "uye", ctx => SH.engelle(sk(ctx), uk(ctx), ctx.body));
  rota("DELETE", "/api/engel/:kim", "uye", ctx => SH.engelKaldir(sk(ctx), uk(ctx), ctx.params.kim));

  // --- Moderasyon (yönetim) ---
  rota("GET", "/api/yonetim/sikayetler", "yonetim", ctx => SH.sikayetler(sk(ctx), ctx.url.searchParams.get("durum")));
  rota("PATCH", "/api/yonetim/sikayetler/:id", "yonetim", ctx => SH.sikayetKarar(sk(ctx), ctx.params.id, ctx.body.karar, ctx.body.saat || 24), { yazma: true });
  /* Minnoş (bekçi kedi): yapay zekâ ile soru cevabı ve kahve falı. Servis kapalıysa { kaynak: "yok" } döner; istemci hazır cevaplarını kullanır. */
  rota("GET", "/api/minnos/bilgi", "uye", ctx => ({ ...MN.bilgi(), kalan: MN.kalan(sk(ctx), uk(ctx)), premium: premiumMu(ctx) }));
  rota("POST", "/api/minnos/sor", "uye", ctx => { if (!izin("minnos:" + uk(ctx), 8, 60000)) throw new Hata(429, "Minnoş biraz dinlensin, bir dakika sonra tekrar sor."); return MN.sor(sk(ctx), uk(ctx), premiumMu(ctx), ctx.body && ctx.body.soru); }, { yazma: true });
  rota("POST", "/api/minnos/fal", "uye", ctx => { if (!izin("minnos:" + uk(ctx), 8, 60000)) throw new Hata(429, "Fincan biraz soğusun, bir dakika sonra tekrar dene."); return MN.fal(sk(ctx), uk(ctx), premiumMu(ctx), ctx.body || {}); }, { yazma: true });
  /* Bekçi: yönetim olayları görür ve "doğru/yanlış alarm" geri bildirimi verir (sonraki eğitimde kullanılır) */
  rota("GET", "/api/yonetim/bekci", "yonetim", ctx => BK.olaylar(sk(ctx)));
  rota("POST", "/api/yonetim/bekci/:id/geri-bildirim", "yonetim", ctx => { const r = BK.geriBildirim(sk(ctx), ctx.params.id, !!ctx.body.dogru); if (!r) throw new Hata(404, "Olay bulunamadı."); return r; }, { yazma: true });
  rota("DELETE", "/api/yonetim/sustur/:kim", "yonetim", ctx => SH.susturKaldir(sk(ctx), ctx.params.kim), { yazma: true });
}
module.exports = { arenaRotalari, PREMIUM_MESAJ };
