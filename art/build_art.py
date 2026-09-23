"""Build the fly sprite kit from the FlyLab drawings in ../../flylab_images.

The supplied drawings are a mixture: some are whole flies, some are isolated
parts. This script keeps the isolated parts (head, thorax, wing) and makes a
clean wingless body out of the apterous whole fly, then recolours the body and
the eyes so that any combination of traits can be drawn.

    python3 build_art.py

Writes PNGs into this folder. Re-run after changing a colour.
"""
import os
import numpy as np
from PIL import Image, ImageDraw

SRC = os.path.join(os.path.dirname(__file__), '..', '..', 'flylab_images')
OUT = os.path.dirname(os.path.abspath(__file__))


def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')


def save(im, name):
    im.save(os.path.join(OUT, name + '.png'))


def luminance(arr):
    return (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]) / 255.0


def colorize(im, dark, light, mask=None):
    """Map each pixel's brightness onto a ramp between two colours."""
    a = np.array(im).astype(float)
    lum = luminance(a)[..., None]
    ramp = np.array(dark, dtype=float) + (np.array(light, dtype=float) - np.array(dark, dtype=float)) * lum
    out = a.copy()
    if mask is None:
        mask = a[..., 3] > 0
    out[..., :3] = np.where(mask[..., None], ramp, a[..., :3])
    return Image.fromarray(out.astype('uint8'), 'RGBA')


def red_mask(im):
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    return (al > 100) & (r > 140) & (g < 95) & (b < 115) & ((r - g) > 55)


# ---------------------------------------------------------------- body

def clean_body():
    """The apterous fly minus its wing stubs: a body with no wings at all.
    Anything the apterous drawing has that the winged drawing does not is a
    stub, including the faint anti-aliased edges."""
    a = np.array(load('wing_size_apterous'))
    w = np.array(load('sex_female'))
    stubs = (a[..., 3] > 4) & (w[..., 3] <= 4)
    a[stubs] = [0, 0, 0, 0]
    return Image.fromarray(a, 'RGBA')


def cut(im, mask):
    """Return a copy with the masked pixels removed."""
    a = np.array(im)
    a[mask] = [0, 0, 0, 0]
    return Image.fromarray(a, 'RGBA')


def keep(im, mask):
    """Return a copy with everything except the masked pixels removed."""
    a = np.array(im)
    a[~mask] = [0, 0, 0, 0]
    return Image.fromarray(a, 'RGBA')


def male_tip(im):
    """Fuse the last abdominal segments into one dark tip, so the sexes can be
    told apart at sprite size the way they are told apart down the scope."""
    a = np.array(im).astype(float)
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    body = a[..., 3] > 40
    cx, cy, rx, ry = 89.0, 128.0, 20.0, 26.0
    tip = body & (((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 <= 1.0)
    a[..., :3] = np.where(tip[..., None], a[..., :3] * 0.28, a[..., :3])
    return Image.fromarray(a.astype('uint8'), 'RGBA')


BODY_COLOURS = {
    'wild': None,
    'yellow': ((140, 108, 20), (255, 241, 152)),
    'tan': ((150, 115, 80), (250, 235, 214)),
    'sable': ((62, 42, 26), (172, 132, 96)),
    'black': ((30, 25, 20), (112, 96, 80)),
    'ebony': ((14, 11, 9), (72, 58, 48)),
}

EYE_COLOURS = {
    'red': None,
    'white': ((214, 205, 195), (252, 249, 245)),
    'brown': ((92, 54, 20), (166, 106, 50)),
    'sepia': ((44, 27, 14), (96, 62, 34)),
    'purple': ((88, 30, 120), (167, 82, 202)),
}

EYE_SHAPES = {'round': 'eye_shape_wild_type', 'bar': 'eye_shape_bar',
              'lobe': 'eye_shape_lobe', 'star': 'eye_shape_star'}

# Shapes with no drawing of their own, built by reworking the eye layer.
#   drop   Dr, small and kidney-shaped
#   rough  If, a pitted surface
#   glazed Gla, smooth and glassy
DERIVED_SHAPES = ('drop', 'rough', 'glazed')

WINGS = {'normal': 'wing_shape_wild_type', 'curly': 'wing_shape_curly',
         'curved': 'wing_shape_curved', 'dumpy': 'wing_shape_dumpy',
         'scalloped': 'wing_shape_scalloped'}

BRISTLES = {'normal': 'bristles_wild_type', 'stubble': 'bristles_stubble',
            'forked': 'bristles_forked', 'singed': 'bristles_singed',
            'shaven': 'bristles_shaven', 'spineless': 'bristles_spineless',
            'scutoid': 'bristles_shaven'}


def narrow_eyes(eyes, mask, keep=0.45):
    """Squeeze each eye toward the outer edge of the head. The supplied Bar
    drawing is only slightly narrower than wild type, which does not read at
    sprite size, so Bar is drawn narrower here."""
    a = np.array(eyes)
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    mid = w // 2
    for x0, x1, anchor in ((0, mid, 'left'), (mid, w, 'right')):
        cols = np.nonzero(mask[:, x0:x1].any(axis=0))[0]
        if not len(cols):
            continue
        lo, hi = cols.min() + x0, cols.max() + x0
        span = hi - lo + 1
        new = max(2, int(span * keep))
        src = a[:, lo:hi + 1]
        img = Image.fromarray(src, 'RGBA').resize((new, h), Image.LANCZOS)
        put = lo if anchor == 'left' else hi + 1 - new
        out[:, put:put + new] = np.array(img)
    return Image.fromarray(out, 'RGBA')


def shrink_eyes(eyes, mask, factor=0.6):
    """Smaller eyes, kept against the outer edge: Drop and Lobe."""
    a = np.array(eyes)
    h, w = a.shape[:2]
    out = np.zeros_like(a)
    ys = np.nonzero(mask.any(axis=1))[0]
    if not len(ys):
        return eyes
    mid = w // 2
    for x0, x1, anchor in ((0, mid, 'left'), (mid, w, 'right')):
        cols = np.nonzero(mask[:, x0:x1].any(axis=0))[0]
        if not len(cols):
            continue
        lo, hi = cols.min() + x0, cols.max() + x0
        top, bot = ys.min(), ys.max()
        src = a[top:bot + 1, lo:hi + 1]
        nw = max(2, int((hi - lo + 1) * factor))
        nh = max(2, int((bot - top + 1) * factor))
        img = np.array(Image.fromarray(src, 'RGBA').resize((nw, nh), Image.LANCZOS))
        py = top + ((bot - top + 1) - nh) // 2
        px = lo if anchor == 'left' else hi + 1 - nw
        out[py:py + nh, px:px + nw] = img
    return Image.fromarray(out, 'RGBA')


def speckle(eyes, mask, dark=0.38, step=3):
    """A pitted surface: If and other rough eyes."""
    a = np.array(eyes).astype(float)
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    pits = mask & (((xs + (ys % (step * 2)) // step * 2) % step) == 0) & ((ys % step) == 0)
    a[..., :3] = np.where(pits[..., None], a[..., :3] * dark, a[..., :3])
    return Image.fromarray(a.astype('uint8'), 'RGBA')


def glaze(eyes, mask):
    """Smooth and glassy: Gla. Flattened colour with one highlight."""
    a = np.array(eyes).astype(float)
    h, w = a.shape[:2]
    lit = luminance(a)
    flat = np.where(mask, (lit * 0.35 + 0.45), lit)
    a[..., :3] = np.where(mask[..., None], np.stack([flat, flat, flat], axis=-1) * 210, a[..., :3])
    ys, xs = np.mgrid[0:h, 0:w]
    for cx in (w // 4, 3 * w // 4):
        spot = mask & (((xs - cx) ** 2 / 36.0 + (ys - h * 0.42) ** 2 / 16.0) < 1)
        a[..., :3] = np.where(spot[..., None], 245, a[..., :3])
    return Image.fromarray(a.astype('uint8'), 'RGBA')


def humeral_layer(colour_ramp):
    """Hu: a tuft of extra bristles on each humeral callus, the front corner of
    the thorax. Additive, so it shows alongside Sb rather than instead of it."""
    im = Image.new('RGBA', (124, 124), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ink = (26, 19, 13, 255) if colour_ramp is None else tuple(
        [int(c * 0.8) for c in colour_ramp[0]] + [255])
    for sx in (1, -1):
        root_x, root_y = 62 + sx * 26, 30
        for dx, dy, wdt in ((-10, -22, 4), (1, -26, 4), (11, -20, 4)):
            d.line([(root_x, root_y), (root_x + sx * dx, root_y + dy)], fill=ink, width=wdt)
        d.ellipse([root_x - 4, root_y - 3, root_x + 4, root_y + 5], fill=ink)
    return im


def serrate_wing():
    """Ser: nicks bitten out of the wing margin."""
    wing = load_out('wing_normal')
    a = np.array(wing)
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    for cy, cx, r in ((int(h * 0.52), 96, 13), (int(h * 0.68), 92, 15), (int(h * 0.83), 80, 14)):
        bite = ((xs - cx) ** 2 + (ys - cy) ** 2) < r * r
        a[bite] = [0, 0, 0, 0]
    return Image.fromarray(a, 'RGBA')


def main():
    """Body colour changes the whole fly, so the body, the thorax and the head
    capsule are each written out in every body colour. The eyes are a layer of
    their own, so eye colour and body colour combine freely."""
    base = clean_body()
    for name, ramp in BODY_COLOURS.items():
        body = base if ramp is None else colorize(base, ramp[0], ramp[1])
        save(body, 'body_F_' + name)
        save(male_tip(body), 'body_M_' + name)

    shapes = dict(EYE_SHAPES)
    shapes['eyeless'] = 'eye_shape_eyeless'
    for shape, src in shapes.items():
        head = load(src)
        mask = red_mask(head)
        cap = cut(head, mask)
        for name, ramp in BODY_COLOURS.items():
            out = cap if ramp is None else colorize(cap, ramp[0], ramp[1])
            save(out, 'headcap_' + shape + '_' + name)
        if shape == 'eyeless':
            continue
        eyes = keep(head, mask)
        if shape == 'bar':
            eyes = narrow_eyes(eyes, mask)
            mask = np.array(eyes)[..., 3] > 100
        for colour, ramp in EYE_COLOURS.items():
            out = eyes if ramp is None else colorize(eyes, ramp[0], ramp[1], mask)
            save(out, 'eyes_' + shape + '_' + colour)

    for kind, src in BRISTLES.items():
        th = load(src)
        for name, ramp in BODY_COLOURS.items():
            out = th if ramp is None else colorize(th, ramp[0], ramp[1])
            save(out, 'thorax_' + kind + '_' + name)

    for name, ramp in BODY_COLOURS.items():
        save(humeral_layer(ramp), 'humeral_' + name)

    round_head = load(EYE_SHAPES['round'])
    round_mask = red_mask(round_head)
    round_eyes = keep(round_head, round_mask)
    for shape in DERIVED_SHAPES:
        if shape == 'drop':
            base, m = shrink_eyes(round_eyes, round_mask, 0.55), None
        elif shape == 'rough':
            small = shrink_eyes(round_eyes, round_mask, 0.86)
            base = speckle(small, np.array(small)[..., 3] > 100)
        else:
            base = glaze(round_eyes, round_mask)
        m = np.array(base)[..., 3] > 100
        for name, ramp in BODY_COLOURS.items():
            save(load_out('headcap_round_' + name), 'headcap_' + shape + '_' + name)
        for colour, ramp in EYE_COLOURS.items():
            out = base if (ramp is None or shape == 'glazed') else colorize(base, ramp[0], ramp[1], m)
            save(out, 'eyes_' + shape + '_' + colour)

    for kind, src in WINGS.items():
        save(load(src), 'wing_' + kind)
    save(serrate_wing(), 'wing_serrate')

    build_icons()

    print('wrote', len([f for f in os.listdir(OUT) if f.endswith('.png')]), 'sprites')


def paste(base, layer, scale, pos):
    w = max(1, int(layer.width * scale))
    h = max(1, int(layer.height * scale))
    base.alpha_composite(layer.resize((w, h), Image.LANCZOS), pos)


def whole_fly(wing_scale):
    """A plain wild-type fly with wings at the given scale. A lone vestigial
    wing is too small to recognise on its own, so the wing-size pictures show a
    whole fly instead. These offsets match ui/flyart.js."""
    ox = 10
    fly = Image.new('RGBA', (200, 212), (0, 0, 0, 0))
    fly.alpha_composite(load_out('body_F_wild'), (ox, 0))
    paste(fly, load_out('thorax_normal_wild'), 0.60, (ox + 55, 30))
    hx, hy = int(ox + 89.5 - 59.5 * 0.40), int(29 - 54 * 0.40)
    paste(fly, load_out('headcap_round_wild'), 0.40, (hx, hy))
    paste(fly, load_out('eyes_round_red'), 0.40, (hx, hy))
    if wing_scale > 0:
        s = 0.80 * wing_scale
        wing = load_out('wing_normal')
        w = wing.resize((max(1, int(wing.width * s)), max(1, int(wing.height * s))), Image.LANCZOS)
        top = int(60 - 6 * s)
        fly.alpha_composite(w, (int(ox + 94 - 39.5 * s), top))
        fly.alpha_composite(w.transpose(Image.FLIP_LEFT_RIGHT), (int(ox + 86 - (w.width - 39.5 * s)), top))
    return fly


def build_icons():
    """Small square pictures for the inspector, made from the same sprites the
    vial uses, so the panel and the vial can never disagree."""
    for colour in EYE_COLOURS:
        ic = Image.new('RGBA', (120, 100), (0, 0, 0, 0))
        ic.alpha_composite(load_out('headcap_round_wild'))
        ic.alpha_composite(load_out('eyes_round_' + colour))
        save(ic, 'icon_eyeColor_' + colour)
    for shape in list(EYE_SHAPES) + ['eyeless'] + list(DERIVED_SHAPES):
        ic = Image.new('RGBA', (120, 100), (0, 0, 0, 0))
        ic.alpha_composite(load_out('headcap_' + shape + '_wild'))
        if shape != 'eyeless':
            ic.alpha_composite(load_out('eyes_' + shape + '_red'))
        save(ic, 'icon_eyeShape_' + shape)
    for kind in BRISTLES:
        save(load_out('thorax_' + kind + '_wild'), 'icon_bristles_' + kind)
    for kind in list(WINGS) + ['serrate']:
        save(load_out('wing_' + kind), 'icon_wingShape_' + kind)

    thorax = load_out('thorax_normal_wild')
    save(thorax, 'icon_humeral_normal')
    hu = thorax.copy()
    hu.alpha_composite(load_out('humeral_wild'))
    save(hu, 'icon_humeral_extra')

    plain = whole_fly(1.0)
    save(plain, 'icon_shape_normal')
    squashed = Image.new('RGBA', plain.size, (0, 0, 0, 0))
    wide = plain.resize((int(plain.width * 1.18), int(plain.height * 0.78)), Image.LANCZOS)
    squashed.alpha_composite(wide, (int((plain.width - wide.width) / 2),
                                    int((plain.height - wide.height) / 2)))
    save(squashed, 'icon_shape_tubby')
    for kind, scale in (('normal', 1.0), ('miniature', 0.6), ('vestigial', 0.22), ('apterous', 0.0)):
        save(whole_fly(scale), 'icon_wingSize_' + kind)
    for colour in BODY_COLOURS:
        save(load_out('body_F_' + colour), 'icon_bodyColor_' + colour)


def load_out(name):
    return Image.open(os.path.join(OUT, name + '.png')).convert('RGBA')


if __name__ == '__main__':
    main()
