"""
People for the walkthrough's crowds: figures generated with Meshy's text to 3D from the
prompts under `figures` in blender/models.json, instanced like every other variant.

Every figure is a look choice. Meshy was given a prompt and made a person of it; nothing
about a figure's body, face, clothing or proportions is a measurement, a reconstruction
of anyone, or evidence of how anyone at Giza dressed, and the height each is drawn at is
chosen here (LOOK), not measured. Every object carries that label ("seked_figure") with
its generation's licence and attribution.

    library(parent, era, log=print)

returns a collection of the era's figures, linked under `parent`, or None for an era
that has no figures or none on disk. The as-built era gets four Old Kingdom figures (a
labourer, a porter, a priest, a woman), stripped and today three present-day tourists,
and the claim's two eras none (ERAS). The collection is a set of variants exactly as
variants.collection makes them: one object per figure, named "<collection> NN" so
Collection Info picks them in that order, each parked at variants.PARKED so only its
instances render. Each figure's mesh stands on z = 0 with the middle of its feet at the
origin and faces +Y, and its object carries no rotation or scale (Collection Info resets
them), so instancing.field and scatter.people place it as they place the capsules of
variants.library's "people": a point's `rot` turns it about its feet, its `scl` scales it.

A figure's GLB is found through build/models/index.json, which `python scripts/models.py`
writes, and imported by the old renderer's importer (blender/render_standins.py), as
render/giza/sphinx.py imports its stand-in: the GLB's meshes joined with their transforms
applied and Meshy's materials kept. It is then decimated to about FACES triangles, turned
by its LOOK `turn` to face +Y (Meshy's figures face glTF +Z, which imports as -Y), scaled
to its LOOK height and stood on its feet at the origin. `library` checks the facing by
the feet, whose toes reach further forward than the shins above them, and says so when a
figure seems to face away.

The materials keep Meshy's base colour, roughness, metallic and normal maps, cut down to
TEXTURE_PX on a side, which is plenty for a figure seen from ten metres or more. The
alpha is never used: a figure is opaque, and a texture's alpha (or the zero alpha in an
atlas's padding) would punch holes in it that cost every ray in a crowd a transparent
bounce, or show black past `transparent_max_bounces`. Emission is off, and the roughness
map is read into ROUGHNESS so bare skin does not shine. Each instance's `tone` (0..1,
written by the scatter) moves the figure's brightness and saturation by a few per cent,
so a crowd of four people is not four clones.

    blender -b --factory-startup -P render/giza/figures.py -- test --era built
    blender -b --factory-startup -P render/giza/figures.py -- sheet --era today

`test` renders a few dozen figures on sand at 10, 25 and 60 m from a camera in the late
afternoon sun; `sheet` stands an era's figures side by side a few metres away. Both write
into build/figures/.
"""
import io
import json
import math
import os
import sys
import time

import numpy as np

if __name__ == "__main__" and not __package__:
    # Run as a script inside Blender (see _main): make the package importable and join it.
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    __package__ = "giza"

from . import data  # noqa: E402

try:
    import bpy
    from mathutils import Matrix
except ImportError:          # the tables are read by plain-Python tests
    bpy = None

BLENDER_DIR = os.path.join(data.REPO, "blender")
MANIFEST = os.path.join(BLENDER_DIR, "models.json")
INDEX = os.path.join(data.REPO, "build", "models", "index.json")
OUT = os.path.join(data.REPO, "build", "figures")
PARKED = (0.0, 0.0, -20000.0)      # where the originals wait, as variants.PARKED

FACES = 10000                      # triangles a figure is decimated to (a look choice)
TEXTURE_PX = 1024                  # the most pixels on a side its textures keep (a look and memory choice)
SHARP_DEG = 60.0                   # faces meeting at more than this keep a hard edge (a look choice)
TONE = dict(value=(0.92, 1.08), saturation=(0.9, 1.1))   # what an instance's tone moves (a look choice)
# Meshy's roughness map, 0..1, is read into this range: as generated, bare skin shines like
# oiled wood in a low sun. The smoothest texels gain most; linen, already rough, hardly moves.
ROUGHNESS = (0.25, 1.0)            # a look choice

# Which figures each era's crowds are drawn from, in Collection Info's order.
OLD_KINGDOM = ("figure-labourer", "figure-porter", "figure-priest", "figure-woman")
TOURISTS = ("figure-tourist-hat", "figure-tourist-backpack", "figure-tourist-camera")
ERAS = {"built": OLD_KINGDOM, "stripped": TOURISTS, "today": TOURISTS}

# LOOK CHOICES, every one. `height`: metres from the soles to the top of whatever is
# highest (the hair, the hat's crown), chosen for a natural stature, not measured; `turn`:
# degrees about Z that bring the generated figure round to face +Y.
LOOK = {
    "figure-labourer": dict(height=1.66, turn=180.0),
    "figure-porter": dict(height=1.64, turn=180.0),
    "figure-priest": dict(height=1.70, turn=180.0),
    "figure-woman": dict(height=1.57, turn=180.0),
    "figure-tourist-hat": dict(height=1.74, turn=180.0),
    "figure-tourist-backpack": dict(height=1.77, turn=180.0),
    "figure-tourist-camera": dict(height=1.75, turn=180.0),
}


def manifest_figures():
    """The manifest's figures by id."""
    with io.open(MANIFEST, encoding="utf-8") as f:
        return {m["id"]: m for m in json.load(f).get("figures", [])}


def _index():
    if not os.path.exists(INDEX):
        return {}
    with io.open(INDEX, encoding="utf-8") as f:
        index = json.load(f)
    return index.get("models", index)


def _triangles(me):
    return int(sum(len(p.vertices) - 2 for p in me.polygons))


def _coords(me):
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def _toes_forward(co):
    """How far the feet reach ahead (+Y) of the shins, metres: positive when the figure faces +Y."""
    z0, z1 = co[:, 2].min(), co[:, 2].max()
    h = z1 - z0
    feet = co[co[:, 2] < z0 + 0.04 * h]
    shins = co[(co[:, 2] > z0 + 0.18 * h) & (co[:, 2] < z0 + 0.28 * h)]
    if len(feet) == 0 or len(shins) == 0:
        return 0.0
    return float(feet[:, 1].mean() - shins[:, 1].mean())


def _stand(me, height, turn_deg):
    """Turn the mesh about Z, scale it to `height` and stand it on z = 0 with the middle of its feet at the origin."""
    me.transform(Matrix.Rotation(math.radians(turn_deg), 4, "Z"))
    co = _coords(me)
    z0, z1 = float(co[:, 2].min()), float(co[:, 2].max())
    feet = co[co[:, 2] < z0 + 0.03 * (z1 - z0)]
    cx, cy = float(feet[:, 0].mean()), float(feet[:, 1].mean())
    s = height / (z1 - z0)
    me.transform(Matrix.Scale(s, 4) @ Matrix.Translation((-cx, -cy, -z0)))
    me.update()
    return s


def _normals(me):
    """
    Normals from the decimated surface itself: smooth, and sharp only where faces meet at
    more than SHARP_DEG (a hat's brim, a jar's lip). The GLB's custom normals are dropped,
    because they are stored against each corner's own frame, which decimation has moved.
    """
    if "custom_normal" in me.attributes:
        me.attributes.remove(me.attributes["custom_normal"])
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(SHARP_DEG))


def _opaque(mat, texture_px):
    """
    Keep Meshy's maps, drop what would trouble Cycles: the alpha (never linked, 1.0, and the
    colour image read without its alpha channel), any emission, and textures larger than
    `texture_px`. Read the roughness into ROUGHNESS, and let the instance's tone move
    brightness and saturation a little.
    """
    tree = mat.node_tree if mat is not None else None
    if tree is None:
        return
    for nd in tree.nodes:
        if nd.type == "TEX_IMAGE" and nd.image is not None:
            img = nd.image
            # The alpha mode first: changing it reloads the image from its packed file, which would undo a scale.
            if img.colorspace_settings.name != "Non-Color" and img.alpha_mode != "NONE":
                img.alpha_mode = "NONE"
            if img.size[0] > texture_px or img.size[1] > texture_px:
                img.scale(min(img.size[0], texture_px), min(img.size[1], texture_px))
    for bsdf in (nd for nd in tree.nodes if nd.type == "BSDF_PRINCIPLED"):
        alpha = bsdf.inputs["Alpha"]
        for link in list(alpha.links):
            tree.links.remove(link)
        alpha.default_value = 1.0
        for link in list(bsdf.inputs["Emission Strength"].links):
            tree.links.remove(link)
        bsdf.inputs["Emission Strength"].default_value = 0.0
        if mat.get("seked_figure_material"):
            continue
        mat["seked_figure_material"] = True
        rough = bsdf.inputs["Roughness"]
        if rough.is_linked:
            mr = tree.nodes.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = ROUGHNESS
            tree.links.new(rough.links[0].from_socket, mr.inputs["Value"])
            tree.links.new(mr.outputs["Result"], rough)
        else:
            rough.default_value = ROUGHNESS[0] + (ROUGHNESS[1] - ROUGHNESS[0]) * rough.default_value
        base = bsdf.inputs["Base Color"]
        if not base.is_linked:
            continue
        src = base.links[0].from_socket
        tone = tree.nodes.new("ShaderNodeAttribute")
        tone.attribute_type = "INSTANCER"
        tone.attribute_name = "tone"
        hsv = tree.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs["Hue"].default_value = 0.5
        for key, (lo, hi) in TONE.items():
            mr = tree.nodes.new("ShaderNodeMapRange")
            mr.inputs["To Min"].default_value = lo
            mr.inputs["To Max"].default_value = hi
            tree.links.new(tone.outputs["Fac"], mr.inputs["Value"])
            tree.links.new(mr.outputs["Result"], hsv.inputs[key.capitalize()])
        tree.links.new(src, hsv.inputs["Color"])
        tree.links.new(hsv.outputs["Color"], base)
    try:
        mat.blend_method = "OPAQUE"        # EEVEE's setting; Cycles reads the Alpha socket, set above
    except (AttributeError, TypeError):
        pass


def figure(model, path, name, look, faces=FACES, texture_px=TEXTURE_PX, log=print):
    """One figure from its GLB: imported, decimated, turned to +Y, scaled, stood on its feet, labelled."""
    if BLENDER_DIR not in sys.path:
        sys.path.insert(0, BLENDER_DIR)
    import render_standins as rs   # the old renderer's importer, which runs inside Blender

    had = set(bpy.data.meshes)
    mesh = rs.import_model(path, name, keep_materials=True)
    before = _triangles(mesh)
    obj = rs.cut_and_reduce(mesh, None, faces)
    me = obj.data
    # The importer leaves the GLB's own meshes behind with no users; drop those, and only those.
    for left in set(bpy.data.meshes) - had:
        if left.users == 0:
            bpy.data.meshes.remove(left)
    scale = _stand(me, look["height"], look["turn"])
    reach = _toes_forward(_coords(me))
    _normals(me)
    for mat in me.materials:
        _opaque(mat, texture_px)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    obj.location = PARKED
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    obj["seked_figure"] = (f"look choice: {model['name']}, generated by Meshy from a text prompt; "
                           "nothing of its form is a measurement")
    obj["seked_license"] = model["license"]
    obj["seked_attribution"] = model["attribution"]
    obj["figure"] = model["id"]
    obj["height"] = look["height"]
    tris = _triangles(me)
    log(f"figure {model['id']}: {before:,} -> {tris:,} triangles, {look['height']:.2f} m (x{scale:.3f}), "
        f"turned {look['turn']:.0f} deg, toes {reach * 100:+.1f} cm ahead of the shins"
        + ("" if reach > 0 else "; WARNING: it seems to face -Y, check LOOK['turn']"))
    return obj, tris


def library(parent, era, log=print, faces=FACES, texture_px=TEXTURE_PX):
    """
    The era's figures as a collection of variants linked under `parent`, in ERAS order, or
    None when the era has none or none of its GLBs is on disk (`python scripts/models.py`
    puts them there). Each object is "<collection> NN", parked at PARKED.
    """
    wanted = ERAS.get(era)
    if not wanted:
        return None
    t0 = time.time()
    models = manifest_figures()
    index = _index()
    name = f"v figures {era}"
    coll = None
    got = []
    for fid in wanted:
        entry, model = index.get(fid), models.get(fid)
        path = os.path.join(data.REPO, "build", "models", entry["file"]) if entry else None
        if model is None or path is None or not os.path.exists(path):
            log(f"figures: {fid} is not on disk (python scripts/models.py fetches it; python scripts/meshy.py generate {fid} makes it)")
            continue
        if coll is None:
            coll = bpy.data.collections.new(name)
            parent.children.link(coll)
        obj, tris = figure(model, path, fid, LOOK[fid], faces, texture_px, log)
        obj.name = f"{name} {len(got):02d}"
        coll.objects.link(obj)
        got.append((fid, tris))
    if coll is None:
        log(f"figures: none of {', '.join(wanted)} is on disk; the {era} era has no figures")
        return None
    log(f"figures {era}: {', '.join(f for f, _ in got)} ({sum(t for _, t in got):,} triangles) in {time.time() - t0:.1f}s")
    return coll


# --- Looking at them ----------------------------------------------------------------------

def _reset():
    from . import instancing, materials
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials._IMAGES.clear()
    instancing._GROUP = None


def _ground(state, coll, half=3000.0):
    """A flat square of the era's ground at z = 0."""
    from . import materials
    me = bpy.data.meshes.new("test ground")
    me.from_pydata([(-half, -half, 0.0), (half, -half, 0.0), (half, half, 0.0), (-half, half, 0.0)], [], [(0, 1, 2, 3)])
    me.materials.append(materials.ground(state))
    ob = bpy.data.objects.new("test ground", me)
    coll.objects.link(ob)
    return ob


def _scene(opts, era):
    """A reset scene with the era's ground, sky, late afternoon sun and figures; returns (scene, world, figures, log)."""
    from . import renderer, states, sun
    from .sky import Sky
    t0 = time.time()
    log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)
    _reset()
    scene = bpy.context.scene
    world = bpy.data.collections.new("world")
    scene.collection.children.link(world)
    lib = bpy.data.collections.new("library")
    scene.collection.children.link(lib)
    state = era if era in states.STATES else "today"
    _ground(state, world)
    coll = library(lib, era, log)
    if coll is None:
        raise SystemExit(f"no figures for {era!r}")
    sky = Sky(scene, coll=world)
    alt, az, _ = sun.sun_at(10, 20, float(opts.get("solar", 16.2)), year=states.spec(state)["year"])
    sky.set_sun(alt, az)
    log(f"sun at {alt:.1f} deg altitude, {az:.1f} deg azimuth")
    renderer.gpu(scene, log)
    renderer.configure(scene)
    return scene, world, coll, log


def _test(opts):
    """A few dozen figures at 10, 25 and 60 m from a camera looking north, the sun low behind its left shoulder."""
    from . import cameras, renderer
    from .instancing import field
    era = opts.get("era", "built")
    scene, world, coll, log = _scene(opts, era)
    n = len(coll.objects)
    rng = np.random.default_rng(int(opts.get("seed", 3)))
    pos, rot, var = [], [], []
    for dist, count, spread in ((10.0, 5, 3.0), (25.0, 10, 8.0), (60.0, 20, 20.0)):
        xs = np.linspace(-spread, spread, count) + rng.uniform(-0.3, 0.3, count) * spread / count
        for i, x in enumerate(xs):
            pos.append((x, dist + rng.uniform(-1.5, 1.5), 0.0))
            # Most face the camera (-Y) give or take, some turn aside, a few walk away.
            face = rng.choice([math.pi, math.pi, math.pi, math.pi / 2, -math.pi / 2, 0.0])
            rot.append((0.0, 0.0, face + rng.uniform(-0.5, 0.5)))
            var.append(i % n if dist < 20 else int(rng.integers(0, n)))
    pos = np.array(pos)
    s = rng.uniform(0.94, 1.05, len(pos))
    field("figures", coll, pos, np.array(rot), np.stack([s, s, s], 1), np.array(var), rng.random(len(pos)),
          np.zeros(len(pos)), world, log)
    cam = cameras.make(scene)
    cameras.frame(cam, (0.0, 0.0, 1.7), (0.0, 60.0, 0.9), float(opts.get("lens", 50.0)))
    w, h = (int(v) for v in opts.get("size", "1280x720").split("x"))
    out = os.path.abspath(opts.get("out", os.path.join(OUT, f"test-{era}.png")))
    t = time.time()
    renderer.render(scene, out, w, h, int(opts.get("samples", 64)))
    log(f"rendered {out} in {time.time() - t:.0f}s")


def _sheet(opts):
    """The era's figures side by side, facing the camera from a few metres, for looking at each one."""
    from . import cameras, renderer
    from .instancing import field
    era = opts.get("era", "built")
    scene, world, coll, log = _scene(opts, era)
    n = len(coll.objects)
    gap = 1.0
    xs = (np.arange(n) - (n - 1) / 2) * gap
    pos = np.stack([xs, np.zeros(n), np.zeros(n)], 1)
    rot = np.array([(0.0, 0.0, math.pi + float(opts.get("yaw", 0.0)))] * n)
    field("figures", coll, pos, rot, np.ones((n, 3)), np.arange(n), np.full(n, 0.5), np.zeros(n), world, log)
    cam = cameras.make(scene)
    d = float(opts.get("distance", 2.2 + 1.1 * n))
    cameras.frame(cam, (0.0, -d, 1.0), (0.0, 0.0, 0.85), float(opts.get("lens", 50.0)))
    w, h = (int(v) for v in opts.get("size", "1280x720").split("x"))
    out = os.path.abspath(opts.get("out", os.path.join(OUT, f"sheet-{era}.png")))
    t = time.time()
    renderer.render(scene, out, w, h, int(opts.get("samples", 64)))
    log(f"rendered {out} in {time.time() - t:.0f}s")


def _opts(argv):
    o, it = {}, iter(argv)
    for k in it:
        o[k.lstrip("-")] = next(it, "1")
    return o


def _main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    cmd = argv[0] if argv else "test"
    opts = _opts(argv[1:])
    if cmd == "test":
        _test(opts)
    elif cmd == "sheet":
        _sheet(opts)
    else:
        raise SystemExit(f"unknown command {cmd!r}: test or sheet")


if __name__ == "__main__":
    _main()
