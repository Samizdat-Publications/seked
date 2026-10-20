"""A head's profile read off its points, without bpy: where its chin and its crown are.

H1 compares the king's head the weathered lion could hold with the monument's own head, which ARCE's south
elevation gives from the chin's underside to the top of the head (`sphinx.head.height`). This reads the same
two points off a mesh's vertices, so the two heights are one measure.
"""
import numpy as np

BINS = 80             # height bins down the head
COLUMN = 0.08         # of the head's width either side of its middle: the profile's column, nose to throat
CHIN_SHARE = 0.6      # of the stretch from the throat up to the nose, in which the chin's front is sought


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
    the bust's foot; the chin's underside is the lowest bin between them that stands at least halfway from
    the throat to the chin's own front (the furthest-forward bin in the lower CHIN_SHARE of the stretch)."""
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
    half = front[throat] + 0.5 * (chin_front - front[throat])
    standing = [i for i in range(throat + 1, nose) if front[i] >= half]
    chin = zc[standing[0]] if standing else zc[throat]
    return float(chin), float(hi)
