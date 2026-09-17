"""
Render a still of the generated scene, headless:

    blender -b build/seked.blend -P blender/render.py -- --out build/dawn.png [--view dawn|panorama|harbour|cutaway|akhet|night] [--state built|today|ancient] [--sphinx lion] [--capstone stone|gold] [--air on|off|<thickness>] [--standins on|off] [--reconstruction on|off] [--location x,y,z --target x,y,z --lens mm] [--width 1600 --height 900 --samples 128]

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

from render_materials import CAPSTONE, STRUCTURE_LABELS, assign_materials, dress_as_built, draw_as_section, make_translucent  # noqa: E402
from render_reconstruction import build_reconstructions  # noqa: E402
from render_standins import build_standins, cut_enclosure  # noqa: E402
from render_sky import DOME_RADIUS_M, SKY_BAKE, baked_sun, build_atmosphere, build_milky_way, build_star_dome, build_sun, build_world, load_bake  # noqa: E402

# Where the akhet view stands relative to the Sphinx: back along the line it
# looks out on, far enough that the whole statue is in the frame with the two
# pyramids beyond it, and high enough to see over its back. A bearing, a
# distance and a height, all of them composition; the point they are measured
# from is the box's own cited position.
# Recomposed when the OSM Sphinx replaced the box. The box stood on the datum
# plane with its top at 20 m; the Sphinx really stands in its hollow with its
# head's top 19 m below Khufu's base, and from the old standoff, 26 m over the
# box and 170 m back, it fell below the bottom of the frame. Closer and lower,
# with a wider lens, puts the head and the line of the back in the foreground
# against the notch, which is what the view was always meant to show.
SPHINX_STANDOFF = {"bearing_deg": 114.0, "distance_m": 110.0, "height_m": 6.0}

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
        # Close in from the east-south-east and a little above the King's
        # Chamber, so the passages fill the frame rather than sit in the
        # middle distance with two other pyramids over them. The old station,
        # 430 m out at 130 m up, framed the plateau and left the interior a
        # pale smudge inside a pale pyramid; this one is inside the Pyramid's
        # own footprint looking down the line of the Gallery.
        "moment": "equinox-sunrise-plus-hour",
        "location": (215.0, 95.0, 96.0),
        "target": (2.0, 6.0, 46.0),
        "lens": 55.0,
        "casing_alpha": 0.05,
        "exposure": -4.6,
        "fill": 0.0,
        "placeholder_sun": (35.0, 135.0),
    },
    "panorama": {
        # The three pyramids from the desert south of them, Menkaure on the
        # left and Khufu on the right, under the December sun an hour before it
        # sets in the south-west: the south faces take the light full on, the
        # east faces fall into shadow, and the west edges catch it. From here
        # Khafre and Menkaure show their shaded east faces and Khufu a lit
        # sliver of his west one, which is what gives the three their depth.
        "moment": "solstice-winter-sunset-minus-hour",
        "location": (-100.0, -1700.0, 60.0),
        "target": (-300.0, -370.0, 58.0),
        "lens": 45.0,
        "air_thickness": 0.15,
        "look": "AgX - Punchy",
        "exposure": -3.3,
        "fill": 0.0,
        "placeholder_sun": (10.3, 234.5),
    },
    "harbour": {
        # From the air north-east of the Sphinx, looking down across the harbour
        # basin and the valley temples to the Sphinx in its enclosure and the
        # causeway climbing to Khafre. Made for the built state, where the
        # reconstruction supplies the temples, the basin and the causeways.
        "moment": "equinox-sunrise-plus-hour",
        "location": (520.0, -330.0, 45.0),
        "target": (320.0, -450.0, -35.0),
        "lens": 30.0,
        "exposure": -4.2,
        "fill": 0.0,
        "placeholder_sun": (6.0, 90.0),
    },
    "akhet": {
        # Looking at the middle of the gap between the Great Pyramid's
        # south-west corner and Khafre's north-east one, which is C6's own
        # target, from a stand in front of the Sphinx. The camera is taken off
        # the Sphinx itself, so it follows the footprint import instead of
        # repeating its coordinates; the location here is what is used if the
        # Sphinx is not in the scene.
        "moment": "solstice-summer-sunset",
        "location": (503.1, -501.5, 46.2),
        # The Sphinx's head where the footprint import built one, and the old
        # box otherwise; the first of these the scene carries is used.
        "from_object": ("Great Sphinx, head", "Sphinx (massing placeholder)"),
        "target": (-206.4, -132.1, 67.1),
        "lens": 35.0,
        "exposure": -2.0,
        "fill": 0.0,
        "placeholder_sun": (-0.833, 298.0),
    },
    "section": {
        # The Great Pyramid in elevation from due east through a casing left
        # almost clear, an orthographic camera so it reads as a section
        # drawing: the passages, the chambers and the four shafts in place, at
        # their true slopes, with nothing foreshortened. The frame is wide
        # enough for the whole pyramid and deep enough for the subterranean
        # chamber under it.
        #
        # This one is a drawing and not a photograph, and says so: no terrain,
        # no sky, no sun. See `drawing` below for why.
        "moment": "equinox-sunrise-plus-hour",
        "location": (700.0, 0.0, 58.0),
        "target": (0.0, 0.0, 58.0),
        "lens": 50.0,
        # Wide enough for the 230 m base and tall enough for the apex at
        # 146.6 m and the subterranean chamber 30 m under the pavement, so
        # the whole of what was measured is in the frame and none of it is
        # cropped to make a picture.
        "ortho_scale": 340.0,
        "casing_alpha": 0.22,
        "exposure": 0.0,
        "fill": 0.0,
        "drawing": (0.055, 0.061, 0.072),
        "drawing_line": (0.06, 0.065, 0.075, 1.1),
        "drawing_structure": "g1",
        "placeholder_sun": (35.0, 135.0),
    },
    "sphinx": {
        # The postcard: the Sphinx from the east, close, in the morning sun
        # that lights its face, Khafre's pyramid behind it and Khufu's to the
        # right. A composition, not a claim.
        "moment": "equinox-sunrise-plus-hour",
        "location": (392.0, -462.0, -26.0),
        "target": (318.0, -425.0, -31.0),
        "lens": 30.0,
        "exposure": -4.2,
        "fill": 0.0,
        "placeholder_sun": (12.0, 97.0),
    },
    "section-g3": {
        # Menkaure's pyramid in elevation from due east, drawn like the Great
        # Pyramid's section: his apartments as the route lays them, from the
        # entrance down the corridor to the panelled antechamber, the
        # portcullises and the large chamber. The camera stands on his own
        # centre, which is Petrie's offset from Khufu's.
        "moment": "equinox-sunrise-plus-hour",
        "location": (-174.45, -739.19, 24.0),
        "target": (-574.45, -739.19, 24.0),
        "lens": 50.0,
        "ortho_scale": 165.0,
        "casing_alpha": 0.22,
        "exposure": 0.0,
        "fill": 0.0,
        "drawing": (0.055, 0.061, 0.072),
        "drawing_line": (0.06, 0.065, 0.075, 1.1),
        "drawing_structure": "g3",
        "placeholder_sun": (35.0, 135.0),
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
    they are measured from is the Sphinx object's own bounding box, the head's
    where the footprint import built one, so the viewpoint follows the data
    instead of repeating it.
    """
    from mathutils import Vector

    names = (name,) if isinstance(name, str) else tuple(name)
    obj = next((bpy.data.objects.get(n) for n in names if bpy.data.objects.get(n) is not None), None)
    if obj is None:
        print(f"WARNING: none of {names!r} is in the scene; standing at the fallback viewpoint instead.")
        return Vector(fallback)
    print(f"  standing off {obj.name!r}")
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


def make_camera(scene, location, target, lens, name="Hero camera", clip_end=4.0 * DOME_RADIUS_M, ortho_scale=None):
    """A camera at a place, looking at a point, with a far clip past the star dome; orthographic if an `ortho_scale` is given."""
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam_data.clip_end = clip_end
    if ortho_scale is not None:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    cam.location = location
    look_at(cam, target)
    scene.camera = cam
    return cam


# The terrain that renders: the flattened ground and the coarse ring that
# carries the horizon past it. The GLO-30 context grid they were cut from
# stays hidden.
RENDERED_TERRAIN = ("Terrain (ground)", "Terrain (far context)")


def describe_camera(location, target, lens, exposure):
    towards = target - location
    bearing = math.degrees(math.atan2(towards.x, towards.y)) % 360.0
    pitch = math.degrees(math.atan2(towards.z, math.hypot(towards.x, towards.y)))
    print(f"  camera at ({location.x:.1f}, {location.y:.1f}, {location.z:.1f}) m looking at ({target.x:.1f}, {target.y:.1f}, {target.z:.1f}) m")
    print(f"  bearing {bearing:.1f} deg, pitch {pitch:+.1f} deg, {lens:.0f} mm, exposure {exposure:+.1f} stops")


def build_backdrop(scene, colour):
    """
    A flat world for a drawing: one colour, lighting everything in the frame
    evenly and standing behind it as the paper does. No sky texture and no sun
    lamp, because neither of them is what a section is a picture of, and
    because a physical sky over a ghosted pyramid buries the thing the drawing
    is for. The colour is the view's own, dark enough that the near-white
    masonry and the inked interior both read against it.
    """
    world = bpy.data.worlds.new("Seked backdrop")
    scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputWorld")
    background = tree.nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = (colour[0], colour[1], colour[2], 1.0)
    background.inputs["Strength"].default_value = 1.0
    tree.links.new(background.outputs[0], out.inputs["Surface"])
    for lamp in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(lamp, do_unlink=True)


def draw_outlines(scene, line):
    """
    A hairline on every silhouette and crease, which is the half of a section
    drawing that shading cannot do. Without it the passages are pale shapes on
    a pale pyramid; with it they are drawn objects, and the eight faces, the
    arrises and the gable on Campbell's chamber all read as edges rather than
    as a change of tone.

    Freestyle draws these in image space, after the trace, so it finds the
    interior solids through the ghosted casing exactly as it finds the casing
    against the backdrop. `line` is the colour and the thickness in pixels.
    """
    colour, thickness = line[:3], line[3]
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = "ABSOLUTE"
    scene.render.line_thickness = thickness
    layer = scene.view_layers[0]
    layer.use_freestyle = True
    settings = layer.freestyle_settings
    for existing in list(settings.linesets):
        settings.linesets.remove(existing)
    lineset = settings.linesets.new("Seked outline")
    lineset.select_silhouette = True
    lineset.select_border = True
    lineset.select_contour = True
    lineset.select_external_contour = False
    lineset.select_edge_mark = False
    # No creases. A crease test is "sharper than", and the sharpest folds in
    # this scene are the Grand Gallery's seven corbel steps, which run the
    # whole length of the gallery and come out as hatching over the one solid
    # the drawing most needs to read. Outlines are what a section draws.
    lineset.select_crease = False
    # A section shows what the stone hides, but only just. Freestyle counts
    # how many surfaces stand between an edge and the camera, and the range
    # here is nought to one: an edge seen through the casing alone is drawn,
    # and an edge seen through the casing and then through a solid's own far
    # wall is not. Without the limit the Grand Gallery's corbel steps come
    # back twice over, near side and far, and the one solid the drawing most
    # needs to read comes out hatched.
    lineset.select_by_visibility = True
    lineset.visibility = "RANGE"
    lineset.qi_start = 0
    lineset.qi_end = 1
    lineset.linestyle.color = colour
    lineset.linestyle.thickness = thickness
    print(f"drawing: outlines at {thickness:.1f} px, freestyle {scene.render.use_freestyle}, linesets {len(settings.linesets)}")


def setup_view(scene, name, view, bake, air=True):
    """The camera, the sun, the sky and, for the night view, the stars. Everything chosen is printed."""
    from mathutils import Vector

    location = sphinx_viewpoint(view["from_object"], view["location"]) if "from_object" in view else Vector(view["location"])
    target = Vector(view["target"])
    make_camera(scene, location, target, view["lens"], ortho_scale=view.get("ortho_scale"))

    backdrop = view.get("drawing")
    if backdrop is None:
        altitude_deg, apparent_deg, azimuth_deg, provenance = baked_sun(bake, view)
        print(f"view {name}: sun altitude {altitude_deg:.3f} deg, seen at {apparent_deg:.3f} deg, azimuth {azimuth_deg:.3f} deg ({provenance})")
        build_world(scene, apparent_deg, azimuth_deg, view.get("fill", 0.0))
        build_sun(scene, altitude_deg, apparent_deg, azimuth_deg)
    else:
        print(f"view {name}: a drawing, so no sun and no sky; every surface carries its own value")
        build_backdrop(scene, backdrop)
        if "drawing_line" in view:
            draw_outlines(scene, view["drawing_line"])

    # A drawing has already built its shell translucent, at a value of its own;
    # this is the photographic path, where the casing keeps its own material
    # and only loses its opacity.
    if backdrop is None and (name == "cutaway" or "casing_alpha" in view):
        g1 = bpy.data.objects.get("G1 Khufu (as built)")
        if g1 is not None:
            make_translucent(g1, view.get("casing_alpha", 0.15))

    if air and backdrop is None and not view.get("stars") and view.get("air", True):
        # A view seen across kilometres of desert thins the air so the far
        # plateau is not lost in it; the factor is a look choice like the air itself.
        build_atmosphere(scene, (0.0, 0.0), view.get("air_thickness", 1.0) * (air if isinstance(air, float) else 1.0))
    if view.get("stars"):
        build_star_dome(scene, bake, location)
        build_milky_way(scene, bake)
    if view.get("look"):
        # A grade, chosen per view like the exposure: AgX's punchy look holds the
        # shadow side of a face down where the default leaves it grey.
        scene.view_settings.look = view["look"]
    scene.view_settings.exposure = view.get("exposure", 0.0)
    describe_camera(location, target, view["lens"], scene.view_settings.exposure)


def show_ground_only(drawing=False):
    """
    Of the three terrain objects the generator writes, render the two that are
    ground: "Terrain (ground)", the near grid flattened under the pyramids, and
    "Terrain (far context)", the coarse ring that carries the horizon out to
    twelve kilometres. The raw GLO-30 grid stays hidden, because it lies under
    the flattened one and turns the monuments into mounds. Both are shaded
    smooth: a grid this coarse is a sampled landscape, not a field of facets.

    A drawing gets none of them. An elevation is drawn against nothing, and a
    desert behind a ghosted pyramid is what turned the first section render
    into pale on pale.
    """
    for obj in bpy.data.objects:
        if not obj.name.startswith("Terrain"):
            continue
        visible = not drawing and obj.name in RENDERED_TERRAIN
        obj.hide_set(not visible)
        obj.hide_render = not visible
        if visible:
            for poly in obj.data.polygons:
                poly.use_smooth = True


def show_state(state):
    """
    Which pyramids are drawn: "built", the default, is each as it was finished,
    cased and pointed; "today" is each as it stands, where the scene has a
    "(today)" object for it, and as built where it does not, which is said.
    Khafre's today carries his cap of casing; Khufu's is his stepped core.
    """
    if state not in ("built", "today", "ancient"):
        raise SystemExit(f"unknown state {state!r}; choose built, today or ancient")
    # "ancient" is the built plateau with the claims about its age shown in place of the
    # mainstream Sphinx, so the pyramids are drawn exactly as they are for "built".
    state = "built" if state == "ancient" else state
    for label in STRUCTURE_LABELS.values():
        built, today = bpy.data.objects.get(f"{label} (as built)"), bpy.data.objects.get(f"{label} (today)")
        use_today = state == "today" and today is not None
        if state == "today" and today is None:
            print(f"state today: {label} has no (today) object, so it is drawn as built")
        for obj, visible in ((built, not use_today), (today, use_today)):
            if obj is not None:
                obj.hide_set(not visible)
                obj.hide_render = not visible


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


def use_gpu(scene, requested="auto"):
    """
    Render Cycles on the GPU when there is one, and say which device it chose.

    Every render in this project ran on the CPU until the plateau was populated
    and a 1080p frame of the film took a minute. Cycles only uses a GPU when the
    Cycles add-on's preferences name a compute backend and the scene asks for
    the GPU, and a headless run does neither by itself. OptiX is tried first
    because it is the faster backend on an RTX card, then CUDA, HIP, oneAPI and
    Metal, and the CPU is what is left. `--device cpu` forces the CPU, which is
    the way to reproduce a render bit for bit on another machine; the two
    devices converge on the same image but not on the same noise.
    """
    if scene.render.engine != "CYCLES" or requested == "cpu":
        scene.cycles.device = "CPU" if scene.render.engine == "CYCLES" else getattr(scene.cycles, "device", "CPU")
        return "CPU"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except KeyError:
        return "CPU"
    for backend in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.refresh_devices() if hasattr(prefs, "refresh_devices") else prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if not gpus:
            continue
        for d in prefs.devices:
            d.use = d.type == backend
        scene.cycles.device = "GPU"
        return f"{backend} ({', '.join(d.name for d in gpus)})"
    scene.cycles.device = "CPU"
    return "CPU"


def configure_render(scene, opts):
    """Engine, samples and frame size from the options; returns the engine's name."""
    engine = choose_engine(scene, opts["engine"])
    device = use_gpu(scene, opts.get("device", "auto"))
    print(f"  rendering on {device}")
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
    # Eight bits and full compression. These frames are delivered images, not
    # working files, and a section drawn in four flat values gains nothing
    # from sixteen bits a channel while costing about twice the bytes; every
    # one of them is kept in docs/progress/log/, so the bytes are a real cost.
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 100
    return engine, samples


def main():
    opts = parse_args({"out": "build/hero.png", "width": "1600", "height": "900", "samples": "128", "engine": "", "device": "auto", "view": "dawn", "state": "built", "sphinx": "", "capstone": "stone", "air": "on", "standins": "on", "reconstruction": "on", "location": "", "target": "", "lens": "", "bake": SKY_BAKE})
    scene = bpy.context.scene
    if opts["view"] not in VIEWS:
        raise SystemExit(f"unknown view {opts['view']!r}; choose from {sorted(VIEWS)}")
    view = VIEWS[opts["view"]]
    # A camera moved for one render, to look at something the named views do
    # not frame, keeps everything else about the view: its moment and light.
    view = dict(view)
    for key in ("location", "target"):
        if opts[key]:
            view[key] = tuple(float(v) for v in opts[key].split(","))
            view.pop("from_object", None)
    if opts["lens"]:
        view["lens"] = float(opts["lens"])

    drawing = "drawing" in view
    CAPSTONE["finish"] = opts["capstone"]
    assign_materials()
    show_state(opts["state"])
    dress_as_built(opts["state"])
    if not drawing and opts["standins"] != "off":
        if opts["reconstruction"] != "off":
            build_reconstructions(scene, opts["state"], standin_sphinx=True)
    if not drawing and opts["standins"] != "off":
        build_standins(scene, opts["state"], [v for v in (opts["sphinx"],) if v])
        cut_enclosure(scene)
    if drawing:
        draw_as_section(view["drawing_structure"], view["casing_alpha"])
    show_ground_only(drawing)
    air = False if opts["air"] == "off" else (True if opts["air"] == "on" else float(opts["air"]))
    setup_view(scene, opts["view"], view, load_bake(opts["bake"]), air)
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
