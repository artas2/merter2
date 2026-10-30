"use strict";
/* Bellek içi olay merkezi: uzun yoklama (long poll) için "bekle / haber ver".
   Tek süreç içindir. Birden çok sunucu örneğine geçişte aynı arayüz Redis Pub/Sub ile uygulanır (docs/PERFORMANS.md). */
class Hub {
  constructor() { this.bekleyen = new Map(); this.zamanli = new Map(); this.sayi = 0; }
  /* anahtar için haber gelene ya da süre dolana kadar bekler; true = haber geldi, false = süre doldu */
  bekle(anahtar, ms, req) {
    return new Promise(coz => {
      let bitti = false;
      const bitir = ok => {
        if (bitti) return; bitti = true; clearTimeout(t);
        const k = this.bekleyen.get(anahtar); if (k) { k.delete(bitir); if (!k.size) this.bekleyen.delete(anahtar); }
        this.sayi--; if (req) req.removeListener("close", kapat); coz(ok);
      };
      const kapat = () => bitir(false);
      const t = setTimeout(() => bitir(false), Math.max(0, ms));
      if (!this.bekleyen.has(anahtar)) this.bekleyen.set(anahtar, new Set());
      this.bekleyen.get(anahtar).add(bitir); this.sayi++;
      if (req) req.once("close", kapat);
    });
  }
  bildir(anahtar) {
    const k = this.bekleyen.get(anahtar); if (!k) return 0;
    const n = k.size; for (const f of [...k]) f(true); return n;
  }
  /* Kısa sürede çok haber gelirse tek bildirime indirger (ör. sohbette yoğun mesaj) */
  bildirGec(anahtar, ms = 150) {
    if (this.zamanli.has(anahtar)) return;
    const t = setTimeout(() => { this.zamanli.delete(anahtar); this.bildir(anahtar); }, ms); t.unref && t.unref();
    this.zamanli.set(anahtar, t);
  }
}
module.exports = { Hub };
