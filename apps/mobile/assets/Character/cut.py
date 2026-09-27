"""Cut character expressions out of CharSet.jpeg into transparent PNGs.

Background removal: flood-fill from the crop border through pixels close to the
sheet's light-gray background. The character's dark outline stops the fill, so
white hoodie/muzzle inside the outline is kept. Edge pixels get soft alpha to
avoid a jagged/haloed rim.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter, ImageChops

# Sheet faces are ~240px. Pre-upscale with Lanczos (+ light sharpen) so phones only ever
# downscale; device upscaling of a small PNG is what makes sprites look pixelated.
UPSCALE = 2

# Usage (from this folder): python cut.py  -> writes expressions/*.png
SRC = sys.argv[1] if len(sys.argv) > 1 else 'CharSet.jpeg'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'expressions'
PX, PY = 20, 665  # panel offset in the full sheet

# "Flat sticker" style: flattens the airbrushed AI shading into clean color blocks and adds a
# white die-cut border + soft shadow, so the mascot reads as a designed sticker set.
STYLE = 'sticker'  # 'sticker' | 'flat' | 'raw'

def flatten(im, colors=32, smooth=2):
    a = im.getchannel('A')
    rgb = im.convert('RGB')
    for _ in range(smooth):
        rgb = rgb.filter(ImageFilter.MedianFilter(3))
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, kmeans=4, dither=Image.Dither.NONE).convert('RGB')
    out = q.filter(ImageFilter.ModeFilter(3)).convert('RGBA')
    out.putalpha(a)
    return out

def sticker(im, border=10):
    pad = border * 3
    w, h = im.size
    canvas = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    a = Image.new('L', canvas.size, 0)
    a.paste(im.getchannel('A').point(lambda v: 255 if v > 40 else 0), (pad, pad))
    outline = a.filter(ImageFilter.MaxFilter(border * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v > 110 else 0)
    shadow = Image.new('RGBA', canvas.size, (120, 70, 90, 0))
    shadow.putalpha(ImageChops.offset(outline.filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.22)), 0, 6))
    canvas = Image.alpha_composite(canvas, shadow)
    white = Image.new('RGBA', canvas.size, (255, 255, 255, 0))
    white.putalpha(outline)
    canvas = Image.alpha_composite(canvas, white)
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(im, (pad, pad), im)
    return Image.alpha_composite(canvas, layer)

BOXES = {  # panel coords (x0, y0, x1, y1)
    'senang':    (20, 55, 230, 295),
    'wink':      (240, 55, 430, 295),
    'tertawa':   (455, 55, 682, 295),
    'terkejut':  (692, 55, 882, 295),
    'tenang':    (895, 55, 1075, 295),
    'berpikir':  (1100, 55, 1330, 295),
    'bingung':   (1340, 55, 1548, 295),
    'semangat':  (255, 335, 470, 578),
    'malu':      (490, 335, 690, 578),
    'menyapa':   (728, 335, 962, 578),
    'mengantuk': (995, 335, 1228, 578),
    'jempol':    (1268, 335, 1502, 578),
}

def bg_dist(p, bg):
    return max(abs(p[0] - bg[0]), abs(p[1] - bg[1]), abs(p[2] - bg[2]))

def cut(img):
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    bg = px[2, 2][:3]
    HARD, SOFT = 18, 60  # <= HARD: background, HARD..SOFT: anti-aliased rim
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        d = bg_dist(px[x, y], bg)
        if d > SOFT:
            continue
        r, g, b, _ = px[x, y]
        if d <= HARD:
            px[x, y] = (r, g, b, 0)
        else:
            a = int(255 * (d - HARD) / (SOFT - HARD))
            px[x, y] = (r, g, b, a)
            continue  # rim pixel: don't spread through it
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    return img

def squarize(img):
    w, h = img.size
    s = max(w, h)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(img, ((s - w) // 2, s - h))  # bottom-aligned
    return canvas

sheet = Image.open(SRC)
for name, (x0, y0, x1, y1) in BOXES.items():
    crop = sheet.crop((x0 + PX, y0 + PY, x1 + PX, y1 + PY))
    out = squarize(cut(crop))
    if UPSCALE > 1:
        # premultiplied alpha avoids light halos from transparent pixels during resampling
        out = out.convert('RGBa').resize((out.width * UPSCALE, out.height * UPSCALE), Image.LANCZOS).convert('RGBA')
        a = out.getchannel('A')
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        out.putalpha(a)
    if STYLE in ('flat', 'sticker'):
        out = flatten(out)
    if STYLE == 'sticker':
        out = sticker(out)
    out.save(f'{OUT}/{name}.png', optimize=True)
    print(name, out.size)

