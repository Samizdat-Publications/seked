"""A head's profile read off its points, without bpy: where its chin and its crown are.

H1 compares the king's head the weathered lion could hold with the monument's own head, which ARCE's south
elevation gives from the chin's underside to the top of the head (`sphinx.head.height`). This reads the same
two points off a mesh's vertices, so the two heights are one measure.
"""
import numpy as np

BINS = 80             # height bins down the head
# of the head's width either side of its middle: the profile's column, nose to throat. Narrower than the beard's
# cut (0.07 in sphinx_eras.king_head), so the rim of the beard's hole, which stands at the chest's front, is not
# read as the chin
COLUMN = 0.05
CHIN_SHARE = 0.6      # of the stretch from the throat up to the nose, in which the chin's front is sought
STEP = 0.25           # of the chin's projection over the throat: a step back that large, from one bin to the next, is the chin's underside


def front_profile(fwd, across, z, bins=BINS):
    """The furthest-forward point of the central column in each height bin: (bin centres, fronts), nan where
    a bin is empty."""
    mid = np.median(across)
    col = np.abs(across - mid) < COLUMN * np.ptp(across)
    edges = np.linspace(z.min(), z.max(), bins + 1)
    b = np.clip(np.searchsorted(edges, z[col], side="right") - 1, 0, bins - 1)
    front = np.full(bins, np.nan)
    f = fwd[col]
    for i in range(bins):
        if (b == i).any():
            front[i] = f[b == i].max()
    return (edges[:-1] + edges[1:]) / 2, front


def chin_to_crown(fwd, across, z, bins=BINS):
    """(chin, crown) heights of a head whose face looks along +fwd. The crown is the highest point. The nose
    is the furthest-forward bin in the upper half; the throat the furthest-back bin below the nose and above
    the bust's foot; the chin's front is the furthest-forward bin in the lower CHIN_SHARE of the stretch between
    them, and its underside the first step back of more than STEP below it."""
    zc, front = front_profile(fwd, across, z, bins)
    ok = ~np.isnan(front)
    zc, front = zc[ok], front[ok]
    lo, hi = z.min(), z.max()
    upper = zc > lo + 0.5 * (hi - lo)
    nose = np.flatnonzero(upper)[np.argmax(front[upper])]
    below = np.arange(nose)
    if len(below) < 3:
        raise ValueError("no profile below the nose")
    throat = below[np.argmin(front[below])]
    # the chin's front: the furthest-forward bin in the lower part of the stretch from the throat to the nose,
    # below the lips
    under = np.arange(throat + 1, throat + 1 + max(1, int(CHIN_SHARE * (nose - throat))))
    chin_front = front[under].max()
    # the chin's underside: going down from the chin's front, the first step back of more than STEP of the chin's
    # projection over the throat. Searching down and not up, because what lies under the chin need not be the
    # throat: the stand-in's beard leaves a stump flush with the chest's front, which is not the chin either.
    start = under[np.argmax(front[under])]
    drop = STEP * (chin_front - front[throat])
    chin = zc[throat]
    for i in range(start, throat, -1):
        if front[i - 1] < front[i] - drop:
            chin = (zc[i] + zc[i - 1]) / 2
            break
    return float(chin), float(hi)
