"""
A leaf's view cut out of its panorama, the way the exhibit shows it (apps/exhibit/src/projection.ts):

    python scripts/leaf_view.py PANO.jpg YAW PITCH FOV OUT.jpg [--size 1600x900]

YAW clockwise from north, PITCH up from the horizon, FOV the vertical field, all in degrees.
"""
import argparse
import math

import numpy as np
from PIL import Image


def view(pano, yaw, pitch, fov, w, h):
    src = np.asarray(pano.convert("RGB"), dtype=np.uint8)
    H, W = src.shape[:2]
    t = math.tan(math.radians(fov) / 2)
    xs = (np.arange(w) + 0.5) / w * 2 - 1
    ys = 1 - (np.arange(h) + 0.5) / h * 2
    x, y = np.meshgrid(xs * t * w / h, ys * t)
    z = np.ones_like(x)
    n = np.sqrt(x * x + y * y + z * z)
    x, y, z = x / n, y / n, z / n
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    y2, z2 = y * cp + z * sp, -y * sp + z * cp
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    wx, wy, wz = x * cy + z2 * sy, -x * sy + z2 * cy, y2
    u = 0.5 + np.arctan2(wx, wy) / (2 * math.pi)
    v = 0.5 - np.arcsin(np.clip(wz, -1, 1)) / math.pi
    px = np.clip((u * W).astype(int) % W, 0, W - 1)
    py = np.clip((v * H).astype(int), 0, H - 1)
    return Image.fromarray(src[py, px])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pano")
    ap.add_argument("yaw", type=float)
    ap.add_argument("pitch", type=float)
    ap.add_argument("fov", type=float)
    ap.add_argument("out")
    ap.add_argument("--size", default="1600x900")
    a = ap.parse_args()
    w, h = (int(v) for v in a.size.split("x"))
    view(Image.open(a.pano), a.yaw, a.pitch, a.fov, w, h).save(a.out, quality=90)


if __name__ == "__main__":
    main()
