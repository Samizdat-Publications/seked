"""
How far the rains wore the Sphinx back, point by point: the numbers render/giza/sphinx_eras.py moves the
master lion's surface by, kept free of bpy so render/tests can check them.

The statue is cut through three members of the Mokattam Formation:
- **Member I** at its foot, hard reef limestone, 3.70 m thick at the rump and 0.65 to 1.09 m at the
  forepaws (Lehner 1994, KMT 5(3); the brief docs/research/ch1.md checked it against the reprint).
- **Member II**, the body: seven beds alternating hard and soft, which weather worst (AERA, "Geology of
  the Sphinx"; docs/research/ch2.md).
- **Member III**, the neck and head: softer at the neck and harder at the head (the same page).

Those are the sources. Everything else here is a **look choice**, stated as such: where Member III begins
(no elevation for the II/III contact has been read off a plate yet), which of Member II's beds is hard,
how much faster a soft bed recedes than a hard one, how deep each era's wear goes, how much more a
face turned to the sky wears than one turned to the ground, and where the vertical joints run. They draw
the claim's long rains (Schoch's precipitation weathering) as legibly as the stone allows. None of them
is a measurement, and no claim reads them.

Coordinates are the master's own, as fractions: `u` along the body from rump (0) to forepaws (1), `h` up
from the enclosure floor (0) to the top of the head (1), so the same numbers serve any master once it is
scaled to the ARCE height (`sphinx.height`).
"""
import numpy as np

MEMBER_I_TOP = (3.70, 0.87)     # m at the rump and at the forepaws: Lehner 1994 (0.87 = mean of 0.65 and 1.09)
MEMBER_III_BASE = 0.62          # of the statue's height: a look choice, the top of the back and the root of the neck
MEMBER_III_HARD = 0.80          # of the statue's height: a look choice, where the softer neck gives way to the head
MEMBER_II_BEDS = 7              # AERA: seven beds, alternating hard and soft
MEMBER_II_SOFT_FIRST = True     # a look choice: the lowest Member II bed is a soft one

# How fast each bed recedes against the softest (look choices).
ERODIBILITY = {"I": 0.30, "II-hard": 0.45, "II-soft": 1.00, "III-neck": 0.75, "III-head": 0.25}

# How far a soft bed's face has receded in each era, in metres (look choices): the long rains, then
# Khafre's time (when the head is recut inside the lion's), then today, with the rest of the wear since.
ERA_DEPTH = {"first-time": 0.0, "lion": 0.80, "built": 1.05, "today": 1.40}

# Vertical joints, opened by water running off the plateau, widest at the top (look choices).
JOINT_SPACING = 7.5             # m, mean distance between joints along the body
JOINT_DEPTH = 0.55              # of the era's depth, at the top of the body
JOINT_WIDTH = (0.20, 0.55)      # m, half-width at the floor and at the top


def member(u, h, height):
    """The bed each point is cut in: an array of ERODIBILITY keys."""
    u, h = np.asarray(u, float), np.asarray(h, float)
    z = h * height
    top_i = MEMBER_I_TOP[0] + (MEMBER_I_TOP[1] - MEMBER_I_TOP[0]) * np.clip(u, 0.0, 1.0)
    base_iii = MEMBER_III_BASE * height
    out = np.empty(z.shape, dtype=object)
    out[:] = "III-head"
    out[h < MEMBER_III_HARD] = "III-neck"
    in_ii = (z >= top_i) & (z < base_iii)
    bed = np.floor((z - top_i) / np.maximum(base_iii - top_i, 1e-6) * MEMBER_II_BEDS).astype(int)
    soft = (bed % 2 == 0) if MEMBER_II_SOFT_FIRST else (bed % 2 == 1)
    out[in_ii & soft] = "II-soft"
    out[in_ii & ~soft] = "II-hard"
    out[z < top_i] = "I"
    return out


def exposure(nz):
    """How much of the weather a face takes by which way it looks: full to the sky, most on the flanks,
    little underneath an overhang (look choices)."""
    nz = np.asarray(nz, float)
    return np.where(nz >= 0.0, 0.70 + 0.30 * nz, 0.70 + 0.50 * nz)


def joints(length, seed=31):
    """Where the vertical joints cross the body, in metres from the rump: evenly spaced and jittered."""
    rng = np.random.default_rng(seed)
    n = max(1, int(length / JOINT_SPACING))
    at = (np.arange(n) + 0.5) * length / n
    return at + rng.uniform(-0.3, 0.3, n) * length / n


def recession(u, h, nz, era, height, length, seed=31):
    """How far, in metres, each point's surface has receded in the era: by bed, by exposure, and in the
    joints. Zero in the First Time."""
    depth = ERA_DEPTH[era]
    if depth == 0.0:
        return np.zeros(np.shape(u))
    u, h, nz = (np.asarray(a, float) for a in (u, h, nz))
    beds = member(u, h, height)
    rate = np.vectorize(ERODIBILITY.get, otypes=[float])(beds)
    d = depth * rate * exposure(nz)
    x = u * length
    half = JOINT_WIDTH[0] + (JOINT_WIDTH[1] - JOINT_WIDTH[0]) * np.clip(h / MEMBER_III_BASE, 0.0, 1.0)
    near = np.min(np.abs(x[..., None] - joints(length, seed)[None, :]), axis=-1)
    groove = JOINT_DEPTH * depth * np.sqrt(np.clip(h / MEMBER_III_BASE, 0.0, 1.0)) * np.clip(1.0 - near / half, 0.0, 1.0)
    # The joints run through the body, not the head: Member III is sound stone.
    return d + np.where(h < MEMBER_III_BASE, groove, 0.0)


def further(u, h, nz, since, era, height, length, seed=31):
    """How much further, in metres, each point recedes from era `since` to `era`: today is the as-built
    statue worn on, not the lion worn again, so the head carved in 2500 BCE keeps its 2500 BCE fit."""
    return np.maximum(recession(u, h, nz, era, height, length, seed) - recession(u, h, nz, since, height, length, seed), 0.0)


# The masonry of the repairs, ancient to the 1980s and 1990s, that cases the lower body and the paws today
# (the paws and tail completed in masonry: Lacovara 2026; the casing of the lower body: Lehner, unchecked).
# How high it runs over Member I is a look choice; under it the stone wears no further, the casing having
# rebuilt the profile.
MASONRY_OVER_MEMBER_I = 1.5     # m


def masonry(u, h, height):
    """Which points lie under today's masonry casing: Member I and the first metre and a half over it."""
    u, h = np.asarray(u, float), np.asarray(h, float)
    top_i = MEMBER_I_TOP[0] + (MEMBER_I_TOP[1] - MEMBER_I_TOP[0]) * np.clip(u, 0.0, 1.0)
    return h * height < top_i + MASONRY_OVER_MEMBER_I
