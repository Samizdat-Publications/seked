"""
Lengthen a side view in 2D through chosen spans, leaving the rest untouched:

    python scripts/sphinx_lab/lengthen.py IN OUT 180:700:1.9 1720:2360:2.2

Each span is source x0:x1:factor in pixels; between spans the image is copied as it is.
"""
import sys
import numpy as np
from PIL import Image

src, dst, spans = sys.argv[1], sys.argv[2], [tuple(map(float, s.split(":"))) for s in sys.argv[3:]]
a = np.asarray(Image.open(src).convert("RGB"))
W = a.shape[1]
xs, x = [], 0.0
for x0, x1, f in sorted(spans):
    xs.extend(np.arange(x, x0))
    xs.extend(np.linspace(x0, x1, int(round((x1 - x0) * f)), endpoint=False))
    x = x1
xs.extend(np.arange(x, W))
xs = np.clip(np.array(xs), 0, W - 1)
i = np.floor(xs).astype(int)
t = (xs - i)[None, :, None]
out = (a[:, i, :] * (1 - t) + a[:, np.clip(i + 1, 0, W - 1), :] * t).astype(np.uint8)
Image.fromarray(out).save(dst)
print(dst, out.shape[1], "x", out.shape[0])
