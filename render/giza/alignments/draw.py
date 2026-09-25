"""
Drawing on a render: lines with a glow, dashes, star rings, labels with a halo, caption panels.

Pillow draws lines without antialiasing, so everything is drawn on a layer twice the render's size
and brought down to it at the end (`Canvas.finish`). Coordinates are always the render's own
pixels; the canvas scales them. The palette and the sizes are look choices.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = r"C:\Windows\Fonts"
SERIF = os.path.join(FONTS, "georgia.ttf")
SERIF_ITALIC = os.path.join(FONTS, "georgiai.ttf")
SANS = os.path.join(FONTS, "segoeui.ttf")
SANS_BOLD = os.path.join(FONTS, "segoeuib.ttf")
SANS_LIGHT = os.path.join(FONTS, "segoeuil.ttf")

GOLD = (242, 201, 120)
PALE = (238, 234, 224)
SKY = (160, 196, 255)
DIM = (200, 196, 186)
MISS = (240, 150, 120)
SHADOW = (8, 10, 18)


def font(path, px):
    return ImageFont.truetype(path, max(6, int(round(px))))


class Canvas:
    def __init__(self, base, ss=2, ref=1920.0):
        self.base = base.convert("RGBA")
        self.W, self.H = self.base.size
        self.ss = ss
        # Positions and sizes are in design units: a frame `ref` wide, whatever the render's own size.
        self.k = self.W / ref
        self.dw, self.dh = ref, self.H / self.k
        self.layer = Image.new("RGBA", (self.W * ss, self.H * ss), (0, 0, 0, 0))
        self.glow = Image.new("RGBA", (self.W * ss, self.H * ss), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.layer)
        self.g = ImageDraw.Draw(self.glow)
        self.fonts = {}

    def f(self, path, px):
        key = (path, px)
        if key not in self.fonts:
            self.fonts[key] = font(path, px * self.k * self.ss)
        return self.fonts[key]

    def _p(self, p):
        return (p[0] * self.k * self.ss, p[1] * self.k * self.ss)

    def _w(self, w):
        return max(1, int(round(w * self.k * self.ss)))

    def line(self, pts, colour, width=2.0, alpha=255, glow=0.0, dash=None):
        """A polyline; `glow` is the halo's width, `dash` is (on, off), all in design units."""
        pts = [p for p in pts if p is not None]
        if len(pts) < 2:
            return
        segs = [pts]
        if dash:
            segs = list(dashes(pts, dash[0], dash[1]))
        for s in segs:
            q = [self._p(p) for p in s]
            if glow:
                self.g.line(q, fill=colour + (int(alpha * 0.55),), width=self._w(glow), joint="curve")
            self.d.line(q, fill=colour + (alpha,), width=self._w(width), joint="curve")

    def ring(self, c, r, colour, width=1.5, alpha=255, glow=0.0, fill=None):
        if c is None:
            return
        x, y = self._p(c)
        rr = r * self.k * self.ss
        box = (x - rr, y - rr, x + rr, y + rr)
        if glow:
            self.g.ellipse(box, outline=colour + (int(alpha * 0.6),), width=self._w(glow))
        self.d.ellipse(box, outline=colour + (alpha,), width=self._w(width), fill=fill)

    def dot(self, c, r, colour, alpha=255, glow=0.0):
        if c is None:
            return
        x, y = self._p(c)
        rr = r * self.k * self.ss
        if glow:
            gg = glow * self.k * self.ss
            self.g.ellipse((x - gg, y - gg, x + gg, y + gg), fill=colour + (int(alpha * 0.5),))
        self.d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=colour + (alpha,))

    def sparkle(self, c, r, colour, alpha=255):
        """A four-pointed star glyph, for a star laid on the ground."""
        if c is None:
            return
        x, y = self._p(c)
        rr = r * self.k * self.ss
        t = rr * 0.22
        pts = [(x, y - rr), (x + t, y - t), (x + rr, y), (x + t, y + t), (x, y + rr), (x - t, y + t), (x - rr, y), (x - t, y - t)]
        self.g.ellipse((x - rr * 1.2, y - rr * 1.2, x + rr * 1.2, y + rr * 1.2), fill=colour + (int(alpha * 0.45),))
        self.d.polygon(pts, fill=colour + (alpha,))

    def text(self, xy, s, size=20, colour=PALE, path=SANS, anchor="la", alpha=255, halo=3.0, spacing=1.25):
        """Text with a dark halo so it reads over stars and stone. Returns its box in frame pixels."""
        fnt = self.f(path, size)
        x, y = self._p(xy)
        if halo:
            self.d.text((x, y), s, font=fnt, fill=SHADOW + (int(alpha * 0.9),), anchor=anchor,
                        stroke_width=self._w(halo), stroke_fill=SHADOW + (int(alpha * 0.55),), spacing=spacing)
        self.d.text((x, y), s, font=fnt, fill=colour + (alpha,), anchor=anchor, spacing=spacing)
        b = self.d.textbbox((x, y), s, font=fnt, anchor=anchor)
        return tuple(v / self.ss / self.k for v in b)

    def measure(self, s, size, path=SANS):
        b = self.d.textbbox((0, 0), s, font=self.f(path, size), anchor="la")
        return (b[2] - b[0]) / self.ss / self.k, (b[3] - b[1]) / self.ss / self.k

    def wrap(self, s, size, width, path=SANS):
        """Break `s` into lines no wider than `width` frame pixels."""
        words, lines, cur = s.split(), [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if self.measure(t, size, path)[0] <= width or not cur:
                cur = t
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    def panel(self, box, alpha=150, radius=14):
        """A dark translucent rounded panel under a caption."""
        x0, y0, x1, y1 = (v * self.k * self.ss for v in box)
        self.d.rounded_rectangle((x0, y0, x1, y1), radius=self._w(radius), fill=SHADOW + (alpha,))

    def paragraphs(self, x, y, width, blocks):
        """
        Stacked text blocks, each (text, size, colour, font path, space after); returns the bottom.
        A block's text is wrapped to `width`.
        """
        for text, size, colour, path, after in blocks:
            for ln in self.wrap(text, size, width, path):
                self.text((x, y), ln, size=size, colour=colour, path=path, halo=0)
                y += size * 1.32
            y += after
        return y

    def paste(self, img, xy, mask=None):
        """An image (a porthole) pasted onto the base under the overlay, its corner at design units."""
        self.base.paste(img, (int(round(xy[0] * self.k)), int(round(xy[1] * self.k))), mask)

    def finish(self, blur=5.0):
        glow = self.glow.filter(ImageFilter.GaussianBlur(blur * self.k * self.ss))
        over = Image.alpha_composite(glow, self.layer)
        over = over.resize((self.W, self.H), Image.LANCZOS)
        return Image.alpha_composite(self.base, over).convert("RGB")


def dashes(pts, on, off):
    """Split a polyline into dashes `on` long with gaps `off`."""
    out, cur, left, drawing = [], [pts[0]], on, True
    for a, b in zip(pts, pts[1:]):
        ax, ay = a
        bx, by = b
        seg = math.hypot(bx - ax, by - ay)
        pos = 0.0
        while seg - pos > left:
            pos += left
            t = pos / seg if seg else 0.0
            p = (ax + (bx - ax) * t, ay + (by - ay) * t)
            if drawing:
                cur.append(p)
                out.append(cur)
            cur = [p]
            drawing = not drawing
            left = on if drawing else off
        left -= seg - pos
        if drawing:
            cur.append(b)
        else:
            cur = [b]
    if drawing and len(cur) > 1:
        out.append(cur)
    return out


def circle_mask(size, ss=4):
    """An antialiased disc mask of `size` pixels."""
    m = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * ss - 1, size * ss - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)
