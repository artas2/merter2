package com.bilinclisakin.app;
public class SiraDenet { public static void main(String[] a) {
  long[] t = { 1793441602000L, 1793476799000L, 1793476800000L, 1793487600000L, 1700000000000L, 1735689599000L, 1735700400000L };
  StringBuilder s = new StringBuilder(); for (long x : t) s.append(HikmetHavuz.gunIndeksi(23, x)).append(' '); System.out.println(s.toString().trim()); } }
