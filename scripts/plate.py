"""
Read a drawing without reading it by eye.

    python scripts/plate.py render PDF PAGE [--dpi N] [--clip X0 Y0 X1 Y1]
    python scripts/plate.py render IMAGE [--clip X0 Y0 X1 Y1]
    python scripts/plate.py grid PNG --box X0 Y0 X1 Y1 [--step 50] [--zoom 2]
    python scripts/plate.py scale --bar X0 Y0 X1 Y1 LENGTH [--check X0 Y0 X1 Y1 LENGTH ...]
    python scripts/plate.py measure --mpp M --shrink S --drafting-m D X0 Y0 X1 Y1 [--key K ...]
    python scripts/plate.py register --pair PX PY X Y --pair ... [--with-scale]

CLAUDE.md allows two readings of a plate. A dimension printed on it is
transcribed like a figure from a table and cites the plate. A distance scaled
off it against its own scale bar is `method: "scaled from plate"`, carries a
sigma, and is never verified. This is the tool for the second, and for finding
the printed figures of the first.

`render` takes the page's embedded scan out of the PDF at its own resolution
when the page is one image, which the archive.org scans are, so nothing is
resampled before it is measured. A plate that arrives as an image rather than
inside a PDF, which is what an Open Context or IIIF download is, goes through
the same command: pass the image in place of the PDF, leave the page out, and
it is converted to PNG at its own resolution, `--clip` then being in pixels. `grid` burns a labelled pixel grid into a
crop, so a point is located by reading the grid rather than by guessing at a
picture. `scale` turns a scale bar's two ends into metres per pixel and
checks it against printed dimensions on the same sheet; how far they disagree
is the scan's shrinkage. `measure` turns two pixel points into a distance and
an angle, with a sigma that sums three terms: the pixel term (the stated
uncertainty of each end, through the scale), the drafting tolerance (half a
millimetre on the sheet unless the author states one), and the shrinkage.
`register` fits a plan onto the frame from control points with the same
least-squares rotation and translation `scripts/footprints.ts` fits OSM with.

Needs PyMuPDF and Pillow. Rendered pages are cached outside the repository,
under %LOCALAPPDATA%/seked/plates (or $SEKED_PLATE_CACHE), because a plate
scan is tens of megabytes and is not ours to commit.
"""
import argparse
import json
import math
import os
import sys


def cache_dir():
    base = os.environ.get("SEKED_PLATE_CACHE") or os.path.join(
        os.environ.get("LOCALAPPDATA") or os.path.expanduser("~/.cache"), "seked", "plates")
    os.makedirs(base, exist_ok=True)
    return base


IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp")


def render_image(args):
    """A plate that is already an image: converted to PNG at its own resolution, `--clip` in pixels."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(args.pdf)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    how = "image file, native resolution"
    if args.clip:
        im = im.crop(tuple(int(v) for v in args.clip))
        how += f", cropped to {[int(v) for v in args.clip]} px"
    stem = os.path.splitext(os.path.basename(args.pdf))[0].replace(" ", "_")
    suffix = "" if not args.clip else "_clip_" + "_".join(str(int(v)) for v in args.clip)
    out = args.out or os.path.join(cache_dir(), stem, f"native{suffix}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    print(json.dumps({"png": out, "width": im.width, "height": im.height, "how": how}))


def render(args):
    if args.pdf.lower().endswith(IMAGE_SUFFIXES):
        return render_image(args)
    import pymupdf
    doc = pymupdf.open(args.pdf)
    page = doc[args.page]
    stem = os.path.splitext(os.path.basename(args.pdf))[0].replace(" ", "_")
    suffix = "" if not args.clip else "_clip_" + "_".join(str(int(v)) for v in args.clip)
    out = args.out or os.path.join(cache_dir(), stem, f"p{args.page:03d}{'' if not args.dpi else f'_{args.dpi}dpi'}{suffix}.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    images = page.get_images(full=True)
    if len(images) == 1 and not args.dpi:
        pix = pymupdf.Pixmap(doc, images[0][0])
        how = "embedded scan, native resolution"
    else:
        dpi = args.dpi or 300
        clip = pymupdf.Rect(*args.clip) if args.clip else None
        pix = page.get_pixmap(dpi=dpi, clip=clip)
        how = f"rasterised at {dpi} dpi" + (f", clipped to {args.clip} pt" if clip else "")
    if pix.n - pix.alpha > 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    pix.save(out)
    print(json.dumps({"png": out, "width": pix.width, "height": pix.height, "how": how}))


def grid(args):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.open(args.png).convert("RGB")
    x0, y0, x1, y1 = args.box
    crop = im.crop((x0, y0, x1, y1))
    z = args.zoom
    if z != 1:
        crop = crop.resize((int(crop.width * z), int(crop.height * z)), Image.NEAREST if z > 1 else Image.LANCZOS)
    draw = ImageDraw.Draw(crop, "RGBA")
    try:
        font = ImageFont.truetype("arial.ttf", max(10, int(12 * max(z, 1))))
    except OSError:
        font = ImageFont.load_default()
    step = args.step
    first_x = (x0 + step - 1) // step * step
    for gx in range(first_x, x1 + 1, step):
        px = (gx - x0) * z
        major = gx % (step * 5) == 0
        draw.line([(px, 0), (px, crop.height)], fill=(220, 0, 0, 200 if major else 90), width=1)
        if major or step >= 50:
            draw.text((px + 2, 2), str(gx), fill=(200, 0, 0, 255), font=font)
    first_y = (y0 + step - 1) // step * step
    for gy in range(first_y, y1 + 1, step):
        py = (gy - y0) * z
        major = gy % (step * 5) == 0
        draw.line([(0, py), (crop.width, py)], fill=(0, 0, 220, 200 if major else 90), width=1)
        if major or step >= 50:
            draw.text((2, py + 2), str(gy), fill=(0, 0, 200, 255), font=font)
    out = args.out or os.path.splitext(args.png)[0] + f"_grid_{x0}_{y0}_{x1}_{y1}.png"
    crop.save(out)
    print(json.dumps({"png": out, "box": args.box, "step": step, "zoom": z}))


def dist(x0, y0, x1, y1):
    return math.hypot(x1 - x0, y1 - y0)


def scale(args):
    bx0, by0, bx1, by1, length = args.bar
    px = dist(bx0, by0, bx1, by1)
    mpp = length / px
    checks = []
    for x0, y0, x1, y1, printed in args.check or []:
        scaled = dist(x0, y0, x1, y1) * mpp
        checks.append({"printed": printed, "scaled": round(scaled, 4), "deviation": round(scaled / printed - 1, 5)})
    shrink = max((abs(c["deviation"]) for c in checks), default=0.0)
    print(json.dumps({"metres_per_pixel": mpp, "bar_pixels": round(px, 2), "bar_length": length,
                      "checks": checks, "shrinkage": shrink}, indent=2))


def measure(args):
    x0, y0, x1, y1 = args.points
    px = dist(x0, y0, x1, y1)
    metres = px * args.mpp
    pixel_term = args.px_sigma * math.sqrt(2) * args.mpp
    shrink_term = args.shrink * metres
    sigma = pixel_term + args.drafting_m + shrink_term
    # Image y runs down, so a line rising to the right has y1 < y0.
    angle = math.degrees(math.atan2(y0 - y1, x1 - x0))
    slope = math.degrees(math.atan2(abs(y1 - y0), abs(x1 - x0)))
    angle_sigma = math.degrees(math.atan((pixel_term + args.drafting_m) / metres)) if metres > 0 else None
    result = {
        "pixels": round(px, 2), "metres": round(metres, 4),
        "sigma": round(sigma, 4),
        "sigma_terms": {"pixel": round(pixel_term, 4), "drafting": round(args.drafting_m, 4), "shrinkage": round(shrink_term, 4)},
        "direction_deg": round(angle, 3), "slope_deg": round(slope, 3),
        "slope_sigma_deg": round(angle_sigma, 3) if angle_sigma is not None else None,
    }
    if args.key:
        result["record"] = {
            "key": args.key, "structure": args.structure, "quantity": "angle" if args.as_angle else "length",
            "value": round(slope, 3) if args.as_angle else round(metres, 3),
            "unit": "deg" if args.as_angle else "m",
            "sigma": round(angle_sigma, 2) if args.as_angle else round(sigma, 3),
            "source": args.source, "method": "scaled from plate",
            "note": f"Scaled from {args.plate} against {args.bar_name}: pixels ({x0}, {y0}) to ({x1}, {y1}) of the "
                    f"native scan, {args.mpp:.6g} m per pixel. Sigma sums the pixel term {pixel_term:.3f} m "
                    f"({args.px_sigma} px at each end), the drafting tolerance {args.drafting_m:.3f} m and the "
                    f"shrinkage {shrink_term:.3f} m ({args.shrink:.2%}).",
            "verified": False,
        }
    print(json.dumps(result, indent=2, ensure_ascii=False))


def register(args):
    pairs = args.pair
    if len(pairs) < 2:
        sys.exit("register needs at least two control points")
    # Image y runs down; flip it so the fit is a proper rotation into a y-up frame.
    src = [(p[0], -p[1]) for p in pairs]
    dst = [(p[2], p[3]) for p in pairs]
    n = len(pairs)
    sx = sum(p[0] for p in src) / n; sy = sum(p[1] for p in src) / n
    dx = sum(p[0] for p in dst) / n; dy = sum(p[1] for p in dst) / n
    a = b = ss = 0.0
    for (px, py), (qx, qy) in zip(src, dst):
        ux, uy, vx, vy = px - sx, py - sy, qx - dx, qy - dy
        a += ux * vx + uy * vy
        b += ux * vy - uy * vx
        ss += ux * ux + uy * uy
    theta = math.atan2(b, a)
    k = math.hypot(a, b) / ss if args.with_scale else (args.mpp or 1.0)
    c, s = math.cos(theta), math.sin(theta)
    tx = dx - k * (c * sx - s * sy)
    ty = dy - k * (s * sx + c * sy)
    residuals = []
    for (px, py), (qx, qy) in zip(src, dst):
        fx = k * (c * px - s * py) + tx
        fy = k * (s * px + c * py) + ty
        residuals.append(round(math.hypot(fx - qx, fy - qy), 4))
    print(json.dumps({"rotation_deg": math.degrees(theta), "metres_per_pixel": k, "translation": [tx, ty],
                      "residuals_m": residuals, "rms_m": math.sqrt(sum(r * r for r in residuals) / n)}, indent=2))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("render", help="a PDF page, or an image plate, to PNG at its own resolution")
    r.add_argument("pdf", help="a PDF, or an image file, in which case PAGE is left out")
    r.add_argument("page", type=int, nargs="?", default=0)
    r.add_argument("--dpi", type=int); r.add_argument("--out")
    r.add_argument("--clip", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"),
                   help="a region of the page in PDF points, or of an image plate in pixels")
    r.set_defaults(fn=render)

    g = sub.add_parser("grid", help="a crop with a labelled pixel grid in source coordinates")
    g.add_argument("png"); g.add_argument("--box", type=int, nargs=4, required=True)
    g.add_argument("--step", type=int, default=50); g.add_argument("--zoom", type=float, default=1)
    g.add_argument("--out")
    g.set_defaults(fn=grid)

    s = sub.add_parser("scale", help="metres per pixel from a scale bar, checked against printed dimensions")
    s.add_argument("--bar", type=float, nargs=5, required=True, metavar=("X0", "Y0", "X1", "Y1", "LENGTH"))
    s.add_argument("--check", type=float, nargs=5, action="append", metavar=("X0", "Y0", "X1", "Y1", "LENGTH"))
    s.set_defaults(fn=scale)

    m = sub.add_parser("measure", help="two pixel points as metres and an angle, with the three-term sigma")
    m.add_argument("points", type=float, nargs=4, metavar=("X0", "Y0", "X1", "Y1"))
    m.add_argument("--mpp", type=float, required=True)
    m.add_argument("--shrink", type=float, default=0.0)
    m.add_argument("--px-sigma", type=float, default=3.0)
    m.add_argument("--drafting-m", type=float, required=True,
                   help="half a millimetre on the sheet, in metres at the drawing's scale, unless the author states one")
    m.add_argument("--key"); m.add_argument("--structure", default="g1")
    m.add_argument("--source"); m.add_argument("--plate", default="the plate"); m.add_argument("--bar-name", default="its scale bar")
    m.add_argument("--as-angle", action="store_true")
    m.set_defaults(fn=measure)

    g2 = sub.add_parser("register", help="least-squares rotation and translation from control points")
    g2.add_argument("--pair", type=float, nargs=4, action="append", required=True, metavar=("PX", "PY", "X", "Y"))
    g2.add_argument("--mpp", type=float, help="fixed metres per pixel; otherwise fit it with --with-scale")
    g2.add_argument("--with-scale", action="store_true")
    g2.set_defaults(fn=register)

    args = ap.parse_args(argv)
    args.fn(args)


if __name__ == "__main__":
    main()
