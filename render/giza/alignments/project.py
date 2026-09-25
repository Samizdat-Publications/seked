"""
Where a point or a direction lands in a rendered frame, without Blender.

A render of render/alignments.py writes, beside its PNG, the camera it was taken with: its
location, the rotation that carries camera axes to world axes, the lens, the sensor width, the
lens shift, the orthographic scale and the frame size. `Camera` inverts that. The camera looks
down its own -Z with +Y up, as Blender's does; the sensor width spans the frame's longer side
(Blender's AUTO sensor fit), and a shift is a fraction of that longer side.

A star is at infinity. The render puts it on a dome centred on the camera (render/giza/night.py),
so the pixel a star lands on is the pixel of its direction, which is what `project_direction`
gives: the same altitude and azimuth the bake gives the dome, turned by the same camera.

Also here, bpy-free: altitude and azimuth to a direction in the project frame (+x east, +y north,
+z up), a similarity fit of one set of points onto another, and the Great Pyramid's shafts as
routes, from blender/seked_data.py's own bore geometry.
"""
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))


def direction(az_deg, alt_deg):
    """A unit vector for an azimuth (north through east) and an altitude, east-north-up."""
    az, alt = math.radians(az_deg), math.radians(alt_deg)
    return np.array([math.cos(alt) * math.sin(az), math.cos(alt) * math.cos(az), math.sin(alt)])


def az_alt(v):
    """The azimuth and altitude of a direction, degrees."""
    v = np.asarray(v, float)
    v = v / np.linalg.norm(v)
    return math.degrees(math.atan2(v[0], v[1])) % 360.0, math.degrees(math.asin(max(-1.0, min(1.0, v[2]))))


def separation(a, b):
    """The angle between two directions, degrees."""
    a = np.asarray(a, float) / np.linalg.norm(a)
    b = np.asarray(b, float) / np.linalg.norm(b)
    return math.degrees(math.acos(max(-1.0, min(1.0, float(a @ b)))))


class Camera:
    """A render's camera, from the `projection` block of its sidecar."""

    def __init__(self, p):
        self.location = np.array(p["location"], float)
        self.matrix = np.array(p["matrix"], float)          # columns: the camera's x, y, z axes in the world
        self.type = p["type"]
        self.lens = p["lens"]
        self.sensor = p["sensor_width"]
        self.shift = (p.get("shift_x", 0.0), p.get("shift_y", 0.0))
        self.ortho_scale = p.get("ortho_scale")
        self.width, self.height = p["size"]

    @property
    def longer(self):
        return max(self.width, self.height)

    def _pixel(self, x, y):
        """
        Image-plane coordinates, in units of the longer side about the optical axis, to pixels. A
        shift moves the frame over the image plane, so the picture moves the other way.
        """
        return (self.width / 2.0 + (x - self.shift[0]) * self.longer,
                self.height / 2.0 - (y - self.shift[1]) * self.longer)

    def project(self, point):
        """The pixel (x right, y down) a world point lands on, or None when it is behind the camera."""
        c = self.matrix.T @ (np.asarray(point, float) - self.location)
        if self.type == "ORTHO":
            return self._pixel(c[0] / self.ortho_scale, c[1] / self.ortho_scale)
        if c[2] >= -1e-9:
            return None
        f = self.lens / self.sensor
        return self._pixel(f * c[0] / -c[2], f * c[1] / -c[2])

    def project_direction(self, d):
        """The pixel a direction at infinity lands on (a star), or None when it points away."""
        if self.type == "ORTHO":
            return None
        c = self.matrix.T @ np.asarray(d, float)
        if c[2] >= -1e-9:
            return None
        f = self.lens / self.sensor
        return self._pixel(f * c[0] / -c[2], f * c[1] / -c[2])

    def project_star(self, az_deg, alt_deg):
        return self.project_direction(direction(az_deg, alt_deg))

    def ray(self, origin, d, far=1.0e7, steps=1):
        """
        A ray from a world point out to infinity along `d`, as pixels: its start and the
        vanishing point of its direction, which is where the render put the star it aims at.
        A straight line in the world is a straight line in a perspective frame, so two points
        are the whole of it.
        """
        a = self.project(origin)
        b = self.project_direction(d)
        if b is None and self.type == "ORTHO":
            b = self.project(np.asarray(origin, float) + far * np.asarray(d, float) / np.linalg.norm(d))
        return a, b

    def inside(self, px, margin=0.0):
        return px is not None and -margin <= px[0] <= self.width + margin and -margin <= px[1] <= self.height + margin


def fit_similarity(src, dst, allow_mirror=True):
    """
    The similarity (scale, rotation, translation, and a mirror if that fits better and is
    allowed) carrying the points `src` onto `dst` with the least sum of squared residuals
    (Umeyama 1991). Returns dict(scale, rotation_deg, mirror, t, apply, residuals, rms).
    """
    src = np.asarray(src, float)
    dst = np.asarray(dst, float)
    best = None
    for mirror in ((False, True) if allow_mirror else (False,)):
        s = src * (np.array([-1.0, 1.0]) if mirror else 1.0)
        ms, md = s.mean(0), dst.mean(0)
        a, b = s - ms, dst - md
        cov = b.T @ a / len(s)
        u, sv, vt = np.linalg.svd(cov)
        d = np.eye(2)
        if np.linalg.det(u @ vt) < 0:
            d[1, 1] = -1.0
        r = u @ d @ vt
        scale = float(np.trace(np.diag(sv) @ d) / (a ** 2).sum() * len(s))
        t = md - scale * r @ ms

        def apply(p, r=r, scale=scale, t=t, mirror=mirror):
            p = np.asarray(p, float) * (np.array([-1.0, 1.0]) if mirror else 1.0)
            return (scale * (r @ p.T)).T + t

        fitted = apply(src)
        res = dst - fitted
        rms = float(np.sqrt((res ** 2).sum(1).mean()))
        out = dict(scale=scale, rotation_deg=math.degrees(math.atan2(r[1, 0], r[0, 0])), mirror=mirror, t=t,
                   apply=apply, fitted=fitted, residuals=res, rms=rms)
        if best is None or rms < best["rms"]:
            best = out
    return best


def fit_turn_held(src, dst, rotation_deg, mirror):
    """
    The scale and shift that carry `src` onto `dst` best with its turn (and mirror) held at the
    given ones: the belt as the sky set it, only moved and sized, against which the free fit's
    turn is measured.
    """
    s = np.asarray(src, float) * (np.array([-1.0, 1.0]) if mirror else 1.0)
    a = math.radians(rotation_deg)
    r = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    s = (r @ s.T).T
    dst = np.asarray(dst, float)
    ms, md = s.mean(0), dst.mean(0)
    A, B = s - ms, dst - md
    scale = float((A * B).sum() / (A * A).sum())
    fitted = scale * A + md
    res = dst - fitted
    return dict(scale=scale, fitted=fitted, residuals=res, rms=float(np.sqrt((res ** 2).sum(1).mean())))


def seked_data():
    """blender/seked_data.py, the stdlib reader the old generator built the interiors with."""
    path = os.path.join(REPO, "blender")
    if path not in sys.path:
        sys.path.insert(0, path)
    import seked_data as sd
    return sd


def resolved(preset="canonical"):
    sd = seked_data()
    return sd.resolve(sd.load_database(), preset)["values"]


def shaft_route(values, base):
    """
    One shaft's floor line from its inlet in the chamber wall to its last measured point, as
    points in the project frame, and the last leg's slope and bearing. It follows
    seked_data._shaft_builder leg for leg (its inlet rule, its segments, its run to the face),
    so the line drawn is the line the bore was built along.
    """
    sd = seked_data()
    chamber, _, side = base.split(".")
    room = sd._SHAFT_CHAMBERS[chamber]
    inlet = (room["east_wall"](values) - values[base + ".inlet.from_east_wall"],
             room["wall"](values, side),
             room["floor"](values) + values[base + ".inlet.from_floor"])
    bearing = 0.0 if side == "north" else 180.0
    half_base = values["g1.base.side.mean"] / 2.0
    face = values["g1.face.angle"]
    points = [inlet]
    legs = sd._shaft_segments(values, base, bearing)
    for s in legs:
        length = sd.run_to_face(points[-1], s["angle"], s["direction"], half_base, face) if s["to_face"] else s["length"]
        points.append(sd.run_end(points[-1], length, s["angle"], s["direction"]))
    last = legs[-1]
    return dict(points=points, angle=last["angle"], bearing=last["direction"], exits=bool(last["to_face"]),
                width=values[base + ".width"], height=values[base + ".height"])
