"""
Training views for a Gaussian splat of one area: the scene built once in one era and moment, then rendered from a few
hundred cameras round the area (rings on the ground about it at several heights, and a ring at eye height inside it),
each camera's pose written into transforms.json in the NeRF "synthetic" layout that splat trainers read (Brush,
nerfstudio, gsplat): `camera_angle_x` and, per frame, `file_path` and the camera's 4x4 `transform_matrix`, Blender's
own camera-to-world, which is that layout's convention.

    blender -b --factory-startup -P render/splat_views.py -- --area sphinx --state today --moment equinox-dawn
    blender -b --factory-startup -P render/splat_views.py -- --area sphinx --preview 4      # four views, to look first

Areas are look choices (AREAS): where the cameras stand and what they look at. Frames already on disk are skipped,
so a stopped run picks up where it was. Output: build/splat/<area>-<state>/images/*.png and transforms.json.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from giza import cameras, data  # noqa: E402
from giza.scene import Plateau  # noqa: E402

# Each area: its centre (x, y, the height the cameras look at), the half-length of what they look at along x, the rings
# on the ground round it (radius m, heights above the ground there m, how many round), and the rings inside it (an
# ellipse's half-axes, the floor's height, the eye's height over it, how many), eye height first; later rings are
# appended so views already rendered keep their numbers.
AREAS = {
    "sphinx": dict(
        centre=(322.0, -433.0, -30.0), along=34.0,
        rings=[(52.0, (2.0, 12.0, 28.0), 28), (78.0, (6.0, 22.0, 45.0), 24), (110.0, (30.0, 70.0), 16)],
        inner=[(40.0, 17.0, -40.1, 1.7, 28), (40.0, 16.0, -40.1, 6.0, 28), (40.0, 16.0, -40.1, 12.0, 28)],
        lens=22.0,
    ),
}


def parse(argv):
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    it = iter(argv)
    return {k.lstrip("-"): next(it) for k in it}


def poses(area, surface):
    """(location, target) for every camera of an area."""
    A = AREAS[area]
    cx, cy, cz = A["centre"]
    out = []
    for radius, heights, n in A["rings"]:
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (radius > 60)) / n
            x, y = cx + radius * math.cos(a), cy + radius * math.sin(a)
            ground = float(surface([x], [y])[0])
            for h in heights:
                # look at the nearest point of the Sphinx's axis, a little low for the high rings so the floor shows
                tx = cx + max(-A["along"], min(A["along"], x - cx))
                out.append(((x, y, ground + h), (tx, cy, cz - 0.08 * h)))
    for ax, ay, floor, eye, n in A["inner"]:
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (eye > 2.0)) / n
            x, y = cx + ax * math.cos(a), cy + ay * math.sin(a)
            tx = cx + max(-A["along"], min(A["along"], 0.6 * (x - cx)))
            out.append(((x, y, floor + eye), (tx, cy, cz + 2.0 - 0.3 * eye)))
    return out


def write_points(plateau, frames, images, root, fov_x, w, h, across):
    """points3D.ply: a grid of `across` rays a view, cast into the scene, each hit coloured from the view's render."""
    import struct
    import bpy
    import numpy as np
    from mathutils import Matrix, Vector
    depsgraph = bpy.context.evaluated_depsgraph_get()
    down = max(1, round(across * h / w))
    tan_x = math.tan(fov_x / 2)
    tan_y = tan_x * h / w
    pts = []
    for fr in frames:
        m = Matrix(fr["transform_matrix"])
        origin = m.to_translation()
        rot = m.to_3x3()
        # Blender's own loader (its Python has no PIL); its pixels run from the bottom row up
        im = bpy.data.images.load(os.path.join(images, os.path.basename(fr["file_path"])), check_existing=False)
        buf = np.empty(im.size[0] * im.size[1] * 4, np.float32)
        im.pixels.foreach_get(buf)
        rgb = (np.clip(buf.reshape(im.size[1], im.size[0], 4)[::-1, :, :3], 0, 1) * 255).astype(np.uint8)
        bpy.data.images.remove(im)
        for j in range(down):
            for i in range(across):
                u, v = (i + 0.5) / across, (j + 0.5) / down
                d = rot @ Vector(((2 * u - 1) * tan_x, (1 - 2 * v) * tan_y, -1.0))
                hit, loc, *_ = plateau.scene.ray_cast(depsgraph, origin, d.normalized(), distance=2000.0)
                if hit:
                    pts.append((loc.x, loc.y, loc.z, *(int(c) for c in rgb[min(h - 1, int(v * h)), min(w - 1, int(u * w))])))
    with open(os.path.join(root, "points3D.ply"), "wb") as f:
        f.write((f"ply\nformat binary_little_endian 1.0\nelement vertex {len(pts)}\nproperty float x\nproperty float y\n"
                 "property float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n").encode())
        for p in pts:
            f.write(struct.pack("<fffBBB", *p))
    return len(pts)


def main():
    o = parse(sys.argv)
    area, state, moment = o.get("area", "sphinx"), o.get("state", "today"), o.get("moment", "equinox-dawn")
    w, h = (int(n) for n in o.get("size", "1280x854").split("x"))
    samples = int(o.get("samples", 48))
    A = AREAS[area]
    stations, _ = data.views()
    plateau = Plateau(state)
    cx, cy, cz = A["centre"]
    # the fine ground is laid round the area's centre, so every camera sees the same ground
    plateau.view({"id": f"splat {area}", "x": cx, "y": cy, "eye": 1.7, "target": [cx + 10, cy, cz], "lens": A["lens"]}, "shot")
    plateau.moment(stations["moments"][moment])
    plateau.scene.render.use_persistent_data = True
    root = os.path.join(data.REPO, "build", "splat", f"{area}-{state}")
    images = os.path.join(root, "images")
    os.makedirs(images, exist_ok=True)
    cams = poses(area, plateau.terrain.surface)
    if o.get("preview"):
        step = max(1, len(cams) // int(o["preview"]))
        cams = cams[::step][: int(o["preview"])]
    frames = []
    for k, (loc, look) in enumerate(cams):
        name = f"view_{k:04d}.png"
        cameras.frame(plateau.camera, loc, look, A["lens"])
        plateau.camera.data.sensor_fit = "HORIZONTAL"
        out = os.path.join(images, name)
        if not os.path.exists(out):
            plateau.render(out, w, h, samples, view_id=f"splat {area} {k}", kind="film", moment=moment)
        import bpy
        bpy.context.view_layer.update()
        m = plateau.camera.matrix_world
        frames.append({"file_path": f"images/{name}", "transform_matrix": [list(map(float, row)) for row in m]})
        print(f"splat {area}: {k + 1}/{len(cams)}", flush=True)
    fov_x = 2 * math.atan(plateau.camera.data.sensor_width / (2 * A["lens"]))
    doc = {"camera_angle_x": fov_x, "w": w, "h": h, "area": area, "state": state, "moment": moment,
           "note": "render/splat_views.py: Blender camera-to-world matrices, the NeRF synthetic convention",
           "frames": frames}
    # the trainer's starting points: where each camera's rays meet the scene, each coloured from its own render, so
    # the splat starts on the true surfaces instead of from noise (the first test smeared everything but the statue)
    if not o.get("preview"):
        n = write_points(plateau, frames, images, root, fov_x, w, h, int(o.get("rays", 72)))
        doc["ply_file_path"] = "points3D.ply"
        print(f"splat {area}: {n} starting points", flush=True)
    with open(os.path.join(root, "transforms.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1)
    print(f"splat {area}: {len(frames)} views and transforms.json in {root}")


if __name__ == "__main__":
    main()
