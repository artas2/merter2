package com.bilinclisakin.app;

import android.Manifest;
import android.app.WallpaperManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/* Hikmet duvar kâğıdı: ana ekran / kilit ekranı olarak ayarlar ya da galeriye kaydeder.
   Android 10+ galeriye kaydetmek için izin istemez; Android 7–9'da depolama izni sorulur. */
@CapacitorPlugin(name = "BSDuvar", permissions = { @Permission(strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }, alias = "galeri") })
public class BSDuvarPlugin extends Plugin {

    private Bitmap coz(PluginCall call) {
        String b = call.getString("base64");
        if (b == null || b.isEmpty()) { call.reject("Resim gönderilmedi."); return null; }
        byte[] d;
        try { d = Base64.decode(b, Base64.DEFAULT); } catch (IllegalArgumentException e) { call.reject("Resim çözülemedi."); return null; }
        Bitmap bm = BitmapFactory.decodeByteArray(d, 0, d.length);
        if (bm == null) call.reject("Resim çözülemedi.");
        return bm;
    }

    @PluginMethod
    public void ayarla(PluginCall call) {
        Bitmap bm = coz(call);
        if (bm == null) return;
        String hedef = call.getString("hedef", "ana");
        int bayrak = "kilit".equals(hedef) ? WallpaperManager.FLAG_LOCK
            : "ikisi".equals(hedef) ? (WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK) : WallpaperManager.FLAG_SYSTEM;
        getBridge().execute(() -> {
            try {
                WallpaperManager wm = WallpaperManager.getInstance(getContext());
                if (!wm.isWallpaperSupported() || !wm.isSetWallpaperAllowed()) { call.reject("Bu cihazda duvar kâğıdı değiştirilemiyor."); return; }
                wm.setBitmap(bm, null, true, bayrak);
                call.resolve();
            } catch (IOException | SecurityException e) {
                call.reject("Duvar kâğıdı ayarlanamadı.", e);
            }
        });
    }

    @PluginMethod
    public void kaydet(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("galeri") != PermissionState.GRANTED) {
            requestPermissionForAlias("galeri", call, "galeriIzni");
            return;
        }
        kaydetIc(call);
    }

    @PermissionCallback
    private void galeriIzni(PluginCall call) {
        if (getPermissionState("galeri") == PermissionState.GRANTED) kaydetIc(call);
        else call.reject("Galeriye kaydetmek için depolama izni gerekli.");
    }

    private void kaydetIc(PluginCall call) {
        Bitmap bm = coz(call);
        if (bm == null) return;
        String ad = call.getString("ad", "hikmet.png").replaceAll("[^A-Za-z0-9._-]", "_");
        getBridge().execute(() -> {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver cr = getContext().getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, ad);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Bilincli Sakin");
                    v.put(MediaStore.Images.Media.IS_PENDING, 1);
                    Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) { call.reject("Galeriye kaydedilemedi."); return; }
                    try (OutputStream os = cr.openOutputStream(uri)) { bm.compress(Bitmap.CompressFormat.PNG, 100, os); }
                    v.clear(); v.put(MediaStore.Images.Media.IS_PENDING, 0); cr.update(uri, v, null, null);
                } else {
                    File klasor = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Bilincli Sakin");
                    if (!klasor.exists() && !klasor.mkdirs()) { call.reject("Klasör oluşturulamadı."); return; }
                    File f = new File(klasor, ad);
                    try (FileOutputStream os = new FileOutputStream(f)) { bm.compress(Bitmap.CompressFormat.PNG, 100, os); }
                    android.media.MediaScannerConnection.scanFile(getContext(), new String[] { f.getAbsolutePath() }, new String[] { "image/png" }, null);
                }
                call.resolve();
            } catch (IOException | SecurityException e) {
                call.reject("Galeriye kaydedilemedi.", e);
            }
        });
    }
}
