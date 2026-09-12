"""Regenerates assets/banner.png and assets/social-card.png from assets/avatar.png."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

OUT = 'assets'
INK=(5,7,3); LIME=(201,249,44); BONE=(222,232,205); DIM=(122,134,104); LINE=(29,38,18); DOT=(38,64,10)
PIXEL='/mnt/skills/examples/canvas-design/canvas-fonts/PixelifySans-Medium.ttf'
MONO='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
S=2

KICKER = 'WAKE TERMINAL'
TAG = ['Whale wallets waking after months',
       'of silence, and where the money goes.']
WALLS = 'SLEEP   EDGE   SIZE   DEPTH   PRICE'
META  = 'Robinhood Chain  ·  CLI-first  ·  MIT'

def build(W0, H0, owl_px, owl_x, tx, word_px, kick_px, tag_px, sub_px, rule_w):
    W, H = W0*S, H0*S
    img = Image.new('RGB', (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(0, H, 18*S):
        for x in range(0, W, 18*S):
            d.rectangle([x, y, x+S-1, y+S-1], fill=DOT)
    d.rectangle([0, 0, W-1, H-1], outline=LINE, width=2*S)

    owl = Image.open(f'{OUT}/avatar.png').convert('RGBA').resize((owl_px*S, owl_px*S), Image.LANCZOS)
    img.paste(owl, (owl_x*S, (H-owl.height)//2), owl)

    word = ImageFont.truetype(PIXEL, word_px*S)
    kick = ImageFont.truetype(MONO, kick_px*S)
    tag  = ImageFont.truetype(MONO, tag_px*S)
    sub  = ImageFont.truetype(MONO, sub_px*S)

    wb = d.textbbox((0, 0), 'PELLET', font=word)
    wh = wb[3]-wb[1]
    lead_tag = int(tag_px*1.42)*S
    lead_sub = int(sub_px*1.5)*S
    kick_h = int(kick_px*1.9)*S
    total = kick_h + wh + 28*S + lead_tag*len(TAG) + 22*S + lead_sub*2
    top = (H-total)//2
    x = tx*S

    d.text((x+2*S, top), KICKER, font=kick, fill=LIME)
    y = top + kick_h

    gl = Image.new('RGB', (W, H), (0, 0, 0))
    ImageDraw.Draw(gl).text((x, y-wb[1]), 'PELLET', font=word, fill=LIME)
    gl = gl.filter(ImageFilter.GaussianBlur(8*S))
    img = Image.fromarray(np.clip(np.asarray(img).astype('int16')
          + (np.asarray(gl).astype('int16')*0.7).astype('int16'), 0, 255).astype('uint8'))

    d = ImageDraw.Draw(img)
    d.text((x, y-wb[1]), 'PELLET', font=word, fill=LIME)
    y += wh + 28*S
    for row in TAG:
        d.text((x+2*S, y), row, font=tag, fill=BONE)
        y += lead_tag
    y += 8*S
    d.line([(x+2*S, y), (x+rule_w*S, y)], fill=LINE, width=2*S)
    y += 14*S
    d.text((x+2*S, y), WALLS, font=sub, fill=DIM); y += lead_sub
    d.text((x+2*S, y), META, font=sub, fill=DIM)
    return img.resize((W0, H0), Image.LANCZOS)

build(1280, 640, 380, 108, 560, 132, 19, 29, 23, 520).save(f'{OUT}/banner.png')
build(1200, 630, 360, 100, 520, 124, 18, 27, 22, 505).save(f'{OUT}/social-card.png')
print('banner + social card rebuilt')
