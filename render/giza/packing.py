"""
How the Old Kingdom's masons filled a wall face, as a plain-Python layout (no bpy, so it is tested
outside Blender): blocks of very different lengths and heights, the beds stepping up and down along
the wall where one block stands taller than its neighbour, rather than courses run level from end
to end like brickwork. Khafre's granite and the megalithic core of his temples are laid so, and so,
less boldly, are the dressed limestone walls of the period. Every size here is a look choice.
"""
import math


def skyline(length, height, rng, course=1.3, block=3.0, course_spread=0.35, block_spread=0.5, min_len=0.7,
            snap=0.2, max_course=2.2, voids=(), aspect=0.85):
    """
    Fill a face `length` long and `height` high with blocks, each (s0, s1, z0, z1) in metres along
    and up the face, touching and never overlapping. The lowest stretch of the top edge is filled
    first with a block of lognormal length and height round `block` and `course`; a block that would
    end within `snap` courses of a neighbour's top is trimmed or raised to it, so bed joints run on
    for a stretch before they step; a block that would leave a sliver under the top is carried up to
    it; no block stands higher than `aspect` times its length, unless it fills a narrow gap. `voids`
    are (s0, s1, top) spans left empty from the foot up to `top`, doorways, which the blocks beside
    them rise past and a lintel spans once they have.
    """
    segs = [[0.0, length, 0.0]]
    for a, b, top in sorted(voids):
        a, b = max(0.0, a), min(length, b)
        if b - a < 0.05:
            continue
        for k, (s0, s1, h) in enumerate(segs):
            if s0 <= a and b <= s1:
                new = [[s0, a, h], [a, b, top], [b, s1, h]]
                segs[k:k + 1] = [s for s in new if s[1] - s[0] > 1e-9]
                break
    blocks = []
    guard = 0
    while guard < 100000:
        guard += 1
        i = min(range(len(segs)), key=lambda k: (segs[k][2], segs[k][0]))
        s0, s1, h = segs[i]
        if h >= height - 1e-6:
            break
        w = s1 - s0
        left = segs[i - 1][2] if i > 0 else None
        right = segs[i + 1][2] if i + 1 < len(segs) else None
        bl = min(max(rng.lognormvariate(math.log(block), block_spread), min_len), w)
        if w - bl < min_len:
            bl = w
        bh = min(max(rng.lognormvariate(math.log(course), course_spread), 0.45 * course), max_course * course)
        # a block stands on its bed: longer than it is high, unless the stretch it fills is too short
        bh = min(bh, max(0.45 * course, aspect * bl))
        top = h + bh
        for nh in (left, right):
            if nh is not None and nh > h and abs(top - nh) < snap * course:
                top = nh
        if top > height - 0.4 * course:
            top = height
        # Against whichever neighbour stands higher (a wall's end counts as the highest), so the step it
        # makes is carried along rather than left as a pit.
        lh = math.inf if left is None else left
        rh = math.inf if right is None else right
        at_left = rng.random() < 0.5 if lh == rh else lh > rh
        a, b = (s0, s0 + bl) if at_left else (s1 - bl, s1)
        blocks.append((a, b, h, top))
        rest = [s0 + bl, s1] if at_left else [s0, s1 - bl]
        new = [[a, b, top]]
        if rest[1] - rest[0] > 1e-9:
            new = new + [[rest[0], rest[1], h]] if at_left else [[rest[0], rest[1], h]] + new
        segs[i:i + 1] = new
        # merge neighbours that now stand level
        merged = [segs[0]]
        for s in segs[1:]:
            if abs(s[2] - merged[-1][2]) < 1e-6:
                merged[-1] = [merged[-1][0], s[1], s[2]]
            else:
                merged.append(s)
        segs = merged
    return blocks
