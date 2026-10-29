"use strict";
/* Uçtan uca testler için sahte Google: OAuth jeton uç noktası + Play Developer API (subscriptionsv2).
   Jeton "tok-<hesapUuid>" biçimindeyse o hesaba ait etkin bir aylık abonelik döner. */
const http = require("node:http");
const crypto = require("node:crypto");
async function sahteGoogle() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const durum = new Map();
  const s = http.createServer((req, res) => {
    const j = o => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.method === "POST" && req.url === "/token") return j({ access_token: "ya29.e2e", expires_in: 3600 });
    const m = /\/purchases\/subscriptionsv2\/tokens\/(.+)$/.exec(req.url);
    if (!m || req.headers.authorization !== "Bearer ya29.e2e") { res.writeHead(404); return res.end("{}"); }
    const tok = decodeURIComponent(m[1]), uuid = tok.startsWith("tok-") ? tok.slice(4) : null;
    if (!uuid) { res.writeHead(404); return res.end("{}"); }
    j({ subscriptionState: durum.get(tok) || "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "bs_premium_aylik", expiryTime: new Date(Date.now() + 30 * 864e5).toISOString() }],
      externalAccountIdentifiers: { obfuscatedExternalAccountId: uuid }, testPurchase: {} });
  });
  await new Promise(r => s.listen(0, "127.0.0.1", r));
  const taban = `http://127.0.0.1:${s.address().port}`;
  const hh = { client_email: "e2e@test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: taban + "/token" };
  return { taban, durum, env: { GOOGLE_HIZMET_HESABI: JSON.stringify(hh), GOOGLE_PAKET_ADI: "com.bilinclisakin.app", GOOGLE_API_TABAN: taban }, kapat: () => s.close() };
}
module.exports = { sahteGoogle };
