#!/usr/bin/env python3
"""Generate background art for the SSC update mail (light backdrop + dark hero)."""
from PIL import Image, ImageDraw, ImageFilter
import math, random

OUT = r"C:\Users\Admin\desktop\ssc\public\logos"

# ---------- 1. OUTER BACKDROP (light, soft glows) ----------
W, H = 1200, 1500
img = Image.new("RGB", (W, H), (245, 245, 247))
px = img.load()

# vertical gradient: #f5f5f7 -> slightly cooler at bottom
for y in range(H):
    t = y / H
    r = int(247 - 8 * t)
    g = int(247 - 6 * t)
    b = int(250 - 4 * t)
    for x in range(W):
        px[x, y] = (r, g, b)

# soft glow blobs (Apple-ish aurora, very subtle)
glow = Image.new("RGB", (W, H), (0, 0, 0))
gd = ImageDraw.Draw(glow)
random.seed(7)
blobs = [
    (180, 220, 340, (0, 113, 227)),   # apple blue
    (1040, 180, 300, (10, 132, 255)),  # brighter blue
    (600, 1380, 420, (100, 180, 255)), # bottom cyan-blue
    (950, 900, 260, (150, 200, 255)),  # mid soft
]
for cx, cy, rad, col in blobs:
    gd.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=col)
glow = glow.filter(ImageFilter.GaussianBlur(180))

# composite glow at low opacity
img = Image.blend(img, Image.blend(img, glow, 0.0), 0.0)  # keep base
base = img.convert("RGB")
glow_px = glow.load()
base_px = base.load()
for y in range(H):
    for x in range(W):
        gr, gg, gb = glow_px[x, y]
        br, bg, bb = base_px[x, y]
        # screen-ish blend, very light
        base_px[x, y] = (
            min(255, int(br + gr * 0.10)),
            min(255, int(bg + gg * 0.10)),
            min(255, int(bb + gb * 0.10)),
        )

# faint diagonal light streaks
streak = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(streak)
for i in range(-3, 8):
    x0 = i * 190
    sd.line([(x0, H), (x0 + 420, 0)], fill=(255, 255, 255, 26), width=60)
streak = streak.filter(ImageFilter.GaussianBlur(40))
base = Image.alpha_composite(base.convert("RGBA"), streak).convert("RGB")
base.save(OUT + r"\mail-backdrop.png", optimize=True)
print("backdrop:", base.size)

# ---------- 2. DARK HERO (pure black + blue glow, Apple event style) ----------
HW, HH = 1200, 660
hero = Image.new("RGB", (HW, HH), (5, 5, 7))
hpx = hero.load()
# subtle vertical fade to #101014
for y in range(HH):
    t = y / HH
    v = int(5 + 12 * t)
    for x in range(HW):
        hpx[x, y] = (v, v, v + 2)

# blue radial glow top-right + cyan bottom-left
hglow = Image.new("RGB", (HW, HH), (0, 0, 0))
hd = ImageDraw.Draw(hglow)
hd.ellipse([HW - 520, -260, HW + 240, 480], fill=(0, 90, 200))
hd.ellipse([-260, HH - 380, 420, HH + 220], fill=(0, 60, 140))
hd.ellipse([HW // 2 - 300, HH - 260, HW // 2 + 300, HH + 240], fill=(20, 40, 90))
hglow = hglow.filter(ImageFilter.GaussianBlur(150))
hp = hglow.load()
for y in range(HH):
    for x in range(HW):
        gr, gg, gb = hp[x, y]
        br, bg, bb = hpx[x, y]
        hpx[x, y] = (min(255, br + gr), min(255, bg + gg), min(255, bb + gb))

# fine dot grid (barely visible, adds texture)
hd2 = ImageDraw.Draw(hero.convert("RGBA"))
dots = Image.new("RGBA", (HW, HH), (0, 0, 0, 0))
dd = ImageDraw.Draw(dots)
for gy in range(0, HH, 34):
    for gx in range(0, HW, 34):
        dd.ellipse([gx, gy, gx + 2, gy + 2], fill=(255, 255, 255, 14))
hero = Image.alpha_composite(hero.convert("RGBA"), dots).convert("RGB")
hero.save(OUT + r"\mail-hero-dark.png", optimize=True)
print("hero:", hero.size)
