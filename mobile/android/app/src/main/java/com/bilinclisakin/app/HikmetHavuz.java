package com.bilinclisakin.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.File;
import java.util.Random;
import java.util.TimeZone;

/* Otomatik Hikmet duvar kâğıdı için görsel havuzu ve sıra.
   Görseller uygulamada (WebView, Amiri yazı tipiyle) üretilir ve files/hikmet/ana-<i>.jpg, kilit-<i>.jpg olarak yazılır.
   Günlük modda sıra uygulamadaki "Günün ayeti/hadisi" ile aynıdır: (yerel gün sayısı) mod n.
   Aralıklı ve "her açılışta" modlarında ana ve kilit ekranı birbirinden bağımsız, karıştırılmış bir desteden seçilir:
   deste bitmeden aynı metin tekrar gelmez, yeni destenin ilki son gösterilenle aynı olmaz. */
final class HikmetHavuz {
    static final String TERCIH = "bs_hikmet";
    static final String MOD_ACILIS = "acilis", MOD_GUNLUK = "gunluk", MOD_ARALIK = "aralik", MOD_KAPALI = "kapali";
    static final int ARALIK_EN_AZ_DK = 15, ARALIK_EN_COK_DK = 1440;

    private HikmetHavuz() {}

    static File klasor(Context c) {
        File f = new File(c.getFilesDir(), "hikmet");
        if (!f.exists()) f.mkdirs();
        return f;
    }
    static SharedPreferences tercih(Context c) { return c.getSharedPreferences(TERCIH, Context.MODE_PRIVATE); }
    static int adet(Context c) { return tercih(c).getInt("n", 0); }
    static String mod(Context c) { return tercih(c).getString("mod", MOD_KAPALI); }

    static int gunIndeksi(int n, long zaman) {
        long gun = Math.floorDiv(zaman + TimeZone.getDefault().getOffset(zaman), 86400000L);
        return (int) Math.floorMod(gun, (long) n);
    }
    /* Karıştırılmış deste (Fisher–Yates); ilk eleman "son" ile aynı olmaz */
    static int[] yeniDeste(int n, int son, Random r) {
        int[] d = new int[n];
        for (int i = 0; i < n; i++) d[i] = i;
        for (int i = n - 1; i > 0; i--) { int j = r.nextInt(i + 1); int t = d[i]; d[i] = d[j]; d[j] = t; }
        if (n > 1 && d[0] == son) { int j = 1 + r.nextInt(n - 1); int t = d[0]; d[0] = d[j]; d[j] = t; }
        return d;
    }
    /* Aralıklı mod: [en az, en çok] dakika arasında rastgele bekleme; eşitse sabit süre */
    static long sonrakiGecikmeMs(int enAzDk, int enCokDk, Random r) {
        int a = Math.min(ARALIK_EN_COK_DK, Math.max(ARALIK_EN_AZ_DK, Math.min(enAzDk, enCokDk)));
        int b = Math.max(a, Math.min(ARALIK_EN_COK_DK, Math.max(enAzDk, enCokDk)));
        return (a + (b > a ? r.nextInt(b - a + 1) : 0)) * 60000L;
    }
    private static int[] desteOku(String s) {
        if (s == null || s.isEmpty()) return new int[0];
        String[] p = s.split(",");
        int[] d = new int[p.length];
        try { for (int i = 0; i < p.length; i++) d[i] = Integer.parseInt(p[i]); } catch (NumberFormatException e) { return new int[0]; }
        return d;
    }
    private static String desteYaz(int[] d) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < d.length; i++) { if (i > 0) b.append(','); b.append(d[i]); }
        return b.toString();
    }
    /* Bu ekran için desteden sıradaki rastgele metni seçer ve kaydeder */
    static int siradakiRastgele(Context c, String ekran) {
        int n = adet(c);
        if (n <= 0) return -1;
        SharedPreferences p = tercih(c);
        int[] deste = desteOku(p.getString("deste_" + ekran, ""));
        int poz = p.getInt("poz_" + ekran, 0);
        if (deste.length != n || poz >= n) { deste = yeniDeste(n, p.getInt("goster_" + ekran, -1), new Random()); poz = 0; }
        int i = Math.floorMod(deste[poz], n);
        p.edit().putString("deste_" + ekran, desteYaz(deste)).putInt("poz_" + ekran, poz + 1).putInt("goster_" + ekran, i).apply();
        return i;
    }
    /* Şu an bu ekranda gösterilecek metin */
    static int gosterilen(Context c, String ekran) {
        int n = adet(c);
        if (n <= 0) return -1;
        if (MOD_GUNLUK.equals(mod(c))) return gunIndeksi(n, System.currentTimeMillis());
        int g = tercih(c).getInt("goster_" + ekran, -1);
        return g >= 0 && g < n ? g : siradakiRastgele(c, ekran);
    }
    static int aralikEnAz(Context c) { return tercih(c).getInt("aralikMin", 60); }
    static int aralikEnCok(Context c) { return tercih(c).getInt("aralikMax", 180); }

    static File dosya(Context c, String ekran, int i) { return new File(klasor(c), ekran + "-" + i + ".jpg"); }

    /* Hedef boyuta yakın örnekleme ile çözer (bellek dostu) */
    static Bitmap yukle(Context c, String ekran, int i, int en, int boy) {
        File f = dosya(c, ekran, i);
        if (!f.exists()) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(f.getAbsolutePath(), o);
        int ornek = 1;
        while (en > 0 && boy > 0 && o.outWidth / (ornek * 2) >= en && o.outHeight / (ornek * 2) >= boy) ornek *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = ornek;
        return BitmapFactory.decodeFile(f.getAbsolutePath(), o2);
    }
}
