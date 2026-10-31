package com.bilinclisakin.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.WallpaperManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.util.DisplayMetrics;

import java.io.IOException;
import java.util.Random;

/* Statik duvar kâğıdı değişimi (kütüphane gerektirmez, AlarmManager):
   - Aralıklı mod: ana ve kilit ekranına birbirinden bağımsız rastgele metin; bir sonraki değişim [en az, en çok] dakika
     arasında rastgele (ikisi eşitse sabit süre). Her değişimde bir sonraki alarm kurulur.
   - Günlük mod: her gün uygulamadaki "Günün ayeti/hadisi"; yaklaşık 3 saatte bir denetlenir, gün değiştiyse yenilenir.
   Telefon yeniden başlayınca (BOOT_COMPLETED) alarm yeniden kurulur. Android pil tasarrufu için alarmı birkaç dakika kaydırabilir. */
public class GunlukDuvarAlici extends BroadcastReceiver {
    static final String EYLEM = "com.bilinclisakin.app.HIKMET_GUNLUK";

    @Override
    public void onReceive(Context c, Intent i) {
        final String mod = HikmetHavuz.mod(c);
        if (!HikmetHavuz.MOD_GUNLUK.equals(mod) && !HikmetHavuz.MOD_ARALIK.equals(mod)) return;
        final boolean acilis = Intent.ACTION_BOOT_COMPLETED.equals(i.getAction());
        final PendingResult sonuc = goAsync();
        final Context uyg = c.getApplicationContext();
        new Thread(() -> {
            try {
                if (HikmetHavuz.MOD_GUNLUK.equals(mod)) { if (acilis) zamanla(uyg); uygula(uyg, false); }
                else {
                    long sonraki = HikmetHavuz.tercih(uyg).getLong("sonraki", 0);
                    if (!acilis || System.currentTimeMillis() >= sonraki) degistir(uyg);
                    sonrakiniKur(uyg, !acilis || System.currentTimeMillis() >= sonraki);
                }
            } finally { sonuc.finish(); }
        }, "hikmet-duvar").start();
    }

    /* Günlük: bugünün metni henüz uygulanmadıysa (ya da zorla) iki ekrana aynı metni koyar */
    static boolean uygula(Context c, boolean zorla) {
        int n = HikmetHavuz.adet(c);
        if (n <= 0) return false;
        int i = HikmetHavuz.gunIndeksi(n, System.currentTimeMillis());
        String anahtar = i + ":" + HikmetHavuz.tercih(c).getString("surum", "");
        if (!zorla && anahtar.equals(HikmetHavuz.tercih(c).getString("uygulanan", ""))) return false;
        boolean ok = ayarla(c, i, i);
        if (ok) HikmetHavuz.tercih(c).edit().putString("uygulanan", anahtar).apply();
        return ok;
    }
    /* Aralıklı: ana ve kilit ekranına desteden bağımsız rastgele yeni metin */
    static boolean degistir(Context c) {
        int a = HikmetHavuz.siradakiRastgele(c, "ana"), k = HikmetHavuz.siradakiRastgele(c, "kilit");
        return a >= 0 && ayarla(c, a, k);
    }
    private static boolean ayarla(Context c, int anaI, int kilitI) {
        DisplayMetrics dm = c.getResources().getDisplayMetrics();
        Bitmap ana = HikmetHavuz.yukle(c, "ana", anaI, dm.widthPixels, dm.heightPixels);
        Bitmap kilit = HikmetHavuz.yukle(c, "kilit", kilitI, dm.widthPixels, dm.heightPixels);
        if (ana == null) { if (kilit != null) kilit.recycle(); return false; }
        try {
            WallpaperManager wm = WallpaperManager.getInstance(c);
            if (!wm.isWallpaperSupported() || !wm.isSetWallpaperAllowed()) return false;
            wm.setBitmap(ana, null, true, WallpaperManager.FLAG_SYSTEM);
            wm.setBitmap(kilit != null ? kilit : ana, null, true, WallpaperManager.FLAG_LOCK);
            return true;
        } catch (IOException | SecurityException e) {
            return false;
        } finally {
            ana.recycle();
            if (kilit != null) kilit.recycle();
        }
    }

    private static PendingIntent bekleyen(Context c) {
        Intent i = new Intent(c, GunlukDuvarAlici.class).setAction(EYLEM);
        return PendingIntent.getBroadcast(c, 4242, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
    /* Günlük mod: yaklaşık 3 saatte bir denetim */
    static void zamanla(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.cancel(bekleyen(c));
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 60000L, 3 * AlarmManager.INTERVAL_HOUR, bekleyen(c));
    }
    /* Aralıklı mod: bir sonraki değişim zamanını rastgele seçip tek seferlik alarm kurar (yeni=false ise kayıtlı zamanı korur) */
    static long sonrakiniKur(Context c, boolean yeni) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;
        SharedPreferences p = HikmetHavuz.tercih(c);
        long t = p.getLong("sonraki", 0);
        if (yeni || t <= System.currentTimeMillis()) {
            t = System.currentTimeMillis() + HikmetHavuz.sonrakiGecikmeMs(HikmetHavuz.aralikEnAz(c), HikmetHavuz.aralikEnCok(c), new Random());
            p.edit().putLong("sonraki", t).apply();
        }
        am.cancel(bekleyen(c));
        am.setAndAllowWhileIdle(AlarmManager.RTC, t, bekleyen(c));
        return t;
    }
    static void iptal(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(bekleyen(c));
        HikmetHavuz.tercih(c).edit().remove("sonraki").apply();
    }
}
