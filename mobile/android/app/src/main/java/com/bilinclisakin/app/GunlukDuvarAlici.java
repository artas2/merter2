package com.bilinclisakin.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.WallpaperManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.util.DisplayMetrics;

import java.io.IOException;

/* Günlük mod: ana ekran ve kilit ekranı birlikte, her gün uygulamadaki "Günün ayeti/hadisi" ile değişir.
   Kütüphane gerektirmez: AlarmManager yaklaşık 3 saatte bir uyanır, gün değiştiyse duvar kâğıdını yeniler.
   Telefon yeniden başlayınca (BOOT_COMPLETED) alarm yeniden kurulur. */
public class GunlukDuvarAlici extends BroadcastReceiver {
    static final String EYLEM = "com.bilinclisakin.app.HIKMET_GUNLUK";

    @Override
    public void onReceive(Context c, Intent i) {
        if (!HikmetHavuz.MOD_GUNLUK.equals(HikmetHavuz.mod(c))) return;
        if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) zamanla(c);
        final PendingResult sonuc = goAsync();
        final Context uyg = c.getApplicationContext();
        new Thread(() -> {
            try { uygula(uyg, false); } finally { sonuc.finish(); }
        }, "hikmet-gunluk").start();
    }

    /* Bugünün metni henüz uygulanmadıysa (ya da zorla) ana ve kilit ekranını ayarlar. true = değişti */
    static boolean uygula(Context c, boolean zorla) {
        int n = HikmetHavuz.adet(c);
        if (n <= 0) return false;
        int i = HikmetHavuz.gunIndeksi(n, System.currentTimeMillis());
        String anahtar = i + ":" + HikmetHavuz.tercih(c).getString("surum", "");
        if (!zorla && anahtar.equals(HikmetHavuz.tercih(c).getString("uygulanan", ""))) return false;
        DisplayMetrics dm = c.getResources().getDisplayMetrics();
        Bitmap ana = HikmetHavuz.yukle(c, "ana", i, dm.widthPixels, dm.heightPixels);
        Bitmap kilit = HikmetHavuz.yukle(c, "kilit", i, dm.widthPixels, dm.heightPixels);
        if (ana == null) return false;
        try {
            WallpaperManager wm = WallpaperManager.getInstance(c);
            if (!wm.isWallpaperSupported() || !wm.isSetWallpaperAllowed()) return false;
            wm.setBitmap(ana, null, true, WallpaperManager.FLAG_SYSTEM);
            wm.setBitmap(kilit != null ? kilit : ana, null, true, WallpaperManager.FLAG_LOCK);
            HikmetHavuz.tercih(c).edit().putString("uygulanan", anahtar).apply();
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
    static void zamanla(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 60000L, 3 * AlarmManager.INTERVAL_HOUR, bekleyen(c));
    }
    static void iptal(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(bekleyen(c));
    }
}
