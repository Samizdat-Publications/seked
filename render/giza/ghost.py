"""
The ghosted head's camera, without bpy: the still (progress 0036) and the sequence that turns round it
(render/ghost.py --orbit N). All look choices, in the master's own units, written into each frame's record.
"""
import math

LOOK = {
    "ghost_from": 0.40,                 # of the statue's height: the lion's head and mane drawn as the ghost
    "still_offset": (1.05, -1.45, -0.02),   # the still's camera from its target: three-quarters in front, a little below
    "sweep_deg": 80.0,                  # the orbit swings this far either side of the face's forward line
    "lens": 70.0,
}


def arc(t, target, look=LOOK):
    """The camera at `t` (0 to 1): on the still's circle about the vertical through `target`, at the still's height,
    swung from `sweep_deg` on the statue's right (its north side, seen from -x) through the face to `sweep_deg` on its
    left. The face looks along -y; the still sits at about 36 degrees on the +x side."""
    dx, dy, dz = look["still_offset"]
    r = math.hypot(dx, dy)
    a = math.radians(-look["sweep_deg"] + 2 * look["sweep_deg"] * t)   # from the forward line, +x positive
    return dict(eye=(target[0] + r * math.sin(a), target[1] - r * math.cos(a), target[2] + dz), at=tuple(target))


def still_t(look=LOOK):
    """The `t` at which the orbit passes through the still's own camera."""
    dx, dy, _ = look["still_offset"]
    return (math.degrees(math.atan2(dx, -dy)) + look["sweep_deg"]) / (2 * look["sweep_deg"])
