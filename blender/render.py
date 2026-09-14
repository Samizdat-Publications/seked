"""
Render a still of the generated scene, headless:

    blender -b build/seked.blend -P blender/render.py -- --out build/dawn.png [--view dawn|cutaway|akhet|night] [--width 1600 --height 900 --samples 128]

Four views, each one a moment the sky package can date. "dawn" is the plan's
first hero shot: the equinox sun an hour up, seen from the east-north-east, so
the grazing light separates the Great Pyramid's eight faces. "cutaway" makes
the casing translucent and looks in from the east, so the passages and
chambers built from Petrie's positions show in place. "akhet" stands in front
of the Sphinx and watches the summer solstice sun set into the gap between the
Great Pyramid and Khafre's, which is claim C6. "night" turns the sun off and
puts the bright star catalogue on a dome with Alnitak on the meridian.

Not one sun or star position is computed here, and none is typed here. They
come from `build/sky-bake.json`, which `pnpm sky-bake` writes out of
`@seked/sky` and the measurement database; every view names a moment in that
file and `render_sky.py` only converts an altitude and an azimuth into
Blender's conventions. Without the bake the script says so and falls back to
the placeholder angles in VIEWS, which are lighting and not astronomy.

The materials are `render_materials.py`, the sky, the sun and the stars are
`render_sky.py`, and the cinematic is `rollback.py`; this file is the views.
"""
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from render_materials import assign_materials, make_translucent  # noqa: E402
from render_sky import DOME_RADIUS_M, SKY_BAKE, baked_sun, build_star_dome, build_sun, build_world, load_bake  # noqa: E402

# Where the akhet view stands relative to the Sphinx: back along the line it
# looks out on, far enough that the whole statue is in the frame with the two
# pyramids beyond it, and high enough to see over its back. A bearing, a
# distance and a height, all of them composition; the point they are measured
# from is the box's own cited position.
SPHINX_STANDOFF = {"bearing_deg": 114.0, "distance_m": 170.0, "height_m": 26.0}

# The night's fill, in the sky texture's units, and its exposure in stops. The
# fill is what keeps a moonless sky from being black; with it at 0.006 the
# first night render came out a flat navy card with grey pyramids on it, so it
# is a third of that now and the exposure a stop up, which is what lets the
# stars carry the frame.
NIGHT_FILL = 0.002
NIGHT_EXPOSURE = 6.5

VIEWS = {
    # Each view names a moment in build/sky-bake.json. `placeholder_sun` is the
    # altitude and azimuth used only when that file is missing, so a render
    # still happens and says it is not the sky. `location` and `target` are in
    # the project frame, metres, +X east, +Y north, +Z up. `exposure` is the
    # camera's, in stops, and is composition rather than physics.
    "dawn": {
        "moment": "equinox-sunrise-plus-hour",
        "location": (700.0, 300.0, 45.0),
        "target": (-60.0, -90.0, 40.0),
        "lens": 55.0,
        "exposure": -4.2,
        "fill": 0.0,
        "placeholder_sun": (6.0, 90.0),
    },
    "cutaway": {
        "moment": "equinox-sunrise-plus-hour",
        "location": (430.0, 170.0, 130.0),
        "target": (-15.0, -5.0, 50.0),
        "lens": 40.0,
        "exposure": -3.5,
        "fill": 0.0,
        "placeholder_sun": (35.0, 135.0),
    },
    "akhet": {
        # Looking at the middle of the gap between the Great Pyramid's
        # south-west corner and Khafre's north-east one, which is C6's own
        # target, from a stand in front of the Sphinx. The camera is taken off
        # the box itself, so it follows the cited coordinates instead of
        # repeating them; the location here is what is used if the Sphinx is
        # not in the scene.
        "moment": "solstice-summer-sunset",
        "location": (503.1, -501.5, 46.2),
        "from_object": "Sphinx (massing placeholder)",
        "target": (-206.4, -132.1, 67.1),
        "lens": 50.0,
        "exposure": -2.0,
        "fill": 0.0,
        "placeholder_sun": (-0.833, 298.0),
    },
    "night": {
        "moment": "alnitak-transit",
        "location": (0.0, 300.0, 45.0),
        "target": (0.0, -200.0, 268.0),
        "lens": 20.0,
        "exposure": NIGHT_EXPOSURE,
        "fill": NIGHT_FILL,
        "stars": True,
        "placeholder_sun": (-37.0, 262.0),
    },
}


def parse_args(defaults):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(defaults)
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            opts[key] = argv[i + 1]
            i += 2
        else:
            i += 1
    return opts


def look_at(obj, target):
    direction = (target - obj.location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def sphinx_viewpoint(name, fallback):
    """
    Where the akhet is photographed from: back along the line the Sphinx looks
    out on, high enough that its back is in the frame with the pyramids beyond
    it. The bearing, the distance and the height are composition; the place
    they are measured from is the box's own cited position, so the viewpoint
    follows those coordinates instead of repeating them.
    """
    from mathutils import Vector

    obj = bpy.data.objects.get(name)
    if obj is None:
        print(f"WARNING: no {name!r} in the scene; standing at the fallback viewpoint instead.")
        return Vector(fallback)
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    centre_east = sum(corner.x for corner in corners) / len(corners)
    centre_north = sum(corner.y for corner in corners) / len(corners)
    top = max(corner.z for corner in corners)
    bearing = math.radians(SPHINX_STANDOFF["bearing_deg"])
    distance = SPHINX_STANDOFF["distance_m"]
    return Vector((
        centre_east + distance * math.sin(bearing),
        centre_north + distance * math.cos(bearing),
        top + SPHINX_STANDOFF["height_m"],
    ))


def make_camera(scene, location, target, lens, name="Hero camera"):
    """A camera at a place, looking at a point, with a far clip past the star dome."""
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_end = 4.0 * DOME_RADIUS_M
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    cam.location = location
    look_at(cam, target)
    scene.camera = cam
    return cam


def show_ground_only():
    """The flattened ground renders, smooth-shaded; the GLO-30 context grid it was cut from stays hidden."""
    for obj in bpy.data.objects:
        if obj.name.startswith("Terrain"):
            ground = obj.name == "Terrain (ground)"
            obj.hide_set(not ground)
            obj.hide_render = not ground
            if ground:
                for poly in obj.data.polygons:
                    poly.use_smooth = True


def describe_camera(location, target, lens, exposure):
    towards = target - location
    bearing = math.degrees(math.atan2(towards.x, towards.y)) % 360.0
    pitch = math.degrees(math.atan2(towards.z, math.hypot(towards.x, towards.y)))
    print(f"  camera at ({location.x:.1f}, {location.y:.1f}, {location.z:.1f}) m looking at ({target.x:.1f}, {target.y:.1f}, {target.z:.1f}) m")
    print(f"  bearing {bearing:.1f} deg, pitch {pitch:+.1f} deg, {lens:.0f} mm, exposure {exposure:+.1f} stops")


def setup_view(scene, name, view, bake):
    """The camera, the sun, the sky and, for the night view, the stars. Everything chosen is printed."""
    from mathutils import Vector

    altitude_deg, apparent_deg, azimuth_deg, provenance = baked_sun(bake, view)
    location = sphinx_viewpoint(view["from_object"], view["location"]) if "from_object" in view else Vector(view["location"])
    target = Vector(view["target"])
    make_camera(scene, location, target, view["lens"])

    if name == "cutaway":
        g1 = bpy.data.objects.get("G1 Khufu (as built)")
        if g1 is not None:
            make_translucent(g1, 0.15)

    print(f"view {name}: sun altitude {altitude_deg:.3f} deg, seen at {apparent_deg:.3f} deg, azimuth {azimuth_deg:.3f} deg ({provenance})")
    build_world(scene, apparent_deg, azimuth_deg, view.get("fill", 0.0))
    build_sun(scene, altitude_deg, apparent_deg, azimuth_deg)
    if view.get("stars"):
        build_star_dome(scene, bake, location)
    scene.view_settings.exposure = view.get("exposure", 0.0)
    describe_camera(location, target, view["lens"], scene.view_settings.exposure)


def choose_engine(scene, requested):
    """
    Cycles, because the sky texture, the sun's penumbra and eight thousand
    emissive points all want a path tracer. Its identifier is not in the engine
    enum until the add-on registers it, so the assignment is tried rather than
    looked up, and EEVEE is the fallback for a build without it.
    """
    for engine in ([requested] if requested else []) + ["CYCLES", "BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"]:
        try:
            scene.render.engine = engine
        except TypeError:
            continue
        return engine
    raise RuntimeError("no usable render engine")


def configure_render(scene, opts):
    """Engine, samples and frame size from the options; returns the engine's name."""
    engine = choose_engine(scene, opts["engine"])
    samples = int(opts["samples"])
    if engine.startswith("BLENDER_EEVEE"):
        scene.eevee.taa_render_samples = samples
    elif engine == "CYCLES":
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
    scene.render.resolution_x = int(opts["width"])
    scene.render.resolution_y = int(opts["height"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    return engine, samples


def main():
    opts = parse_args({"out": "build/hero.png", "width": "1600", "height": "900", "samples": "128", "engine": "", "view": "dawn", "bake": SKY_BAKE})
    scene = bpy.context.scene
    if opts["view"] not in VIEWS:
        raise SystemExit(f"unknown view {opts['view']!r}; choose from {sorted(VIEWS)}")
    view = VIEWS[opts["view"]]

    assign_materials()
    show_ground_only()
    setup_view(scene, opts["view"], view, load_bake(opts["bake"]))
    engine, samples = configure_render(scene, opts)
    out = os.path.abspath(opts["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scene.render.filepath = out
    started = time.time()
    bpy.ops.render.render(write_still=True)
    elapsed = time.time() - started
    print(f"rendered {out} with {engine}, {samples} samples, in {elapsed:.1f} s ({elapsed / 60:.1f} min)")


if __name__ == "__main__":
    main()
