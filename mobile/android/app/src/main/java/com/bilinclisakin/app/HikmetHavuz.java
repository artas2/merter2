package com.bilinclisakin.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.File;
import java.util.TimeZone;

/* Otomatik Hikmet duvar kâğıdı için görsel havuzu ve sıra.
   Görseller uygulamada (WebView, Amiri yazı tipiyle) üretilir ve files/hikmet/ana-<i>.jpg, kilit-<i>.jpg olarak yazılır.
   Günlük sıra uygulamadaki "Günün ayeti/hadisi" ile aynıdır: (yerel gün sayısı) mod n. */
final class HikmetHavuz {
    static final String TERCIH = "bs_hikmet";
    static final String MOD_ACILIS = "acilis", MOD_GUNLUK = "gunluk", MOD_KAPALI = "kapali";

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
    /* Şu an gösterilecek sıra: günlükte bugünün metni, her açılışta kayıtlı sıra (ilk kez bugünün metniyle başlar) */
    static int sira(Context c) {
        int n = adet(c);
        if (n <= 0) return -1;
        SharedPreferences p = tercih(c);
        if (MOD_ACILIS.equals(mod(c))) return Math.floorMod(p.getInt("sira", gunIndeksi(n, System.currentTimeMillis())), n);
        return gunIndeksi(n, System.currentTimeMillis());
    }
    static int ilerlet(Context c) {
        int n = adet(c);
        if (n <= 0) return -1;
        int s = (sira(c) + 1) % n;
        tercih(c).edit().putInt("sira", s).apply();
        return s;
    }
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
