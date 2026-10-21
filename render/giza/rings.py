"""
Plane geometry on footprint rings, free of bpy so publish and the tests can use it as the renderer does.
"""


def centroid(ring):
    """A ring's area centroid, the point Hölscher's plate is registered to (the vertices' mean leans towards where they crowd)."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        c = x0 * y1 - x1 * y0
        a += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    return cx / (3.0 * a), cy / (3.0 * a)
