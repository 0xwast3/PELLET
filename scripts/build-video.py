"""Renders the 10-second buyback clip from two 4x page captures.

Capture step (see CHANGELOG 0.8.2): screenshot the landing page at
device_scale_factor=4 into src-top.png and src-buy.png, then run this file.
Every crop stays at or above 480 CSS px wide, which is exactly 1920px in the
4x source, so no frame is ever upscaled.
"""
from PIL import Image
import math, os, shutil

DSF = 4
OUT_W, OUT_H = 1920, 1080
FPS = 60
XFADE = 10
NATIVE_MIN = OUT_W / DSF        # 480 CSS px — the tightest crop that is still native 1080p

src = {'top': Image.open('src-top.png').convert('RGB'),
       'buy': Image.open('src-buy.png').convert('RGB')}
SRC_W, SRC_H = src['top'].width / DSF, src['top'].height / DSF

def rect(cx, cy, w):
    w = max(NATIVE_MIN, min(w, SRC_W))
    h = w * OUT_H / OUT_W
    return (min(max(cx - w/2, 0), SRC_W - w), min(max(cy - h/2, 0), SRC_H - h), w, h)

smoother = lambda t: t*t*t*(t*(t*6-15)+10)

# element geometry, CSS px
H2      = (370, 87, 716, 87)
LEDGER  = (1120, 135, 430, 364)
DECIDED = (1121, 136, 213, 362)
NOTDEC  = (1336, 136, 213, 362)

SHOTS = [
    # establishing: the lime bar and the brand, easing in
    ('top', rect(860, 300, 1900), rect(700, 250, 1480),  96),
    # the claim, framed so the headline never gets cut by an edge
    ('buy', rect(728, 300, 1180), rect(728, 150, 900),  150),
    # what holders actually get: pan down the DECIDED column
    ('buy', rect(1215, 190, 600), rect(1215, 410, 545), 186),
    # the honest half, then pull back to both columns at once
    ('buy', rect(1440, 250, 545), rect(940, 280, 1820), 198),
]

def render(i, key, a, b, n):
    d = f'shot{i}'; shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    img = src[key]
    for f in range(n):
        t = smoother(f / (n - 1))
        w = a[2] * (b[2] / a[2]) ** t                      # geometric zoom reads smoother than linear
        cx = (a[0] + a[2]/2) + ((b[0] + b[2]/2) - (a[0] + a[2]/2)) * t
        cy = (a[1] + a[3]/2) + ((b[1] + b[3]/2) - (a[1] + a[3]/2)) * t
        x, y, rw, rh = rect(cx, cy, w)
        # clamp after rounding: rect() clamps in CSS px, but the pixel box can
        # still land one unit outside the source once it is scaled by DSF
        x0 = max(0, min(round(x * DSF), img.width - 2))
        y0 = max(0, min(round(y * DSF), img.height - 2))
        x1 = min(img.width, max(x0 + 2, round((x + rw) * DSF)))
        y1 = min(img.height, max(y0 + 2, round((y + rh) * DSF)))
        box = (x0, y0, x1, y1)
        img.resize((OUT_W, OUT_H), Image.LANCZOS, box=box).save(f'{d}/{f:04d}.jpg', quality=96)
    return d, n

dirs = [render(i, *s) for i, s in enumerate(SHOTS)]
shutil.rmtree('frames', ignore_errors=True); os.makedirs('frames')
out, tail = 0, []
for di, (d, n) in enumerate(dirs):
    for f in range(n):
        im = Image.open(f'{d}/{f:04d}.jpg')
        if tail and f < XFADE:
            im = Image.blend(tail[f], im, (f + 1) / (XFADE + 1))
        elif tail and f == XFADE:
            tail = []
        if di < len(dirs) - 1 and f >= n - XFADE:
            continue
        im.save(f'frames/{out:05d}.jpg', quality=96); out += 1
    if di < len(dirs) - 1:
        tail = [Image.open(f'{d}/{f:04d}.jpg') for f in range(n - XFADE, n)]
print('frames:', out, '=', round(out / FPS, 3), 's')
