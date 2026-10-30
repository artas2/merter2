"use strict";
/* Belge deposu: claude.ai artifact "db" yeteneğinin sunucu karşılığı.
   Merter Çınar Evleri arayüzü (merter/index.html) bu depoyu, istemcideki uyum katmanı (merter/claude-uyum.js) üzerinden
   aynı çağrılarla kullanır: doc(yol).get/set/update/delete/onSnapshot ve collection(yol).onSnapshot.
   Her site ayrı bir ad alanıdır; site kimliği her zaman oturumdan gelir.

   Erişim kuralları artifact'teki 22 kuralın birebir aynısıdır:
   - seviye: view (1) < interact (2) < admin (3) < owner (4)
   - sakin ve denetçi = interact, site yöneticisi = admin; "owner" (lisans) yazımı sitede kimseye açık değildir.
   - "koleksiyon/{self}" kuralı yalnızca belge kimliği kişinin kendi kimliğiyse uygulanır, eksik alan koleksiyon kuralından gelir.
   - kural yoksa: okuma view, yazma interact.
   - data/users/<kimlik>/… yalnızca o kişiye açıktır (yönetici dahil kimse göremez). */
const crypto = require("node:crypto");
const { Hata } = require("./validate");

const KURALLAR = [
  ["sakinler", "admin", "admin"], ["sakinler/{self}", "interact", "interact"],
  ["sepetler", "admin", "admin"], ["sepetler/{self}", "interact", "interact"],
  ["ayarlar", "view", "admin"],
  ["katilim", "interact", "admin"], ["katilim/{self}", "interact", "interact"],
  ["magazaSiparis", "admin", "admin"], ["magazaSiparis/{self}", "interact", "interact"],
  ["lisans", "view", "owner"],
  ["gonderiler", "interact", "admin"], ["gonderiler/{self}", "interact", "interact"],
  ["begeniler", "interact", "admin"], ["begeniler/{self}", "interact", "interact"],
  ["yorumlar", "interact", "admin"], ["yorumlar/{self}", "interact", "interact"],
  ["firsatBen", "interact", "admin"], ["firsatBen/{self}", "interact", "interact"],
  ["firsatOneri", "admin", "admin"], ["firsatOneri/{self}", "interact", "interact"],
  ["hizmetSiparis", "admin", "admin"], ["hizmetSiparis/{self}", "interact", "interact"]
].map(([path, read, write]) => ({ path, read, write }));
const SEVIYE = { view: 1, interact: 2, admin: 3, owner: 4 };
const ROL_SEVIYE = { sakin: 2, site_denetci: 2, site_yonetici: 3 };
const MAKS_BELGE = 512 * 1024;
const MAKS_DERINLIK = 12;
const SEGMENT = /^[A-Za-z0-9_-]{1,80}$/;

function yolCoz(yol, belgeMi) {
  if (typeof yol !== "string" || !yol || yol.length > 400) throw new Hata(400, "Geçersiz yol.");
  const p = yol.split("/");
  if (!p.every(s => SEGMENT.test(s))) throw new Hata(400, "Geçersiz yol.");
  if (belgeMi ? p.length % 2 !== 0 : p.length % 2 !== 1) throw new Hata(400, belgeMi ? "Belge yolu çift parçalı olmalı." : "Koleksiyon yolu tek parçalı olmalı.");
  return p;
}

function kuralBul(p, uid) {
  // data/users/<id>/… : yalnızca sahibi
  if (p[0] === "data") return p[1] === "users" && p[2] === uid ? { read: "view", write: "view" } : { read: "yok", write: "yok" };
  const k = KURALLAR.find(r => r.path === p[0]) || { read: "view", write: "interact" };
  if (p.length === 2 && p[1] === uid) {
    const s = KURALLAR.find(r => r.path === p[0] + "/{self}");
    if (s) return { read: s.read || k.read, write: s.write || k.write };
  }
  return k;
}

function derinlik(v, d = 0) {
  if (d > MAKS_DERINLIK) return d;
  if (v && typeof v === "object") { let m = d; for (const k in v) m = Math.max(m, derinlik(v[k], d + 1)); return m; }
  return d;
}
/* update: iç içe nesneler birleşir, diziler ve değerler üzerine yazılır (artifact db ile aynı). */
function birlestir(a, b) {
  for (const k of Object.keys(b)) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) birlestir(a[k], v);
    else a[k] = v;
  }
  return a;
}

function createBelgeler({ db, now, sirri, abonelikAktif }) {
  const q = {
    get: db.prepare("SELECT veri FROM belgeler WHERE site_id = ? AND koleksiyon = ? AND belge_id = ?"),
    liste: db.prepare("SELECT belge_id, veri FROM belgeler WHERE site_id = ? AND koleksiyon = ? AND veri IS NOT NULL ORDER BY belge_id"),
    yaz: db.prepare(`INSERT INTO belgeler (site_id, koleksiyon, belge_id, veri, sira, guncelleme) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(site_id, koleksiyon, belge_id) DO UPDATE SET veri = excluded.veri, sira = excluded.sira, guncelleme = excluded.guncelleme`),
    siraArtir: db.prepare("UPDATE belge_sira SET sira = sira + 1 WHERE site_id = ? RETURNING sira"),
    siraEkle: db.prepare("INSERT OR IGNORE INTO belge_sira (site_id, sira) VALUES (?, 0)"),
    siraGet: db.prepare("SELECT sira FROM belge_sira WHERE site_id = ?"),
    degisen: db.prepare("SELECT koleksiyon, belge_id FROM belgeler WHERE site_id = ? AND sira > ? ORDER BY sira LIMIT 500"),
    varlikEkle: db.prepare("INSERT INTO varliklar (id, site_id, user_id, tip, veri, boyut, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    varlikGet: db.prepare("SELECT * FROM varliklar WHERE id = ?"),
    varlikSil: db.prepare("DELETE FROM varliklar WHERE id = ? AND site_id = ? AND user_id = ?"),
    varlikToplam: db.prepare("SELECT COALESCE(SUM(boyut), 0) n FROM varliklar WHERE site_id = ? AND user_id = ?")
  };
  const bekleyenler = new Map(); // site_id -> Set(fn)

  /* Kişinin bu sitedeki kimliği: kalıcı, tahmin edilemez, siteye özgü. */
  const kimlik = (siteId, userId) => "u" + crypto.createHmac("sha256", sirri).update(`kimlik:${siteId}:${userId}`).digest("hex").slice(0, 20);

  function baglam(ctx) {
    const uid = kimlik(ctx.site.id, ctx.user.id);
    return { siteId: ctx.site.id, uid, seviye: ROL_SEVIYE[ctx.uyelik.rol] || 1, userId: ctx.user.id };
  }
  const izinli = (b, p, tur) => { const k = kuralBul(p, b.uid)[tur]; return k !== "yok" && b.seviye >= (SEVIYE[k] || 99); };

  /* Sanal belge: lisans/site = bu kişinin Premium durumu (abonelik ya da site öder). Yazılamaz. */
  function sanal(b, p) {
    if (p.length === 2 && p[0] === "lisans" && p[1] === "site") return { premium: !!abonelikAktif(b.userId, b.siteId) };
    return undefined;
  }
  function oku(b, p) {
    const s = sanal(b, p); if (s !== undefined) return s;
    const r = q.get.get(b.siteId, p.slice(0, -1).join("/"), p[p.length - 1]);
    return r && r.veri !== null ? JSON.parse(r.veri) : null;
  }
  function kaydet(b, p, veri) {
    const json = veri === null ? null : JSON.stringify(veri);
    if (json !== null && Buffer.byteLength(json) > MAKS_BELGE) throw new Hata(413, "Belge çok büyük.");
    q.siraEkle.run(b.siteId);
    const sira = q.siraArtir.get(b.siteId).sira;
    q.yaz.run(b.siteId, p.slice(0, -1).join("/"), p[p.length - 1], json, sira, now());
    const w = bekleyenler.get(b.siteId);
    if (w) { bekleyenler.delete(b.siteId); for (const f of w) f(); }
  }
  function govdeDenetle(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Hata(400, "Belge verisi nesne olmalı.");
    if (derinlik(v) > MAKS_DERINLIK) throw new Hata(400, "Belge çok derin.");
  }

  function islem(ctx, body) {
    const b = baglam(ctx), op = body.op;
    if (op === "koleksiyon") {
      const p = yolCoz(body.yol, false);
      if (p.length === 1 && p[0] === "lisans") return { belgeler: [{ id: "site", veri: sanal(b, ["lisans", "site"]) }] };
      const k = p.join("/");
      return { belgeler: q.liste.all(b.siteId, k).filter(r => izinli(b, [...p, r.belge_id], "read")).map(r => ({ id: r.belge_id, veri: JSON.parse(r.veri) })) };
    }
    const p = yolCoz(body.yol, true);
    if (op === "get") {
      if (!izinli(b, p, "read")) throw new Hata(403, "Bu belgeyi okuma izniniz yok.");
      const v = oku(b, p);
      return { var: v !== null, veri: v };
    }
    if (!["set", "update", "delete"].includes(op)) throw new Hata(400, "Bilinmeyen işlem.");
    if (sanal(b, p) !== undefined || !izinli(b, p, "write")) throw new Hata(403, "Bu belgeye yazma izniniz yok.");
    if (op === "delete") { if (oku(b, p) !== null) kaydet(b, p, null); return { ok: true }; }
    govdeDenetle(body.veri);
    if (op === "set") { kaydet(b, p, body.veri); return { ok: true }; }
    const eski = oku(b, p);
    if (eski === null) throw new Hata(404, "Güncellenecek belge yok.");
    kaydet(b, p, birlestir(eski, body.veri));
    return { ok: true };
  }

  /* Uzun yoklama: değişiklik varsa hemen, yoksa en çok `bekleMs` sonra döner. Yalnızca kişinin okuyabildiği yollar bildirilir. */
  async function akis(ctx, sonra, bekleMs = 25000) {
    const b = baglam(ctx);
    const simdiki = () => (q.siraGet.get(b.siteId) || { sira: 0 }).sira;
    if (!(sonra >= 0) || sonra >= simdiki()) {
      if (sonra >= 0) await new Promise(res => {
        const t = setTimeout(() => { const s = bekleyenler.get(b.siteId); if (s) s.delete(bitir); res(); }, bekleMs);
        function bitir() { clearTimeout(t); res(); }
        if (!bekleyenler.has(b.siteId)) bekleyenler.set(b.siteId, new Set());
        bekleyenler.get(b.siteId).add(bitir);
      });
    }
    const sira = simdiki();
    if (!(sonra >= 0)) return { sira, yollar: [] };
    const yollar = [...new Set(q.degisen.all(b.siteId, sonra).map(r => r.koleksiyon + "/" + r.belge_id))]
      .filter(y => izinli(b, y.split("/"), "read"));
    return { sira, yollar };
  }

  /* Fotoğraflar: yalnızca site üyeleri yükler; kişi başına toplam 50 MB. Kimlik 128 bit rastgeledir. */
  const TIPLER = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 };
  function varlikYukle(ctx, body) {
    const b = baglam(ctx);
    if (!TIPLER[body.tip]) throw new Hata(415, "Yalnızca JPEG, PNG ya da WebP yüklenebilir.");
    if (typeof body.veri !== "string" || body.veri.length > 4 * 1024 * 1024) throw new Hata(413, "Fotoğraf en çok 3 MB olabilir.");
    const buf = Buffer.from(body.veri, "base64");
    if (!buf.length || buf.length > 3 * 1024 * 1024) throw new Hata(413, "Fotoğraf en çok 3 MB olabilir.");
    const imza = body.tip === "image/png" ? buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) : body.tip === "image/jpeg" ? buf[0] === 0xff && buf[1] === 0xd8 : buf.subarray(8, 12).toString() === "WEBP";
    if (!imza) throw new Hata(415, "Dosya içeriği türüyle uyuşmuyor.");
    if (q.varlikToplam.get(b.siteId, b.userId).n + buf.length > 50 * 1024 * 1024) throw new Hata(413, "Fotoğraf kotanız doldu.");
    const id = crypto.randomBytes(16).toString("hex");
    q.varlikEkle.run(id, b.siteId, b.userId, body.tip, buf, buf.length, now());
    return { id, url: "/api/varlik/" + id, sizeBytes: buf.length, contentType: body.tip };
  }
  function varlikSil(ctx, id) {
    const b = baglam(ctx);
    if (!/^[0-9a-f]{32}$/.test(id)) throw new Hata(400, "Geçersiz kimlik.");
    q.varlikSil.run(id, b.siteId, b.userId);
    return { ok: true };
  }
  function varlik(id) { return /^[0-9a-f]{32}$/.test(id) ? q.varlikGet.get(id) : null; }

  /* Kişi siteden çıkarılınca ya da hesabını silince: o kişiye ait tüm belgeler (kimliğiyle anahtarlanan) ve fotoğrafları silinir. */
  function kisiSil(siteId, userId) {
    const uid = kimlik(siteId, userId), b = { siteId };
    const satirlar = db.prepare("SELECT koleksiyon, belge_id FROM belgeler WHERE site_id = ? AND veri IS NOT NULL AND (belge_id = ? OR koleksiyon = ? OR koleksiyon LIKE ?)")
      .all(siteId, uid, "data/users/" + uid, "data/users/" + uid + "/%");
    for (const r of satirlar) kaydet(b, [...r.koleksiyon.split("/"), r.belge_id], null);
    db.prepare("DELETE FROM varliklar WHERE site_id = ? AND user_id = ?").run(siteId, userId);
    return satirlar.length;
  }

  /* Sistem içi (kullanıcı kurallarından bağımsız) okuma ve birleştirme: moderasyon gibi sunucu işleri için. */
  function sistemOku(siteId, yol) { return oku({ siteId }, yol.split("/")); }
  function sistemGuncelle(siteId, yol, yama) {
    const p = yol.split("/"), b = { siteId }, eski = oku(b, p);
    if (eski === null) return false;
    kaydet(b, p, birlestir(eski, yama)); return true;
  }
  return { islem, akis, varlikYukle, varlikSil, varlik, kimlik, baglam, kisiSil, sistemOku, sistemGuncelle };
}

module.exports = { createBelgeler, KURALLAR, kuralBul, birlestir };
