package com.bilinclisakin.app;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.Build;
import android.service.wallpaper.WallpaperService;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.view.SurfaceHolder;

/* Canlı duvar kâğıdı: telefon her açıldığında (ekran açılınca) rastgele yeni bir ayet ya da hadise geçer;
   ana ve kilit ekranı birbirinden bağımsız seçilir.
   Kilit ekranındayken "kilit" düzeni (yazı aşağıda, saat alanı boş), kilit açılınca "ana" düzeni çizilir.
   Günlük modda her gün uygulamadaki "Günün ayeti/hadisi" gösterilir. Çizim yalnızca görünürken ve olay olunca yapılır (pil dostu). */
public class HikmetDuvarServisi extends WallpaperService {
    @Override
    public Engine onCreateEngine() { return new Motor(); }

    private class Motor extends Engine {
        private int en, boy;
        private String sonAnahtar = "";
        private Bitmap resim;
        private boolean kayitli;

        private final BroadcastReceiver alici = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) {
                if (Intent.ACTION_SCREEN_ON.equals(i.getAction())) {
                    if (HikmetHavuz.MOD_ACILIS.equals(HikmetHavuz.mod(c)) && !isPreview()) {
                        HikmetHavuz.siradakiRastgele(c, "ana");
                        HikmetHavuz.siradakiRastgele(c, "kilit");
                    }
                    ciz();
                } else if (Intent.ACTION_USER_PRESENT.equals(i.getAction())) {
                    ciz();
                }
            }
        };

        @Override
        public void onCreate(SurfaceHolder s) {
            super.onCreate(s);
            IntentFilter f = new IntentFilter();
            f.addAction(Intent.ACTION_SCREEN_ON);
            f.addAction(Intent.ACTION_USER_PRESENT);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(alici, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(alici, f);
            kayitli = true;
        }

        @Override
        public void onDestroy() {
            if (kayitli) { try { unregisterReceiver(alici); } catch (IllegalArgumentException e) { /* zaten kaldırıldı */ } kayitli = false; }
            if (resim != null) { resim.recycle(); resim = null; }
            super.onDestroy();
        }

        @Override
        public void onVisibilityChanged(boolean gorunur) { if (gorunur) ciz(); }

        @Override
        public void onSurfaceChanged(SurfaceHolder s, int bicim, int w, int h) {
            super.onSurfaceChanged(s, bicim, w, h);
            en = w; boy = h; sonAnahtar = ""; ciz();
        }

        private void ciz() {
            SurfaceHolder s = getSurfaceHolder();
            if (s == null || en <= 0 || boy <= 0) return;
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            String ekran = km != null && km.isKeyguardLocked() ? "kilit" : "ana";
            int i = HikmetHavuz.gosterilen(HikmetDuvarServisi.this, ekran);
            String anahtar = ekran + ":" + i + ":" + en + "x" + boy;
            if (!anahtar.equals(sonAnahtar)) {
                if (resim != null) { resim.recycle(); resim = null; }
                if (i >= 0) {
                    resim = HikmetHavuz.yukle(HikmetDuvarServisi.this, ekran, i, en, boy);
                    if (resim == null && "kilit".equals(ekran)) resim = HikmetHavuz.yukle(HikmetDuvarServisi.this, "ana", i, en, boy);
                }
                sonAnahtar = anahtar;
            }
            Canvas c = null;
            try {
                c = s.lockCanvas();
                if (c == null) return;
                if (resim != null) {
                    // Ortala ve kırp (cover)
                    float olcek = Math.max((float) en / resim.getWidth(), (float) boy / resim.getHeight());
                    int w = Math.round(en / olcek), h = Math.round(boy / olcek);
                    int x = (resim.getWidth() - w) / 2, y = (resim.getHeight() - h) / 2;
                    c.drawBitmap(resim, new Rect(x, y, x + w, y + h), new Rect(0, 0, en, boy), new Paint(Paint.FILTER_BITMAP_FLAG));
                } else {
                    c.drawColor(Color.rgb(31, 107, 90));
                    TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                    p.setColor(Color.WHITE);
                    p.setTextSize(en / 22f);
                    String yazi = "Bilinçli Sakin uygulamasında Hikmet › Otomatik duvar kâğıdı bölümünü açın.";
                    StaticLayout l = StaticLayout.Builder.obtain(yazi, 0, yazi.length(), p, en * 3 / 4)
                        .setAlignment(Layout.Alignment.ALIGN_CENTER).build();
                    c.save(); c.translate(en / 8f, boy / 2f - l.getHeight() / 2f); l.draw(c); c.restore();
                }
            } finally {
                if (c != null) { try { s.unlockCanvasAndPost(c); } catch (IllegalStateException | IllegalArgumentException e) { /* yüzey kapandı */ } }
            }
        }
    }
}
