package com.bilinclisakin.app;
import java.util.*;
public class RastgeleDenet { public static void main(String[] a) {
  Random r = new Random(42); int hata = 0;
  // 1) Deste: her biri 0..n-1 permütasyonu ve ilk eleman son gösterilenle aynı değil
  for (int t = 0; t < 20000; t++) { int n = 1 + r.nextInt(30), son = r.nextInt(n); int[] d = HikmetHavuz.yeniDeste(n, son, r);
    boolean[] g = new boolean[n]; for (int x : d) { if (x < 0 || x >= n || g[x]) hata++; else g[x] = true; } if (n > 1 && d[0] == son) hata++; }
  // 2) Desteler arka arkaya: 23'lük bir turda tekrar yok, tur geçişinde aynı metin art arda gelmez
  int son = -1, arda = 0; for (int tur = 0; tur < 2000; tur++) { int[] d = HikmetHavuz.yeniDeste(23, son, r); if (d[0] == son) arda++; son = d[22]; }
  // 3) Gecikme: [en az, en çok] dakika içinde, eşitse sabit; sınırlar 15 dk – 24 sa
  long enAz = Long.MAX_VALUE, enCok = 0; for (int t = 0; t < 20000; t++) { long g = HikmetHavuz.sonrakiGecikmeMs(60, 180, r); enAz = Math.min(enAz, g); enCok = Math.max(enCok, g); }
  long sabit = HikmetHavuz.sonrakiGecikmeMs(180, 180, r), alt = HikmetHavuz.sonrakiGecikmeMs(1, 5, r), ust = HikmetHavuz.sonrakiGecikmeMs(2000, 3000, r);
  // 4) Dağılım: 23 metin 23000 seçimde kabaca eşit (her biri ~1000)
  int[] say = new int[23]; for (int t = 0; t < 1000; t++) for (int x : HikmetHavuz.yeniDeste(23, -1, r)) say[x]++;
  boolean ok = hata == 0 && arda == 0 && enAz >= 60 * 60000L && enCok <= 180 * 60000L && sabit == 180 * 60000L && alt == 15 * 60000L && ust == 1440 * 60000L;
  System.out.println((ok ? "TAMAM " : "HATA ") + "deste hatası=" + hata + " ardArda=" + arda + " gecikme=" + enAz / 60000 + "-" + enCok / 60000 + "dk sabit=" + sabit / 60000 + " alt=" + alt / 60000 + " ust=" + ust / 60000 + " dagilim=" + Arrays.stream(say).min().getAsInt() + ".." + Arrays.stream(say).max().getAsInt());
  if (!ok) System.exit(1);
} }
