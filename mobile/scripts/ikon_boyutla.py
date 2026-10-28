import sys, os
from PIL import Image
kok = sys.argv[1]
k = os.path.join(kok, "kaynak")
tam = Image.open(os.path.join(k, "ikon-1024.png")).convert("RGB")  # iOS saydamlık kabul etmez
tam.save(os.path.join(kok, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"))
on = Image.open(os.path.join(k, "ikon-on-plan-1024.png")).convert("RGBA")
res = os.path.join(kok, "android/app/src/main/res")
for ad, n in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    d = os.path.join(res, "mipmap-" + ad)
    kare = tam.resize((n, n), Image.LANCZOS)
    kare.save(os.path.join(d, "ic_launcher.png"))
    maske = Image.new("L", (n, n), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(maske).ellipse((0, 0, n - 1, n - 1), fill=255)
    yuvarlak = Image.new("RGBA", (n, n), (0, 0, 0, 0)); yuvarlak.paste(kare, (0, 0), maske)
    yuvarlak.save(os.path.join(d, "ic_launcher_round.png"))
    fg = int(n * 108 / 48)
    on.resize((fg, fg), Image.LANCZOS).save(os.path.join(d, "ic_launcher_foreground.png"))
# Play Store listesi ikonu 512×512
tam.resize((512, 512), Image.LANCZOS).save(os.path.join(k, "play-ikon-512.png"))
print("ikonlar yazıldı")
