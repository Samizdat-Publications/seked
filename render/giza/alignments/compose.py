"""
The overlays: each picture's lines, labels and captions drawn onto its render.

Everything that lands on a star is projected from the star's baked altitude and azimuth through
the camera the render recorded (project.Camera); everything that lands on a monument is projected
from its place in the project frame (render/giza/data.py, blender/seked_data.py). Every number a
caption states is read from the bake's `alignments` section, which holds the claims engine's own
evaluations, or from docs/shafts.md (`pnpm shafts`); none is typed here. The words make the
steelman's case, and where a claim's match is loose the caption says by how much.

Positions are in design units, a frame 1920 wide (a porthole 360), whatever size the render was:
the camera is scaled to it and the canvas scales back (draw.Canvas).

    python render/alignments.py overlay [--final] [--only c4-night,c4-plan,c5-dawn-10500,c5-dawn-2500,c2-2450,c2-10450]
"""
import io
import json
import math
import os
import re

import numpy as np
from PIL import Image

from .. import data, states
from . import lines as figures
from . import project
from .draw import DIM, GOLD, MISS, PALE, SANS, SANS_BOLD, SERIF, SERIF_ITALIC, SKY, Canvas, circle_mask

RENDERS = os.path.join(data.REPO, "build", "alignments", "render")
OUT = os.path.join(data.REPO, "build", "alignments")
BAKE = os.path.join(data.REPO, "build", "sky-bake.json")
SHAFTS_MD = os.path.join(data.REPO, "docs", "shafts.md")


# --- words for numbers --------------------------------------------------------------------------

def dm(deg, signed=False):
    """Degrees and arcminutes, to the minute: 45°12′."""
    m = int(round(abs(deg) * 60.0))
    sign = "−" if deg < 0 and m else ("+" if signed and m else "")
    return f"{sign}{m // 60}°{m % 60:02d}′"


def year(epoch):
    """An astronomical epoch as a year: -10449 is 10,450 BCE."""
    y = int(round(1 - epoch)) if epoch < 0.5 else int(round(epoch))
    text = f"{y:,}" if y >= 10000 else str(y)             # 10,450 BCE but 2450 BCE, as the claims write them
    return f"{text} BCE" if epoch < 0.5 else f"{text} CE"


def minutes_of(deg_sidereal):
    """Degrees of sidereal time as hours and minutes of it."""
    m = int(round(abs(deg_sidereal) * 4.0))
    return f"{m // 60} h {m % 60:02d} min" if m >= 60 else f"{m} minutes"


# --- what the pictures read ---------------------------------------------------------------------

class Context:
    def __init__(self):
        if not os.path.exists(BAKE):
            raise SystemExit(f"{BAKE} is missing: run pnpm run sky-bake")
        with io.open(BAKE, encoding="utf-8") as f:
            self.bake = json.load(f)
        if "alignments" not in self.bake:
            raise SystemExit("the sky bake has no alignments section: run pnpm run sky-bake")
        self.al = self.bake["alignments"]
        cat = data.load_json(data.DATA, "stars", "hyg-bright.json")
        cols = cat["columns"]
        self.ids = [r[cols.index("id")] for r in cat["stars"]]
        self.names = [r[cols.index("name")] for r in cat["stars"]]
        self.index = {h: i for i, h in enumerate(self.ids)}
        self.by_name = {n: i for i, n in enumerate(self.names) if n}
        self.figures = figures.load()
        self.values = project.resolved()

    def sky(self, sky_id):
        return self.bake["nights"].get(sky_id) or self.al["skies"][sky_id]

    def render(self, view_id, ref=1920.0):
        """A render, its sidecar, and its camera projecting into design units (a frame `ref` wide)."""
        png = os.path.join(RENDERS, f"{view_id}.png")
        side = os.path.join(RENDERS, f"{view_id}.json")
        if not os.path.exists(png):
            raise SystemExit(f"{png} is missing: render it (render/alignments.py render)")
        with io.open(side, encoding="utf-8") as f:
            s = json.load(f)
        p = dict(s["projection"])
        w, h = p["size"]
        p["size"] = [ref, ref * h / w]
        return s, Image.open(png).convert("RGB"), project.Camera(p)

    def star(self, sky, key):
        """A star's (az, alt, mag) in a sky, by Hipparcos id ('hip26727') or by name."""
        i = self.index[key] if key in self.index else self.by_name[key]
        return sky["stars"][i][:3]


def shaft_epochs():
    """docs/shafts.md's solved epochs, by star name: [(epoch text, culmination)]."""
    out = {}
    if not os.path.exists(SHAFTS_MD):
        return out
    with io.open(SHAFTS_MD, encoding="utf-8") as f:
        for ln in f:
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if len(cells) == 6 and re.match(r"\d[\d,]* (BCE|CE)$", cells[4]):
                out.setdefault(cells[2], []).append((cells[4], cells[3]))
    return out


def pyramid_top(key, era):
    P = data.PYRAMIDS[key]
    h = P["today"] if states.STATES[era]["pyramids"] in ("today", "stripped") else P["H"]
    return (P["cx"], P["cy"], P["base"] + h)


def star_px(cam, az_alt):
    return cam.project_star(az_alt[0], az_alt[1])


def draw_figure(cv, cam, ctx, sky, abbr, colour=PALE, width=1.3, alpha=120, below_alpha=70, dash_below=(7, 7)):
    """A constellation's figure lines; a segment with an end under the horizon is dashed and dimmer."""
    for a, b in ctx.figures["figures"][abbr]["segments"]:
        sa, sb = ctx.star(sky, a), ctx.star(sky, b)
        pa, pb = star_px(cam, sa), star_px(cam, sb)
        if pa is None or pb is None:
            continue
        under = sa[1] < 0 or sb[1] < 0
        cv.line([pa, pb], colour, width, alpha=below_alpha if under else alpha, dash=dash_below if under else None)


def figure_stars(ctx, abbr):
    return sorted({h for seg in ctx.figures["figures"][abbr]["segments"] for h in seg})


def caption(cv, box, title, subtitle, blocks, alpha=165):
    """A caption panel, fitted to its text: a title, a subtitle and wrapped paragraphs. Returns its bottom."""
    x0, y0, width = box
    pad = 26
    height = pad + 44 + 34
    for t, s, c, p, a in blocks:
        height += len(cv.wrap(t, s, width - 2 * pad, p)) * s * 1.32 + a
    height += pad - 6
    if y0 < 0:                              # a negative top anchors the panel's bottom that far above the frame's foot
        y0 = cv.dh + y0 - height
    cv.panel((x0, y0, x0 + width, y0 + height), alpha=alpha)
    cv.text((x0 + pad, y0 + pad), title, size=34, colour=PALE, path=SERIF, halo=0)
    cv.text((x0 + pad, y0 + pad + 46), subtitle, size=18, colour=GOLD, path=SERIF_ITALIC, halo=0)
    cv.paragraphs(x0 + pad, y0 + pad + 44 + 34 + 8, width - 2 * pad, blocks)
    return y0 + height


def credit(cv, text):
    cv.text((cv.dw - 18, cv.dh - 14), text, size=13, colour=DIM, path=SANS, anchor="rd", alpha=190, halo=2)


# --- C4: Orion over the pyramids ----------------------------------------------------------------

def c4_numbers(ctx):
    c4 = ctx.al["c4"]
    src = [[p["x"], p["y"]] for p in c4["pairs"]]
    dst = [[data.PYRAMIDS[p["ground"]]["cx"], data.PYRAMIDS[p["ground"]]["cy"]] for p in c4["pairs"]]
    fit = project.fit_similarity(src, dst, allow_mirror=True)
    return dict(c4=c4, fit=fit, dst=dst,
                angle=next(c for c in c4["comparisons"] if c["unit"] == "deg"),
                offset=next(c for c in c4["comparisons"] if c["unit"] == "ratio"),
                residuals=[float(np.hypot(*r)) for r in fit["residuals"]],
                length=float(np.hypot(*np.subtract(dst[0], dst[-1]))),
                # How far the fit turns the sky from lying north to south, as it does when seen looking south.
                turn=(fit["rotation_deg"] + 180.0 + 540.0) % 360.0 - 180.0)


def c4_night(ctx, final):
    side, img, cam = ctx.render("c4-night")
    sky = ctx.sky(side["sky"])
    n = c4_numbers(ctx)
    c4, fit = n["c4"], n["fit"]
    cv = Canvas(img)
    era = side["era"]
    draw_figure(cv, cam, ctx, sky, "Ori", colour=SKY, width=1.2, alpha=105)
    belt = [ctx.star(sky, p["name"]) for p in c4["pairs"]]
    bpx = [star_px(cam, s) for s in belt]
    tops = [cam.project(pyramid_top(p["ground"], era)) for p in c4["pairs"]]
    feet = [cam.project((data.PYRAMIDS[p["ground"]]["cx"], data.PYRAMIDS[p["ground"]]["cy"], data.PYRAMIDS[p["ground"]]["base"]))
            for p in c4["pairs"]]
    for s, t in zip(bpx, tops):
        cv.line([s, t], GOLD, 1.3, alpha=150, glow=5, dash=(10, 6))
    cv.line(bpx, GOLD, 2.4, alpha=235, glow=9)
    # The belt laid on the ground: the best fit of the three stars onto the three pyramids.
    ground = [cam.project((g[0], g[1], data.PYRAMIDS[p["ground"]]["base"])) for p, g in zip(c4["pairs"], fit["fitted"])]
    cv.line(ground, GOLD, 2.0, alpha=200, glow=8)
    for g, s in zip(ground, belt):
        cv.sparkle(g, 9 - 1.6 * s[2], GOLD)
    cv.text((ground[-1][0] + 60, ground[-1][1] - 2), "the belt laid on the ground", size=16, colour=GOLD, anchor="lm")
    # Alnitak to the left of the belt, Alnilam under it, Mintaka to the right: the belt is short in the frame.
    offsets = {0: (-18, 4, "rm"), 1: (12, 20, "lt"), 2: (18, -6, "lm")}
    for k, (p, px) in enumerate(zip(c4["pairs"], bpx)):
        cv.ring(px, 11, GOLD, 1.6, glow=4)
        dx, dy, anc = offsets[k]
        cv.text((px[0] + dx, px[1] + dy), p["name"], size=21, colour=GOLD, path=SANS_BOLD, anchor=anc)
    for p, f in zip(c4["pairs"], feet):
        cv.text((f[0], f[1] + 22), data.PYRAMIDS[p["ground"]]["name"], size=20, colour=PALE, path=SANS_BOLD, anchor="mt")
    for name, dx in (("Betelgeuse", 14), ("Rigel", 14), ("Bellatrix", 14), ("Saiph", -14)):
        px = star_px(cam, ctx.star(sky, name))
        if cam.inside(px):
            cv.text((px[0] + dx, px[1]), name, size=15, colour=SKY, anchor="lm" if dx > 0 else "rm", alpha=210)
    head = star_px(cam, ctx.star(sky, "Meissa"))
    if cam.inside(head):
        cv.text((head[0], head[1] - 22), "ORION", size=17, colour=SKY, path=SANS_BOLD, anchor="ms", alpha=200)
    res = n["residuals"]
    blocks = [
        (f"The night of {year(c4['epoch'])}, seen from {side['camera'][1] / 1000:.1f} km north of the Great Pyramid and "
         f"{side['camera'][2]:.0f} m up. Alnitak, the belt's "
         f"eastern star, crosses the meridian {dm(belt[0][1])} above the horizon, near the lowest it ever stands in precession's "
         f"26,000-year swing: the moment Bauval and Hancock call the First Time.", 19, PALE, SANS, 12),
        (f"The belt hangs over the three pyramids in their order: Alnitak over Khufu, Alnilam over Khafre, and the fainter "
         f"Mintaka, set off the line, over the smaller Menkaure, set off its line too. Laid on the ground as the sky is seen "
         f"from here, and fitted, each star falls within {max(res):.0f} m of its pyramid's centre ({res[0]:.1f}, {res[1]:.1f} "
         f"and {res[2]:.1f} m, over {n['length']:.0f} m).", 19, PALE, SANS, 12),
        (f"Where it is loose: the belt then stood {dm(n['angle']['value'])} from the meridian and the pyramids' diagonal "
         f"stands {dm(n['angle']['target'])}; the fit turns the belt {abs(n['turn']):.0f}° to close that, and the two "
         f"angles agree only in {year(c4['matches'][0])}. Menkaure lies {n['offset']['value']:.3f} of the Khufu to Khafre "
         f"distance off their line, Mintaka {n['offset']['target']:.3f}.", 16, MISS, SANS, 0),
    ]
    caption(cv, (40, 40, 560), "Orion over Giza", "C4, the Orion correlation, drawn as its strongest case", blocks)
    credit(cv, "Stars: HYG 4.2 (CC BY-SA 4.0) precessed by Vondrák 2011; figure lines: Stellarium (CC BY-SA 4.0). "
               "The First Time is a claim, not a reconstruction.")
    return cv.finish()


def c4_plan(ctx, final):
    side, img, cam = ctx.render("c4-plan")
    n = c4_numbers(ctx)
    c4, fit = n["c4"], n["fit"]
    cv = Canvas(img)
    sky = ctx.sky(c4["night"])
    centres = [cam.project((d[0], d[1], 0.0)) for d in n["dst"]]
    fitted = [cam.project((g[0], g[1], 0.0)) for g in fit["fitted"]]
    # The meridian through Khufu, and the diagonal to Menkaure, and the angle between them.
    g1 = data.PYRAMIDS["g1"]
    cv.line([cam.project((g1["cx"], 380.0, 0.0)), cam.project((g1["cx"], -900.0, 0.0))], PALE, 1.2, alpha=150, dash=(12, 8))
    top = cam.project((g1["cx"], 380.0, 0.0))
    cv.text((top[0] + 10, top[1] + 4), "the meridian, true north", size=16, colour=PALE, anchor="la", alpha=220)
    cv.line([centres[0], centres[2]], PALE, 1.6, alpha=210)
    r = 190.0
    g = n["angle"]["target"]
    arc = [cam.project((g1["cx"] + r * math.sin(math.radians(a)), g1["cy"] + r * math.cos(math.radians(a)), 0.0))
           for a in np.linspace(180.0, 180.0 + g, 30)]
    cv.line(arc, PALE, 1.4, alpha=220)
    mid = cam.project((g1["cx"] + 1.1 * r * math.sin(math.radians(180 + g / 2)), g1["cy"] + 1.1 * r * math.cos(math.radians(180 + g / 2)), 0.0))
    cv.text(mid, dm(g), size=17, colour=PALE, anchor="rm")
    # The belt as the sky set it, laid as it is seen looking south and only moved and sized: the fit's turn is
    # measured from this.
    held = project.fit_turn_held([[p["x"], p["y"]] for p in c4["pairs"]], n["dst"], 180.0, True)
    ghost_px = [cam.project((g[0], g[1], 0.0)) for g in held["fitted"]]
    cv.line(ghost_px, SKY, 1.6, alpha=220, dash=(9, 6))
    for gp in ghost_px:
        cv.ring(gp, 6, SKY, 1.4, alpha=230)
    far = ghost_px[-1]
    cv.text((far[0] - 16, far[1] + 14), f"the belt as the sky set it, not turned: {held['rms']:.0f} m off", size=15,
            colour=SKY, anchor="ra")
    # The belt, fitted: its line, its stars sized by their brightness, and the misses drawn true.
    cv.line(fitted, GOLD, 2.4, alpha=235, glow=8)
    for p, f, c in zip(c4["pairs"], fitted, centres):
        cv.sparkle(f, 17 - 3.0 * ctx.star(sky, p["name"])[2], GOLD)
        cv.line([f, c], MISS, 2.0, alpha=255)
        cv.dot(c, 3.2, PALE)
    for p, c, res in zip(c4["pairs"], centres, n["residuals"]):
        # Just off the pyramid's east edge, where the words are on grass and not on white casing.
        P = data.PYRAMIDS[p["ground"]]
        edge = cam.project((P["cx"] + P["half"], P["cy"], 0.0))
        x = edge[0] + 18
        cv.text((x, c[1] - 12), f"{p['name']} on {P['name']}", size=20, colour=GOLD, path=SANS_BOLD, anchor="lm", halo=4)
        cv.text((x, c[1] + 14), f"misses its centre by {res:.1f} m", size=16, colour=MISS, anchor="lm", halo=4)
    inset(cv, n, (1920 - 40 - 640, 1080 - 64 - 330, 640, 330))
    blocks = [
        (f"The three pyramids from straight above, north up, with Orion's belt as it stood in {year(c4['epoch'])} laid over "
         f"them and fitted: turned, scaled ({fit['scale']:.0f} m to the degree of sky) and moved to sit on them as closely as it "
         f"can. Laid as the sky is seen from the plateau looking south, the stars land {n['residuals'][0]:.1f}, "
         f"{n['residuals'][1]:.1f} and {n['residuals'][2]:.1f} m from the pyramids' centres, {fit['rms']:.1f} m root mean square "
         f"over {n['length']:.0f} m.", 18, PALE, SANS, 12),
        (f"Where it is loose: to fit, the belt is turned {abs(n['turn']):.0f}° from where the sky set it (dashed), the gap "
         f"between its {dm(n['angle']['value'])} from the meridian in {year(c4['epoch'])} and the diagonal's "
         f"{dm(n['angle']['target'])}. And laying the sky down as it is seen puts its north to the south: Krupp's objection, "
         f"and one of the claim's three free choices.", 16, MISS, SANS, 0),
    ]
    caption(cv, (40, 40, 600), "The belt on the ground", "C4, laid on the plan", blocks)
    credit(cv, "Pyramid centres: Petrie's offsets (data/measurements). Stars: HYG 4.2 precessed by Vondrák 2011. "
               "The First Time era is a claim.")
    return cv.finish()


def inset(cv, n, box):
    """The belt's angle to the meridian across the precessional swing, from the bake's curve."""
    c4 = n["c4"]
    x0, y0, w, h = box
    cv.panel((x0, y0, x0 + w, y0 + h), alpha=195)
    epochs = c4["curve"]["epochs"]
    angles = c4["curve"]["beltAngleDeg"]
    lo, hi = 20.0, 85.0
    px0, py0, pw, ph = x0 + 62, y0 + 58, w - 90, h - 118

    def X(e):
        return px0 + (e - epochs[0]) / (epochs[-1] - epochs[0]) * pw

    def Y(a):
        return py0 + ph - (a - lo) / (hi - lo) * ph

    cv.text((x0 + 20, y0 + 18), "The belt's angle to the meridian, as precession turns it", size=17, colour=PALE,
            path=SANS_BOLD, halo=0)
    for a in (30, 45, 60, 75):
        cv.line([(px0, Y(a)), (px0 + pw, Y(a))], DIM, 0.8, alpha=60)
        cv.text((px0 - 8, Y(a)), f"{a}°", size=13, colour=DIM, anchor="rm", halo=0)
    for e in [1 - y for y in (12000, 9000, 6000, 3000)] + [2000]:
        cv.line([(X(e), py0 + ph), (X(e), py0 + ph + 5)], DIM, 1.0, alpha=160)
        cv.text((X(e), py0 + ph + 9), year(e), size=12, colour=DIM, anchor="mt", halo=0)
    g = c4["curve"]["groundDiagonalDeg"]
    cv.line([(px0, Y(g)), (px0 + pw, Y(g))], GOLD, 1.4, alpha=230, dash=(8, 5))
    cv.text((px0 + pw, Y(g) + 6), f"the pyramids' diagonal, {dm(g)}", size=13, colour=GOLD, anchor="ra", halo=0)
    cv.line([(X(e), Y(a)) for e, a in zip(epochs, angles)], SKY, 2.0, alpha=255)
    for m in c4["matches"]:
        cv.ring((X(m), Y(g)), 6, GOLD, 2.0)
        cv.text((X(m) + 10, Y(g) + 8), f"equal in {year(m)}", size=13, colour=GOLD, anchor="la", halo=0)
    for mk in c4["marks"]:
        e, a = mk["epoch"], mk["beltAngleDeg"]
        cv.dot((X(e), Y(a)), 4.5, PALE)
        cv.text((X(e) + 8, Y(a) - 8), f"{year(e)}: {dm(a)} ({mk['claim']})", size=13, colour=PALE, anchor="ls", halo=0)
    cv.text((x0 + 20, y0 + h - 16), "C4's own formula every 50 years: the belt's slope against the meridian at its crossing.",
            size=12, colour=DIM, anchor="ls", halo=0)


# --- C5: the lion and its constellation ---------------------------------------------------------

C5_FIGURES = {"c5-dawn-10500": ("Leo", "Leo", ("Regulus", "Denebola", "Algieba")),
              "c5-dawn-2500": ("Tau", "Taurus", ("Aldebaran", "Alcyone", "Elnath"))}


def c5_dawn(ctx, sky_id, final):
    side, img, cam = ctx.render(sky_id)
    sky = ctx.sky(sky_id)
    c5 = ctx.al["c5"][sky_id]
    abbr, fig_name, named = C5_FIGURES[sky_id]
    cv = Canvas(img)
    lion_dawn = sky_id == min(ctx.al["c5"], key=lambda k: ctx.al["c5"][k]["epoch"])
    # The horizon, due east, and the lion's gaze to it.
    cv.line([cam.project_star(a, 0.0) for a in np.linspace(40.0, 140.0, 60)], PALE, 1.0, alpha=70, dash=(4, 6))
    east = cam.project_star(90.0, 0.0)
    if side.get("sphinx_head"):
        cv.line([cam.project(side["sphinx_head"]), east], GOLD, 1.6, alpha=200, glow=5, dash=(9, 6))
    cv.line([(east[0], east[1] - 16), (east[0], east[1] + 16)], GOLD, 2.0)
    cv.text((east[0], east[1] + 22), "due east, 90°", size=16, colour=GOLD, anchor="mt")
    # The figure: lines, and its stars, a ring for one still under the horizon.
    draw_figure(cv, cam, ctx, sky, abbr, colour=SKY, width=1.6, alpha=190, below_alpha=150)
    for h in figure_stars(ctx, abbr):
        s = ctx.star(sky, h)
        px = star_px(cam, s)
        if px is None:
            continue
        r = max(2.0, 5.2 - 1.1 * s[2])
        if s[1] < 0:
            cv.ring(px, r + 1.5, SKY, 1.2, alpha=170)
        else:
            cv.dot(px, r * 0.55, PALE, alpha=150, glow=r * 1.6)
    # The sun under the horizon, and where it comes up.
    sun = sky["sun"]
    spx = cam.project_star(sun["azimuthDeg"], sun["altitudeDeg"])
    rise = cam.project_star(c5["sunRiseAzimuthDeg"], 0.0)
    cv.ring(spx, 16, GOLD, 1.6, alpha=230, glow=6)
    cv.line([spx, rise], GOLD, 1.3, alpha=200, dash=(4, 5))
    cv.line([(rise[0], rise[1] - 10), (rise[0], rise[1] + 10)], GOLD, 2.0)
    cv.text((spx[0] - 24, spx[1] + 2), f"the sun, {dm(-sun['altitudeDeg'])} below the horizon", size=16, colour=GOLD, anchor="rm")
    cv.text((rise[0] - 6, rise[1] - 14), f"it rises at {dm(c5['sunRiseAzimuthDeg'])}", size=15, colour=GOLD, anchor="rs")
    reg = next(c for c in c5["comparisons"] if c["label"].startswith("Regulus's rising azimuth"))
    lead = next(c for c in c5["comparisons"] if "sidereal" in c["label"])
    for name in named:
        s = ctx.star(sky, name)
        px = star_px(cam, s)
        if not cam.inside(px):
            continue
        up = s[1] >= 0
        big = name in ("Regulus", "Aldebaran")
        cv.text((px[0] + 14, px[1] - 10), name, size=19 if big else 16, colour=PALE if up else SKY,
                path=SANS_BOLD if big else SANS, anchor="ls", alpha=255 if up else 225)
    pts = [p for p in (star_px(cam, ctx.star(sky, h)) for h in figure_stars(ctx, abbr)) if cam.inside(p)]
    if pts:
        topmost = min(pts, key=lambda p: p[1])
        cv.text((topmost[0] + 26, topmost[1] + 4), fig_name.upper(), size=22, colour=SKY, path=SANS_BOLD, anchor="lm", alpha=235)
    reg_rise = cam.project_star(reg["value"], 0.0)
    if cam.inside(reg_rise):
        cv.line([(reg_rise[0], reg_rise[1] - 10), (reg_rise[0], reg_rise[1] + 10)], PALE, 1.6, alpha=220)
        cv.text((reg_rise[0] + 6, reg_rise[1] + 14), f"Regulus rises at {dm(reg['value'])}", size=14, colour=PALE, anchor="la")
    sun_dir = project.direction(sun["azimuthDeg"], sun["altitudeDeg"])
    if lion_dawn:
        sep = project.separation(sun_dir, project.direction(*ctx.star(sky, "Regulus")[:2]))
        blocks = [
            (f"The spring equinox of {year(c5['epoch'])}, the sun {dm(-sun['altitudeDeg'])} below the horizon, seen from behind "
             f"the lion along its gaze. Leo lies stretched along the dawn horizon, head raised, and the equinox sun is about "
             f"to rise beneath it, {sep:.0f}° from Regulus, its heart. The lion on the ground faces the lion in the sky.",
             19, PALE, SANS, 12),
            (f"Regulus cleared the horizon {minutes_of(lead['value'])} of sidereal time ahead of the sun, well inside the "
             f"claim's two hours: Leo was the constellation of this dawn, and in Hancock and Bauval's reading of the whole age.", 19, PALE, SANS, 12),
            (f"Where it is loose: Regulus rose at {dm(reg['value'])}, {dm(reg['value'] - reg['target'])} south of due east, "
             f"twice the claim's {dm(reg['toleranceAbs'])} band. The Sphinx's own axis has no surveyed azimuth to test, and "
             f"the epoch is chosen for the sky, not read off the stone.", 16, MISS, SANS, 0),
        ]
        title, sub = "The lion faces Leo", "C5, the Sphinx and Leo at the equinox dawn of 10,500 BCE"
    else:
        sep = project.separation(sun_dir, project.direction(*ctx.star(sky, "Aldebaran")[:2]))
        pleiades = project.separation(sun_dir, project.direction(*ctx.star(sky, "Alcyone")[:2]))
        first = min(ctx.al["c5"].values(), key=lambda d: d["epoch"])
        blocks = [
            (f"The same place and the same moment of the equinox dawn, {year(c5['epoch'])}. Precession has turned the sky "
             f"through {c5['epoch'] - first['epoch']:,} years: the equinox sun now rises in Taurus, between the Pleiades "
             f"({pleiades:.0f}° away) and Aldebaran ({sep:.0f}°), and the Bull comes up with it, lost in the dawn.",
             19, PALE, SANS, 12),
            (f"Leo is nowhere near: Regulus rises {dm(reg['target'] - reg['value'])} north of east, {minutes_of(lead['value'])} "
             f"of sidereal time after the sun. If the Sphinx was made to face its own constellation, the argument runs, it "
             f"was not made under this sky.", 19, PALE, SANS, 0),
        ]
        title, sub = "The Bull, not the Lion", "C5's pair: the same dawn in 2500 BCE"
    caption(cv, (40, 40, 600), title, sub, [(t, min(sz, 18), c, p, a) for t, sz, c, p, a in blocks])
    era = "the lion era is a claim" if lion_dawn else "the as-built era is a reconstruction"
    credit(cv, "Stars: HYG 4.2 (CC BY-SA 4.0) precessed by Vondrák 2011; figure lines: Stellarium (CC BY-SA 4.0). "
               f"The Sphinx is a stand-in model; {era}.")
    return cv.finish()


# --- C2: the shafts -----------------------------------------------------------------------------

# Where each shaft's porthole sits, its centre and radius in design pixels: look choices. The two
# southern shafts rise 5.4 degrees apart and the two northern 6.5, so a circle centred on one ray
# would sit across the other; each circle stands off its ray instead, the upper ray's above, the
# lower ray's below, and a short leader joins it to the point of the ray nearest it.
PORTHOLES = {"kc.shaft.south": ((705, 318), 140), "qc.shaft.south": ((372, 660), 128),
             "qc.shaft.north": ((1452, 262), 140), "kc.shaft.north": ((1664, 626), 128)}
RAY_BEYOND = 110     # how far each ray runs on past its leader, in design pixels, to its arrowhead
CHAMBERS = {"kc": "King's Chamber", "qc": "Queen's Chamber"}
SHAFT_BAND = 1.5     # the bake's SHAFT_BAND_DEG, in words only; the crossing lists come already cut to it
PORT = 360.0         # a porthole's design width
# The figures each porthole draws, by the shaft part of its sky id, and the extra stars it names.
PORT_FIGURES = {"kc-south": ("Ori", "Cen", "Gem", "CMa", "Lep"), "qc-south": ("CMa", "Ori", "Cen", "Tau", "Lep", "Pup"),
                "kc-north": ("Dra", "UMi", "UMa", "Cep"), "qc-north": ("UMi", "Dra", "Lyr", "Her", "UMa")}
PORT_NAMES = {"c2-2450-kc-south": {"Betelgeuse": (10, 0), "Rigel": (10, 0)},
              "c2-2450-qc-south": {"Adhara": (10, 0)},
              "c2-10450-kc-south": {"Toliman": (10, 8)},
              "c2-10450-qc-south": {"Rigil Kentaurus": (10, 0)},
              "c2-10450-qc-north": {"Eltanin": (10, 0)}}


def c2_xray(ctx, tag, final):
    side, img, cam = ctx.render(f"c2-xray-{tag}")
    c2 = ctx.al["c2"]
    claim_tag = next(iter(c2["shafts"][0]["at"]))          # the claim's own epoch comes first in the bake
    claimed = tag == claim_tag
    solved = shaft_epochs()
    cv = Canvas(img)
    sd = project.seked_data()
    v = ctx.values
    half = v["g1.base.side.mean"] / 2.0
    face = v["g1.face.angle"]
    top = pyramid_top("g1", side["era"])
    corners = [(half, half, 0.0), (half, -half, 0.0), (-half, -half, 0.0), (-half, half, 0.0)]
    for c in corners:
        cv.line([cam.project(c), cam.project(top)], PALE, 0.9, alpha=80)
    cv.line([cam.project(c) for c in corners[:2]], PALE, 0.9, alpha=80)
    epoch = c2["shafts"][0]["at"][tag]["epoch"]
    for shaft in c2["shafts"]:
        route = project.shaft_route(v, shaft["key"])
        cv.line([cam.project(p) for p in route["points"]], GOLD, 2.2, alpha=255, glow=6)
        d = project.direction(route["bearing"], route["angle"])
        end = route["points"][-1]
        # Out through the masonry to the face, where the bore stops short of it.
        if route["exits"]:
            exit3 = tuple(end)
        else:
            t = sd.run_to_face(end, route["angle"], route["bearing"], half, face)
            exit3 = tuple(end[i] + t * d[i] for i in range(3))
            cv.line([cam.project(end), cam.project(exit3)], GOLD, 1.3, alpha=170, dash=(5, 5))
        a = np.array(cam.project(exit3))
        u = unit(cam, exit3, d)
        centre, rad = PORTHOLES[shaft["key"]]
        centre = np.array(centre, float)
        foot_t = float((centre - a) @ u)
        foot = a + foot_t * u
        tip = a + (foot_t + RAY_BEYOND) * u
        cv.line([tuple(a), tuple(tip)], GOLD, 1.8, alpha=235, glow=7)
        arrow(cv, tip, u, GOLD)
        towards = (centre - foot) / np.linalg.norm(centre - foot)
        cv.line([tuple(foot), tuple(centre - towards * rad)], GOLD, 1.2, alpha=200, dash=(3, 4))
        cv.dot(tuple(foot), 3.0, GOLD)
        at = shaft["at"][tag]
        porthole(cv, ctx, at, shaft, route, tuple(centre), rad, claimed, solved)
        if not claimed:
            ghost(cv, cam, exit3, shaft, at)
    # The two chambers named off to the side of the drawing, each with a short leader.
    for key, word, dx, dy in (("kc", "King's Chamber", -95, -40), ("qc", "Queen's Chamber", -95, 44)):
        room = [p for p in sd.interior_solids(v, "g1") if p["name"] == key]
        if room:
            px = cam.project(tuple(np.array(room[0]["verts"]).mean(0)))
            to = (px[0] + dx, px[1] + dy)
            cv.line([px, to], PALE, 1.0, alpha=200)
            cv.text((to[0] - 6, to[1]), word, size=15, colour=PALE, anchor="rm", alpha=240)
    if claimed:
        words_n = {1: "one", 2: "two", 3: "three", 4: "all four"}
        within = words_n.get(sum(1 for c in c2["comparisons"] if c["within"]), "none")
        # For each star the solved epoch nearest the claim's (Thuban's line is met twice), and the widest gap.
        gaps = [min(abs(int(e.split()[0].replace(",", "")) - (1 - epoch)) for e, _ in solved[s["at"][tag]["claimed"]["name"]])
                for s in c2["shafts"] if solved.get(s["at"][tag]["claimed"]["name"])]
        spread = max(gaps) if gaps else "?"
        title, sub = "Where the shafts point", "C2, the Great Pyramid's shafts and their stars"
        blocks = [
            (f"The Great Pyramid from due east, {year(epoch)}, its casing seen through, its four shafts drawn from "
             f"Gantenbrink's survey and carried on out into the sky. Each circle is the sky up its shaft at the hour its "
             f"star crosses the meridian: Orion's belt and Sirius to the south; Thuban, the pole star of the age, and Kochab "
             f"to the north.", 17, PALE, SANS, 10),
            (f"All four stand within a degree of their shafts, {within} of them inside C2's 1 % band. Solved one at a time, "
             f"each shaft meets its star within {spread} years of Bauval and Gilbert's {year(epoch)}.", 17, PALE, SANS, 0),
        ]
        loose = ("Where it is loose: the four culminate at different hours, never together, and which star a shaft is given "
                 "is a free choice. The Queen's Chamber shafts end inside the masonry, and the north one's slope wanders from "
                 "33° to 40° along it.")
    else:
        title, sub = "The shafts in 10,450 BCE", "C2 against the sky of the First Time"
        blocks = [
            (f"The same shafts under the sky of {year(epoch)}. Precession has sunk Orion to the horizon and moved the pole: "
             f"the dotted lines are where the stars of 2450 BCE crossed the meridian then. Each circle holds instead the "
             f"brightest star to cross its shaft's line within {SHAFT_BAND}°.", 17, PALE, SANS, 10),
            ("Both southern shafts catch Centaurus, its two brightest stars, and the Queen's Chamber's northern shaft "
             "catches Vega, the bright star nearest the pole in that age.", 17, PALE, SANS, 0),
        ]
        loose = ("Where it is loose: this searches the whole catalogue for whatever crosses a line, and any line will find "
                 "something. Rigil Kentaurus moves across the sky faster than any other bright star; carried back 12,000 years "
                 "in a straight line, its place is the least certain here.")
    caption(cv, (26, 26, 520), title, sub, blocks, alpha=185)
    note(cv, (1920 - 26 - 540, -40, 540), loose)
    credit(cv, "Shafts: Gantenbrink 1993, Petrie (data/measurements). Stars: HYG 4.2 precessed by Vondrák 2011. "
               "Solved epochs: docs/shafts.md. Casing and glow are look choices.")
    return cv.finish()


def note(cv, box, text):
    """A short panel of the loose ends, its bottom `-y0` above the frame's foot when y0 is negative."""
    x0, y0, width = box
    pad = 18
    lines = cv.wrap(text, 15, width - 2 * pad)
    height = 2 * pad + len(lines) * 15 * 1.32
    if y0 < 0:
        y0 = cv.dh + y0 - height
    cv.panel((x0, y0, x0 + width, y0 + height), alpha=185)
    cv.paragraphs(x0 + pad, y0 + pad, width - 2 * pad, [(text, 15, MISS, SANS, 0)])


def arrow(cv, tip, u, colour, size=11):
    """An arrowhead at `tip` pointing along `u`: the ray goes on to its star."""
    n = np.array([-u[1], u[0]])
    back = np.array(tip) - u * size
    cv.line([tuple(back + n * size * 0.45), tuple(tip), tuple(back - n * size * 0.45)], colour, 1.8, alpha=235)


def unit(cam, origin, d):
    """The on-screen direction of a world ray from `origin` along `d`."""
    a = cam.project(origin)
    b = cam.project(tuple(origin[i] + 100.0 * d[i] for i in range(3)))
    u = np.subtract(b, a)
    return u / np.linalg.norm(u)


def ghost(cv, cam, exit3, shaft, at):
    """Where the shaft's claimed star culminated in this epoch, as a dotted ray from the shaft's mouth."""
    c = at["claimed"]
    north = c["transitNorth"]
    if (shaft["side"] == "north") != north:
        return
    a = cam.project(exit3)
    u = unit(cam, exit3, project.direction(0.0 if north else 180.0, c["transitAltitudeDeg"]))
    # Short enough that the low southern ghosts stop before the Queen's Chamber's southern circle.
    reach = 300 if c["transitAltitudeDeg"] > 60 else 200
    far = (a[0] + u[0] * reach, a[1] + u[1] * reach)
    cv.line([a, far], SKY, 1.2, alpha=200, dash=(2, 5))
    cv.text((far[0] + (8 if north else -8), far[1] - (10 if north and shaft["key"].startswith("kc") else 0)),
            f"{c['name']} then: {dm(c['transitAltitudeDeg'])}", size=14, colour=SKY, anchor="lm" if north else "rm", alpha=235)


def porthole(cv, ctx, at, shaft, route, centre, rad, claimed, solved):
    """
    The sky up the shaft: the porthole render masked to a circle, its figures, its star ringed and named,
    the shaft's line at the centre, and the words inside the rim: which shaft, what it meets, and when.
    """
    side, img, cam = ctx.render(f"port-{at['sky']}", ref=PORT)
    sky = ctx.sky(at["sky"])
    pc = Canvas(img, ref=PORT)
    for abbr in PORT_FIGURES.get(at["sky"].split("-", 2)[2], ()):
        draw_figure(pc, cam, ctx, sky, abbr, colour=SKY, width=1.1, alpha=140)
    c, t = PORT / 2.0, 11.0
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        pc.line([(c + dx * t, c + dy * t), (c + dx * 2.6 * t, c + dy * 2.6 * t)], GOLD, 1.2, alpha=235)
    target = sky.get("meridian")
    named = None
    if target and (claimed or at["crossing"]):
        key = target["star"] if target["star"] in ctx.index else target["name"]
        px = star_px(cam, ctx.star(sky, key))
        if cam.inside(px, -8):
            pc.ring(px, 9, GOLD, 1.3, glow=3)
            pc.text((px[0] + 12, px[1] - 9), target["name"], size=17, colour=GOLD, path=SANS_BOLD, anchor="ls")
            named = target["name"]
    if not claimed and not at["crossing"]:
        pole = cam.project_star(0.0, ctx.bake["observer"]["latitudeDeg"])
        if cam.inside(pole):
            pc.line([(pole[0] - 7, pole[1]), (pole[0] + 7, pole[1])], PALE, 1.0, alpha=220)
            pc.line([(pole[0], pole[1] - 7), (pole[0], pole[1] + 7)], PALE, 1.0, alpha=220)
            pc.text((pole[0] + 10, pole[1] + 1), "celestial pole", size=13, colour=PALE, anchor="lm")
    for name, (dx, dy) in PORT_NAMES.get(at["sky"], {}).items():
        if name == named:
            continue
        px = star_px(cam, ctx.star(sky, name))
        if cam.inside(px, -8):
            pc.text((px[0] + dx, px[1] + dy), name, size=13, colour=SKY, anchor="lm", alpha=230)
    # The words, on dark bands across the top and the foot of the circle.
    head = f"{CHAMBERS[shaft['key'].split('.')[0]].upper()}, {shaft['side'].upper()}"
    foot = []
    if claimed:
        cl = at["claimed"]
        off = cl["transitAltitudeDeg"] - route["angle"]
        foot.append(f"{cl['name']} at {dm(cl['transitAltitudeDeg'])}, {dm(abs(off))} {'above' if off > 0 else 'below'}")
        eps = [e for e, _ in solved.get(cl["name"], [])]
        if eps and all(e.endswith(" BCE") for e in eps):
            foot.append("on the line in " + " and ".join(e[:-4] for e in eps) + " BCE")
        elif eps:
            foot.append("on the line in " + " and ".join(eps))
    elif at["crossing"]:
        s0 = at["crossing"][0]
        foot.append(f"{s0['name']} at {dm(s0['altitudeDeg'])}, {dm(abs(s0['offsetDeg']))} {'above' if s0['offsetDeg'] > 0 else 'below'}")
        also = [s["name"] for s in at["crossing"][1:3] if not s["name"].startswith("hip")]
        if also:
            foot.append("also crossing: " + ", ".join(also))
    else:
        foot.append(f"no star to mag. 4 within {SHAFT_BAND}°")
        foot.append(f"it looks {dm(route['angle'] - ctx.bake['observer']['latitudeDeg'])} above the celestial pole")
    # Set low enough in the circle that the chord is wide enough for them.
    # The circle is shown at about three quarters of this canvas, so the words are set large for it.
    pc.panel((0, 0, PORT, 96), alpha=150, radius=0)
    pc.text((c, 62), head, size=17, colour=GOLD, path=SANS_BOLD, anchor="ms", halo=0)
    pc.text((c, 86), f"shaft at {dm(route['angle'])}", size=17, colour=PALE, anchor="ms", halo=0)
    pc.panel((0, PORT - 104, PORT, PORT), alpha=150, radius=0)
    for i, s in enumerate(foot):
        pc.text((c, PORT - 96 + 24 * i), s, size=18 if i == 0 else 16, colour=PALE if i == 0 else DIM,
                path=SANS_BOLD if i == 0 else SANS, anchor="mt", halo=0)
    disc = pc.finish()
    size = int(round(2 * rad * cv.k))
    disc = disc.resize((size, size), Image.LANCZOS)
    cv.paste(disc, (centre[0] - rad, centre[1] - rad), circle_mask(size))
    cv.ring(centre, rad, GOLD, 2.0, alpha=230, glow=6)


PICTURES = {
    "c4-night": ("c4-orion-night", lambda ctx, final: c4_night(ctx, final)),
    "c4-plan": ("c4-orion-plan", lambda ctx, final: c4_plan(ctx, final)),
    "c5-dawn-10500": ("c5-leo-dawn-10500", lambda ctx, final: c5_dawn(ctx, "c5-dawn-10500", final)),
    "c5-dawn-2500": ("c5-taurus-dawn-2500", lambda ctx, final: c5_dawn(ctx, "c5-dawn-2500", final)),
    "c2-2450": ("c2-shafts-2450", lambda ctx, final: c2_xray(ctx, "2450", final)),
    "c2-10450": ("c2-shafts-10450", lambda ctx, final: c2_xray(ctx, "10450", final)),
}


def main(spec, opts):
    ctx = Context()
    only = opts["only"].split(",") if isinstance(opts.get("only"), str) else list(PICTURES)
    final = bool(opts.get("final"))
    tail = "" if final else "-draft"
    os.makedirs(OUT, exist_ok=True)
    done = {}
    for key in only:
        name, fn = PICTURES[key]
        try:
            img = fn(ctx, final)
        except SystemExit as e:
            print(f"{key}: skipped, {e}")
            continue
        out = os.path.join(OUT, f"{name}{tail}.png")
        img.save(out)
        done[key] = img
        print(f"wrote {out} ({img.width} x {img.height})")
    if "c5-dawn-10500" in done and "c5-dawn-2500" in done:
        # C5's pair, one over the other: the same place and moment of the equinox dawn, 8,000 years apart.
        a, b = done["c5-dawn-10500"], done["c5-dawn-2500"]
        pair = Image.new("RGB", (a.width, a.height + b.height + 8), (8, 10, 18))
        pair.paste(a, (0, 0))
        pair.paste(b, (0, a.height + 8))
        out = os.path.join(OUT, f"c5-pair{tail}.png")
        pair.save(out)
        print(f"wrote {out} ({pair.width} x {pair.height})")
