"use strict";
/* SMS sağlayıcı soyutlaması.
   Her sağlayıcı: { ad, async gonder(telefon, mesaj) } nesnesidir.
   Yeni bir sağlayıcı eklemek için createSmsProvider içine bir dal ekleyin. */

function konsolProvider(log = console.log) {
  return {
    ad: "konsol",
    async gonder(telefon, mesaj) {
      // Geliştirme modu: SMS gönderilmez, kod sunucu loguna yazılır.
      log(`[SMS:konsol] ${telefon} -> ${mesaj}`);
    }
  };
}

/* Testler için: gönderilen mesajları bellekte tutar. */
function bellekProvider() {
  const giden = [];
  return {
    ad: "bellek",
    giden,
    async gonder(telefon, mesaj) { giden.push({ telefon, mesaj, zaman: Date.now() }); },
    sonKod(telefon) {
      for (let i = giden.length - 1; i >= 0; i--) if (giden[i].telefon === telefon) { const m = giden[i].mesaj.match(/(\d{6})/); return m && m[1]; }
      return null;
    }
  };
}

/* Genel HTTP webhook: kendi SMS ağ geçidinize JSON POST eder.
   SMS_WEBHOOK_URL ve isteğe bağlı SMS_WEBHOOK_TOKEN (Bearer) kullanır. */
function webhookProvider({ url, token }) {
  if (!url) throw new Error("SMS_WEBHOOK_URL tanımlı değil");
  return {
    ad: "webhook",
    async gonder(telefon, mesaj) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ telefon, mesaj }),
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) throw new Error("SMS webhook hata: " + r.status);
    }
  };
}

/* NetGSM şablonu (Türkiye). DOĞRULANMADI: canlıya almadan önce NetGSM'in güncel
   API belgesiyle uç noktayı, parametreleri ve başarılı yanıt kodlarını kontrol edin. */
function netgsmProvider({ kullanici, sifre, baslik }) {
  if (!kullanici || !sifre || !baslik) throw new Error("NETGSM_KULLANICI / NETGSM_SIFRE / NETGSM_BASLIK eksik");
  return {
    ad: "netgsm",
    async gonder(telefon, mesaj) {
      const params = new URLSearchParams({ usercode: kullanici, password: sifre, gsmno: telefon.replace(/^\+/, ""), message: mesaj, msgheader: baslik, dil: "TR" });
      const r = await fetch("https://api.netgsm.com.tr/sms/send/get?" + params.toString(), { signal: AbortSignal.timeout(10000) });
      const t = (await r.text()).trim();
      if (!r.ok || !/^(00|01|02)\b/.test(t)) throw new Error("NetGSM hata: " + t.slice(0, 40));
    }
  };
}

function createSmsProvider(env = process.env, log) {
  const ad = (env.SMS_PROVIDER || "konsol").toLowerCase();
  if (ad === "konsol") return konsolProvider(log);
  if (ad === "bellek") return bellekProvider();
  if (ad === "webhook") return webhookProvider({ url: env.SMS_WEBHOOK_URL, token: env.SMS_WEBHOOK_TOKEN });
  if (ad === "netgsm") return netgsmProvider({ kullanici: env.NETGSM_KULLANICI, sifre: env.NETGSM_SIFRE, baslik: env.NETGSM_BASLIK });
  throw new Error("Bilinmeyen SMS_PROVIDER: " + ad);
}

module.exports = { createSmsProvider, konsolProvider, bellekProvider, webhookProvider, netgsmProvider };
