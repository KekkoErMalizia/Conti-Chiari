# Disegna l'icona di Conti Chiari in vettoriale e ne ricava tutte le immagini.
#   pip install cairosvg pillow
#   python3 scripts/icons.py
# Scrive gli SVG sorgente (assets/icon.svg, www/icons/icon.svg) e i PNG per web, Android e iOS.
# Dopo, per l'app nativa: npm run icons (usa i PNG in assets/).
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEAL, TEAL_DARK = '#1f5f6b', '#0f1a1e'
PAPER, LINE, GOLD = '#f4f8f7', '#a9c3c6', '#d6a12a'
SPLASH_BG = {'splash.png': '#eef2f1', 'splash-dark.png': TEAL_DARK}

# Disegno su una tela 1024×1024, centrato in (512, 512): scontrino con tre righe e moneta divisa a metà
RECEIPT_L, RECEIPT_R, RECEIPT_T = 206, 794, 100
TOOTH_TIP, TOOTH_VALLEY, TEETH = 920, 862, 6
LINES = [(302, 698, 296), (302, 594, 400), (302, 560, 504)]  # x iniziale, x finale, y
LINE_W = 44
COIN_X, COIN_Y, COIN_R, GAP = 618, 682, 198, 16  # GAP: metà della fessura che divide la moneta
EXTENT = 514  # distanza massima del disegno dal centro (gli angoli in alto dello scontrino)


def glyph():
    w = (RECEIPT_R - RECEIPT_L) / TEETH
    teeth = ' '.join(f'L{RECEIPT_R - w * (i + .5):g},{TOOTH_VALLEY} L{RECEIPT_R - w * (i + 1):g},{TOOTH_TIP}' for i in range(TEETH))
    receipt = f'<path fill="{PAPER}" d="M{RECEIPT_L},{RECEIPT_T} H{RECEIPT_R} V{TOOTH_TIP} {teeth} Z"/>'
    lines = ''.join(f'<path d="M{a},{y} H{b}"/>' for a, b, y in LINES)
    lines = f'<g stroke="{LINE}" stroke-width="{LINE_W}" stroke-linecap="round">{lines}</g>'
    # due mezze monete separate: nella fessura si vede quello che c'è sotto (carta o sfondo)
    dy = (COIN_R ** 2 - GAP ** 2) ** .5
    top, bot = COIN_Y - dy, COIN_Y + dy
    coin = (f'<path fill="{GOLD}" d="M{COIN_X - GAP},{top:.2f} A{COIN_R},{COIN_R} 0 0 0 {COIN_X - GAP},{bot:.2f} Z'
            f' M{COIN_X + GAP},{top:.2f} A{COIN_R},{COIN_R} 0 0 1 {COIN_X + GAP},{bot:.2f} Z"/>')
    return receipt + lines + coin


def svg(radius=None, bg=TEAL, corner=0):
    """radius: distanza massima dal centro a cui arriva il disegno (None = misura piena). bg=None: trasparente."""
    s = 1 if radius is None else radius / EXTENT
    back = '' if bg is None else f'<rect width="1024" height="1024" rx="{corner}" fill="{bg}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{back}'
            f'<g transform="translate(512 512) scale({s:.4f}) translate(-512 -512)">{glyph()}</g></svg>\n')


def png(src, size, path, rgb=False):
    im = Image.open(BytesIO(cairosvg.svg2png(bytestring=src.encode(), output_width=size, output_height=size)))
    (im.convert('RGB') if rgb else im.convert('RGBA')).save(path, optimize=True)


def main():
    a, w = ROOT / 'assets', ROOT / 'www' / 'icons'
    full = svg()
    (a / 'icon.svg').write_text(full)
    (w / 'icon.svg').write_text(full)
    # web (PWA): icona piena e versione "maskable" con il disegno nella zona sicura (cerchio di raggio 40%)
    png(full, 192, w / 'icon-192.png')
    png(full, 512, w / 'icon-512.png')
    png(full, 1024, w / 'icon-1024.png', rgb=True)
    png(full, 180, w / 'apple-touch-icon.png', rgb=True)
    png(svg(radius=390), 512, w / 'maskable-512.png')
    # Android/iOS (capacitor-assets): icona piena, primo piano e sfondo dell'icona adattiva.
    # Android mostra solo i 72/108 centrali del livello e ritaglia a cerchio: zona sicura di raggio 66/108/2 ≈ 313
    png(full, 1024, a / 'icon-only.png', rgb=True)
    png(svg(radius=300, bg=None), 1024, a / 'icon-foreground.png')
    png(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="{TEAL}"/></svg>',
        1024, a / 'icon-background.png', rgb=True)
    # schermate di avvio: icona arrotondata di 556 px al centro
    logo = Image.open(BytesIO(cairosvg.svg2png(bytestring=svg(corner=225).encode(), output_width=556, output_height=556)))
    for name, bg in SPLASH_BG.items():
        im = Image.new('RGB', (2732, 2732), bg)
        im.paste(logo, (1088, 1088), logo)
        im.save(a / name, optimize=True)


if __name__ == '__main__':
    main()
