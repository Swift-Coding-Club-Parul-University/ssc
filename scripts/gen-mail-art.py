#!/usr/bin/env python3
"""Background art v2: bright white backdrop + dark hero for the SSC update mail."""
from PIL import Image, ImageDraw, ImageFilter
import random

OUT = r"C:\Users\Admin\desktop\ssc\public\logos"

# ---------- 1. OUTER BACKDROP (white base, soft bright glows) ----------
W, H = 1200, 1500
img = Image.new("RGB", (W, H), (255, 255, 255))
px = img.load()

# very faint vertical shade: pure white -> #fbfdfd
for y in range(H):
    t = y / H
    v_r = 255
    v_g = int(255 - 4 * t)
    v_b = int(255 - 3 * t)
    for x in range(W):
        px[x, y] = (v_r, v_g, v_b)

# bright, soft glow blobs (barely-there warm neutrals — keeps backdrop reading white)
glow = Image.new("RGB", (W, H), (0, 0, 0))
gd = ImageDraw.Draw(glow)
random.seed(11)
blobs = [
    (150, 200, 360, (255, 236, 228)),   # warm blush top-left
    (1060, 160, 320, (240, 240, 246)),  # cool neutral top-right
    (600, 1400, 460, (255, 240, 232)),  # warm bottom
    (980, 880, 280, (244, 238, 250)),   # soft lilac mid
    (260, 980, 260, (255, 244, 232)),   # cream hint
]
for cx, cy, rad, col in blobs:
    gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)
glow = glow.filter(ImageFilter.GaussianBlur(190))

# blend glow softly onto white (very low intensity)
gp = glow.load()
for y in range(H):
    for x in range(W):
        gr, gg, gb = gp[x, y]
        br, bg, bb = px[x, y]
        px[x, y] = (
            min(255, int(br + (gr - 235) * 0.28)),
            min(255, int(bg + (gg - 235) * 0.28)),
            min(255, int(bb + (gb - 235) * 0.28)),
        )

# faint white light streaks
streak = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(streak)
for i in range(-3, 8):
    x0 = i * 190
    sd.line([(x0, H), (x0 + 420, 0)], fill=(255, 255, 255, 90), width=70)
streak = streak.filter(ImageFilter.GaussianBlur(45))
base = Image.alpha_composite(img.convert("RGBA"), streak).convert("RGB")
base.save(OUT + r"\mail-backdrop.png", optimize=True)
print("backdrop:", base.size)

# ---------- 2. DARK HERO (black + teal/aqua glow, glass vibe) ----------
HW, HH = 1200, 660
hero = Image.new("RGB", (HW, HH), (5, 5, 7))
hpx = hero.load()
for y in range(HH):
    t = y / HH
    v = int(5 + 10 * t)
    for x in range(HW):
        hpx[x, y] = (v, v, v + 2)

hglow = Image.new("RGB", (HW, HH), (0, 0, 0))
hd = ImageDraw.Draw(hglow)
hd.ellipse([HW - 520, -260, HW + 240, 480], fill=(0, 150, 135))   # teal top-right
hd.ellipse([-260, HH - 380, 420, HH + 220], fill=(0, 110, 100))   # teal bottom-left
hd.ellipse([HW // 2 - 300, HH - 260, HW // 2 + 300, HH + 240], fill=(40, 30, 80))  # lilac center
hglow = hglow.filter(ImageFilter.GaussianBlur(150))
hp = hglow.load()
for y in range(HH):
    for x in range(HW):
        gr, gg, gb = hp[x, y]
        br, bg, bb = hpx[x, y]
        hpx[x, y] = (min(255, br + gr), min(255, bg + gg), min(255, bb + gb))

# fine dot grid
dots = Image.new("RGBA", (HW, HH), (0, 0, 0, 0))
dd = ImageDraw.Draw(dots)
for gy in range(0, HH, 34):
    for gx in range(0, HW, 34):
        dd.ellipse([gx, gy, gx + 2, gy + 2], fill=(255, 255, 255, 14))
hero = Image.alpha_composite(hero.convert("RGBA"), dots).convert("RGB")
hero.save(OUT + r"\mail-hero-dark.png", optimize=True)
print("hero:", hero.size)
